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

// Map known Visakhapatnam areas to approximate coordinates
export const areaCoordinates: Record<string, LatLng> = {
  // Original 33 areas
  'Gajuwaka': { lat: 17.7047, lng: 83.2113 },
  'Gopalapatnam': { lat: 17.7458, lng: 83.2614 },
  'Dwaraka Nagar': { lat: 17.7242, lng: 83.3059 },
  'MVP Colony': { lat: 17.7367, lng: 83.2851 },
  'Kancharapalem': { lat: 17.7180, lng: 83.2760 },
  'Madhurawada': { lat: 17.7833, lng: 83.3667 },
  'Pendurthi': { lat: 17.7909, lng: 83.2467 },
  'Seethammadhara': { lat: 17.7305, lng: 83.2987 },
  'Simhachalam': { lat: 17.7667, lng: 83.2500 },
  'Visakhapatnam Steel Plant Area': { lat: 17.6403, lng: 83.1638 },
  'Akkayyapalem': { lat: 17.7294, lng: 83.2935 },
  'Arilova': { lat: 17.7633, lng: 83.3083 },
  'Lawsons Bay': { lat: 17.7200, lng: 83.3400 },
  'Beach Road': { lat: 17.7050, lng: 83.3217 },
  'Jagadamba': { lat: 17.7142, lng: 83.3017 },
  'Railway New Colony': { lat: 17.7100, lng: 83.2900 },
  'One Town': { lat: 17.6967, lng: 83.2917 },
  'CBM Compound': { lat: 17.6900, lng: 83.2850 },
  'Allipuram': { lat: 17.7058, lng: 83.2942 },
  'Dabagardens': { lat: 17.7283, lng: 83.3017 },
  'Pothinamallayya Palem': { lat: 17.7450, lng: 83.2750 },
  'Kurmannapalem': { lat: 17.7550, lng: 83.2350 },
  'Naidu Thota': { lat: 17.7025, lng: 83.2958 },
  'Waltair': { lat: 17.7217, lng: 83.3200 },
  'Kirlampudi': { lat: 17.7333, lng: 83.3233 },
  'Rushikonda': { lat: 17.7689, lng: 83.3842 },
  'NAD Junction': { lat: 17.7283, lng: 83.2533 },
  'Isukathota': { lat: 17.7700, lng: 83.3700 },
  'Kommadi': { lat: 17.8000, lng: 83.3850 },
  'PM Palem': { lat: 17.7550, lng: 83.3650 },
  'Yendada': { lat: 17.7833, lng: 83.3833 },
  'Sagar Nagar': { lat: 17.7617, lng: 83.3533 },
  'Thatichetlapalem': { lat: 17.7383, lng: 83.2933 },
  // Additional 25 areas
  'Bheemunipatnam': { lat: 17.8908, lng: 83.4528 },
  'Anakapalli': { lat: 17.6914, lng: 83.0042 },
  'Pedagantyada': { lat: 17.7583, lng: 83.2833 },
  'Chinagadili': { lat: 17.8167, lng: 83.4000 },
  'Gnanapuram': { lat: 17.7175, lng: 83.3100 },
  'Maharanipeta': { lat: 17.7050, lng: 83.3050 },
  'Siripuram': { lat: 17.7200, lng: 83.3150 },
  'Dondaparthy': { lat: 17.7517, lng: 83.2967 },
  'Murali Nagar': { lat: 17.7400, lng: 83.2800 },
  'Ramnagar': { lat: 17.7133, lng: 83.2867 },
  'Peda Waltair': { lat: 17.7267, lng: 83.3267 },
  'Chinna Waltair': { lat: 17.7183, lng: 83.3317 },
  'RK Beach': { lat: 17.7117, lng: 83.3283 },
  'Kailasapuram': { lat: 17.7583, lng: 83.2617 },
  'Gidijala': { lat: 17.7950, lng: 83.3050 },
  'Marripalem': { lat: 17.7750, lng: 83.3600 },
  'Hanumanthawaka': { lat: 17.6850, lng: 83.2783 },
  'Malkapuram': { lat: 17.7100, lng: 83.2200 },
  'Nathayyapalem': { lat: 17.6950, lng: 83.2650 },
  'Kommadi Junction': { lat: 17.8050, lng: 83.3900 },
  'Timmapuram': { lat: 17.8200, lng: 83.4100 },
  'Lankelapalem': { lat: 17.8350, lng: 83.4200 },
  'Sriharipuram': { lat: 17.7350, lng: 83.2700 },
  'HB Colony': { lat: 17.7450, lng: 83.3050 },
  'Jodugullapalem': { lat: 17.7600, lng: 83.3950 },
};

// Get safety score for a point based on nearby safety zones
export const getSafetyScoreForPoint = (
  point: LatLng,
  safetyZones: SafetyZone[]
): number => {
  if (safetyZones.length === 0) return 70;

  let nearestScore = 70;
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
    
    // If within ~2km of a zone, use its safety score
    if (distance < 2000 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestScore = zone.safety_score;
    }
  }

  return nearestScore;
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
