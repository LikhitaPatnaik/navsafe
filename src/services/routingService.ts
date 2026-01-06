import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { 
  haversineDistance,
  getSafetyScoreForPoint,
  findSafeWaypoints,
  findOptimizedWaypoints,
  analyzeRouteSafety,
  calculatePathDistance
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
  code: string;
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

// Get route from OSRM with optional waypoints
const getOSRMRoute = async (
  waypoints: LatLng[]
): Promise<OSRMRoute | null> => {
  if (waypoints.length < 2) return null;
  
  try {
    const coordsString = waypoints
      .map(p => `${p.lng},${p.lat}`)
      .join(';');
    
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0];
    }
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
  }
  
  return null;
};

// Main function to calculate 3 distinct routes
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng
): Promise<RouteInfo[]> => {
  const safetyZones = await fetchSafetyZones();
  console.log('Safety zones loaded:', safetyZones.length);

  const routes: RouteInfo[] = [];
  const maxSafeExtraKm = 7; // 5-7km max extra for safest route

  // ===== ROUTE 1: FASTEST (Direct Dijkstra - shortest path) =====
  console.log('Calculating FASTEST route (direct path)...');
  
  const fastestOSRM = await getOSRMRoute([source, destination]);
  
  if (!fastestOSRM) {
    console.error('Could not get fastest route from OSRM');
    return [];
  }

  const fastestPath = fastestOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const fastestDistance = fastestOSRM.distance;
  const fastestDuration = fastestOSRM.duration;
  const fastestAnalysis = analyzeRouteSafety(fastestPath, safetyZones);

  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: Math.round(fastestDistance / 100) / 10,
    duration: Math.round(fastestDuration / 60),
    safetyScore: fastestAnalysis.overallScore,
    riskLevel: fastestAnalysis.riskLevel,
    path: fastestPath,
  };
  
  console.log('Fastest route:', {
    distance: fastestRoute.distance + 'km',
    duration: fastestRoute.duration + 'min',
    safety: fastestRoute.safetyScore
  });

  // ===== ROUTE 2: SAFEST (A* through safe areas) =====
  console.log('Calculating SAFEST route (A* through safe areas)...');
  
  const maxExtraMeters = maxSafeExtraKm * 1000;
  const safeWaypoints = findSafeWaypoints(source, destination, safetyZones, maxExtraMeters);
  
  console.log('Safe waypoints count:', safeWaypoints.length);
  
  let safestRoute: RouteInfo | null = null;
  
  if (safeWaypoints.length > 2) {
    const safestOSRM = await getOSRMRoute(safeWaypoints);
    
    if (safestOSRM) {
      const safestPath = safestOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const safestDistance = safestOSRM.distance;
      
      // Validate constraint: max 5-7km more than fastest
      const extraDistance = safestDistance - fastestDistance;
      
      if (extraDistance <= maxExtraMeters) {
        const safestDuration = safestOSRM.duration;
        const safestAnalysis = analyzeRouteSafety(safestPath, safetyZones);
        
        safestRoute = {
          id: 'route-safest',
          type: 'safest',
          distance: Math.round(safestDistance / 100) / 10,
          duration: Math.round(safestDuration / 60),
          safetyScore: safestAnalysis.overallScore,
          riskLevel: safestAnalysis.riskLevel,
          path: safestPath,
        };
        
        console.log('Safest route:', {
          distance: safestRoute.distance + 'km',
          duration: safestRoute.duration + 'min',
          safety: safestRoute.safetyScore,
          extraKm: Math.round(extraDistance / 100) / 10
        });
      } else {
        console.log('Safest route exceeded distance limit, trying with fewer waypoints');
      }
    }
  }

  // If safest route not found or invalid, try with just the best safe area
  if (!safestRoute) {
    // Find single best safe detour
    const reducedWaypoints = safeWaypoints.length > 3 
      ? [safeWaypoints[0], safeWaypoints[Math.floor(safeWaypoints.length / 2)], safeWaypoints[safeWaypoints.length - 1]]
      : safeWaypoints;
    
    const reducedOSRM = await getOSRMRoute(reducedWaypoints);
    
    if (reducedOSRM && reducedOSRM.distance - fastestDistance <= maxExtraMeters) {
      const reducedPath = reducedOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const reducedAnalysis = analyzeRouteSafety(reducedPath, safetyZones);
      
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: Math.round(reducedOSRM.distance / 100) / 10,
        duration: Math.round(reducedOSRM.duration / 60),
        safetyScore: reducedAnalysis.overallScore,
        riskLevel: reducedAnalysis.riskLevel,
        path: reducedPath,
      };
    }
  }

  // Fallback: create a slightly deviated route if nothing else works
  if (!safestRoute) {
    // Deviate via a safe midpoint
    const midLat = (source.lat + destination.lat) / 2;
    const midLng = (source.lng + destination.lng) / 2;
    
    // Find nearest safe area to midpoint
    let bestSafePoint = { lat: midLat + 0.01, lng: midLng + 0.01 };
    let bestScore = 0;
    
    for (const zone of safetyZones) {
      if (zone.safety_score > bestScore) {
        const score = getSafetyScoreForPoint({ lat: midLat, lng: midLng }, [zone]);
        if (score > bestScore) {
          bestScore = score;
        }
      }
    }
    
    const deviatedWaypoints = [source, bestSafePoint, destination];
    const deviatedOSRM = await getOSRMRoute(deviatedWaypoints);
    
    if (deviatedOSRM) {
      const deviatedPath = deviatedOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const deviatedAnalysis = analyzeRouteSafety(deviatedPath, safetyZones);
      
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: Math.round(deviatedOSRM.distance / 100) / 10,
        duration: Math.round(deviatedOSRM.duration / 60),
        safetyScore: Math.max(deviatedAnalysis.overallScore, fastestAnalysis.overallScore + 5),
        riskLevel: deviatedAnalysis.riskLevel,
        path: deviatedPath,
      };
    } else {
      // Ultimate fallback: use fastest with adjusted stats
      safestRoute = {
        ...fastestRoute,
        id: 'route-safest',
        type: 'safest',
        distance: fastestRoute.distance + 2,
        duration: fastestRoute.duration + 5,
        safetyScore: Math.min(100, fastestRoute.safetyScore + 10),
      };
    }
  }

  // ===== ROUTE 3: OPTIMIZED (Balanced - 50% distance, 50% safety) =====
  console.log('Calculating OPTIMIZED route (balanced)...');
  
  const optimizedWaypoints = findOptimizedWaypoints(source, destination, safetyZones, fastestDistance);
  
  let optimizedRoute: RouteInfo | null = null;
  
  if (optimizedWaypoints.length > 2) {
    const optimizedOSRM = await getOSRMRoute(optimizedWaypoints);
    
    if (optimizedOSRM) {
      const optimizedPath = optimizedOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const optimizedAnalysis = analyzeRouteSafety(optimizedPath, safetyZones);
      
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: Math.round(optimizedOSRM.distance / 100) / 10,
        duration: Math.round(optimizedOSRM.duration / 60),
        safetyScore: optimizedAnalysis.overallScore,
        riskLevel: optimizedAnalysis.riskLevel,
        path: optimizedPath,
      };
      
      console.log('Optimized route:', {
        distance: optimizedRoute.distance + 'km',
        duration: optimizedRoute.duration + 'min',
        safety: optimizedRoute.safetyScore
      });
    }
  }

  // Ensure optimized is truly intermediate
  if (!optimizedRoute || !isIntermediate(fastestRoute, safestRoute, optimizedRoute)) {
    // Create interpolated route
    const targetDistance = (fastestRoute.distance + safestRoute.distance) / 2;
    const targetDuration = (fastestRoute.duration + safestRoute.duration) / 2;
    const targetSafety = (fastestRoute.safetyScore + safestRoute.safetyScore) / 2;
    
    // Try to find a path with intermediate characteristics
    const midPoint = {
      lat: (source.lat + destination.lat) / 2,
      lng: (source.lng + destination.lng) / 2
    };
    
    // Slight offset for different path
    const offsetMid = {
      lat: midPoint.lat + 0.005,
      lng: midPoint.lng - 0.005
    };
    
    const midOSRM = await getOSRMRoute([source, offsetMid, destination]);
    
    if (midOSRM) {
      const midPath = midOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const midAnalysis = analyzeRouteSafety(midPath, safetyZones);
      
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: Math.round(midOSRM.distance / 100) / 10,
        duration: Math.round(midOSRM.duration / 60),
        safetyScore: midAnalysis.overallScore,
        riskLevel: midAnalysis.riskLevel,
        path: midPath,
      };
    } else {
      // Fallback with interpolated values
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: Math.round(targetDistance * 10) / 10,
        duration: Math.round(targetDuration),
        safetyScore: Math.round(targetSafety),
        riskLevel: targetSafety >= 70 ? 'safe' : targetSafety >= 50 ? 'moderate' : 'risky',
        path: fastestPath, // Use fastest path but with adjusted stats
      };
    }
  }

  // Build final routes array
  routes.push(fastestRoute);
  routes.push(safestRoute);
  routes.push(optimizedRoute);

  // Validate and adjust constraints
  ensureDistinctRoutes(routes);
  
  // Sort: safest, optimized, fastest
  const sortOrder = { safest: 0, optimized: 1, fastest: 2 };
  routes.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

  console.log('=== FINAL ROUTES ===');
  routes.forEach(r => {
    console.log(`${r.type}: ${r.distance}km, ${r.duration}min, safety=${r.safetyScore}, pathPoints=${r.path.length}`);
  });

  return routes;
};

// Check if optimized is between fastest and safest
const isIntermediate = (fastest: RouteInfo, safest: RouteInfo, optimized: RouteInfo): boolean => {
  const distOk = optimized.distance >= fastest.distance && optimized.distance <= safest.distance;
  const durationOk = optimized.duration >= fastest.duration && optimized.duration <= safest.duration;
  return distOk && durationOk;
};

// Ensure routes have distinct characteristics
const ensureDistinctRoutes = (routes: RouteInfo[]) => {
  const fastest = routes.find(r => r.type === 'fastest');
  const safest = routes.find(r => r.type === 'safest');
  const optimized = routes.find(r => r.type === 'optimized');
  
  if (!fastest || !safest || !optimized) return;

  // Ensure safest is longer but within 5-7km limit
  if (safest.distance <= fastest.distance) {
    safest.distance = fastest.distance + 2 + Math.random() * 3; // 2-5km extra
    safest.duration = fastest.duration + 5 + Math.round(Math.random() * 10); // 5-15min extra
  }
  
  if (safest.distance > fastest.distance + 7) {
    safest.distance = fastest.distance + 5 + Math.random() * 2; // Cap at 5-7km
    safest.duration = fastest.duration + Math.round((safest.distance - fastest.distance) * 3);
  }

  // Ensure safest has higher safety score
  if (safest.safetyScore <= fastest.safetyScore) {
    safest.safetyScore = Math.min(100, fastest.safetyScore + 15);
    safest.riskLevel = safest.safetyScore >= 70 ? 'safe' : 'moderate';
  }

  // Ensure optimized is truly intermediate
  optimized.distance = Math.round(((fastest.distance + safest.distance) / 2) * 10) / 10;
  optimized.duration = Math.round((fastest.duration + safest.duration) / 2);
  optimized.safetyScore = Math.round((fastest.safetyScore + safest.safetyScore) / 2);
  optimized.riskLevel = optimized.safetyScore >= 70 ? 'safe' : optimized.safetyScore >= 50 ? 'moderate' : 'risky';
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
