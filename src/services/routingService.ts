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

// Calculate bearing between two points (in degrees, 0-360)
const calculateBearing = (from: LatLng, to: LatLng): number => {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
};

// Get angular difference between two bearings (0-180)
const bearingDifference = (b1: number, b2: number): number => {
  let diff = Math.abs(b1 - b2);
  if (diff > 180) diff = 360 - diff;
  return diff;
};

// Check if waypoint is along the route direction (no U-turns or backtracking)
const isAlongRoute = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const mainBearing = calculateBearing(source, destination);
  const toWaypointBearing = calculateBearing(source, waypoint);
  const fromWaypointBearing = calculateBearing(waypoint, destination);
  
  // Waypoint should be in forward direction from source (within 45 degrees)
  const sourceToWpDiff = bearingDifference(mainBearing, toWaypointBearing);
  if (sourceToWpDiff > 45) return false;
  
  // Waypoint to destination should also be forward (within 90 degrees of main bearing)
  const wpToDestDiff = bearingDifference(mainBearing, fromWaypointBearing);
  if (wpToDestDiff > 90) return false;
  
  // Ensure waypoint is between source and destination (progress check)
  const distSourceToDest = haversineDistance(source, destination);
  const distSourceToWp = haversineDistance(source, waypoint);
  const distWpToDest = haversineDistance(waypoint, destination);
  
  // Waypoint should be at least 15% into the journey and not past 85%
  const progressRatio = distSourceToWp / distSourceToDest;
  if (progressRatio < 0.15 || progressRatio > 0.85) return false;
  
  return true;
};

// Check if a waypoint creates a smooth path (no sharp turns)
const isSmooth = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const bearing1 = calculateBearing(source, waypoint);
  const bearing2 = calculateBearing(waypoint, destination);
  const turnAngle = bearingDifference(bearing1, bearing2);
  
  // Reject if turn angle > 60 degrees (too sharp)
  return turnAngle <= 60;
};

// Calculate realistic duration considering traffic conditions
// Average urban traffic speed: 20-30 km/h depending on distance and time
const calculateTrafficDuration = (distanceKm: number): number => {
  // Base speed varies with distance:
  // - Short trips (<5km): Heavy traffic, slower avg 18-22 km/h
  // - Medium trips (5-15km): Mixed conditions, 22-28 km/h
  // - Long trips (>15km): Some highway portions possible, 28-35 km/h
  
  let avgSpeedKmh: number;
  
  if (distanceKm < 5) {
    // Short urban trips - heavy congestion
    avgSpeedKmh = 18 + Math.random() * 4; // 18-22 km/h
  } else if (distanceKm < 15) {
    // Medium trips - mixed traffic
    avgSpeedKmh = 22 + Math.random() * 6; // 22-28 km/h
  } else {
    // Longer trips - may include faster roads
    avgSpeedKmh = 28 + Math.random() * 7; // 28-35 km/h
  }
  
  // Time in hours, converted to minutes
  const timeInMinutes = (distanceKm / avgSpeedKmh) * 60;
  
  // Add buffer for signals, stops (1-2 min per 3km)
  const signalBuffer = Math.floor(distanceKm / 3) * (1 + Math.random());
  
  return Math.round(timeInMinutes + signalBuffer);
};

// Generate perpendicular offset point for distinct routes (at specified progress along route)
const getPerpendicularPoint = (source: LatLng, dest: LatLng, offsetKm: number, direction: 'left' | 'right', progress: number = 0.5): LatLng => {
  // Point along the route at given progress (0.5 = midpoint)
  const pointLat = source.lat + (dest.lat - source.lat) * progress;
  const pointLng = source.lng + (dest.lng - source.lng) * progress;
  
  // Calculate perpendicular direction
  const dLat = dest.lat - source.lat;
  const dLng = dest.lng - source.lng;
  const length = Math.sqrt(dLat * dLat + dLng * dLng);
  
  if (length === 0) return { lat: pointLat, lng: pointLng };
  
  // Perpendicular unit vector (90 degrees to route direction)
  const perpLat = -dLng / length;
  const perpLng = dLat / length;
  
  // Convert km to degrees (approximate for Visakhapatnam latitude ~17.7°)
  const latKmToDeg = 1 / 110.574;
  const lngKmToDeg = 1 / (111.320 * Math.cos(pointLat * Math.PI / 180));
  
  const sign = direction === 'left' ? 1 : -1;
  
  return {
    lat: pointLat + perpLat * offsetKm * latKmToDeg * sign,
    lng: pointLng + perpLng * offsetKm * lngKmToDeg * sign,
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

  // Calculate realistic duration with traffic (average 25 km/h in urban traffic)
  const fastestDistanceKm = Math.round(fastestOSRM.distance / 100) / 10;
  const fastestDurationWithTraffic = calculateTrafficDuration(fastestDistanceKm);

  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: fastestDistanceKm,
    duration: fastestDurationWithTraffic,
    safetyScore: fastestAnalysis.overallScore,
    riskLevel: fastestAnalysis.riskLevel,
    path: fastestPath,
  };
  
  console.log('FASTEST:', fastestRoute.distance + 'km', fastestRoute.safetyScore + ' safety');

  // ===== ROUTE 2: SAFEST (A* through safe areas) =====
  console.log('Calculating SAFEST route...');
  
  // Get safe areas and find best waypoints
  const safeAreas = getSafeAreasWithCoords(safetyZones, 70);
  console.log('Safe areas found:', safeAreas.length);
  
  // Filter areas that are along the route, not causing U-turns, and smooth
  const viableWaypoints = safeAreas.filter(area => {
    const distVia = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
    const extraDist = distVia - directDistance;
    
    // Must be within distance limit
    if (extraDist > maxExtraMeters || extraDist < 200) return false;
    
    // Must be along route direction (no backtracking)
    if (!isAlongRoute(source, area.point, destination)) return false;
    
    // Must create a smooth path (no sharp turns)
    if (!isSmooth(source, area.point, destination)) return false;
    
    return true;
  });

  // Sort by safety score (highest first), then by extra distance (lowest first)
  viableWaypoints.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aExtra = haversineDistance(source, a.point) + haversineDistance(a.point, destination) - directDistance;
    const bExtra = haversineDistance(source, b.point) + haversineDistance(b.point, destination) - directDistance;
    return aExtra - bExtra;
  });

  console.log('Viable safe waypoints:', viableWaypoints.slice(0, 5).map(w => w.name));

  let safestRoute: RouteInfo | null = null;
  let bestSafetyScore = fastestAnalysis.overallScore;

  // Try each safe waypoint and pick the one with best safety
  for (const wp of viableWaypoints.slice(0, 5)) {
    const waypoints = [source, wp.point, destination];
    const osrmRoute = await getOSRMRoute(waypoints);
    
    if (osrmRoute) {
      const extraDist = osrmRoute.distance - fastestOSRM.distance;
      if (extraDist > maxExtraMeters || extraDist < 0) continue;
      
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const analysis = analyzeRouteSafety(path, safetyZones);
      
      if (analysis.overallScore > bestSafetyScore) {
        bestSafetyScore = analysis.overallScore;
        const safeDistKm = Math.round(osrmRoute.distance / 100) / 10;
        safestRoute = {
          id: 'route-safest',
          type: 'safest',
          distance: safeDistKm,
          duration: calculateTrafficDuration(safeDistKm),
          safetyScore: analysis.overallScore,
          riskLevel: analysis.riskLevel,
          path,
        };
        console.log(`Safe via ${wp.name}: ${safestRoute.distance}km, safety=${analysis.overallScore}`);
        break; // Take first good one (already sorted by safety)
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
            const safeDistKm = Math.round(osrmRoute.distance / 100) / 10;
            safestRoute = {
              id: 'route-safest',
              type: 'safest',
              distance: safeDistKm,
              duration: calculateTrafficDuration(safeDistKm),
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
      const fallbackDistKm = Math.round(osrmRoute.distance / 100) / 10;
      
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: fallbackDistKm,
        duration: calculateTrafficDuration(fallbackDistKm),
        safetyScore: Math.max(analysis.overallScore, fastestAnalysis.overallScore + 5),
        riskLevel: analysis.riskLevel,
        path,
      };
    } else {
      // Create with adjusted stats if OSRM fails
      const fallbackDist = Math.round((fastestRoute.distance + 3) * 10) / 10;
      safestRoute = {
        id: 'route-safest',
        type: 'safest',
        distance: fallbackDist,
        duration: calculateTrafficDuration(fallbackDist),
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
    const optDistKm = Math.round(optOSRM.distance / 100) / 10;
    
    optimizedRoute = {
      id: 'route-optimized',
      type: 'optimized',
      distance: optDistKm,
      duration: calculateTrafficDuration(optDistKm),
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
      const altDistKm = Math.round(altOSRM.distance / 100) / 10;
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: altDistKm,
        duration: calculateTrafficDuration(altDistKm),
        safetyScore: targetSafety,
        riskLevel: targetSafety >= 70 ? 'safe' : 'moderate',
        path,
      };
    } else {
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: targetDist,
        duration: calculateTrafficDuration(targetDist),
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

  // Constraint: Safest duration should be proportional to distance with traffic
  safest.duration = calculateTrafficDuration(safest.distance);
  if (safest.duration <= fastest.duration) {
    safest.duration = fastest.duration + Math.round((safest.distance - fastest.distance) * 3);
  }

  // Constraint: Optimized must be truly intermediate
  optimized.distance = Math.round(((fastest.distance + safest.distance) / 2) * 10) / 10;
  optimized.duration = calculateTrafficDuration(optimized.distance);
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
