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

// Map known Visakhapatnam areas to accurate coordinates (from FINAL_PREPROCESSED_DB.xlsx)
export const areaCoordinates: Record<string, LatLng> = {
  // Extreme Risk (SafetyScore 0-2)
  'Anakapalle NH16': { lat: 17.6913, lng: 83.0039 },
  'One Town Heritage': { lat: 17.7000, lng: 83.2900 },
  'One Town': { lat: 17.7000, lng: 83.2900 },
  'Jagadamba Jct': { lat: 17.7105, lng: 83.2980 },
  'Jagadamba Junction': { lat: 17.7105, lng: 83.2980 },
  'Pendurthi Vepagunta': { lat: 17.7977, lng: 83.1943 },
  'Pendurthi': { lat: 17.7977, lng: 83.1943 },

  // High Risk (SafetyScore 2-4)
  'RK Beach South': { lat: 17.7180, lng: 83.3250 },
  'RK Beach': { lat: 17.7180, lng: 83.3250 },
  'Beach Road': { lat: 17.7215, lng: 83.3150 },
  'NAD Flyover Zone': { lat: 17.7400, lng: 83.2300 },
  'NAD': { lat: 17.7400, lng: 83.2300 },
  'NAD Junction': { lat: 17.7400, lng: 83.2300 },
  'Dwaraka Nagar Hub': { lat: 17.7287, lng: 83.3086 },
  'Dwarakanagar': { lat: 17.7287, lng: 83.3086 },
  'Dwaraka Nagar': { lat: 17.7287, lng: 83.3086 },
  'Rushikonda North': { lat: 17.7920, lng: 83.3850 },
  'Rushikonda': { lat: 17.7920, lng: 83.3850 },
  'Kancharapalem Core': { lat: 17.7354, lng: 83.2738 },
  'Kancharapalem': { lat: 17.7354, lng: 83.2738 },
  'Arilova': { lat: 17.7673, lng: 83.3134 },
  'Gajuwaka Industrial': { lat: 17.6853, lng: 83.2037 },
  'Gajuwaka': { lat: 17.6853, lng: 83.2037 },
  'Maddilapalem Jct': { lat: 17.7382, lng: 83.3230 },
  'Maddilapalem': { lat: 17.7382, lng: 83.3230 },

  // Moderate Risk (SafetyScore 4-6)
  'Old Gajuwaka': { lat: 17.6850, lng: 83.2040 },
  'Marripalem': { lat: 17.7400, lng: 83.2500 },
  'Lawsons Bay': { lat: 17.7300, lng: 83.3300 },
  'Lawsons Bay Colony': { lat: 17.7300, lng: 83.3300 },
  'Anandapuram Bypass': { lat: 17.9000, lng: 83.3700 },
  'Anandapuram': { lat: 17.9000, lng: 83.3700 },
  'Akkayapalem Central': { lat: 17.7347, lng: 83.2977 },
  'Akkayapalem': { lat: 17.7347, lng: 83.2977 },
  'Anakapalle Central': { lat: 17.6890, lng: 83.0035 },
  'Anakapalli': { lat: 17.6890, lng: 83.0035 },
  'MVP Colony Core': { lat: 17.7407, lng: 83.3367 },
  'MVP Colony': { lat: 17.7407, lng: 83.3367 },

  // Low Risk (SafetyScore 6-8)
  'Madhurawada Hub': { lat: 17.8017, lng: 83.3533 },
  'Madhurawada': { lat: 17.8017, lng: 83.3533 },
  'Bheemunipatnam': { lat: 17.8900, lng: 83.4500 },
  'Sheelanagar': { lat: 17.7185, lng: 83.1984 },
  'Sheela Nagar': { lat: 17.7185, lng: 83.1984 },
  'Simhachalam Ghat': { lat: 17.7669, lng: 83.2484 },
  'Simhachalam': { lat: 17.7669, lng: 83.2484 },
  'Steel Plant East': { lat: 17.6100, lng: 83.1900 },
  'Steel Plant': { lat: 17.6100, lng: 83.1900 },
  'PM Palem': { lat: 17.7990, lng: 83.3531 },

  // Safe (SafetyScore 8-10)
  'Steel Plant West': { lat: 17.6080, lng: 83.1880 },
  'Vizianagaram Town': { lat: 18.1067, lng: 83.3956 },
  'Vizianagaram': { lat: 18.1067, lng: 83.3956 },
  'Vizianagaram Rural': { lat: 18.12, lng: 83.42 },
  'Seethammadhara': { lat: 17.7425, lng: 83.3124 },
  'Tagarapuvalasa': { lat: 17.9301, lng: 83.4257 },

  // Additional aliases for routing
  'Siripuram': { lat: 17.7198, lng: 83.3163 },
  'Dabagardens': { lat: 17.7150, lng: 83.3050 },
  'Gopalapatnam': { lat: 17.7481, lng: 83.2187 },
  'Waltair': { lat: 17.7280, lng: 83.3200 },
  'Andhra University': { lat: 17.7320, lng: 83.3190 },
  'Port Area': { lat: 17.6950, lng: 83.2850 },
  'Kommadi': { lat: 17.8306, lng: 83.3358 },
  'Kommadhi': { lat: 17.8306, lng: 83.3358 }, // alias → Kommadi
  'RTC Complex': { lat: 17.7200, lng: 83.3100 },
  'Allipuram': { lat: 17.7193, lng: 83.2971 },
  'Malkapuram': { lat: 17.6880, lng: 83.2450 },
  'Poorna Market': { lat: 17.7064, lng: 83.2982 },
  'Railway New Colony': { lat: 17.7245, lng: 83.2956 },
  'Yendada': { lat: 17.7772, lng: 83.3628 },
  'Boyapalem': { lat: 17.7312, lng: 83.2859 },
  'Kurmannapalem': { lat: 17.6900, lng: 83.1700 },
  'Balayya Sastri Layout': { lat: 17.7250, lng: 83.3050 },
  'Daspalla Hills': { lat: 17.7220, lng: 83.3100 },
  'Vishalakshinagar': { lat: 17.7350, lng: 83.3200 },
  'Venkojipalem': { lat: 17.7456, lng: 83.3289 },
  'Scindia': { lat: 17.7150, lng: 83.2900 },
  'Ghat road': { lat: 17.7650, lng: 83.2380 },
  'Marikavalasa': { lat: 17.8359, lng: 83.3581 },
  'Bhogapuram': { lat: 18.0300, lng: 83.4900 },
  'Steel Plant Township': { lat: 17.6100, lng: 83.1900 },
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
