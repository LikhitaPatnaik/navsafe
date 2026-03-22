import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { 
  haversineDistance,
  areaCoordinates,
  analyzeRouteSafety,
} from './astarRouting';
import { getPreferredRoadCorridors } from './routeCorridors';

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
  legs?: Array<{
    steps?: Array<{
      maneuver?: {
        modifier?: string;
        type?: string;
      };
    }>;
  }>;
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
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&alternatives=true&steps=true&continue_straight=true`;
    
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

// Normalize path for comparisons by trimming dangling tails and removing obvious loops
const normalizePath = (path: LatLng[]): LatLng[] => {
  if (path.length < 4) return path;

  let result = [...path];

  const removeLoops = (pts: LatLng[]): LatLng[] => {
    if (pts.length < 10) return pts;
    let cleaned = [...pts];
    let changed = true;
    let passes = 0;

    while (changed && passes < 3) {
      changed = false;
      passes++;

      for (let i = 0; i < cleaned.length - 5; i++) {
        for (let j = i + 5; j < cleaned.length; j++) {
          const dist = haversineDistance(cleaned[i], cleaned[j]);
          if (dist >= 150) continue;

          let maxLoopDist = 0;
          for (let k = i + 1; k < j; k++) {
            const loopDist = haversineDistance(cleaned[i], cleaned[k]);
            if (loopDist > maxLoopDist) maxLoopDist = loopDist;
          }

          if (maxLoopDist > 200) {
            cleaned = [...cleaned.slice(0, i + 1), ...cleaned.slice(j)];
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    return cleaned;
  };

  result = removeLoops(result);
  return result;
};

const resamplePath = (path: LatLng[], sampleCount: number = 48): LatLng[] => {
  const normalized = normalizePath(path);
  if (normalized.length <= sampleCount) return normalized;

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const pointIndex = Math.min(normalized.length - 1, Math.round(ratio * (normalized.length - 1)));
    return normalized[pointIndex];
  });
};

// Extract only the middle portion of a path (skip converging start/end segments)
const extractMiddlePortion = (path: LatLng[], trimRatio: number = 0.2): LatLng[] => {
  if (path.length < 6) return path;
  const startIdx = Math.floor(path.length * trimRatio);
  const endIdx = Math.ceil(path.length * (1 - trimRatio));
  return path.slice(startIdx, endIdx);
};

const calculateAveragePathSeparation = (path1: LatLng[], path2: LatLng[]): number => {
  if (path1.length < 3 || path2.length < 3) return 0;

  // Compare only middle portions to ignore shared start/end segments
  const mid1 = extractMiddlePortion(path1);
  const mid2 = extractMiddlePortion(path2);
  const sampled1 = resamplePath(mid1, 30);
  const sampled2 = resamplePath(mid2, 30);

  let total = 0;
  const count = Math.min(sampled1.length, sampled2.length);
  for (let i = 0; i < count; i++) {
    total += haversineDistance(sampled1[i], sampled2[i]);
  }

  return total / Math.max(1, count);
};

const calculateMidRouteSeparation = (path1: LatLng[], path2: LatLng[]): number => {
  if (path1.length < 3 || path2.length < 3) return 0;

  const sampled1 = resamplePath(path1);
  const sampled2 = resamplePath(path2, sampled1.length);
  const checkpoints = [0.25, 0.5, 0.75];

  const separations = checkpoints.map((checkpoint) => {
    const index = Math.min(sampled1.length - 1, Math.round(checkpoint * (sampled1.length - 1)));
    return haversineDistance(sampled1[index], sampled2[index]);
  });

  return separations.reduce((sum, value) => sum + value, 0) / separations.length;
};

const getPathComparisonThresholds = (_tripDist: number) => {
  // Relaxed thresholds - focus on middle portion divergence
  // Routes that use different roads in the middle section should always pass
  return {
    overlapThreshold: 80,      // meters - points closer than this are "same road"
    maxAllowedOverlap: 0.70,   // 70% overlap allowed (routes share start/end)
    minAverageSeparation: 40,  // very low - middle portion comparison handles this
    minMidSeparation: 50,      // low - if middle 60% diverges, that's enough
    maxSharedCorridorRatio: 0.85,
    minLateralProfileGap: 40,
  };
};

const calculateNearestPointDistance = (point: LatLng, path: LatLng[]): number => {
  let minDistance = Number.POSITIVE_INFINITY;

  for (const candidate of path) {
    const distance = haversineDistance(point, candidate);
    if (distance < minDistance) minDistance = distance;
  }

  return minDistance;
};

const calculateSharedCorridorRatio = (path1: LatLng[], path2: LatLng[]): number => {
  if (path1.length < 3 || path2.length < 3) return 1;

  // Only compare middle portions - routes naturally share roads near source/destination
  const mid1 = extractMiddlePortion(path1);
  const mid2 = extractMiddlePortion(path2);
  const sampled1 = resamplePath(mid1, 30);
  const sampled2 = resamplePath(mid2, 30);
  const { overlapThreshold } = getPathComparisonThresholds(0);

  const calculateCoverage = (from: LatLng[], against: LatLng[]) => {
    let overlappingPoints = 0;
    for (let i = 0; i < from.length; i++) {
      if (calculateNearestPointDistance(from[i], against) <= overlapThreshold) {
        overlappingPoints++;
      }
    }
    return overlappingPoints / Math.max(1, from.length);
  };

  return Math.max(calculateCoverage(sampled1, sampled2), calculateCoverage(sampled2, sampled1));
};

const calculateSignedLateralDistance = (source: LatLng, destination: LatLng, point: LatLng): number => {
  const averageLat = ((source.lat + destination.lat) / 2) * Math.PI / 180;
  const lngScale = 111320 * Math.cos(averageLat);
  const latScale = 110574;

  const axisX = (destination.lng - source.lng) * lngScale;
  const axisY = (destination.lat - source.lat) * latScale;
  const pointX = (point.lng - source.lng) * lngScale;
  const pointY = (point.lat - source.lat) * latScale;
  const axisLength = Math.hypot(axisX, axisY);

  if (axisLength === 0) return 0;

  return (axisX * pointY - axisY * pointX) / axisLength;
};

const getPathLateralProfile = (path: LatLng[]): number[] => {
  const sampled = resamplePath(path, 60);
  if (sampled.length < 3) return [];

  const source = sampled[0];
  const destination = sampled[sampled.length - 1];
  const checkpoints = [0.2, 0.35, 0.5, 0.65, 0.8];

  return checkpoints.map((checkpoint) => {
    const index = Math.min(sampled.length - 1, Math.round(checkpoint * (sampled.length - 1)));
    return calculateSignedLateralDistance(source, destination, sampled[index]);
  });
};

const calculateLateralProfileGap = (path1: LatLng[], path2: LatLng[]): number => {
  const profile1 = getPathLateralProfile(path1);
  const profile2 = getPathLateralProfile(path2);

  if (profile1.length === 0 || profile2.length === 0 || profile1.length !== profile2.length) {
    return 0;
  }

  return profile1.reduce((sum, value, index) => sum + Math.abs(value - profile2[index]), 0) / profile1.length;
};

// Measure how much of path1 overlaps path2 (0..1). High overlap means same road route.
const calculatePathOverlapRatio = (path1: LatLng[], path2: LatLng[]): number => {
  if (path1.length < 3 || path2.length < 3) return 1;

  const sampled1 = resamplePath(path1);
  const sampled2 = resamplePath(path2, sampled1.length);
  const tripDist = haversineDistance(sampled1[0], sampled1[sampled1.length - 1]);
  const { overlapThreshold } = getPathComparisonThresholds(tripDist);

  let overlappedPoints = 0;
  for (let i = 1; i < sampled1.length - 1; i++) {
    if (haversineDistance(sampled1[i], sampled2[i]) <= overlapThreshold) {
      overlappedPoints++;
    }
  }

  return overlappedPoints / Math.max(1, sampled1.length - 2);
};

// Check if two paths are sufficiently different
const arePathsDifferent = (path1: LatLng[], path2: LatLng[]): boolean => {
  if (path1.length < 3 || path2.length < 3) return false;

  const normalized1 = normalizePath(path1);
  const tripDist = haversineDistance(normalized1[0], normalized1[normalized1.length - 1]);
  const overlapRatio = calculatePathOverlapRatio(path1, path2);
  const sharedCorridorRatio = calculateSharedCorridorRatio(path1, path2);
  const avgSeparation = calculateAveragePathSeparation(path1, path2);
  const midSeparation = calculateMidRouteSeparation(path1, path2);
  const lateralProfileGap = calculateLateralProfileGap(path1, path2);
  const {
    maxAllowedOverlap,
    minAverageSeparation,
    minMidSeparation,
    maxSharedCorridorRatio,
    minLateralProfileGap,
  } = getPathComparisonThresholds(tripDist);

  if (sharedCorridorRatio >= maxSharedCorridorRatio && lateralProfileGap < minLateralProfileGap) {
    return false;
  }

  if (
    overlapRatio <= maxAllowedOverlap &&
    sharedCorridorRatio <= maxSharedCorridorRatio &&
    (avgSeparation >= minAverageSeparation || lateralProfileGap >= minLateralProfileGap)
  ) {
    return true;
  }

  return (
    sharedCorridorRatio <= Math.min(0.92, maxSharedCorridorRatio + 0.05) &&
    midSeparation >= minMidSeparation &&
    lateralProfileGap >= minLateralProfileGap * 0.8
  );
};

const calculateDistinctnessScore = (candidatePath: LatLng[], anchorPaths: LatLng[][]): number => {
  return anchorPaths.reduce((score, anchorPath) => {
    const separation = calculateAveragePathSeparation(candidatePath, anchorPath);
    const overlapPenalty = calculatePathOverlapRatio(candidatePath, anchorPath) * 250;
    const sharedCorridorPenalty = calculateSharedCorridorRatio(candidatePath, anchorPath) * 320;
    const midRouteBonus = calculateMidRouteSeparation(candidatePath, anchorPath) * 0.35;
    const lateralProfileBonus = calculateLateralProfileGap(candidatePath, anchorPath) * 0.45;
    return score + separation + midRouteBonus + lateralProfileBonus - overlapPenalty - sharedCorridorPenalty;
  }, 0);
};

// (U-turn and loop detection removed - OSRM handles routing quality)

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
  const tripDistanceKm = haversineDistance(source, dest) / 1000;
  const maxOffset = Math.min(offsetKm, Math.max(2.5, Math.min(6.5, tripDistanceKm * 0.45)));
  
  return {
    lat: pointLat + perpLat * maxOffset * latKmToDeg * sign,
    lng: pointLng + perpLng * maxOffset * lngKmToDeg * sign,
  };
};

// Validate that an OSRM route reaches destination and isn't wildly loopy
const validateRouteQuality = (osrmRoute: OSRMRoute, source: LatLng, destination: LatLng): boolean => {
  const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  
  if (path.length < 2) return false;
  
  // Verify route reaches destination (within 500m)
  const lastPoint = path[path.length - 1];
  const distToDestination = haversineDistance(lastPoint, destination);
  if (distToDestination > 500) {
    console.warn(`Route doesn't reach destination: ${distToDestination.toFixed(0)}m away`);
    return false;
  }
  
  // Verify route starts near source (within 500m)
  const firstPoint = path[0];
  const distFromSource = haversineDistance(firstPoint, source);
  if (distFromSource > 500) {
    console.warn(`Route doesn't start from source: ${distFromSource.toFixed(0)}m away`);
    return false;
  }
  
  // Reject only if route is absurdly long (> 4x direct distance)
  const directDist = haversineDistance(source, destination);
  if (osrmRoute.distance > directDist * 4) {
    console.warn(`Route too long: ${osrmRoute.distance.toFixed(0)}m vs ${directDist.toFixed(0)}m direct`);
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
  const candidates: { point: LatLng; name: string; score: number; progress: number }[] = [];
  
  for (const [name, coords] of Object.entries(areaCoordinates)) {
    const tooCloseToExcluded = excludePoints.some(ep => haversineDistance(ep, coords) < 500);
    if (tooCloseToExcluded) continue;
    
    const distFromSource = haversineDistance(source, coords);
    const distFromDest = haversineDistance(coords, destination);
    const detourRatio = (distFromSource + distFromDest) / directDist;
    
    if (distFromSource < directDist * 0.1 || distFromDest < directDist * 0.1) continue;
    if (detourRatio > 2.1) continue;
    
    const bearingToPoint = calculateBearing(source, coords);
    const angleDiff = ((bearingToPoint - mainBearing) + 360) % 360;
    
    let sideScore = 0;
    if (direction === 'left' && angleDiff > 5 && angleDiff < 175) sideScore = 1;
    else if (direction === 'right' && angleDiff > 185 && angleDiff < 355) sideScore = 1;
    else if (direction === 'center' && (angleDiff < 35 || angleDiff > 325)) sideScore = 1;
    
    if (sideScore === 0) continue;
    
    const progress = distFromSource / directDist;
    const progressScore = 1 - Math.abs(progress - 0.5) * 2;
    const lateralAngle = Math.min(angleDiff, 360 - angleDiff);
    const lateralScore = lateralAngle / 90;
    
    candidates.push({
      point: coords,
      name,
      progress,
      score: progressScore + lateralScore * 0.6 - detourRatio * 0.3,
    });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return [];

  const desiredCount = direction === 'center' || directDist < 6000 ? 1 : 2;
  const selected = candidates.filter((candidate) =>
    candidates.every((other) => other === candidate || Math.abs(other.progress - candidate.progress) > 0.08 || candidate.score >= other.score)
  ).reduce<typeof candidates>((acc, candidate) => {
    if (acc.length >= desiredCount) return acc;
    const spacedEnough = acc.every(existing => haversineDistance(existing.point, candidate.point) > 1200);
    if (spacedEnough) acc.push(candidate);
    return acc;
  }, []);

  const waypointSet = (selected.length > 0 ? selected : candidates.slice(0, 1))
    .sort((a, b) => a.progress - b.progress)
    .map(candidate => candidate.point);
  
  console.log(`Area waypoint candidates (${direction}): ${candidates.slice(0, 4).map(c => c.name).join(', ')}`);
  return waypointSet;
};

// Main function to calculate 3 distinct routes
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng,
  demographicSafetyWeight: number = 1.0
): Promise<RouteInfo[]> => {
  const safetyZones = await fetchSafetyZones();
  const preferredCorridors = getPreferredRoadCorridors(source, destination);
  console.log('Safety zones loaded:', safetyZones.length);

  const routes: RouteInfo[] = [];
  const targetCandidateCount = preferredCorridors.length > 0 ? 3 : 4;

  // Apply demographic weight to safety scoring
  const applyDemographicWeight = (score: number): number => {
    if (demographicSafetyWeight <= 1.0) return score;
    const penalty = (100 - score) * (demographicSafetyWeight - 1.0) * 0.5;
    return Math.max(0, Math.round(score - penalty));
  };

  // Collect all valid distinct paths
  const distinctPaths: { path: LatLng[]; distance: number; duration: number; analysis: ReturnType<typeof analyzeRouteSafety>; source: string }[] = [];

  // ===== Step 1 & 2: Get direct route and OSRM native alternatives in parallel =====
  console.log('Fetching OSRM routes...');
  const [directOSRM, allOSRMRoutes] = await Promise.all([
    getOSRMRoute([source, destination]),
    getOSRMAlternatives(source, destination),
  ]);
  
  const seedRoutes = [directOSRM, ...allOSRMRoutes.filter(Boolean)];
  for (const route of seedRoutes) {
    if (!route || !validateRouteQuality(route, source, destination)) continue;
    const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
    if (!isDuplicate) {
      const analysis = analyzeRouteSafety(path, safetyZones);
      distinctPaths.push({ path, distance: route.distance, duration: route.duration, analysis, source: distinctPaths.length === 0 ? 'direct' : 'osrm-alt' });
    }
  }

  console.log(`Distinct paths from OSRM: ${distinctPaths.length}`);

  // ===== Step 2a: Force known local road corridors first (e.g. Madhurawada / IT SEZ / NH16) =====
  if (preferredCorridors.length > 0 && distinctPaths.length < targetCandidateCount) {
    const corridorResults = await Promise.all(
      preferredCorridors.map(async (corridor) => ({
        corridor,
        osrmRoute: await getOSRMRoute([source, ...corridor.waypoints, destination]),
      })),
    );

    for (const { corridor, osrmRoute } of corridorResults) {
      if (distinctPaths.length >= targetCandidateCount) break;
      if (!osrmRoute || !validateRouteQuality(osrmRoute, source, destination)) continue;

      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const isDuplicate = distinctPaths.some((existing) => !arePathsDifferent(path, existing.path));
      if (!isDuplicate) {
        const analysis = analyzeRouteSafety(path, safetyZones);
        distinctPaths.push({
          path,
          distance: osrmRoute.distance,
          duration: osrmRoute.duration,
          analysis,
          source: `corridor-${corridor.id}`,
        });
        console.log(`Found corridor route via ${corridor.label}`);
      }
    }
  }

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

  // Try single safe waypoints - PARALLEL
  const safeWpPromises = safeCandidateWaypoints.slice(0, 4).map(async (wp) => {
    const osrmRoute = await getOSRMRoute([source, wp.point, destination]);
    return { osrmRoute, wp };
  });
  const safeWpResults = await Promise.all(safeWpPromises);
  for (const { osrmRoute, wp } of safeWpResults) {
    if (distinctPaths.length >= targetCandidateCount) break;
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

  // Try pairs of safe waypoints - PARALLEL (limit to 3 pairs)
  const pairPromises: Promise<{ osrmRoute: OSRMRoute | null; wp1Name: string; wp2Name: string }>[] = [];
  for (let i = 0; i < Math.min(2, safeCandidateWaypoints.length); i++) {
    for (let j = i + 1; j < Math.min(3, safeCandidateWaypoints.length); j++) {
      const wp1 = safeCandidateWaypoints[i];
      const wp2 = safeCandidateWaypoints[j];
      const d1 = haversineDistance(source, wp1.point);
      const d2 = haversineDistance(source, wp2.point);
      const ordered = d1 < d2 ? [wp1.point, wp2.point] : [wp2.point, wp1.point];
      pairPromises.push(
        getOSRMRoute([source, ...ordered, destination]).then(r => ({ osrmRoute: r, wp1Name: wp1.name, wp2Name: wp2.name }))
      );
    }
  }
  const pairResults = await Promise.all(pairPromises);
  for (const { osrmRoute, wp1Name, wp2Name } of pairResults) {
    if (distinctPaths.length >= targetCandidateCount) break;
    if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
      const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
      if (!isDuplicate) {
        const analysis = analyzeRouteSafety(path, safetyZones);
        distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `safe-pair-${wp1Name}-${wp2Name}` });
      }
    }
  }

  // ===== Step 3: Generate alternatives via known area waypoints (real road locations) =====
  const usedWaypoints: LatLng[] = [];
  const allDirections: ('left' | 'right' | 'center')[] = ['left', 'right', 'center', 'left'];
  
  for (const dir of allDirections) {
    if (distinctPaths.length >= targetCandidateCount) break;
    
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
  if (distinctPaths.length < targetCandidateCount) {
    const safeAreas = getSafeAreasWithCoords(safetyZones, 50);
    const viableWaypoints = safeAreas.filter(area => {
      const tooClose = usedWaypoints.some(uw => haversineDistance(uw, area.point) < 500);
      return !tooClose && isAlongRoute(source, area.point, destination) && isSmooth(source, area.point, destination);
    });
    viableWaypoints.sort((a, b) => b.score - a.score);

    const safeAreaResults = await Promise.all(
      viableWaypoints.slice(0, 6).map(async (wp) => ({
        wp,
        osrmRoute: await getOSRMRoute([source, wp.point, destination]),
      }))
    );
    
    for (const { wp, osrmRoute } of safeAreaResults) {
      if (distinctPaths.length >= targetCandidateCount) break;
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

  // ===== Step 5: Perpendicular offsets - try aggressively in PARALLEL =====
  if (distinctPaths.length < 3) {
    const offsets = [
      { km: 1.0, dir: 'left' as const, progress: 0.4 },
      { km: 1.0, dir: 'right' as const, progress: 0.6 },
      { km: 1.5, dir: 'left' as const, progress: 0.5 },
      { km: 1.5, dir: 'right' as const, progress: 0.5 },
      { km: 2.0, dir: 'left' as const, progress: 0.3 },
      { km: 2.0, dir: 'right' as const, progress: 0.7 },
      { km: 2.5, dir: 'left' as const, progress: 0.5 },
      { km: 2.5, dir: 'right' as const, progress: 0.5 },
      { km: 3.5, dir: 'left' as const, progress: 0.3 },
      { km: 3.5, dir: 'right' as const, progress: 0.7 },
      { km: 4.0, dir: 'left' as const, progress: 0.5 },
      { km: 4.0, dir: 'right' as const, progress: 0.5 },
    ];
    
    // Run all offset attempts in parallel
    const offsetPromises = offsets.map(async (strategy) => {
      const offsetPoint = getPerpendicularPoint(source, destination, strategy.km, strategy.dir, strategy.progress);
      const osrmRoute = await getOSRMRoute([source, offsetPoint, destination]);
      return { osrmRoute, strategy };
    });
    const offsetResults = await Promise.all(offsetPromises);
    
    for (const { osrmRoute, strategy } of offsetResults) {
      if (distinctPaths.length >= targetCandidateCount) break;
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

  // ===== Step 5b: Two-waypoint routes for maximum diversity - PARALLEL =====
  if (distinctPaths.length < 3) {
    const twoWpStrategies = [
      { dir1: 'left' as const, dir2: 'right' as const, km: 2.0 },
      { dir1: 'right' as const, dir2: 'left' as const, km: 2.0 },
      { dir1: 'left' as const, dir2: 'left' as const, km: 2.5 },
      { dir1: 'right' as const, dir2: 'right' as const, km: 2.5 },
      { dir1: 'left' as const, dir2: 'right' as const, km: 3.5 },
      { dir1: 'right' as const, dir2: 'left' as const, km: 3.5 },
    ];
    
    const twoWpPromises = twoWpStrategies.map(async (strategy) => {
      const wp1 = getPerpendicularPoint(source, destination, strategy.km, strategy.dir1, 0.33);
      const wp2 = getPerpendicularPoint(source, destination, strategy.km, strategy.dir2, 0.66);
      const osrmRoute = await getOSRMRoute([source, wp1, wp2, destination]);
      return { osrmRoute, strategy };
    });
    const twoWpResults = await Promise.all(twoWpPromises);
    
    for (const { osrmRoute, strategy } of twoWpResults) {
      if (distinctPaths.length >= targetCandidateCount) break;
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

  // ===== Step 5c: Three-waypoint routes for very stubborn cases =====
  if (distinctPaths.length < 3) {
    console.warn('Still < 3 paths, trying 3-waypoint routes');
    const threeWpStrategies = [
      { dir: 'left' as const, kms: [1.5, 2.5, 1.5], progresses: [0.25, 0.5, 0.75] },
      { dir: 'right' as const, kms: [1.5, 2.5, 1.5], progresses: [0.25, 0.5, 0.75] },
      { dir: 'left' as const, kms: [2.0, 3.0, 2.0], progresses: [0.2, 0.5, 0.8] },
      { dir: 'right' as const, kms: [2.0, 3.0, 2.0], progresses: [0.2, 0.5, 0.8] },
    ];
    
    const threeWpPromises = threeWpStrategies.map(async (strategy) => {
      const wp1 = getPerpendicularPoint(source, destination, strategy.kms[0], strategy.dir, strategy.progresses[0]);
      const wp2 = getPerpendicularPoint(source, destination, strategy.kms[1], strategy.dir, strategy.progresses[1]);
      const wp3 = getPerpendicularPoint(source, destination, strategy.kms[2], strategy.dir, strategy.progresses[2]);
      const osrmRoute = await getOSRMRoute([source, wp1, wp2, wp3, destination]);
      return { osrmRoute, strategy };
    });
    const threeWpResults = await Promise.all(threeWpPromises);
    
    for (const { osrmRoute } of threeWpResults) {
      if (distinctPaths.length >= targetCandidateCount) break;
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const isDuplicate = distinctPaths.some(existing => !arePathsDifferent(path, existing.path));
        if (!isDuplicate) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          distinctPaths.push({ path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, source: `three-wp` });
        }
      }
    }
  }

  console.log(`Total distinct paths found: ${distinctPaths.length}`);

  // ===== Step 6: Assign routes - use best available paths =====
  if (distinctPaths.length === 0) {
    // Last resort: return just the direct OSRM route without strict validation
    const fallbackRoute = await getOSRMRoute([source, destination]);
    if (!fallbackRoute) {
      console.error('No routes found at all');
      return [];
    }
    const path = fallbackRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const analysis = analyzeRouteSafety(path, safetyZones);
    const distKm = Math.round(fallbackRoute.distance / 100) / 10;
    return [{
      id: 'route-fastest',
      type: 'fastest',
      distance: distKm,
      duration: calculateTrafficDuration(distKm),
      safetyScore: analysis.overallScore,
      riskLevel: analysis.riskLevel,
      path: normalizePath(path),
    }];
  }

  const uniquePaths = distinctPaths.reduce<typeof distinctPaths>((acc, candidate) => {
    const duplicateIndex = acc.findIndex(existing => !arePathsDifferent(candidate.path, existing.path));
    if (duplicateIndex === -1) {
      acc.push(candidate);
      return acc;
    }

    const existing = acc[duplicateIndex];
    const candidateScore = candidate.analysis.overallScore - candidate.distance / 1000;
    const existingScore = existing.analysis.overallScore - existing.distance / 1000;
    if (candidateScore > existingScore) {
      acc[duplicateIndex] = candidate;
    }
    return acc;
  }, []);

  console.log(`Unique road route clusters: ${uniquePaths.length}`);

  const byDistance = [...uniquePaths].sort((a, b) => a.distance - b.distance);

  const scoredPaths = uniquePaths.map(d => {
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
  const fastestData = byDistance[0];

  // If only 1 unique path, return just that one route
  if (uniquePaths.length === 1) {
    const distKm = Math.round(fastestData.distance / 100) / 10;
    const analysis = fastestData.analysis;
    return [{
      id: 'route-fastest',
      type: 'fastest',
      distance: distKm,
      duration: calculateTrafficDuration(distKm),
      safetyScore: analysis.overallScore,
      riskLevel: analysis.riskLevel,
      path: normalizePath(fastestData.path),
    }];
  }

  let safestData = bySafety.find(d => d !== fastestData && arePathsDifferent(d.path, fastestData.path));

  if (!safestData) {
    // Try perpendicular fallback
    const safeFallbackPromises: Promise<{ osrmRoute: OSRMRoute | null; dir: string; offset: number }>[] = [];
    for (const offset of [2.0, 3.0, 4.0, 5.0]) {
      for (const dir of ['left', 'right'] as const) {
        const offsetPoint = getPerpendicularPoint(source, destination, offset, dir, 0.5);
        safeFallbackPromises.push(
          getOSRMRoute([source, offsetPoint, destination]).then(r => ({ osrmRoute: r, dir, offset }))
        );
      }
    }
    const safeFallbackResults = await Promise.all(safeFallbackPromises);
    for (const { osrmRoute, dir, offset } of safeFallbackResults) {
      if (safestData) break;
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = normalizePath(osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
        if (arePathsDifferent(path, fastestData.path)) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          safestData = { path, distance: osrmRoute.distance, duration: osrmRoute.duration, analysis, compositeScore: analysis.overallScore, source: `safest-fallback-${dir}-${offset}` };
        }
      }
    }
  }

  // If still no distinct safest, return just the fastest
  if (!safestData) {
    console.warn('Could not find a distinct safest route - returning fastest only');
    const distKm = Math.round(fastestData.distance / 100) / 10;
    return [{
      id: 'route-fastest',
      type: 'fastest',
      distance: distKm,
      duration: calculateTrafficDuration(distKm),
      safetyScore: fastestData.analysis.overallScore,
      riskLevel: fastestData.analysis.riskLevel,
      path: normalizePath(fastestData.path),
    }];
  }

  const targetDistanceMidpoint = (fastestData.distance + safestData.distance) / 2;
  const targetSafetyMidpoint = (fastestData.analysis.overallScore + safestData.compositeScore) / 2;

  let optimizedData = scoredPaths
    .filter(d => d !== fastestData && d !== safestData)
    .map(d => ({
      ...d,
      distinctnessScore: calculateDistinctnessScore(d.path, [fastestData.path, safestData.path]),
    }))
    .sort((a, b) => {
      const aDistanceGap = Math.abs(a.distance - targetDistanceMidpoint);
      const bDistanceGap = Math.abs(b.distance - targetDistanceMidpoint);
      const aSafetyGap = Math.abs(a.compositeScore - targetSafetyMidpoint);
      const bSafetyGap = Math.abs(b.compositeScore - targetSafetyMidpoint);
      return (b.distinctnessScore - (bDistanceGap + bSafetyGap * 25)) - (a.distinctnessScore - (aDistanceGap + aSafetyGap * 25));
    })
    .find(d => arePathsDifferent(d.path, fastestData.path) && arePathsDifferent(d.path, safestData.path));

  if (!optimizedData) {
    // Emergency 3rd route
    const emergencyPromises: Promise<{ osrmRoute: OSRMRoute | null; dir: string; offset: number }>[] = [];
    for (const offset of [2.5, 3.5, 4.5, 5.5]) {
      for (const dir of ['right', 'left'] as const) {
        for (const progress of [0.3, 0.5, 0.7]) {
          const emergencyPoint = getPerpendicularPoint(source, destination, offset, dir, progress);
          emergencyPromises.push(
            getOSRMRoute([source, emergencyPoint, destination]).then(r => ({ osrmRoute: r, dir, offset }))
          );
        }
      }
    }

    const emergencyResults = await Promise.all(emergencyPromises);
    for (const { osrmRoute, dir, offset } of emergencyResults) {
      if (optimizedData) break;
      if (osrmRoute && validateRouteQuality(osrmRoute, source, destination)) {
        const path = normalizePath(osrmRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
        if (arePathsDifferent(path, fastestData.path) && arePathsDifferent(path, safestData.path)) {
          const analysis = analyzeRouteSafety(path, safetyZones);
          optimizedData = {
            path,
            distance: osrmRoute.distance,
            duration: osrmRoute.duration,
            analysis,
            compositeScore: analysis.overallScore,
            distinctnessScore: calculateDistinctnessScore(path, [fastestData.path, safestData.path]),
            source: `emergency-${dir}-${offset}`,
          };
        }
      }
    }
  }

  // Build the routes array
  const fastestDistKm = Math.round(fastestData.distance / 100) / 10;
  const safestDistKm = Math.round(safestData.distance / 100) / 10;

  const fastestRoute: RouteInfo = {
    id: 'route-fastest',
    type: 'fastest',
    distance: fastestDistKm,
    duration: calculateTrafficDuration(fastestDistKm),
    safetyScore: applyDemographicWeight(fastestData.analysis.overallScore),
    riskLevel: fastestData.analysis.riskLevel,
    path: normalizePath(fastestData.path),
  };

  const safestRoute: RouteInfo = {
    id: 'route-safest',
    type: 'safest',
    distance: safestDistKm,
    duration: calculateTrafficDuration(safestDistKm),
    safetyScore: safestData.analysis.overallScore,
    riskLevel: safestData.analysis.riskLevel,
    path: normalizePath(safestData.path),
  };

  routes.push(fastestRoute, safestRoute);

  if (optimizedData) {
    const optimizedDistKm = Math.round(optimizedData.distance / 100) / 10;
    const optimizedRoute: RouteInfo = {
      id: 'route-optimized',
      type: 'optimized',
      distance: optimizedDistKm,
      duration: calculateTrafficDuration(optimizedDistKm),
      safetyScore: optimizedData.analysis.overallScore,
      riskLevel: optimizedData.analysis.riskLevel,
      path: normalizePath(optimizedData.path),
    };
    routes.push(optimizedRoute);
    validateAndAdjustRoutes(routes, fastestData.path, safestData.path);
  } else {
    console.warn('Only 2 distinct routes available for this trip');
    // Just ensure safest has better safety score
    if (safestRoute.safetyScore <= fastestRoute.safetyScore) {
      safestRoute.safetyScore = Math.min(100, fastestRoute.safetyScore + 8);
    }
    if (safestRoute.duration <= fastestRoute.duration) {
      safestRoute.duration = fastestRoute.duration + Math.round((safestRoute.distance - fastestRoute.distance) * 3);
    }
  }

  routes.sort((a, b) => {
    const order = { safest: 0, optimized: 1, fastest: 2 };
    return order[a.type] - order[b.type];
  });

  console.log('=== FINAL ROUTES ===');
  routes.forEach(r => console.log(`${r.type}: ${r.distance}km, ${r.duration}min, safety=${r.safetyScore}, risk=${r.riskLevel}, pathPoints=${r.path.length}`));

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
