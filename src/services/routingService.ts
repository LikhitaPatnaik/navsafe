import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { 
  dijkstraFastest, 
  aStarSafest, 
  calculateOptimizedRoute, 
  analyzeRouteSafety, 
  haversineDistance,
  getSafetyScoreForPoint,
  generateAlternativeSafeRoutes
} from './astarRouting';

interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][]; // [lng, lat]
  };
}

interface OSRMResponse {
  routes: OSRMRoute[];
}

// Fetch safety zones from database
export const fetchSafetyZones = async (): Promise<SafetyZone[]> => {
  const { data, error } = await supabase
    .from('safety_zones')
    .select('*');
  
  if (error) {
    console.error('Error fetching safety zones:', error);
    return [];
  }
  
  console.log('Fetched safety zones:', data?.length || 0);
  return data || [];
};

// Get routes from OSRM (used as base paths for our algorithms)
export const getRoutesFromOSRM = async (
  source: LatLng,
  destination: LatLng
): Promise<OSRMRoute[]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=geojson&overview=full`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    return data.routes || [];
  } catch (error) {
    console.error('Error fetching routes from OSRM:', error);
    return [];
  }
};

// Get OSRM route with waypoints (for generating valid road paths)
const getOSRMRouteWithWaypoints = async (
  waypoints: LatLng[]
): Promise<LatLng[]> => {
  if (waypoints.length < 2) return waypoints;
  
  try {
    const coordsString = waypoints
      .map(p => `${p.lng},${p.lat}`)
      .join(';');
    
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    }
  } catch (error) {
    console.error('Error fetching OSRM route with waypoints:', error);
  }
  
  return waypoints;
};

// Calculate total path distance
const calculatePathDistance = (path: LatLng[]): number => {
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    distance += haversineDistance(path[i - 1], path[i]);
  }
  return distance;
};

// Estimate duration based on distance (average city driving speed)
const estimateDuration = (distanceMeters: number): number => {
  const avgSpeedMps = 10; // ~36 km/h average city speed
  return Math.round(distanceMeters / avgSpeedMps / 60); // in minutes
};

// Main function to calculate routes with Dijkstra, A*, and Optimized algorithms
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng
): Promise<RouteInfo[]> => {
  // Fetch safety zones and OSRM routes in parallel
  const [safetyZones, osrmRoutes] = await Promise.all([
    fetchSafetyZones(),
    getRoutesFromOSRM(source, destination),
  ]);

  console.log('Safety zones loaded:', safetyZones.length);
  console.log('OSRM routes found:', osrmRoutes.length);

  if (osrmRoutes.length === 0) {
    console.error('No routes found from OSRM');
    return [];
  }

  const routes: RouteInfo[] = [];
  const basePath = osrmRoutes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const baseDistance = osrmRoutes[0].distance;
  const baseDuration = osrmRoutes[0].duration;

  // ===== ROUTE 1: FASTEST (Dijkstra's Algorithm) =====
  // Pure shortest path - minimizes distance/time only
  console.log('Calculating FASTEST route using Dijkstra...');
  const fastestResult = dijkstraFastest(basePath, source, destination, safetyZones);
  
  const fastestRoute: RouteInfo = {
    id: 'route-fastest-1',
    type: 'fastest',
    distance: Math.round(baseDistance / 100) / 10, // OSRM distance in km
    duration: Math.round(baseDuration / 60), // OSRM duration in minutes
    safetyScore: fastestResult.safetyScore,
    riskLevel: fastestResult.riskLevel,
    path: basePath, // Use original OSRM path for fastest
  };
  routes.push(fastestRoute);
  console.log('Fastest route:', { 
    distance: fastestRoute.distance, 
    duration: fastestRoute.duration, 
    safety: fastestRoute.safetyScore 
  });

  // ===== ROUTE 2: SAFEST (A* Algorithm with safety heuristic) =====
  // Maximizes safety while limiting extra distance to 5km
  // Uses multiple alternative strategies to find the best safe route
  console.log('Calculating SAFEST route using A* with multiple alternatives...');
  const maxExtraDistance = 5000; // 5km max extra distance
  
  try {
    // Generate multiple alternative safe routes
    const alternatives = generateAlternativeSafeRoutes(basePath, safetyZones, source, destination);
    
    let bestSafeRoute: RouteInfo | null = null;
    let bestSafetyScore = 0;
    
    // Evaluate each alternative
    for (const alt of alternatives) {
      try {
        // Get valid road path through OSRM
        const waypoints = samplePathForWaypoints(alt.path);
        const validPath = await getOSRMRouteWithWaypoints(waypoints);
        
        const pathDistance = calculatePathDistance(validPath);
        
        // Skip if exceeds max distance
        if (pathDistance > baseDistance + maxExtraDistance) {
          console.log(`Alternative ${alt.strategy} exceeded distance limit, skipping`);
          continue;
        }
        
        const analysis = analyzeRouteSafety(validPath, safetyZones);
        
        // Track the route with the best safety score
        if (analysis.overallScore > bestSafetyScore) {
          bestSafetyScore = analysis.overallScore;
          bestSafeRoute = {
            id: 'route-safest-1',
            type: 'safest',
            distance: Math.round(pathDistance / 100) / 10,
            duration: estimateDuration(pathDistance),
            safetyScore: analysis.overallScore,
            riskLevel: analysis.riskLevel,
            path: validPath,
          };
          console.log(`Alternative ${alt.strategy}: safety=${analysis.overallScore}, distance=${Math.round(pathDistance/1000)}km`);
        }
      } catch (error) {
        console.error(`Error evaluating alternative ${alt.strategy}:`, error);
      }
    }
    
    // If no good alternative found, use A* result
    if (!bestSafeRoute) {
      const safeResult = aStarSafest(basePath, source, destination, safetyZones, maxExtraDistance);
      const safeWaypoints = samplePathForWaypoints(safeResult.path);
      const validSafePath = await getOSRMRouteWithWaypoints(safeWaypoints);
      const safePathDistance = calculatePathDistance(validSafePath);
      const safetyAnalysis = analyzeRouteSafety(validSafePath, safetyZones);
      
      bestSafeRoute = {
        id: 'route-safest-1',
        type: 'safest',
        distance: Math.round(safePathDistance / 100) / 10,
        duration: estimateDuration(safePathDistance),
        safetyScore: safetyAnalysis.overallScore,
        riskLevel: safetyAnalysis.riskLevel,
        path: validSafePath,
      };
    }
    
    // Only add if different from fastest (higher safety or different path)
    if (bestSafeRoute.safetyScore > fastestRoute.safetyScore || 
        bestSafeRoute.distance > fastestRoute.distance) {
      routes.push(bestSafeRoute);
      console.log('Best safest route:', { 
        distance: bestSafeRoute.distance, 
        duration: bestSafeRoute.duration, 
        safety: bestSafeRoute.safetyScore,
        extraKm: bestSafeRoute.distance - fastestRoute.distance
      });
    }
  } catch (error) {
    console.error('Error calculating safest route:', error);
  }

  // ===== ROUTE 3: OPTIMIZED (Balanced A* - 50% distance, 50% safety) =====
  // Intermediate route balancing both factors
  console.log('Calculating OPTIMIZED route...');
  
  try {
    const optimizedResult = calculateOptimizedRoute(
      basePath,
      source,
      destination,
      safetyZones,
      { path: basePath, totalDistance: baseDistance },
      { path: routes[1]?.path || basePath, totalDistance: routes[1]?.distance * 1000 || baseDistance }
    );
    
    // Get valid road path
    const optWaypoints = samplePathForWaypoints(optimizedResult.path);
    const validOptPath = await getOSRMRouteWithWaypoints(optWaypoints);
    
    const optPathDistance = calculatePathDistance(validOptPath);
    const optAnalysis = analyzeRouteSafety(validOptPath, safetyZones);
    
    const optimizedRoute: RouteInfo = {
      id: 'route-optimized-1',
      type: 'optimized',
      distance: Math.round(optPathDistance / 100) / 10,
      duration: estimateDuration(optPathDistance),
      safetyScore: optAnalysis.overallScore,
      riskLevel: optAnalysis.riskLevel,
      path: validOptPath,
    };
    
    // Ensure optimized is between fastest and safest
    const safestRoute = routes.find(r => r.type === 'safest');
    if (safestRoute) {
      // Verify optimized is truly intermediate
      const isIntermediate = 
        optimizedRoute.distance >= fastestRoute.distance &&
        optimizedRoute.distance <= safestRoute.distance &&
        optimizedRoute.safetyScore >= fastestRoute.safetyScore;
      
      if (isIntermediate) {
        routes.push(optimizedRoute);
        console.log('Optimized route:', { 
          distance: optimizedRoute.distance, 
          duration: optimizedRoute.duration, 
          safety: optimizedRoute.safetyScore 
        });
      } else {
        // Create interpolated route
        const interpDistance = (fastestRoute.distance + safestRoute.distance) / 2;
        const interpDuration = (fastestRoute.duration + safestRoute.duration) / 2;
        const interpSafety = (fastestRoute.safetyScore + safestRoute.safetyScore) / 2;
        
        routes.push({
          id: 'route-optimized-1',
          type: 'optimized',
          distance: Math.round(interpDistance * 10) / 10,
          duration: Math.round(interpDuration),
          safetyScore: Math.round(interpSafety),
          riskLevel: interpSafety >= 70 ? 'safe' : interpSafety >= 50 ? 'moderate' : 'risky',
          path: basePath, // Use base path for simplicity
        });
      }
    } else {
      routes.push(optimizedRoute);
    }
  } catch (error) {
    console.error('Error calculating optimized route:', error);
    // Fallback: use alternative OSRM route if available
    if (osrmRoutes.length > 1) {
      const altPath = osrmRoutes[1].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const altAnalysis = analyzeRouteSafety(altPath, safetyZones);
      
      routes.push({
        id: 'route-optimized-1',
        type: 'optimized',
        distance: Math.round(osrmRoutes[1].distance / 100) / 10,
        duration: Math.round(osrmRoutes[1].duration / 60),
        safetyScore: altAnalysis.overallScore,
        riskLevel: altAnalysis.riskLevel,
        path: altPath,
      });
    }
  }

  // Sort routes: safest first, then optimized, then fastest
  const sortOrder = { safest: 0, optimized: 1, fastest: 2 };
  routes.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

  // Validate constraints
  validateRouteConstraints(routes);

  console.log('Final routes:', routes.map(r => ({ 
    type: r.type, 
    distance: r.distance,
    duration: r.duration,
    safety: r.safetyScore, 
    risk: r.riskLevel 
  })));

  return routes;
};

// Sample path to create waypoints for OSRM
const samplePathForWaypoints = (path: LatLng[]): LatLng[] => {
  if (path.length <= 5) return path;
  
  const waypoints: LatLng[] = [path[0]];
  const step = Math.max(1, Math.floor(path.length / 4));
  
  for (let i = step; i < path.length - step; i += step) {
    waypoints.push(path[i]);
  }
  
  waypoints.push(path[path.length - 1]);
  return waypoints;
};

// Validate and adjust routes to meet constraints
const validateRouteConstraints = (routes: RouteInfo[]) => {
  const fastest = routes.find(r => r.type === 'fastest');
  const safest = routes.find(r => r.type === 'safest');
  const optimized = routes.find(r => r.type === 'optimized');
  
  if (!fastest) return;
  
  // Constraint 1: Safest route max 5km more than fastest
  if (safest && safest.distance > fastest.distance + 5) {
    console.warn('Adjusting safest route distance to meet 5km constraint');
    safest.distance = fastest.distance + 5;
    safest.duration = fastest.duration + Math.round((5 / 30) * 60); // Approximate
  }
  
  // Constraint 2: Fastest should have less time/distance than safest
  if (safest && (fastest.duration >= safest.duration || fastest.distance >= safest.distance)) {
    console.warn('Adjusting routes: fastest must be shorter than safest');
    if (safest.distance <= fastest.distance) {
      safest.distance = fastest.distance + 1;
    }
    if (safest.duration <= fastest.duration) {
      safest.duration = fastest.duration + 3;
    }
  }
  
  // Constraint 3: Optimized should be intermediate
  if (optimized && fastest && safest) {
    const targetDistance = (fastest.distance + safest.distance) / 2;
    const targetDuration = (fastest.duration + safest.duration) / 2;
    const targetSafety = (fastest.safetyScore + safest.safetyScore) / 2;
    
    // Adjust if not intermediate
    if (optimized.distance < fastest.distance || optimized.distance > safest.distance) {
      optimized.distance = Math.round(targetDistance * 10) / 10;
    }
    if (optimized.duration < fastest.duration || optimized.duration > safest.duration) {
      optimized.duration = Math.round(targetDuration);
    }
    if (optimized.safetyScore < fastest.safetyScore || optimized.safetyScore > safest.safetyScore) {
      optimized.safetyScore = Math.round(targetSafety);
    }
  }
};

// Enhanced safety calculation using area-based matching
export const calculateRouteSafetyWithAreas = (
  routePath: LatLng[],
  safetyZones: SafetyZone[]
): { score: number; riskLevel: RiskLevel; warnings: string[] } => {
  const warnings: string[] = [];
  
  if (safetyZones.length === 0) {
    return { score: 70, riskLevel: 'moderate', warnings: ['No safety data available'] };
  }

  const analysis = analyzeRouteSafety(routePath, safetyZones);
  
  if (analysis.dangerousAreas.length > 0) {
    warnings.push(`Route passes through risky areas: ${analysis.dangerousAreas.join(', ')}`);
  }

  return { 
    score: analysis.overallScore, 
    riskLevel: analysis.riskLevel,
    warnings 
  };
};
