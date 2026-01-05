import { LatLng, RiskLevel } from '@/types/route';

interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

interface GraphNode {
  point: LatLng;
  neighbors: { node: GraphNode; distance: number; safetyScore: number }[];
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

// Calculate safety penalty (higher penalty for lower safety scores)
const calculateSafetyPenalty = (safetyScore: number): number => {
  const normalizedScore = Math.max(0, Math.min(100, safetyScore));
  // Penalty ranges from 1 (safest) to 5 (most dangerous)
  return 1 + (4 * (100 - normalizedScore)) / 100;
};

// Build a graph from route path for pathfinding
const buildGraphFromPath = (
  path: LatLng[],
  safetyZones: SafetyZone[]
): Map<string, GraphNode> => {
  const graph = new Map<string, GraphNode>();
  
  // Create nodes for each point
  path.forEach((point, idx) => {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    graph.set(key, {
      point,
      neighbors: [],
    });
  });
  
  // Connect sequential nodes
  const nodes = Array.from(graph.values());
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const distance = haversineDistance(current.point, next.point);
    const midPoint = {
      lat: (current.point.lat + next.point.lat) / 2,
      lng: (current.point.lng + next.point.lng) / 2,
    };
    const safetyScore = getSafetyScoreForPoint(midPoint, safetyZones);
    
    current.neighbors.push({ node: next, distance, safetyScore });
    next.neighbors.push({ node: current, distance, safetyScore });
  }
  
  return graph;
};

// Priority Queue for Dijkstra/A*
class PriorityQueue<T> {
  private items: { element: T; priority: number }[] = [];
  
  enqueue(element: T, priority: number) {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }
  
  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * DIJKSTRA'S ALGORITHM for fastest route
 * Pure shortest path - minimizes distance only
 */
export const dijkstraFastest = (
  path: LatLng[],
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[]
): { path: LatLng[]; totalDistance: number; safetyScore: number; riskLevel: RiskLevel } => {
  if (path.length < 2) {
    return { path, totalDistance: 0, safetyScore: 70, riskLevel: 'moderate' };
  }
  
  const graph = buildGraphFromPath(path, safetyZones);
  const nodes = Array.from(graph.values());
  
  // Distance map
  const distances = new Map<GraphNode, number>();
  const previous = new Map<GraphNode, GraphNode | null>();
  const pq = new PriorityQueue<GraphNode>();
  
  // Initialize
  nodes.forEach(node => {
    distances.set(node, Infinity);
    previous.set(node, null);
  });
  
  const startNode = nodes[0];
  const endNode = nodes[nodes.length - 1];
  
  distances.set(startNode, 0);
  pq.enqueue(startNode, 0);
  
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    
    if (current === endNode) break;
    
    const currentDist = distances.get(current) || Infinity;
    
    for (const { node: neighbor, distance } of current.neighbors) {
      const newDist = currentDist + distance;
      
      if (newDist < (distances.get(neighbor) || Infinity)) {
        distances.set(neighbor, newDist);
        previous.set(neighbor, current);
        pq.enqueue(neighbor, newDist);
      }
    }
  }
  
  // Reconstruct path
  const resultPath: LatLng[] = [];
  let current: GraphNode | null = endNode;
  while (current) {
    resultPath.unshift(current.point);
    current = previous.get(current) || null;
  }
  
  // Calculate safety score for the path
  const { overallScore, riskLevel } = analyzeRouteSafety(resultPath, safetyZones);
  
  return {
    path: resultPath.length > 0 ? resultPath : path,
    totalDistance: distances.get(endNode) || 0,
    safetyScore: overallScore,
    riskLevel,
  };
};

/**
 * A* ALGORITHM for safest route
 * Minimizes combined cost: distance * safety_penalty
 * Constrained to max 5km more than fastest route
 */
export const aStarSafest = (
  path: LatLng[],
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  maxExtraDistance: number = 5000 // 5km max extra distance
): { path: LatLng[]; totalDistance: number; safetyScore: number; riskLevel: RiskLevel } => {
  if (path.length < 2) {
    return { path, totalDistance: 0, safetyScore: 70, riskLevel: 'moderate' };
  }
  
  // First get shortest distance using Dijkstra
  const fastestResult = dijkstraFastest(path, source, destination, safetyZones);
  const shortestDistance = fastestResult.totalDistance;
  const maxAllowedDistance = shortestDistance + maxExtraDistance;
  
  // Generate alternative waypoints that avoid dangerous areas
  const alternativePath = generateSafeWaypoints(path, safetyZones, source, destination);
  const graph = buildGraphFromPath(alternativePath, safetyZones);
  const nodes = Array.from(graph.values());
  
  // A* with safety-weighted cost
  const gScore = new Map<GraphNode, number>();
  const fScore = new Map<GraphNode, number>();
  const previous = new Map<GraphNode, GraphNode | null>();
  const pq = new PriorityQueue<GraphNode>();
  
  nodes.forEach(node => {
    gScore.set(node, Infinity);
    fScore.set(node, Infinity);
    previous.set(node, null);
  });
  
  const startNode = nodes[0];
  const endNode = nodes[nodes.length - 1];
  
  gScore.set(startNode, 0);
  const h = haversineDistance(startNode.point, endNode.point);
  fScore.set(startNode, h);
  pq.enqueue(startNode, h);
  
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    
    if (current === endNode) break;
    
    const currentG = gScore.get(current) || Infinity;
    
    // Skip if we've exceeded max allowed distance
    if (currentG > maxAllowedDistance) continue;
    
    for (const { node: neighbor, distance, safetyScore } of current.neighbors) {
      // A* cost: distance * safety penalty (lower safety = higher cost)
      const safetyPenalty = calculateSafetyPenalty(safetyScore);
      const edgeCost = distance * safetyPenalty;
      
      const tentativeG = currentG + edgeCost;
      
      if (tentativeG < (gScore.get(neighbor) || Infinity)) {
        previous.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        
        const heuristic = haversineDistance(neighbor.point, endNode.point);
        const avgSafetyToEnd = getSafetyScoreForPoint(neighbor.point, safetyZones);
        const hPenalty = calculateSafetyPenalty(avgSafetyToEnd);
        
        fScore.set(neighbor, tentativeG + heuristic * hPenalty);
        pq.enqueue(neighbor, fScore.get(neighbor)!);
      }
    }
  }
  
  // Reconstruct path
  const resultPath: LatLng[] = [];
  let current: GraphNode | null = endNode;
  let actualDistance = 0;
  
  while (current) {
    resultPath.unshift(current.point);
    const prev = previous.get(current);
    if (prev) {
      actualDistance += haversineDistance(prev.point, current.point);
    }
    current = prev;
  }
  
  // If no valid path found or path exceeds limit, return modified fastest
  if (resultPath.length === 0 || actualDistance > maxAllowedDistance) {
    // Return fastest path but with safety analysis
    return fastestResult;
  }
  
  const { overallScore, riskLevel } = analyzeRouteSafety(resultPath, safetyZones);
  
  return {
    path: resultPath,
    totalDistance: actualDistance,
    safetyScore: overallScore,
    riskLevel,
  };
};

/**
 * Generate waypoints that avoid dangerous areas
 * @param strategy - 'left', 'right', or 'optimal' deviation strategy
 */
const generateSafeWaypoints = (
  originalPath: LatLng[],
  safetyZones: SafetyZone[],
  source: LatLng,
  destination: LatLng,
  strategy: 'left' | 'right' | 'optimal' = 'optimal'
): LatLng[] => {
  const waypoints: LatLng[] = [source];
  
  // Sample original path and add deviation points for dangerous areas
  const sampleRate = Math.max(1, Math.floor(originalPath.length / 20));
  
  for (let i = sampleRate; i < originalPath.length - sampleRate; i += sampleRate) {
    const point = originalPath[i];
    const safetyScore = getSafetyScoreForPoint(point, safetyZones);
    
    if (safetyScore < 50) {
      // Add deviated point
      const direction = {
        lat: destination.lat - source.lat,
        lng: destination.lng - source.lng,
      };
      const perpLat = -direction.lng;
      const perpLng = direction.lat;
      const perpMag = Math.sqrt(perpLat * perpLat + perpLng * perpLng);
      
      if (perpMag > 0) {
        const offset = 0.01; // ~1km offset for better deviation
        
        if (strategy === 'left') {
          // Always deviate left
          const leftPoint = {
            lat: point.lat + (perpLat / perpMag) * offset,
            lng: point.lng + (perpLng / perpMag) * offset,
          };
          waypoints.push(leftPoint);
        } else if (strategy === 'right') {
          // Always deviate right
          const rightPoint = {
            lat: point.lat - (perpLat / perpMag) * offset,
            lng: point.lng - (perpLng / perpMag) * offset,
          };
          waypoints.push(rightPoint);
        } else {
          // Optimal: try both directions, pick safer
          const leftPoint = {
            lat: point.lat + (perpLat / perpMag) * offset,
            lng: point.lng + (perpLng / perpMag) * offset,
          };
          const rightPoint = {
            lat: point.lat - (perpLat / perpMag) * offset,
            lng: point.lng - (perpLng / perpMag) * offset,
          };
          
          const leftSafety = getSafetyScoreForPoint(leftPoint, safetyZones);
          const rightSafety = getSafetyScoreForPoint(rightPoint, safetyZones);
          
          if (leftSafety >= rightSafety && leftSafety > safetyScore) {
            waypoints.push(leftPoint);
          } else if (rightSafety > safetyScore) {
            waypoints.push(rightPoint);
          } else {
            waypoints.push(point);
          }
        }
      } else {
        waypoints.push(point);
      }
    } else {
      waypoints.push(point);
    }
  }
  
  waypoints.push(destination);
  return waypoints;
};

/**
 * Generate multiple alternative safe routes using different deviation strategies
 */
export const generateAlternativeSafeRoutes = (
  originalPath: LatLng[],
  safetyZones: SafetyZone[],
  source: LatLng,
  destination: LatLng
): { path: LatLng[]; strategy: string }[] => {
  const alternatives: { path: LatLng[]; strategy: string }[] = [];
  
  // Strategy 1: Optimal (pick best at each point)
  alternatives.push({
    path: generateSafeWaypoints(originalPath, safetyZones, source, destination, 'optimal'),
    strategy: 'optimal'
  });
  
  // Strategy 2: Left deviation
  alternatives.push({
    path: generateSafeWaypoints(originalPath, safetyZones, source, destination, 'left'),
    strategy: 'left'
  });
  
  // Strategy 3: Right deviation
  alternatives.push({
    path: generateSafeWaypoints(originalPath, safetyZones, source, destination, 'right'),
    strategy: 'right'
  });
  
  // Strategy 4: Route through known safe areas
  const safeAreaRoute = generateRouteThroughSafeAreas(source, destination, safetyZones);
  if (safeAreaRoute.length > 2) {
    alternatives.push({
      path: safeAreaRoute,
      strategy: 'safe-areas'
    });
  }
  
  return alternatives;
};

/**
 * Generate a route that passes through known safe areas
 */
const generateRouteThroughSafeAreas = (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[]
): LatLng[] => {
  // Get safe areas (score >= 80)
  const safeAreas = safetyZones
    .filter(zone => zone.safety_score >= 80)
    .map(zone => {
      const normalizedArea = zone.area.toLowerCase();
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
          return { ...coords, score: zone.safety_score, name: zone.area };
        }
      }
      return null;
    })
    .filter((area): area is LatLng & { score: number; name: string } => area !== null);
  
  if (safeAreas.length === 0) return [source, destination];
  
  // Find safe areas that are along the general direction of travel
  const directDistance = haversineDistance(source, destination);
  const relevantSafeAreas = safeAreas.filter(area => {
    const distToSource = haversineDistance(source, area);
    const distToDest = haversineDistance(area, destination);
    // Only include if it's not too far out of the way (within 50% extra distance)
    return distToSource + distToDest < directDistance * 1.5;
  });
  
  // Sort by safety score (highest first)
  relevantSafeAreas.sort((a, b) => b.score - a.score);
  
  // Take top 3 safe waypoints
  const waypoints = relevantSafeAreas.slice(0, 3);
  
  // Sort waypoints by distance from source
  waypoints.sort((a, b) => haversineDistance(source, a) - haversineDistance(source, b));
  
  return [source, ...waypoints, destination];
};

/**
 * OPTIMIZED ROUTE: Blend of fastest and safest
 * Uses weighted average: 50% distance priority, 50% safety priority
 */
export const calculateOptimizedRoute = (
  path: LatLng[],
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  fastestResult: { path: LatLng[]; totalDistance: number },
  safestResult: { path: LatLng[]; totalDistance: number }
): { path: LatLng[]; totalDistance: number; safetyScore: number; riskLevel: RiskLevel } => {
  if (path.length < 2) {
    return { path, totalDistance: 0, safetyScore: 70, riskLevel: 'moderate' };
  }
  
  const graph = buildGraphFromPath(path, safetyZones);
  const nodes = Array.from(graph.values());
  
  // Optimized uses balanced cost: 0.5 * distance + 0.5 * (distance * safety_penalty)
  const gScore = new Map<GraphNode, number>();
  const fScore = new Map<GraphNode, number>();
  const previous = new Map<GraphNode, GraphNode | null>();
  const pq = new PriorityQueue<GraphNode>();
  
  nodes.forEach(node => {
    gScore.set(node, Infinity);
    fScore.set(node, Infinity);
    previous.set(node, null);
  });
  
  const startNode = nodes[0];
  const endNode = nodes[nodes.length - 1];
  
  gScore.set(startNode, 0);
  fScore.set(startNode, haversineDistance(startNode.point, endNode.point));
  pq.enqueue(startNode, fScore.get(startNode)!);
  
  // Max distance is average of fastest and safest + small buffer
  const maxDistance = (fastestResult.totalDistance + safestResult.totalDistance) / 2 + 2000;
  
  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    
    if (current === endNode) break;
    
    const currentG = gScore.get(current) || Infinity;
    if (currentG > maxDistance) continue;
    
    for (const { node: neighbor, distance, safetyScore } of current.neighbors) {
      // Balanced cost: 50% pure distance, 50% safety-adjusted
      const safetyPenalty = calculateSafetyPenalty(safetyScore);
      const balancedCost = 0.5 * distance + 0.5 * (distance * safetyPenalty);
      
      const tentativeG = currentG + balancedCost;
      
      if (tentativeG < (gScore.get(neighbor) || Infinity)) {
        previous.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        
        const heuristic = haversineDistance(neighbor.point, endNode.point);
        fScore.set(neighbor, tentativeG + heuristic);
        pq.enqueue(neighbor, fScore.get(neighbor)!);
      }
    }
  }
  
  // Reconstruct path
  const resultPath: LatLng[] = [];
  let current: GraphNode | null = endNode;
  let actualDistance = 0;
  
  while (current) {
    resultPath.unshift(current.point);
    const prev = previous.get(current);
    if (prev) {
      actualDistance += haversineDistance(prev.point, current.point);
    }
    current = prev;
  }
  
  const { overallScore, riskLevel } = analyzeRouteSafety(
    resultPath.length > 0 ? resultPath : path, 
    safetyZones
  );
  
  return {
    path: resultPath.length > 0 ? resultPath : path,
    totalDistance: actualDistance || fastestResult.totalDistance,
    safetyScore: overallScore,
    riskLevel,
  };
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

// Export for backward compatibility
export const calculateSafetyAdjustedRoute = aStarSafest;
export const findSafestRoute = aStarSafest;
