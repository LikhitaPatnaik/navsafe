import { LatLng, RiskLevel } from '@/types/route';

export interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

// Haversine distance in meters
export const haversineDistance = (p1: LatLng, p2: LatLng): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Map known Visakhapatnam areas to accurate coordinates (from pre_processed_db-2.xlsx)
export const areaCoordinates: Record<string, LatLng> = {
  // Extreme/High Risk Areas (Total Crimes: 50+)
  'Beach Road': { lat: 17.7174, lng: 83.3212 }, // 50 crimes - FIXED coordinate (on land along coast)
  'Dwarakanagar': { lat: 17.72867, lng: 83.308634 }, // 38 crimes
  'Dwaraka Nagar': { lat: 17.72867, lng: 83.308634 },
  'Vizianagaram': { lat: 18.1067, lng: 83.3956 }, // 38 crimes
  'Kancharapalem': { lat: 17.7354, lng: 83.2738 }, // 29 crimes
  'Gajuwaka': { lat: 17.6853, lng: 83.2037 }, // 34 crimes
  
  // Moderate-High Risk Areas
  'Simhachalam': { lat: 17.75, lng: 83.22 }, // 29 crimes
  'MVP Colony': { lat: 17.7407, lng: 83.3367 }, // 30 crimes
  'One Town': { lat: 17.7, lng: 83.29 }, // 33 crimes
  
  // Moderate-Low Risk Areas
  'Jagadamba Jct': { lat: 17.7073, lng: 83.001 }, // 25 crimes
  'Jagadamba Junction': { lat: 17.7073, lng: 83.001 },
  'Maddilapalem': { lat: 17.7382, lng: 83.323 }, // 23 crimes
  'Lawsons Bay': { lat: 17.73, lng: 83.33 }, // 24 crimes
  'Lawsons Bay Colony': { lat: 17.73, lng: 83.33 },
  'Poorna Market': { lat: 17.7064, lng: 83.2982 }, // 12 crimes
  
  // Low Risk Areas
  'Anandapuram': { lat: 17.9, lng: 83.37 }, // 21 crimes
  'Marripalem': { lat: 17.74, lng: 83.25 }, // 17 crimes
  'Steel Plant': { lat: 17.61, lng: 83.19 }, // 20 crimes
  'Steel Plant Township': { lat: 17.61, lng: 83.19 },
  'Madhurawada': { lat: 17.7957, lng: 83.3756 }, // 18 crimes - FIXED coordinate (on land)
  'Anakapalli': { lat: 17.69, lng: 83.0024 }, // 18 crimes
  'Malkapuram': { lat: 17.688, lng: 83.245 }, // 11 crimes
  'Seethammadhara': { lat: 17.7425, lng: 83.3124 }, // 8 crimes
  'Railway New Colony': { lat: 17.7245, lng: 83.2956 }, // 5 crimes
  
  // Minimal Risk Areas
  'Akkayapalem': { lat: 17.7347, lng: 83.2977 }, // 10 crimes
  'PM Palem': { lat: 17.7996, lng: 83.3531 }, // 4 crimes
  'Yendada': { lat: 17.77, lng: 83.36 }, // 8 crimes
  'NAD': { lat: 17.74, lng: 83.23 }, // 12 crimes
  'NAD Junction': { lat: 17.74, lng: 83.23 },
  
  // Safe Areas
  'Bheemunipatnam': { lat: 17.89, lng: 83.45 }, // 4 crimes
  'Arilova': { lat: 17.7673, lng: 83.3134 }, // 9 crimes
  'RTC Complex': { lat: 17.72, lng: 83.31 }, // 4 crimes
  'Kommadhi': { lat: 17.72, lng: 83.31 }, // 2 crimes
  'Kommadi': { lat: 17.72, lng: 83.31 },
  'Marikavalasa': { lat: 17.8359, lng: 83.3581 }, // 2 crimes
  'Sheelanagar': { lat: 17.719, lng: 83.202 }, // 2 crimes
  'Sheela Nagar': { lat: 17.719, lng: 83.202 },
  'Allipuram': { lat: 17.7162, lng: 83.2965 }, // 1 crime
  
  // Very Safe Areas
  'Tagarapuvalasa': { lat: 17.5611, lng: 83.2267 }, // 1 crime - FIXED coordinate (on land)
  'Bhogapuram': { lat: 18.03, lng: 83.49 }, // 2 crimes
  'Boyapalem': { lat: 17.7312, lng: 83.2859 }, // 1 crime - FIXED coordinate
  'Kurmannapalem': { lat: 17.69, lng: 83.17 }, // 1 crime
  'Siripuram': { lat: 17.7198, lng: 83.3163 }, // 1 crime
};

// Get nearest safety zone info for a given point
export const getNearestSafetyZone = (
  point: LatLng,
  safetyZones: SafetyZone[]
): { safetyScore: number; areaName: string } | null => {
  if (safetyZones.length === 0) return null;

  let nearestZone: SafetyZone | null = null;
  let nearestDistance = Infinity;

  for (const zone of safetyZones) {
    const normalizedArea = zone.area.toLowerCase();
    let zoneCenter: LatLng | null = null;
    
    for (const [key, coords] of Object.entries(areaCoordinates)) {
      if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
        zoneCenter = coords;
        break;
      }
    }
    
    if (!zoneCenter) continue;

    const distance = haversineDistance(point, zoneCenter);
    
    // If within ~2km of a zone
    if (distance < 2000 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }

  if (nearestZone) {
    return {
      safetyScore: nearestZone.safety_score,
      areaName: nearestZone.area
    };
  }

  return null;
};

// Get safety score for a point based on nearby safety zones
export const getSafetyScoreForPoint = (
  point: LatLng,
  safetyZones: SafetyZone[]
): number => {
  const nearest = getNearestSafetyZone(point, safetyZones);
  return nearest ? nearest.safetyScore : 70;
};

/**
 * Find the best safe waypoints to create a distinct safe path
 * This generates waypoints through high-safety areas
 */
export const findSafeWaypoints = (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  maxExtraDistance: number = 7000
): LatLng[] => {
  const directDistance = haversineDistance(source, destination);
  const maxTotalDistance = directDistance + maxExtraDistance;

  // Get all safe areas (score >= 70) with their coordinates
  const safeAreaPoints: { point: LatLng; score: number; name: string }[] = [];
  
  for (const zone of safetyZones) {
    if (zone.safety_score >= 70) {
      const normalizedArea = zone.area.toLowerCase();
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
          safeAreaPoints.push({
            point: coords,
            score: zone.safety_score,
            name: zone.area
          });
          break;
        }
      }
    }
  }

  if (safeAreaPoints.length === 0) {
    return [source, destination];
  }

  // Filter areas that are reachable within distance constraint
  const reachableAreas = safeAreaPoints.filter(area => {
    const distViaArea = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
    return distViaArea <= maxTotalDistance;
  });

  if (reachableAreas.length === 0) {
    return [source, destination];
  }

  // Sort by safety score (highest first)
  reachableAreas.sort((a, b) => b.score - a.score);

  // Use A* to find the best path through safe areas
  const bestPath = aStarThroughSafeAreas(source, destination, reachableAreas, maxTotalDistance);
  
  console.log('Safe waypoints found:', bestPath.map(p => 
    reachableAreas.find(a => a.point.lat === p.lat && a.point.lng === p.lng)?.name || 'start/end'
  ));

  return bestPath;
};

/**
 * A* algorithm to find optimal path through safe areas
 */
const aStarThroughSafeAreas = (
  source: LatLng,
  destination: LatLng,
  safeAreas: { point: LatLng; score: number; name: string }[],
  maxDistance: number
): LatLng[] => {
  interface Node {
    point: LatLng;
    score: number;
    g: number; // distance from start
    h: number; // heuristic (distance to goal)
    f: number; // g + h - safety bonus
    parent: Node | null;
  }

  const startNode: Node = {
    point: source,
    score: 70,
    g: 0,
    h: haversineDistance(source, destination),
    f: haversineDistance(source, destination),
    parent: null
  };

  const endNode: Node = {
    point: destination,
    score: 70,
    g: Infinity,
    h: 0,
    f: Infinity,
    parent: null
  };

  const openSet: Node[] = [startNode];
  const closedSet = new Set<string>();

  const pointKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    const key = pointKey(current.point);
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    // Check if we've reached destination
    const distToDest = haversineDistance(current.point, destination);
    if (distToDest < 500) { // Within 500m of destination
      // Reconstruct path
      const path: LatLng[] = [destination];
      let node: Node | null = current;
      while (node) {
        path.unshift(node.point);
        node = node.parent;
      }
      return path;
    }

    // Explore neighbors: all safe areas + destination
    const neighbors = [...safeAreas.map(a => ({ point: a.point, score: a.score })), { point: destination, score: 70 }];

    for (const neighbor of neighbors) {
      const nKey = pointKey(neighbor.point);
      if (closedSet.has(nKey)) continue;

      const g = current.g + haversineDistance(current.point, neighbor.point);
      
      // Skip if exceeds max distance
      if (g + haversineDistance(neighbor.point, destination) > maxDistance) continue;

      const h = haversineDistance(neighbor.point, destination);
      // f = g + h - safetyBonus (higher safety = lower cost)
      const safetyBonus = (neighbor.score - 50) * 50; // Convert safety to distance bonus
      const f = g + h - safetyBonus;

      const existingIdx = openSet.findIndex(n => pointKey(n.point) === nKey);
      if (existingIdx >= 0 && openSet[existingIdx].g <= g) continue;

      const newNode: Node = {
        point: neighbor.point,
        score: neighbor.score,
        g,
        h,
        f,
        parent: current
      };

      if (existingIdx >= 0) {
        openSet[existingIdx] = newNode;
      } else {
        openSet.push(newNode);
      }
    }
  }

  // No path found through safe areas, return direct
  return [source, destination];
};

/**
 * Generate waypoints for optimized route (intermediate between fast and safe)
 */
export const findOptimizedWaypoints = (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  fastestDistance: number
): LatLng[] => {
  const directDistance = haversineDistance(source, destination);
  // Allow 3-4km extra for optimized (between 0 for fastest and 5-7 for safest)
  const maxExtraDistance = Math.min(4000, (7000 - 0) / 2);

  // Get moderately safe areas (score >= 60)
  const safeAreaPoints: { point: LatLng; score: number }[] = [];
  
  for (const zone of safetyZones) {
    if (zone.safety_score >= 60) {
      const normalizedArea = zone.area.toLowerCase();
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
          safeAreaPoints.push({ point: coords, score: zone.safety_score });
          break;
        }
      }
    }
  }

  // Filter by distance
  const reachableAreas = safeAreaPoints.filter(area => {
    const distViaArea = haversineDistance(source, area.point) + haversineDistance(area.point, destination);
    return distViaArea <= directDistance + maxExtraDistance;
  });

  if (reachableAreas.length === 0) return [source, destination];

  // Pick ONE middle waypoint with good safety
  // Sort by balanced score: safety - distance penalty
  reachableAreas.sort((a, b) => {
    const aExtraDist = haversineDistance(source, a.point) + haversineDistance(a.point, destination) - directDistance;
    const bExtraDist = haversineDistance(source, b.point) + haversineDistance(b.point, destination) - directDistance;
    const aBalanced = a.score - (aExtraDist / 100);
    const bBalanced = b.score - (bExtraDist / 100);
    return bBalanced - aBalanced;
  });

  const bestMid = reachableAreas[0];
  return [source, bestMid.point, destination];
};

// Calculate safety statistics for a route
export const analyzeRouteSafety = (
  path: LatLng[],
  safetyZones: SafetyZone[]
): {
  overallScore: number;
  riskLevel: RiskLevel;
  dangerousAreas: string[];
  safeAreas: string[];
} => {
  const areaScores: Map<string, number[]> = new Map();
  const scores: number[] = [];

  // Sample points for performance
  const sampleRate = Math.max(1, Math.floor(path.length / 50));
  for (let i = 0; i < path.length; i += sampleRate) {
    const point = path[i];
    const score = getSafetyScoreForPoint(point, safetyZones);
    scores.push(score);

    // Find matching zone
    for (const zone of safetyZones) {
      const normalizedArea = zone.area.toLowerCase();
      let zoneCenter: LatLng | null = null;
      
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
          zoneCenter = coords;
          break;
        }
      }
      
      if (zoneCenter && haversineDistance(point, zoneCenter) < 2000) {
        const existing = areaScores.get(zone.area) || [];
        existing.push(zone.safety_score);
        areaScores.set(zone.area, existing);
      }
    }
  }

  const overallScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 70;

  const dangerousAreas: string[] = [];
  const safeAreas: string[] = [];

  areaScores.forEach((scores, area) => {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore < 50) {
      dangerousAreas.push(area);
    } else if (avgScore >= 75) {
      safeAreas.push(area);
    }
  });

  let riskLevel: RiskLevel = 'moderate';
  if (overallScore >= 70) riskLevel = 'safe';
  else if (overallScore < 50) riskLevel = 'risky';

  return {
    overallScore: Math.round(overallScore),
    riskLevel,
    dangerousAreas,
    safeAreas,
  };
};

// Calculate path distance
export const calculatePathDistance = (path: LatLng[]): number => {
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    distance += haversineDistance(path[i - 1], path[i]);
  }
  return distance;
};
