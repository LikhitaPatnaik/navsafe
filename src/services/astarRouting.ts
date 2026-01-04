import { LatLng, RiskLevel } from '@/types/route';

interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

interface AStarNode {
  point: LatLng;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost (g + h)
  parent: AStarNode | null;
  safetyPenalty: number;
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

// Get safety score for a point based on nearby safety zones
const getSafetyScoreForPoint = (
  point: LatLng,
  safetyZones: SafetyZone[]
): number => {
  if (safetyZones.length === 0) return 70;

  // Find zones that might be relevant (simple proximity check)
  // In a real implementation, this would use proper geospatial queries
  let nearestScore = 70;
  let nearestDistance = Infinity;

  for (const zone of safetyZones) {
    // Create approximate center for each zone based on known Visakhapatnam areas
    const zoneCenter = getApproximateZoneCenter(zone.area);
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

// Map known Visakhapatnam areas to approximate coordinates
const getApproximateZoneCenter = (area: string): LatLng | null => {
  const areaCoordinates: Record<string, LatLng> = {
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
  };

  // Case-insensitive lookup
  const normalizedArea = area.toLowerCase();
  for (const [key, coords] of Object.entries(areaCoordinates)) {
    if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
      return coords;
    }
  }

  return null;
};

// Calculate safety penalty (higher penalty for lower safety scores)
const calculateSafetyPenalty = (safetyScore: number): number => {
  // Convert safety score (0-100) to penalty multiplier
  // Higher safety = lower penalty, lower safety = higher penalty
  const normalizedScore = Math.max(0, Math.min(100, safetyScore));
  // Penalty ranges from 1 (safest) to 5 (most dangerous)
  return 1 + (4 * (100 - normalizedScore)) / 100;
};

// Generate waypoints around a dangerous area
const generateDeviationPoints = (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[]
): LatLng[] => {
  const waypoints: LatLng[] = [source];
  
  // Find dangerous zones along the path
  const dangerousZones = safetyZones.filter(zone => zone.safety_score < 50);
  
  // Create intermediate points that avoid dangerous areas
  const numIntermediatePoints = 10;
  
  for (let i = 1; i <= numIntermediatePoints; i++) {
    const t = i / (numIntermediatePoints + 1);
    let basePoint: LatLng = {
      lat: source.lat + t * (destination.lat - source.lat),
      lng: source.lng + t * (destination.lng - source.lng),
    };

    // Check if this point is in a dangerous zone
    const safetyScore = getSafetyScoreForPoint(basePoint, safetyZones);
    
    if (safetyScore < 50) {
      // Find a safer nearby point by shifting perpendicular to the path
      const perpLat = -(destination.lng - source.lng);
      const perpLng = destination.lat - source.lat;
      const perpMag = Math.sqrt(perpLat * perpLat + perpLng * perpLng);
      
      if (perpMag > 0) {
        const offset = 0.01; // ~1km offset
        basePoint = {
          lat: basePoint.lat + (perpLat / perpMag) * offset,
          lng: basePoint.lng + (perpLng / perpMag) * offset,
        };
      }
    }
    
    waypoints.push(basePoint);
  }
  
  waypoints.push(destination);
  return waypoints;
};

// A* algorithm for finding safest route
export const findSafestRoute = (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  baseRoutePath: LatLng[]
): { path: LatLng[]; safetyScore: number; riskLevel: RiskLevel } => {
  // Generate candidate waypoints
  const waypoints = generateDeviationPoints(source, destination, safetyZones);
  
  // Simple path smoothing with safety consideration
  const safePath: LatLng[] = [source];
  let totalSafetyScore = 0;
  let scoreCount = 0;

  for (let i = 1; i < waypoints.length - 1; i++) {
    const point = waypoints[i];
    const pointSafety = getSafetyScoreForPoint(point, safetyZones);
    
    // Only add points that improve safety or are necessary for navigation
    if (pointSafety >= 50 || i === 1 || i === waypoints.length - 2) {
      safePath.push(point);
      totalSafetyScore += pointSafety;
      scoreCount++;
    }
  }
  
  safePath.push(destination);

  // Calculate overall safety score
  const avgSafetyScore = scoreCount > 0 ? totalSafetyScore / scoreCount : 70;
  
  // Determine risk level
  let riskLevel: RiskLevel = 'moderate';
  if (avgSafetyScore >= 70) riskLevel = 'safe';
  else if (avgSafetyScore < 50) riskLevel = 'risky';

  return {
    path: safePath,
    safetyScore: Math.round(avgSafetyScore),
    riskLevel,
  };
};

// Get safety-adjusted OSRM route
export const calculateSafetyAdjustedRoute = async (
  source: LatLng,
  destination: LatLng,
  safetyZones: SafetyZone[],
  originalPath: LatLng[]
): Promise<{ path: LatLng[]; safetyScore: number; riskLevel: RiskLevel }> => {
  // Analyze the original path for dangerous segments
  const pathScores: number[] = [];
  const dangerousSegments: number[] = [];

  for (let i = 0; i < originalPath.length; i++) {
    const score = getSafetyScoreForPoint(originalPath[i], safetyZones);
    pathScores.push(score);
    if (score < 50) {
      dangerousSegments.push(i);
    }
  }

  // If original path is safe, use it
  const avgScore = pathScores.reduce((a, b) => a + b, 0) / pathScores.length;
  if (avgScore >= 70 && dangerousSegments.length === 0) {
    return {
      path: originalPath,
      safetyScore: Math.round(avgScore),
      riskLevel: 'safe',
    };
  }

  // Otherwise, find a safer route using A*
  return findSafestRoute(source, destination, safetyZones, originalPath);
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

  // Sample every 5th point for performance
  for (let i = 0; i < path.length; i += 5) {
    const point = path[i];
    const score = getSafetyScoreForPoint(point, safetyZones);
    scores.push(score);

    // Find matching zone
    for (const zone of safetyZones) {
      const zoneCenter = getApproximateZoneCenter(zone.area);
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
