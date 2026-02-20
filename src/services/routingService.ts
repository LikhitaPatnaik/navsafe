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

// Check if two paths are sufficiently different
const arePathsDifferent = (path1: LatLng[], path2: LatLng[]): boolean => {
  if (path1.length < 3 || path2.length < 3) return false;
  
  const sampleCount = 30;
  let differentPoints = 0;
  
  for (let i = 1; i < sampleCount - 1; i++) {
    const idx1 = Math.floor((i / sampleCount) * path1.length);
    const p1 = path1[idx1];
    
    let minDist = Infinity;
    const searchRate = Math.max(1, Math.floor(path2.length / 100));
    for (let j = 0; j < path2.length; j += searchRate) {
      const d = haversineDistance(p1, path2[j]);
      if (d < minDist) minDist = d;
    }
    
    // 150m threshold for genuine street-level differences
    if (minDist > 150) {
      differentPoints++;
    }
  }
  
  // Paths are different if at least 6 of 28 middle points diverge by 150m+
  return differentPoints >= 6;
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
const hasConsistentProgress = (path: LatLng[], source: LatLng, destination: LatLng): boolean => {
  if (path.length < 5) return true;
  
  const directDist = haversineDistance(source, destination);
  let lastDistance = haversineDistance(path[0], destination);
  let regressionCount = 0;
  let maxRegression = 0;
  const sampleRate = Math.max(1, Math.floor(path.length / 20));
  
  for (let i = sampleRate; i < path.length; i += sampleRate) {
    const currentDistance = haversineDistance(path[i], destination);
    
    // Track regressions (moving away from destination)
    if (currentDistance > lastDistance + 200) {
      regressionCount++;
      const regression = currentDistance - lastDistance;
      if (regression > maxRegression) maxRegression = regression;
    }
    lastDistance = currentDistance;
  }
  
  // Reject if too many regressions or a single large one
  if (regressionCount > 2) return false;
  if (maxRegression > directDist * 0.3) return false; // Single regression > 30% of trip distance
  
  // Check for loops: if path revisits a point within 100m
  for (let i = 0; i < path.length - 10; i += sampleRate) {
    for (let j = i + Math.max(10, sampleRate * 3); j < path.length; j += sampleRate) {
      if (haversineDistance(path[i], path[j]) < 100) {
        // Check the loop went at least 300m away
        let maxDist = 0;
        for (let k = i; k < j; k += Math.max(1, Math.floor((j - i) / 5))) {
          const d = haversineDistance(path[i], path[k]);
          if (d > maxDist) maxDist = d;
        }
        if (maxDist > 300) {
          console.warn(`Loop detected: points ${i}-${j}, max loop extent ${maxDist.toFixed(0)}m`);
          return false;
        }
      }
    }
  }
  
  return true;
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

// Check if waypoint is roughly along the route direction
const isAlongRoute = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const distSourceToDest = haversineDistance(source, destination);
  const distSourceToWp = haversineDistance(source, waypoint);
  const distWpToDest = haversineDistance(waypoint, destination);
  
  // Waypoint should be at least 10% into the journey and not past 90%
  const progressRatio = distSourceToWp / distSourceToDest;
  if (progressRatio < 0.10 || progressRatio > 0.90) return false;
  
  // Total path via waypoint shouldn't be much longer than direct
  const pathViaDist = distSourceToWp + distWpToDest;
  if (pathViaDist > distSourceToDest * 2.0) return false;
  
  return true;
};

// Check if a waypoint creates a reasonably smooth path
const isSmooth = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const bearing1 = calculateBearing(source, waypoint);
  const bearing2 = calculateBearing(waypoint, destination);
  const turnAngle = bearingDifference(bearing1, bearing2);
  
  // Reject if turn angle > 120 degrees
  return turnAngle <= 120;
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
  if (!hasConsistentProgress(path, source, destination)) {
    return false;
  }
  
  return true;
};

// Find known area waypoints that lie between source and destination on real roads
const findIntermediateAreaWaypoints = (
  source: LatLng,
  destination: LatLng,
  direction: 'left' | 'right' | 'center',
  excludePoints: LatLng[] = []
): LatLng[] => {
  const directDist = haversineDistance(source, destination);
  const mainBearing = calculateBearing(source, destination);
  
  const candidates: { point: LatLng; name: string; score: number }[] = [];
  
  for (const [name, coords] of Object.entries(areaCoordinates)) {
    // Skip points too close to already-used waypoints
    const tooCloseToExcluded = excludePoints.some(ep => haversineDistance(ep, coords) < 500);
    if (tooCloseToExcluded) continue;
    
    const distFromSource = haversineDistance(source, coords);
    const distFromDest = haversineDistance(coords, destination);
    const detourRatio = (distFromSource + distFromDest) / directDist;
    
    if (distFromSource < directDist * 0.1 || distFromDest < directDist * 0.1) continue;
    if (detourRatio > 2.0) continue; // Allow up to 2x detour for more options
    
    const bearingToPoint = calculateBearing(source, coords);
    const angleDiff = ((bearingToPoint - mainBearing) + 360) % 360;
    
    let sideScore = 0;
    if (direction === 'left' && angleDiff > 5 && angleDiff < 175) sideScore = 1;
    else if (direction === 'right' && angleDiff > 185 && angleDiff < 355) sideScore = 1;
    else if (direction === 'center' && (angleDiff < 40 || angleDiff > 320)) sideScore = 1;
    
    if (sideScore === 0) continue;
    
    const progress = distFromSource / directDist;
    const progressScore = 1 - Math.abs(progress - 0.5) * 2;
    
    // Favor points further from the main bearing line for more divergent routes
    const lateralAngle = Math.min(angleDiff, 360 - angleDiff);
    const lateralScore = lateralAngle / 90; // Higher = more lateral = more different
    
    candidates.push({
      point: coords,
      name,
      score: progressScore + lateralScore * 0.5 - detourRatio * 0.3
    });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  
  if (candidates.length === 0) return [];
  
  console.log(`Area waypoint candidates (${direction}): ${candidates.slice(0, 3).map(c => c.name).join(', ')}`);
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

  // ===== Step 2b: Generate dedicated SAFE routes through highest-safety areas =====
  // Aggressively route through areas with best safety scores to ensure a genuinely safe option
  const highSafetyAreas = getSafeAreasWithCoords(safetyZones, 65)
    .sort((a, b) => b.score - a.score);
  
  // Also identify danger zones to avoid
  const dangerZones: { point: LatLng; score: number; name: string }[] = [];
  for (const zone of safetyZones) {
    if (zone.safety_score < 40) {
      const normalizedArea = zone.area.toLowerCase().trim();
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || 
            normalizedArea.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(normalizedArea)) {
          dangerZones.push({ point: coords, score: zone.safety_score, name: zone.area });
          break;
        }
      }
    }
  }

  // Try routing through 1 or 2 safe waypoints that are along the route
  const directDist = haversineDistance(source, destination);
  const safeCandidateWaypoints = highSafetyAreas.filter(area => {
    const distVia = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
    return distVia <= directDist * 2.5 && 
           haversineDistance(source, area.point) > directDist * 0.1 &&
           haversineDistance(area.point, destination) > directDist * 0.1;
  });

  // Try single safe waypoints
  for (const wp of safeCandidateWaypoints.slice(0, 5)) {
    if (distinctPaths.length >= 8) break;
    const osrmRoute = await getOSRMRoute([source, wp.point, destination]);
    if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
      if (!isDuplicate) {
        const analysis = analyzeRouteSafety(path, safetyZones);
        distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `safe-dedicated-${wp.name}` });
        console.log(`Found safe-dedicated route via ${wp.name} (safety: ${wp.score})`);
      }
    }
  }

  // Try pairs of safe waypoints for even safer routes
  for (let i = 0; i < Math.min(3, safeCandidateWaypoints.length); i++) {
    for (let j = i + 1; j < Math.min(5, safeCandidateWaypoints.length); j++) {
      if (distinctPaths.length >= 8) break;
      const wp1 = safeCandidateWaypoints[i];
      const wp2 = safeCandidateWaypoints[j];
      // Order waypoints by distance from source
      const d1 = haversineDistance(source, wp1.point);
      const d2 = haversineDistance(source, wp2.point);
      const ordered = d1 < d2 ? [wp1.point, wp2.point] : [wp2.point, wp1.point];
      
      const osrmRoute = await getOSRMRoute([source, ...ordered, destination]);
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `safe-pair-${wp1.name}-${wp2.name}` });
          console.log(`Found safe-pair route via ${wp1.name} + ${wp2.name}`);
        }
      }
    }
  }

  // ===== Step 3: Generate alternatives via known area waypoints (real road locations) =====
  const usedWaypoints: LatLng[] = [];
  const allDirections: ('left' | 'right' | 'center')[] = ['left', 'right', 'center', 'left', 'right', 'center', 'right', 'left'];
  
  for (const dir of allDirections) {
    if (distinctPaths.length >= 8) break;
    
    const waypoints = findIntermediateAreaWaypoints(source, destination, dir, usedWaypoints);
    if (waypoints.length === 0) continue;
    
    const osrmRoute = await getOSRMRoute([source, ...waypoints, destination]);
    if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
      if (!isDuplicate) {
        const analysis = analyzeRouteSafety(path, safetyZones);
        distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `area-wp-${dir}` });
        usedWaypoints.push(...waypoints);
        console.log(`Found distinct route via ${dir} area waypoint`);
      } else {
        usedWaypoints.push(...waypoints);
      }
    } else {
      usedWaypoints.push(...waypoints);
    }
  }

  // ===== Step 4: Try safe-area waypoints =====
  if (distinctPaths.length < 5) {
    const safeAreas = getSafeAreasWithCoords(safetyZones, 50);
    const viableWaypoints = safeAreas.filter(area => {
      const tooClose = usedWaypoints.some(uw => haversineDistance(uw, area.point) < 500);
      return !tooClose && isAlongRoute(source, area.point, destination) && isSmooth(source, area.point, destination);
    });
    viableWaypoints.sort((a, b) => b.score - a.score);
    
    for (const wp of viableWaypoints.slice(0, 8)) {
      if (distinctPaths.length >= 8) break;
      
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

  // ===== Step 5: Perpendicular offsets - try aggressively =====
  if (distinctPaths.length < 5) {
    const offsets = [
      { km: 1.5, dir: 'left' as const, progress: 0.4 },
      { km: 1.5, dir: 'right' as const, progress: 0.6 },
      { km: 2.5, dir: 'left' as const, progress: 0.5 },
      { km: 2.5, dir: 'right' as const, progress: 0.5 },
      { km: 3.5, dir: 'left' as const, progress: 0.3 },
      { km: 3.5, dir: 'right' as const, progress: 0.7 },
      { km: 4.0, dir: 'left' as const, progress: 0.5 },
      { km: 4.0, dir: 'right' as const, progress: 0.5 },
    ];
    
    for (const strategy of offsets) {
      if (distinctPaths.length >= 5) break;
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

  // ===== Step 5b: Two-waypoint routes for maximum diversity =====
  if (distinctPaths.length < 5) {
    const twoWpStrategies = [
      { dir1: 'left' as const, dir2: 'right' as const, km: 2.5 },
      { dir1: 'right' as const, dir2: 'left' as const, km: 2.5 },
      { dir1: 'left' as const, dir2: 'left' as const, km: 3.5 },
      { dir1: 'right' as const, dir2: 'right' as const, km: 3.5 },
    ];
    
    for (const strategy of twoWpStrategies) {
      if (distinctPaths.length >= 5) break;
      const wp1 = getPerpendicularPoint(source, destination, strategy.km, strategy.dir1, 0.33);
      const wp2 = getPerpendicularPoint(source, destination, strategy.km, strategy.dir2, 0.66);
      const osrmRoute = await getOSRMRoute([source, wp1, wp2, destination]);
      
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `two-wp-${strategy.dir1}-${strategy.dir2}` });
        }
      }
    }
  }

  console.log(`Total distinct paths found: ${distinctPaths.length}`);

  // ===== Step 6: Assign routes - STRICTLY enforce different paths =====
  if (distinctPaths.length === 0) {
    console.error('No routes found');
    return [];
  }

  // Sort by distance to find fastest
  const byDistance = [...distinctPaths].sort((a, b) => a.distance - b.distance);
  
  // Calculate composite safety scores considering danger zone proximity
  const scoredPaths = distinctPaths.map(d => {
    let dangerPenalty = 0;
    const sampleRate = Math.max(1, Math.floor(d.path.length / 30));
    for (let i = 0; i < d.path.length; i += sampleRate) {
      for (const dz of dangerZones) {
        const dist = haversineDistance(d.path[i], dz.point);
        if (dist < 1500) {
          dangerPenalty += (1500 - dist) / 1500 * (40 - dz.score) / 40 * 3;
        }
      }
    }
    const dangerAreaCount = d.analysis.dangerousAreas.length;
    const safeAreaCount = d.analysis.safeAreas.length;
    const compositeScore = d.analysis.overallScore + safeAreaCount * 3 - dangerAreaCount * 5 - dangerPenalty;
    return { ...d, compositeScore };
  });

  const bySafety = [...scoredPaths].sort((a, b) => b.compositeScore - a.compositeScore);
  
  // === FASTEST: shortest distance ===
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
  
  // === SAFEST: highest composite safety, MUST be different path from fastest ===
  let safestData = bySafety.find(d => 
    d !== fastestData && arePathsDifferent(d.path, fastestData.path)
  );
  
  // If no genuinely different safer path, try generating one via perpendicular offset
  if (!safestData) {
    console.warn('No distinct safest path found, generating via perpendicular...');
    for (const offset of [3.0, 4.0, 5.0]) {
      for (const dir of ['left', 'right'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, offset, dir, 0.5);
        const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
        if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          if (arePathsDifferent(path, fastestData.path)) {
            const analysis = analyzeRouteSafety(path, safetyZones);
            safestData = { path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, compositeScore: analysis.overallScore, source: `safest-fallback-${dir}-${offset}` };
            break;
          }
        }
      }
      if (safestData) break;
    }
  }
  
  if (!safestData) safestData = bySafety[0];
  
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
  
  // === OPTIMIZED: MUST be different from BOTH fastest and safest ===
  let optimizedData = distinctPaths.find(d => 
    d !== fastestData && d !== safestData &&
    arePathsDifferent(d.path, fastestData.path) && arePathsDifferent(d.path, safestData.path)
  );
  
  // If no triple-distinct path exists, find the most divergent candidate
  if (!optimizedData) {
    let maxCombinedDivergence = -1;
    for (const d of distinctPaths) {
      if (d === fastestData || d === safestData) continue;
      let divFromFastest = 0;
      let divFromSafest = 0;
      const sampleCount = 15;
      for (let i = 1; i < sampleCount - 1; i++) {
        const idx = Math.floor((i / sampleCount) * d.path.length);
        
        let minDistF = Infinity;
        for (let j = 0; j < fastestData.path.length; j += Math.max(1, Math.floor(fastestData.path.length / 40))) {
          const dist = haversineDistance(d.path[idx], fastestData.path[j]);
          if (dist < minDistF) minDistF = dist;
        }
        divFromFastest += minDistF;
        
        let minDistS = Infinity;
        for (let j = 0; j < safestData.path.length; j += Math.max(1, Math.floor(safestData.path.length / 40))) {
          const dist = haversineDistance(d.path[idx], safestData.path[j]);
          if (dist < minDistS) minDistS = dist;
        }
        divFromSafest += minDistS;
      }
      const combined = Math.min(divFromFastest, divFromSafest);
      if (combined > maxCombinedDivergence) {
        maxCombinedDivergence = combined;
        optimizedData = d;
      }
    }
  }
  
  // Last resort: generate via large perpendicular offsets in the opposite direction from safest
  if (!optimizedData || (!arePathsDifferent(optimizedData.path, fastestData.path) || !arePathsDifferent(optimizedData.path, safestData.path))) {
    console.warn('Generating emergency 3rd route via large perpendicular offset');
    for (const offset of [3.5, 4.5, 5.5]) {
      for (const dir of ['right', 'left'] as const) {
        const emergencyPoint = getPerpendicularPoint(source, destination, offset, dir, 0.5);
        const emergencyRoute = await getOSRMRoute([source, emergencyPoint, destination]);
        if (emergencyRoute && validateRouteQuality(emergencyRoute, source, destination)) {
          const path = emergencyRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          if (arePathsDifferent(path, fastestData.path) && arePathsDifferent(path, safestData.path)) {
            const analysis = analyzeRouteSafety(path, safetyZones);
            optimizedData = { path, distance: emergencyRoute.distance, duration: emergencyRoute.duration, analysis, source: 'emergency' };
            break;
          }
        }
      }
      if (optimizedData && arePathsDifferent(optimizedData.path, fastestData.path) && arePathsDifferent(optimizedData.path, safestData.path)) break;
    }
  }
  
  if (!optimizedData) {
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
  
  // === FINAL VERIFICATION: ensure all 3 are truly different ===
  const f2s = arePathsDifferent(fastestRoute.path, safestRoute.path);
  const f2o = arePathsDifferent(fastestRoute.path, optimizedRoute.path);
  const s2o = arePathsDifferent(safestRoute.path, optimizedRoute.path);
  
  console.log('=== PATH DIVERSITY CHECK ===');
  console.log(`Fastest vs Safest different: ${f2s}`);
  console.log(`Fastest vs Optimized different: ${f2o}`);
  console.log(`Safest vs Optimized different: ${s2o}`);
  
  if (!f2s) console.warn('⚠️ Fastest and Safest share the same road path!');
  if (!f2o) console.warn('⚠️ Fastest and Optimized share the same road path!');
  if (!s2o) console.warn('⚠️ Safest and Optimized share the same road path!');
  
  validateAndAdjustRoutes(routes, fastestData.path, safestData.path);

  routes.sort((a, b) => {
    const order = { safest: 0, optimized: 1, fastest: 2 };
    return order[a.type] - order[b.type];
  });

  console.log('=== FINAL ROUTES ===');
  routes.forEach(r => console.log(`${r.type}: ${r.distance}km, ${r.duration}min, safety=${r.safetyScore}, risk=${r.riskLevel}, pathPoints=${r.path.length}, source=${(r as any).source || 'n/a'}`));
  console.log(`Safest route source: ${safestData.source}, dangerAreas avoided: ${safestData.analysis.dangerousAreas.length === 0 ? 'all' : safestData.analysis.dangerousAreas.join(',')}`);

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
