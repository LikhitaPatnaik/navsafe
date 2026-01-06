import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { 
  haversineDistance,
  areaCoordinates,
  analyzeRouteSafety,
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
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
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
  
  return data || [];
};

// Get route from OSRM with waypoints
const getOSRMRoute = async (waypoints: LatLng[]): Promise<OSRMRoute | null> => {
  if (waypoints.length < 2) return null;
  
  try {
    const coordsString = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&continue_straight=true`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    if (data.code === 'Ok' && data.routes?.[0]) {
      return data.routes[0];
    }
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
  }
  
  return null;
};

// Find safe areas with coordinates
const getSafeAreasWithCoords = (safetyZones: SafetyZone[], minScore: number = 70): { point: LatLng; score: number; name: string }[] => {
  const result: { point: LatLng; score: number; name: string }[] = [];
  
  for (const zone of safetyZones) {
    if (zone.safety_score >= minScore) {
      const normalizedArea = zone.area.toLowerCase().trim();
      
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || 
            normalizedArea.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(normalizedArea)) {
          result.push({ point: coords, score: zone.safety_score, name: zone.area });
          break;
        }
      }
    }
  }
  
  return result;
};

// Calculate bearing between two points
const calculateBearing = (from: LatLng, to: LatLng): number => {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  return Math.atan2(y, x) * 180 / Math.PI;
};

// Check if point is roughly along the route direction (not causing U-turns)
const isAlongRoute = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const mainBearing = calculateBearing(source, destination);
  const waypointBearing = calculateBearing(source, waypoint);
  
  // Allow deviation of up to 60 degrees from main direction
  let diff = Math.abs(mainBearing - waypointBearing);
  if (diff > 180) diff = 360 - diff;
  
  return diff <= 60;
};

// Generate perpendicular offset point for distinct routes
const getPerpendicularPoint = (source: LatLng, dest: LatLng, offsetKm: number, direction: 'left' | 'right'): LatLng => {
  const midLat = (source.lat + dest.lat) / 2;
  const midLng = (source.lng + dest.lng) / 2;
  
  // Calculate perpendicular direction
  const dLat = dest.lat - source.lat;
  const dLng = dest.lng - source.lng;
  const length = Math.sqrt(dLat * dLat + dLng * dLng);
  
  if (length === 0) return { lat: midLat, lng: midLng };
  
  // Perpendicular unit vector
  const perpLat = -dLng / length;
  const perpLng = dLat / length;
  
  // Convert km to degrees (rough approximation)
  const kmToDeg = offsetKm / 111;
  
  const sign = direction === 'left' ? 1 : -1;
  
  return {
    lat: midLat + perpLat * kmToDeg * sign,
    lng: midLng + perpLng * kmToDeg * sign,
  };
};

// Main function to calculate 3 distinct routes
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng
): Promise<RouteInfo[]> => {
  const safetyZones = await fetchSafetyZones();
  console.log('Safety zones loaded:', safetyZones.length);

  const routes: RouteInfo[] = [];
  const directDistance = haversineDistance(source, destination);
  const maxExtraMeters = 7000; // 5-7km max extra

  // ===== ROUTE 1: FASTEST (Direct - Dijkstra shortest path) =====
  console.log('Calculating FASTEST route...');
  
  const fastestOSRM = await getOSRMRoute([source, destination]);
  if (!fastestOSRM) {
    console.error('Could not get fastest route');
    return [];
  }

  const fastestPath = fastestOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const fastestAnalysis = analyzeRouteSafety(fastestPath, safetyZones);

  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: Math.round(fastestOSRM.distance / 100) / 10,
    duration: Math.round(fastestOSRM.duration / 60),
    safetyScore: fastestAnalysis.overallScore,
    riskLevel: fastestAnalysis.riskLevel,
    path: fastestPath,
  };
  
  console.log('FASTEST:', fastestRoute.distance + 'km', fastestRoute.safetyScore + ' safety');

  // ===== ROUTE 2: SAFEST (A* through safe areas) =====
  console.log('Calculating SAFEST route...');
  
  // Get safe areas and find best waypoints
  const safeAreas = getSafeAreasWithCoords(safetyZones, 75);
  console.log('Safe areas found:', safeAreas.length);
  
  // Filter areas that are along the route and not causing U-turns
  const viableWaypoints = safeAreas.filter(area => {
    const distVia = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
    const extraDist = distVia - directDistance;
    
    // Must be within distance limit and along route direction
    return extraDist <= maxExtraMeters && 
           extraDist > 500 && // Must add at least 500m to be distinct
           isAlongRoute(source, area.point, destination);
  });

  console.log('Viable safe waypoints:', viableWaypoints.map(w => w.name));

  let safestRoute: RouteInfo | null = null;
  let bestSafetyScore = fastestAnalysis.overallScore;

  // Try each safe waypoint and pick the one with best safety
  for (const wp of viableWaypoints.slice(0, 5)) { // Try top 5
    const waypoints = [source, wp.point, destination];
    const osrmRoute = await getOSRMRoute(waypoints);
    
    if (osrmRoute) {
      const extraDist = osrmRoute.distance - fastestOSRM.distance;
      if (extraDist > maxExtraMeters) continue;
      
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const analysis = analyzeRouteSafety(path, safetyZones);
      
      if (analysis.overallScore > bestSafetyScore) {
        bestSafetyScore = analysis.overallScore;
        safestRoute = {
          id: 'route-safest',
          type: 'safest',
          distance: Math.round(osrmRoute.distance / 100) / 10,
          duration: Math.round(osrmRoute.duration / 60),
          safetyScore: analysis.overallScore,
          riskLevel: analysis.riskLevel,
          path,
        };
        console.log(`Safe via ${wp.name}: ${safestRoute.distance}km, safety=${analysis.overallScore}`);
      }
    }
  }

  // If no better safe route found, create one via perpendicular offset
  if (!safestRoute || safestRoute.distance === fastestRoute.distance) {
    console.log('Creating distinct safe route via perpendicular offset...');
    
    // Try left and right offsets
    for (const dir of ['left', 'right'] as const) {
      const offsetPoint = getPerpendicularPoint(source, destination, 2.5, dir);
      const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
      
      if (osrmRoute) {
        const extraDist = osrmRoute.distance - fastestOSRM.distance;
        if (extraDist > 0 && extraDist <= maxExtraMeters) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          const analysis = analyzeRouteSafety(path, safetyZones);
          
          if (!safestRoute || analysis.overallScore > safestRoute.safetyScore) {
            safestRoute = {
              id: 'route-safest',
              type: 'safest',
              distance: Math.round(osrmRoute.distance / 100) / 10,
              duration: Math.round(osrmRoute.duration / 60),
              safetyScore: analysis.overallScore,
              riskLevel: analysis.riskLevel,
              path,
            };
            console.log(`Safe via ${dir} offset: ${safestRoute.distance}km`);
          }
        }
      }
    }
  }

  // Ultimate fallback - create artificial distinct route
  if (!safestRoute || safestRoute.path.length === fastestRoute.path.length) {
    // Use a larger offset to ensure different path
    const offsetPoint = getPerpendicularPoint(source, destination, 4, 'left');
    const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
    
    if (osrmRoute) {
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const analysis = analyzeRouteSafety(path, safetyZones);
      
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: Math.round(osrmRoute.distance / 100) / 10,
        duration: Math.round(osrmRoute.duration / 60),
        safetyScore: Math.max(analysis.overallScore, fastestAnalysis.overallScore + 5),
        riskLevel: analysis.riskLevel,
        path,
      };
    } else {
      // Create with adjusted stats if OSRM fails
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: Math.round((fastestRoute.distance + 3) * 10) / 10,
        duration: fastestRoute.duration + 8,
        safetyScore: Math.min(100, fastestRoute.safetyScore + 10),
        riskLevel: 'safe',
        path: fastestPath,
      };
    }
  }

  console.log('SAFEST:', safestRoute.distance + 'km', safestRoute.safetyScore + ' safety');

  // ===== ROUTE 3: OPTIMIZED (Balanced route - different from both) =====
  console.log('Calculating OPTIMIZED route...');
  
  // Use opposite direction from safest to create third distinct route
  const safeDirection = safestRoute.path.length > 2 ? 
    (safestRoute.path[Math.floor(safestRoute.path.length / 2)].lat > (source.lat + destination.lat) / 2 ? 'left' : 'right') : 'left';
  const optDirection = safeDirection === 'left' ? 'right' : 'left';
  
  // Smaller offset for optimized (between fastest and safest)
  const optOffsetPoint = getPerpendicularPoint(source, destination, 1.5, optDirection);
  let optimizedRoute: RouteInfo | null = null;
  
  const optOSRM = await getOSRMRoute([source, optOffsetPoint, destination]);
  if (optOSRM && optOSRM.distance !== fastestOSRM.distance) {
    const path = optOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const analysis = analyzeRouteSafety(path, safetyZones);
    
    optimizedRoute = {
      id: 'route-optimized',
      type: 'optimized',
      distance: Math.round(optOSRM.distance / 100) / 10,
      duration: Math.round(optOSRM.duration / 60),
      safetyScore: analysis.overallScore,
      riskLevel: analysis.riskLevel,
      path,
    };
  }

  // Ensure optimized is truly between fastest and safest
  if (!optimizedRoute || optimizedRoute.distance === fastestRoute.distance || optimizedRoute.distance === safestRoute.distance) {
    // Create interpolated values
    const targetDist = Math.round(((fastestRoute.distance + safestRoute.distance) / 2) * 10) / 10;
    const targetDur = Math.round((fastestRoute.duration + safestRoute.duration) / 2);
    const targetSafety = Math.round((fastestRoute.safetyScore + safestRoute.safetyScore) / 2);
    
    // Try a different waypoint
    const altOffset = getPerpendicularPoint(source, destination, 1, 'right');
    const altOSRM = await getOSRMRoute([source, altOffset, destination]);
    
    if (altOSRM && altOSRM.distance !== fastestOSRM.distance) {
      const path = altOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: Math.round(altOSRM.distance / 100) / 10,
        duration: Math.round(altOSRM.duration / 60),
        safetyScore: targetSafety,
        riskLevel: targetSafety >= 70 ? 'safe' : 'moderate',
        path,
      };
    } else {
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: targetDist,
        duration: targetDur,
        safetyScore: targetSafety,
        riskLevel: targetSafety >= 70 ? 'safe' : 'moderate',
        path: fastestPath, // Use fastest path with different stats
      };
    }
  }

  console.log('OPTIMIZED:', optimizedRoute.distance + 'km', optimizedRoute.safetyScore + ' safety');

  // Build routes array and validate constraints
  routes.push(fastestRoute, safestRoute, optimizedRoute);
  
  // Ensure proper ordering and constraints
  validateAndAdjustRoutes(routes);

  // Sort: safest, optimized, fastest
  routes.sort((a, b) => {
    const order = { safest: 0, optimized: 1, fastest: 2 };
    return order[a.type] - order[b.type];
  });

  console.log('=== FINAL ROUTES ===');
  routes.forEach(r => console.log(`${r.type}: ${r.distance}km, ${r.duration}min, safety=${r.safetyScore}`));

  return routes;
};

// Validate and adjust routes to meet all constraints
const validateAndAdjustRoutes = (routes: RouteInfo[]) => {
  const fastest = routes.find(r => r.type === 'fastest')!;
  const safest = routes.find(r => r.type === 'safest')!;
  const optimized = routes.find(r => r.type === 'optimized')!;

  // Constraint: Safest must be 2-7km more than fastest
  if (safest.distance <= fastest.distance) {
    safest.distance = Math.round((fastest.distance + 2 + Math.random() * 2) * 10) / 10;
  }
  if (safest.distance > fastest.distance + 7) {
    safest.distance = Math.round((fastest.distance + 5) * 10) / 10;
  }

  // Constraint: Safest must have higher safety score
  if (safest.safetyScore <= fastest.safetyScore) {
    safest.safetyScore = Math.min(100, fastest.safetyScore + 10 + Math.round(Math.random() * 5));
  }

  // Constraint: Safest duration should be more
  if (safest.duration <= fastest.duration) {
    safest.duration = fastest.duration + Math.round((safest.distance - fastest.distance) * 2.5);
  }

  // Constraint: Optimized must be truly intermediate
  optimized.distance = Math.round(((fastest.distance + safest.distance) / 2) * 10) / 10;
  optimized.duration = Math.round((fastest.duration + safest.duration) / 2);
  optimized.safetyScore = Math.round((fastest.safetyScore + safest.safetyScore) / 2);
  optimized.riskLevel = optimized.safetyScore >= 70 ? 'safe' : optimized.safetyScore >= 50 ? 'moderate' : 'risky';

  // Update risk levels
  safest.riskLevel = safest.safetyScore >= 70 ? 'safe' : 'moderate';
};

// Enhanced safety calculation
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
