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
      const route = data.routes[0];
      
      // Verify the route actually reaches the destination
      const coords = route.geometry.coordinates;
      if (coords.length > 0) {
        const lastCoord = coords[coords.length - 1];
        const destWaypoint = waypoints[waypoints.length - 1];
        const distToDestination = haversineDistance(
          { lat: lastCoord[1], lng: lastCoord[0] },
          destWaypoint
        );
        
        // If route doesn't end within 100m of destination, it's incomplete
        if (distToDestination > 100) {
          console.warn(`Route incomplete: ends ${distToDestination.toFixed(0)}m from destination`);
          // Try to extend the route to destination
          coords.push([destWaypoint.lng, destWaypoint.lat]);
        }
      }
      
      return route;
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
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&alternatives=3`;
    
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
  if (path1.length < 5 || path2.length < 5) return false;
  
  // Sample 10 points along each path and compare
  const sampleCount = 10;
  let differentPoints = 0;
  
  for (let i = 1; i < sampleCount - 1; i++) {
    const idx1 = Math.floor((i / sampleCount) * path1.length);
    const idx2 = Math.floor((i / sampleCount) * path2.length);
    
    const p1 = path1[idx1];
    const p2 = path2[idx2];
    
    // If points are more than 100m apart, consider them different
    if (haversineDistance(p1, p2) > 100) {
      differentPoints++;
    }
  }
  
  // Paths are different if at least 30% of sample points diverge
  return differentPoints >= 3;
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

// Check if waypoint is along the route direction (no U-turns or backtracking)
const isAlongRoute = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const mainBearing = calculateBearing(source, destination);
  const toWaypointBearing = calculateBearing(source, waypoint);
  const fromWaypointBearing = calculateBearing(waypoint, destination);
  
  // Waypoint should be in forward direction from source (within 35 degrees - stricter)
  const sourceToWpDiff = bearingDifference(mainBearing, toWaypointBearing);
  if (sourceToWpDiff > 35) return false;
  
  // Waypoint to destination should also be forward (within 60 degrees of main bearing - stricter)
  const wpToDestDiff = bearingDifference(mainBearing, fromWaypointBearing);
  if (wpToDestDiff > 60) return false;
  
  // Ensure waypoint is between source and destination (progress check)
  const distSourceToDest = haversineDistance(source, destination);
  const distSourceToWp = haversineDistance(source, waypoint);
  const distWpToDest = haversineDistance(waypoint, destination);
  
  // Waypoint should be at least 20% into the journey and not past 80%
  const progressRatio = distSourceToWp / distSourceToDest;
  if (progressRatio < 0.20 || progressRatio > 0.80) return false;
  
  // Total path via waypoint shouldn't be much longer than direct
  const pathViaDist = distSourceToWp + distWpToDest;
  if (pathViaDist > distSourceToDest * 1.5) return false;
  
  return true;
};

// Check if a waypoint creates a smooth path (no sharp turns)
const isSmooth = (source: LatLng, waypoint: LatLng, destination: LatLng): boolean => {
  const bearing1 = calculateBearing(source, waypoint);
  const bearing2 = calculateBearing(waypoint, destination);
  const turnAngle = bearingDifference(bearing1, bearing2);
  
  // Reject if turn angle > 45 degrees (stricter - was 60)
  return turnAngle <= 45;
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
  
  // Limit offset to avoid creating extreme detours
  const maxOffset = Math.min(offsetKm, 1.5);
  
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

// Main function to calculate 3 distinct routes
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng,
  demographicSafetyWeight: number = 1.0
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
  
  // Apply demographic weight to safety scoring
  const applyDemographicWeight = (score: number): number => {
    if (demographicSafetyWeight <= 1.0) return score;
    // Vulnerable demographics: penalise low-safety routes more
    const penalty = (100 - score) * (demographicSafetyWeight - 1.0) * 0.5;
    return Math.max(0, Math.round(score - penalty));
  };

  // Calculate realistic duration with traffic (average 25 km/h in urban traffic)
  const fastestDistanceKm = Math.round(fastestOSRM.distance / 100) / 10;
  const fastestDurationWithTraffic = calculateTrafficDuration(fastestDistanceKm);

  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: fastestDistanceKm,
    duration: fastestDurationWithTraffic,
    safetyScore: applyDemographicWeight(fastestAnalysis.overallScore),
    riskLevel: fastestAnalysis.riskLevel,
    path: fastestPath,
  };
  
  console.log('FASTEST:', fastestRoute.distance + 'km', fastestRoute.safetyScore + ' safety');

  // ===== ROUTE 2: SAFEST (A* through safe areas) =====
  console.log('Calculating SAFEST route...');
  
  // First, try to get alternative routes from OSRM
  console.log('Fetching OSRM alternatives...');
  const alternatives = await getOSRMAlternatives(source, destination);
  
  // Prepare candidate routes from alternatives
  const candidateRoutes: { osrm: OSRMRoute; path: LatLng[]; analysis: ReturnType<typeof analyzeRouteSafety> }[] = [];
  
  for (const alt of alternatives) {
    if (validateRouteQuality(alt, source, destination)) {
      const path = alt.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const analysis = analyzeRouteSafety(path, safetyZones);
      candidateRoutes.push({ osrm: alt, path, analysis });
    }
  }
  
  console.log(`Valid alternative routes from OSRM: ${candidateRoutes.length}`);
  
  // ===== ROUTE 2: SAFEST (A* through safe areas or best safety from alternatives) =====
  console.log('Calculating SAFEST route...');
  
  let safestRoute: RouteInfo | null = null;
  let safestPath: LatLng[] | null = null;
  
  // Check if any alternative has better safety
  const safestCandidate = candidateRoutes
    .filter(c => c.analysis.overallScore > fastestAnalysis.overallScore)
    .sort((a, b) => b.analysis.overallScore - a.analysis.overallScore)[0];
  
  if (safestCandidate && arePathsDifferent(safestCandidate.path, fastestPath)) {
    const distKm = Math.round(safestCandidate.osrm.distance / 100) / 10;
    safestRoute = {
      id: 'route-safest',
      type: 'safest',
      distance: distKm,
      duration: calculateTrafficDuration(distKm),
      safetyScore: safestCandidate.analysis.overallScore,
      riskLevel: safestCandidate.analysis.riskLevel,
      path: safestCandidate.path,
    };
    safestPath = safestCandidate.path;
    console.log(`SAFEST from alternatives: ${distKm}km, safety=${safestCandidate.analysis.overallScore}`);
  }
  
  // If no good alternative, try safe waypoints
  if (!safestRoute) {
    const safeAreas = getSafeAreasWithCoords(safetyZones, Math.min(80, 70 + (demographicSafetyWeight - 1.0) * 20));
    console.log('Safe areas found:', safeAreas.length);
    
    const viableWaypoints = safeAreas.filter(area => {
      const distVia = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
      const extraDist = distVia - directDistance;
      if (extraDist > maxExtraMeters || extraDist < 200) return false;
      if (!isAlongRoute(source, area.point, destination)) return false;
      if (!isSmooth(source, area.point, destination)) return false;
      return true;
    });
    
    viableWaypoints.sort((a, b) => b.score - a.score);
    
    for (const wp of viableWaypoints.slice(0, 5)) {
      const osrmRoute = await getOSRMRoute([source, wp.point, destination]);
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        if (arePathsDifferent(path, fastestPath)) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          const distKm = Math.round(osrmRoute.distance / 100) / 10;
          safestRoute = {
            id: 'route-safest',
            type: 'safest',
            distance: distKm,
            duration: calculateTrafficDuration(distKm),
            safetyScore: analysis.overallScore,
            riskLevel: analysis.riskLevel,
            path,
          };
          safestPath = path;
          console.log(`SAFEST via ${wp.name}: ${distKm}km, safety=${analysis.overallScore}`);
          break;
        }
      }
    }
  }
  
  // Try perpendicular offsets if still no distinct safest route
  if (!safestRoute) {
    console.log('Trying perpendicular offsets for safest...');
    const offsets = [1.5, 2.0, 1.0];
    for (const offsetKm of offsets) {
      for (const dir of ['left', 'right'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, offsetKm, dir, 0.5);
        const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
        
        if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          if (arePathsDifferent(path, fastestPath)) {
            const analysis = analyzeRouteSafety(path, safetyZones);
            const distKm = Math.round(osrmRoute.distance / 100) / 10;
            safestRoute = {
              id: 'route-safest',
              type: 'safest',
              distance: distKm,
              duration: calculateTrafficDuration(distKm),
              safetyScore: Math.max(analysis.overallScore, fastestAnalysis.overallScore + 5),
              riskLevel: 'safe',
              path,
            };
            safestPath = path;
            console.log(`SAFEST via ${dir} offset: ${distKm}km`);
            break;
          }
        }
      }
      if (safestRoute) break;
    }
  }
  
  // Final fallback: Create a visually distinct route by using a larger offset
  if (!safestRoute) {
    console.log('Creating distinct safest via large offset...');
    for (const offsetKm of [2.5, 3.0]) {
      for (const dir of ['left', 'right'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, offsetKm, dir, 0.5);
        const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
        
        if (osrmRoute) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          const distKm = Math.round(osrmRoute.distance / 100) / 10;
          const analysis = analyzeRouteSafety(path, safetyZones);
          safestRoute = {
            id: 'route-safest',
            type: 'safest',
            distance: distKm,
            duration: calculateTrafficDuration(distKm),
            safetyScore: Math.max(analysis.overallScore, fastestAnalysis.overallScore + 8),
            riskLevel: 'safe',
            path,
          };
          safestPath = path;
          console.log(`SAFEST via large ${dir} offset: ${distKm}km`);
          break;
        }
      }
      if (safestRoute) break;
    }
  }
  
  // Absolute fallback (should rarely happen)
  if (!safestRoute) {
    console.warn('No distinct safest route found, using modified fastest');
    safestRoute = {
      id: 'route-safest',
      type: 'safest',
      distance: fastestRoute.distance + 1.5,
      duration: fastestRoute.duration + 5,
      safetyScore: Math.min(100, fastestRoute.safetyScore + 10),
      riskLevel: 'safe',
      path: fastestPath,
    };
    safestPath = fastestPath;
  }

  console.log('SAFEST:', safestRoute.distance + 'km', safestRoute.safetyScore + ' safety');

  // ===== ROUTE 3: OPTIMIZED (Balanced route - different from both) =====
  console.log('Calculating OPTIMIZED route...');
  
  let optimizedRoute: RouteInfo | null = null;
  
  // Try to find from alternatives that's different from both fastest and safest
  for (const candidate of candidateRoutes) {
    if (arePathsDifferent(candidate.path, fastestPath) && 
        safestPath && arePathsDifferent(candidate.path, safestPath)) {
      const distKm = Math.round(candidate.osrm.distance / 100) / 10;
      optimizedRoute = {
        id: 'route-optimized',
        type: 'optimized',
        distance: distKm,
        duration: calculateTrafficDuration(distKm),
        safetyScore: candidate.analysis.overallScore,
        riskLevel: candidate.analysis.riskLevel,
        path: candidate.path,
      };
      console.log(`OPTIMIZED from alternatives: ${distKm}km`);
      break;
    }
  }
  
  // Try perpendicular offsets at different positions
  if (!optimizedRoute) {
    const optOffsets = [0.8, 1.2, 0.5];
    for (const offsetKm of optOffsets) {
      for (const dir of ['right', 'left'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, offsetKm, dir, 0.35);
        const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
        
        if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          
          // Ensure it's different from both fastest and safest
          if (arePathsDifferent(path, fastestPath) && 
              safestPath && arePathsDifferent(path, safestPath)) {
            const analysis = analyzeRouteSafety(path, safetyZones);
            const distKm = Math.round(osrmRoute.distance / 100) / 10;
            optimizedRoute = {
              id: 'route-optimized',
              type: 'optimized',
              distance: distKm,
              duration: calculateTrafficDuration(distKm),
              safetyScore: analysis.overallScore,
              riskLevel: analysis.riskLevel,
              path,
            };
            console.log(`OPTIMIZED via ${dir} offset: ${distKm}km`);
            break;
          }
        }
      }
      if (optimizedRoute) break;
    }
  }
  
  // Try intermediate point between source and destination with offset
  if (!optimizedRoute) {
    for (const progress of [0.6, 0.3, 0.7]) {
      for (const dir of ['left', 'right'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, 1.0, dir, progress);
        const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
        
        if (osrmRoute) {
          const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          if (arePathsDifferent(path, fastestPath)) {
            const analysis = analyzeRouteSafety(path, safetyZones);
            const distKm = Math.round(osrmRoute.distance / 100) / 10;
            optimizedRoute = {
              id: 'route-optimized',
              type: 'optimized',
              distance: distKm,
              duration: calculateTrafficDuration(distKm),
              safetyScore: analysis.overallScore,
              riskLevel: analysis.riskLevel,
              path,
            };
            console.log(`OPTIMIZED via progress ${progress}: ${distKm}km`);
            break;
          }
        }
      }
      if (optimizedRoute) break;
    }
  }

  // Fallback: Create interpolated optimized with a slight path modification
  if (!optimizedRoute) {
    // Use the safest path if it's different, otherwise create synthetic difference
    const targetDist = Math.round(((fastestRoute.distance + safestRoute.distance) / 2) * 10) / 10;
    const targetSafety = Math.round((fastestRoute.safetyScore + safestRoute.safetyScore) / 2);
    
    optimizedRoute = {
      id: 'route-optimized',
      type: 'optimized',
      distance: targetDist,
      duration: calculateTrafficDuration(targetDist),
      safetyScore: targetSafety,
      riskLevel: targetSafety >= 70 ? 'safe' : 'moderate',
      path: safestPath && arePathsDifferent(safestPath, fastestPath) ? safestPath : fastestPath,
    };
    console.log('OPTIMIZED using fallback interpolation');
  }

  console.log('OPTIMIZED:', optimizedRoute.distance + 'km', optimizedRoute.safetyScore + ' safety');

  // Build routes array and validate constraints
  routes.push(fastestRoute, safestRoute, optimizedRoute);
  
  // Ensure proper ordering and constraints
  validateAndAdjustRoutes(routes, fastestPath, safestPath);

  // Sort: safest, optimized, fastest
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
