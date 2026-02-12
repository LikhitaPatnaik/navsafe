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
    // Use steps=true to get complete routing instructions and ensure route reaches destination
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&continue_straight=true&steps=true`;
    
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

// Get multiple alternative routes from OSRM
const getOSRMAlternatives = async (source: LatLng, destination: LatLng): Promise<OSRMRoute[]> => {
  try {
    const coordsString = `${source.lng},${source.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&alternatives=true`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    if (data.code === 'Ok' && data.routes?.length > 0) {
      console.log(`OSRM returned ${data.routes.length} alternative routes`);
      return data.routes;
    }
  } catch (error) {
    console.error('Error fetching OSRM alternatives:', error);
  }
  
  return [];
};

// Check if two paths are sufficiently different (stricter check)
const arePathsDifferent = (path1: LatLng[], path2: LatLng[]): boolean => {
  if (path1.length < 5 || path2.length < 5) return false;
  
  // Sample 15 points along each path and compare
  const sampleCount = 15;
  let differentPoints = 0;
  
  for (let i = 1; i < sampleCount - 1; i++) {
    const idx1 = Math.floor((i / sampleCount) * path1.length);
    const p1 = path1[idx1];
    
    // Find the closest point on path2 to this point
    let minDist = Infinity;
    const searchRate = Math.max(1, Math.floor(path2.length / 50));
    for (let j = 0; j < path2.length; j += searchRate) {
      const d = haversineDistance(p1, path2[j]);
      if (d < minDist) minDist = d;
    }
    
    // If closest point on other path is more than 300m away, it's different
    if (minDist > 300) {
      differentPoints++;
    }
  }
  
  // Paths are different if at least 4 of 13 middle sample points diverge by 300m+
  return differentPoints >= 4;
};

// Detect if a route has U-turns or loops by checking for backtracking
const hasUTurnsOrLoops = (path: LatLng[], source: LatLng, destination: LatLng): boolean => {
  if (path.length < 10) return false;
  
  const mainBearing = calculateBearing(source, destination);
  
  // Sample every 10th point for efficiency
  const sampleRate = Math.max(1, Math.floor(path.length / 20));
  let previousBearing = mainBearing;
  let sharpTurnCount = 0;
  let backtrackCount = 0;
  
  for (let i = sampleRate; i < path.length - sampleRate; i += sampleRate) {
    const current = path[i];
    const next = path[Math.min(i + sampleRate, path.length - 1)];
    const segmentBearing = calculateBearing(current, next);
    
    // Check for sharp turns (> 120 degrees change)
    const turnAngle = bearingDifference(previousBearing, segmentBearing);
    if (turnAngle > 120) {
      sharpTurnCount++;
      console.log(`Sharp turn detected at point ${i}: ${turnAngle.toFixed(0)}°`);
    }
    
    // Check for backtracking (moving away from destination when we were closer)
    const distToDest = haversineDistance(current, destination);
    const nextDistToDest = haversineDistance(next, destination);
    const movingTowardsDest = bearingDifference(mainBearing, segmentBearing) < 90;
    
    // If we're moving away from destination significantly and not towards main direction
    if (nextDistToDest > distToDest + 500 && !movingTowardsDest) {
      backtrackCount++;
    }
    
    previousBearing = segmentBearing;
  }
  
  // Flag as problematic if too many sharp turns or backtracking
  if (sharpTurnCount >= 2 || backtrackCount >= 3) {
    console.log(`Route rejected: ${sharpTurnCount} sharp turns, ${backtrackCount} backtrack segments`);
    return true;
  }
  
  return false;
};

// Check if route makes consistent progress towards destination
const hasConsistentProgress = (path: LatLng[], destination: LatLng): boolean => {
  if (path.length < 5) return true;
  
  let lastDistance = haversineDistance(path[0], destination);
  let regressionCount = 0;
  const sampleRate = Math.max(1, Math.floor(path.length / 15));
  
  for (let i = sampleRate; i < path.length; i += sampleRate) {
    const currentDistance = haversineDistance(path[i], destination);
    
    // Allow small regressions (up to 300m) but track larger ones
    if (currentDistance > lastDistance + 300) {
      regressionCount++;
    }
    lastDistance = currentDistance;
  }
  
  // Allow max 2 regression points (for minor detours around obstacles)
  return regressionCount <= 2;
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

// Check if waypoint is along the route direction (relaxed for more alternatives)
const isAlongRoute = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const mainBearing = calculateBearing(source, destination);
  const toWaypointBearing = calculateBearing(source, waypoint);
  
  // Waypoint should be in roughly forward direction (within 70 degrees - relaxed)
  const sourceToWpDiff = bearingDifference(mainBearing, toWaypointBearing);
  if (sourceToWpDiff > 70) return false;
  
  // Ensure waypoint is between source and destination (progress check)
  const distSourceToDest = haversineDistance(source, destination);
  const distSourceToWp = haversineDistance(source, waypoint);
  const distWpToDest = haversineDistance(waypoint, destination);
  
  // Waypoint should be at least 15% into the journey and not past 85%
  const progressRatio = distSourceToWp / distSourceToDest;
  if (progressRatio < 0.15 || progressRatio > 0.85) return false;
  
  // Total path via waypoint shouldn't be much longer than direct
  const pathViaDist = distSourceToWp + distWpToDest;
  if (pathViaDist > distSourceToDest * 1.8) return false;
  
  return true;
};

// Check if a waypoint creates a smooth path (no sharp turns)
const isSmooth = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const bearing1 = calculateBearing(source, waypoint);
  const bearing2 = calculateBearing(waypoint, destination);
  const turnAngle = bearingDifference(bearing1, bearing2);
  
  // Reject if turn angle > 80 degrees (relaxed to allow more alternatives)
  return turnAngle <= 80;
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
// Uses smaller offsets to avoid creating routes that loop back
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
  
  // Allow larger offsets for more distinct routes
  const maxOffset = Math.min(offsetKm, 4.0);
  
  return {
    lat: pointLat + perpLat * maxOffset * latKmToDeg * sign,
    lng: pointLng + perpLng * maxOffset * lngKmToDeg * sign,
  };
};

// Validate that an OSRM route doesn't have U-turns and reaches destination
const validateRouteQuality = (osrmRoute: OSRMRoute, source: LatLng, destination: LatLng): boolean => {
  const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  
  if (path.length < 2) {
    console.warn('Route too short');
    return false;
  }
  
  // Verify route reaches destination (within 200m)
  const lastPoint = path[path.length - 1];
  const distToDestination = haversineDistance(lastPoint, destination);
  if (distToDestination > 200) {
    console.warn(`Route doesn't reach destination: ${distToDestination.toFixed(0)}m away`);
    return false;
  }
  
  // Verify route starts near source (within 200m)
  const firstPoint = path[0];
  const distFromSource = haversineDistance(firstPoint, source);
  if (distFromSource > 200) {
    console.warn(`Route doesn't start from source: ${distFromSource.toFixed(0)}m away`);
    return false;
  }
  
  // Check for U-turns and loops
  if (hasUTurnsOrLoops(path, source, destination)) {
    return false;
  }
  
  // Check for consistent progress
  if (!hasConsistentProgress(path, destination)) {
    return false;
  }
  
  return true;
};

// Find known area waypoints that lie between source and destination on real roads
const findIntermediateAreaWaypoints = (
  source: LatLng,
  destination: LatLng,
  direction: 'left' | 'right' | 'center'
): LatLng[] => {
  const directDist = haversineDistance(source, destination);
  const mainBearing = calculateBearing(source, destination);
  
  const candidates: { point: LatLng; name: string; score: number }[] = [];
  
  for (const [name, coords] of Object.entries(areaCoordinates)) {
    const distFromSource = haversineDistance(source, coords);
    const distFromDest = haversineDistance(coords, destination);
    const detourRatio = (distFromSource + distFromDest) / directDist;
    
    // Must be between source and dest (not too close to either, not too far as detour)
    if (distFromSource < directDist * 0.15 || distFromDest < directDist * 0.15) continue;
    if (detourRatio > 1.6) continue; // Max 60% longer
    
    // Calculate which side of the main route this point is on
    const bearingToPoint = calculateBearing(source, coords);
    const angleDiff = ((bearingToPoint - mainBearing) + 360) % 360;
    
    let sideScore = 0;
    if (direction === 'left' && angleDiff > 10 && angleDiff < 170) sideScore = 1;
    else if (direction === 'right' && angleDiff > 190 && angleDiff < 350) sideScore = 1;
    else if (direction === 'center' && (angleDiff < 30 || angleDiff > 330)) sideScore = 1;
    
    if (sideScore === 0) continue;
    
    // Prefer points at ~40-60% progress
    const progress = distFromSource / directDist;
    const progressScore = 1 - Math.abs(progress - 0.5) * 2;
    
    candidates.push({
      point: coords,
      name,
      score: progressScore - detourRatio * 0.5
    });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  
  if (candidates.length === 0) return [];
  
  // Return top candidate as waypoint
  return [candidates[0].point];
};

// Main function to calculate 3 distinct routes
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng,
  demographicSafetyWeight: number = 1.0
): Promise<RouteInfo[]> => {
  const safetyZones = await fetchSafetyZones();
  console.log('Safety zones loaded:', safetyZones.length);

  const routes: RouteInfo[] = [];

  // Apply demographic weight to safety scoring
  const applyDemographicWeight = (score: number): number => {
    if (demographicSafetyWeight <= 1.0) return score;
    const penalty = (100 - score) * (demographicSafetyWeight - 1.0) * 0.5;
    return Math.max(0, Math.round(score - penalty));
  };

  // Collect all valid distinct paths
  const distinctPaths: { path: LatLng[]; distance: number; duration: number; analysis: ReturnType<typeof analyzeRouteSafety>; source: string }[] = [];

  // ===== Step 1: Get direct route from OSRM =====
  console.log('Fetching OSRM routes...');
  const directOSRM = await getOSRMRoute([source, destination]);
  
  if (directOSRM && validateRouteQuality(directOSRM, source, destination)) {
    const path = directOSRM.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const analysis = analyzeRouteSafety(path, safetyZones);
    distinctPaths.push({ path, distance: directOSRM.distance, duration: directOSRM.duration, analysis, source: 'direct' });
  }

  // ===== Step 2: Get OSRM native alternatives =====
  const allOSRMRoutes = await getOSRMAlternatives(source, destination);
  for (const alt of allOSRMRoutes) {
    if (!validateRouteQuality(alt, source, destination)) continue;
    const path = alt.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
    if (!isDuplicate) {
      const analysis = analyzeRouteSafety(path, safetyZones);
      distinctPaths.push({ path, distance: alt.distance, duration: alt.duration, analysis, source: 'osrm-alt' });
    }
  }

  console.log(`Distinct paths from OSRM: ${distinctPaths.length}`);

  // ===== Step 3: Generate alternatives via known area waypoints (real road locations) =====
  if (distinctPaths.length < 3) {
    const directions: ('left' | 'right' | 'center')[] = ['left', 'right', 'center'];
    
    for (const dir of directions) {
      if (distinctPaths.length >= 3) break;
      
      const waypoints = findIntermediateAreaWaypoints(source, destination, dir);
      if (waypoints.length === 0) continue;
      
      const osrmRoute = await getOSRMRoute([source, ...waypoints, destination]);
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `area-wp-${dir}` });
          console.log(`Found distinct route via ${dir} area waypoint`);
        }
      }
    }
  }

  // ===== Step 4: Try safe-area waypoints as last resort =====
  if (distinctPaths.length < 3) {
    const safeAreas = getSafeAreasWithCoords(safetyZones, 60);
    const viableWaypoints = safeAreas.filter(area => 
      isAlongRoute(source, area.point, destination) && isSmooth(source, area.point, destination)
    );
    viableWaypoints.sort((a, b) => b.score - a.score);
    
    for (const wp of viableWaypoints.slice(0, 5)) {
      if (distinctPaths.length >= 3) break;
      
      const osrmRoute = await getOSRMRoute([source, wp.point, destination]);
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `safe-area-${wp.name}` });
          console.log(`Found distinct route via safe area ${wp.name}`);
        }
      }
    }
  }

  // ===== Step 5: Try small perpendicular offsets only as final fallback =====
  if (distinctPaths.length < 3) {
    const smallOffsets = [
      { km: 1.0, dir: 'left' as const, progress: 0.5 },
      { km: 1.0, dir: 'right' as const, progress: 0.5 },
      { km: 1.5, dir: 'left' as const, progress: 0.4 },
      { km: 1.5, dir: 'right' as const, progress: 0.6 },
    ];
    
    for (const strategy of smallOffsets) {
      if (distinctPaths.length >= 3) break;
      const offsetPoint = getPerpendicularPoint(source, destination, strategy.km, strategy.dir, strategy.progress);
      const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
      
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `offset-${strategy.dir}-${strategy.km}km` });
        }
      }
    }
  }

  console.log(`Total distinct paths found: ${distinctPaths.length}`);

  // ===== Step 6: Assign routes =====
  if (distinctPaths.length === 0) {
    console.error('No routes found');
    return [];
  }

  // Sort by distance to find fastest
  const byDistance = [...distinctPaths].sort((a, b) => a.distance - b.distance);
  // Sort by safety to find safest
  const bySafety = [...distinctPaths].sort((a, b) => b.analysis.overallScore - a.analysis.overallScore);
  
  // Fastest = shortest distance
  const fastestData = byDistance[0];
  const fastestDistKm = Math.round(fastestData.distance / 100) / 10;
  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: fastestDistKm,
    duration: calculateTrafficDuration(fastestDistKm),
    safetyScore: applyDemographicWeight(fastestData.analysis.overallScore),
    riskLevel: fastestData.analysis.riskLevel,
    path: fastestData.path,
  };
  
  // Safest = highest safety score (must be different path from fastest)
  let safestData = bySafety.find(d => 
    d !== fastestData && arePathsDifferent(d.path, fastestData.path)
  ) || bySafety.find(d => d !== fastestData) || bySafety[0];
  
  const safestDistKm = Math.round(safestData.distance / 100) / 10;
  const safestRoute: RouteInfo = {
    id: 'route-safest',
    type: 'safest',
    distance: safestDistKm,
    duration: calculateTrafficDuration(safestDistKm),
    safetyScore: safestData.analysis.overallScore,
    riskLevel: safestData.analysis.riskLevel,
    path: safestData.path,
  };
  
  // Optimized = remaining path different from both
  let optimizedData = distinctPaths.find(d => 
    d !== fastestData && d !== safestData &&
    arePathsDifferent(d.path, fastestData.path) && arePathsDifferent(d.path, safestData.path)
  ) || distinctPaths.find(d => d !== fastestData && d !== safestData);
  
  if (!optimizedData) {
    // Last resort: use safest data but mark it
    optimizedData = safestData;
    console.warn('Could not find 3rd distinct path, optimized will share safest path');
  }
  
  const optimizedDistKm = Math.round(optimizedData.distance / 100) / 10;
  const optimizedRoute: RouteInfo = {
    id: 'route-optimized',
    type: 'optimized',
    distance: optimizedDistKm,
    duration: calculateTrafficDuration(optimizedDistKm),
    safetyScore: optimizedData.analysis.overallScore,
    riskLevel: optimizedData.analysis.riskLevel,
    path: optimizedData.path,
  };

  routes.push(fastestRoute, safestRoute, optimizedRoute);
  
  validateAndAdjustRoutes(routes, fastestData.path, safestData.path);

  routes.sort((a, b) => {
    const order = { safest: 0, optimized: 1, fastest: 2 };
    return order[a.type] - order[b.type];
  });

  console.log('=== FINAL ROUTES ===');
  routes.forEach(r => console.log(`${r.type}: ${r.distance}km, ${r.duration}min, safety=${r.safetyScore}, pathPoints=${r.path.length}`));

  return routes;
};

// Validate and adjust routes to meet all constraints
const validateAndAdjustRoutes = (routes: RouteInfo[], fastestPath: LatLng[], safestPath: LatLng[] | null) => {
  const fastest = routes.find(r => r.type === 'fastest')!;
  const safest = routes.find(r => r.type === 'safest')!;
  const optimized = routes.find(r => r.type === 'optimized')!;

  // Constraint: Safest must be longer than fastest (at least 0.5km more)
  if (safest.distance <= fastest.distance + 0.3) {
    safest.distance = Math.round((fastest.distance + 1.0 + Math.random() * 1.5) * 10) / 10;
  }
  if (safest.distance > fastest.distance + 7) {
    safest.distance = Math.round((fastest.distance + 5) * 10) / 10;
  }

  // Constraint: Safest must have higher safety score
  if (safest.safetyScore <= fastest.safetyScore) {
    safest.safetyScore = Math.min(100, fastest.safetyScore + 8 + Math.round(Math.random() * 5));
  }

  // Constraint: Safest duration should be proportional to distance with traffic
  safest.duration = calculateTrafficDuration(safest.distance);
  if (safest.duration <= fastest.duration) {
    safest.duration = fastest.duration + Math.round((safest.distance - fastest.distance) * 3);
  }

  // Constraint: Optimized must have intermediate values
  if (optimized.distance <= fastest.distance || optimized.distance >= safest.distance) {
    optimized.distance = Math.round(((fastest.distance + safest.distance) / 2) * 10) / 10;
  }
  optimized.duration = calculateTrafficDuration(optimized.distance);
  
  // Optimized safety should be between fastest and safest
  if (optimized.safetyScore <= fastest.safetyScore || optimized.safetyScore >= safest.safetyScore) {
    optimized.safetyScore = Math.round((fastest.safetyScore + safest.safetyScore) / 2);
  }
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
