import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { calculateSafetyAdjustedRoute, analyzeRouteSafety, haversineDistance } from './astarRouting';

interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][]; // [lng, lat]
  };
}

interface OSRMResponse {
  routes: OSRMRoute[];
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
  
  console.log('Fetched safety zones:', data?.length || 0);
  return data || [];
};

// Map known Visakhapatnam areas to approximate coordinates for matching
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

// Get safety score for a specific point
const getSafetyScoreForPoint = (point: LatLng, safetyZones: SafetyZone[]): number => {
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

// Calculate safety score for a route based on areas it passes through
const calculateRouteSafetyScore = (
  routeCoords: LatLng[],
  safetyZones: SafetyZone[]
): { score: number; riskLevel: RiskLevel; dangerousAreas: string[] } => {
  if (safetyZones.length === 0) {
    return { score: 70, riskLevel: 'moderate', dangerousAreas: [] };
  }

  const analysis = analyzeRouteSafety(routeCoords, safetyZones);
  return { 
    score: analysis.overallScore, 
    riskLevel: analysis.riskLevel,
    dangerousAreas: analysis.dangerousAreas
  };
};

// Get routes from OSRM
export const getRoutesFromOSRM = async (
  source: LatLng,
  destination: LatLng
): Promise<OSRMRoute[]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=geojson&overview=full`;
    
    const response = await fetch(url);
    const data: OSRMResponse = await response.json();
    
    return data.routes || [];
  } catch (error) {
    console.error('Error fetching routes from OSRM:', error);
    return [];
  }
};

// Convert OSRM route to our RouteInfo format
const osrmRouteToRouteInfo = (
  route: OSRMRoute,
  index: number,
  safetyZones: SafetyZone[],
  type: 'fastest' | 'safest' | 'optimized'
): RouteInfo => {
  const path: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  const { score, riskLevel } = calculateRouteSafetyScore(path, safetyZones);

  return {
    id: `route-${type}-${index + 1}`,
    type,
    distance: Math.round(route.distance / 100) / 10, // Convert to km
    duration: Math.round(route.duration / 60), // Convert to minutes
    safetyScore: score,
    riskLevel,
    path,
  };
};

// Main function to calculate routes with safety scores
export const calculateRoutes = async (
  source: LatLng,
  destination: LatLng
): Promise<RouteInfo[]> => {
  // Fetch safety zones and OSRM routes in parallel
  const [safetyZones, osrmRoutes] = await Promise.all([
    fetchSafetyZones(),
    getRoutesFromOSRM(source, destination),
  ]);

  console.log('Safety zones loaded:', safetyZones.length);
  console.log('OSRM routes found:', osrmRoutes.length);

  if (osrmRoutes.length === 0) {
    console.error('No routes found from OSRM');
    return [];
  }

  const routes: RouteInfo[] = [];

  // Route 1: Fastest route (default OSRM route)
  const fastestRoute = osrmRouteToRouteInfo(osrmRoutes[0], 0, safetyZones, 'fastest');
  routes.push(fastestRoute);

  // Route 2: Safest route using A* algorithm with safety data
  try {
    const fastestPath = osrmRoutes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const safetyResult = await calculateSafetyAdjustedRoute(source, destination, safetyZones, fastestPath);
    
    // Calculate distance for safety route
    let safetyDistance = 0;
    for (let i = 1; i < safetyResult.path.length; i++) {
      safetyDistance += haversineDistance(safetyResult.path[i - 1], safetyResult.path[i]);
    }
    
    // Estimate duration based on average walking/driving speed
    const avgSpeedMps = 10; // ~36 km/h average city speed
    const safetyDuration = safetyDistance / avgSpeedMps / 60; // in minutes

    const safestRoute: RouteInfo = {
      id: 'route-safest-1',
      type: 'safest',
      distance: Math.round(safetyDistance / 100) / 10, // Convert to km
      duration: Math.round(safetyDuration),
      safetyScore: safetyResult.safetyScore,
      riskLevel: safetyResult.riskLevel,
      path: safetyResult.path,
    };
    
    routes.push(safestRoute);
    console.log('Safest route calculated:', safestRoute.safetyScore, safestRoute.riskLevel);
  } catch (error) {
    console.error('Error calculating safe route:', error);
    // Fallback: use second OSRM route if available
    if (osrmRoutes.length > 1) {
      const fallbackSafest = osrmRouteToRouteInfo(osrmRoutes[1], 1, safetyZones, 'safest');
      routes.push(fallbackSafest);
    }
  }

  // Route 3: Optimized route (balance of speed and safety) - use alternative OSRM route if available
  if (osrmRoutes.length > 1) {
    const optimizedRoute = osrmRouteToRouteInfo(osrmRoutes[1], 2, safetyZones, 'optimized');
    routes.push(optimizedRoute);
  }

  // Sort routes: safest first, then fastest, then optimized
  const sortOrder = { safest: 0, fastest: 1, optimized: 2 };
  routes.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

  console.log('Final routes:', routes.map(r => ({ type: r.type, safety: r.safetyScore, risk: r.riskLevel })));

  return routes;
};

// Enhanced safety calculation using area-based matching (for when Excel data is uploaded)
export const calculateRouteSafetyWithAreas = (
  routePath: LatLng[],
  safetyZones: SafetyZone[]
): { score: number; riskLevel: RiskLevel; warnings: string[] } => {
  const warnings: string[] = [];
  
  if (safetyZones.length === 0) {
    return { score: 70, riskLevel: 'moderate', warnings: ['No safety data available'] };
  }

  // Sample points along the route
  const samplePoints = routePath.filter((_, idx) => idx % 10 === 0);
  
  // For each sample point, find the nearest safety zone
  // This is a simplified version - real implementation would use proper geospatial queries
  let totalScore = 0;
  let matchedZones = 0;
  const riskyAreas: string[] = [];

  samplePoints.forEach(point => {
    // For now, we average all zone scores
    // When real data is uploaded, this will do proper area matching
    safetyZones.forEach(zone => {
      totalScore += zone.safety_score;
      matchedZones++;
      
      if (zone.safety_score < 50) {
        if (!riskyAreas.includes(zone.area)) {
          riskyAreas.push(zone.area);
        }
      }
    });
  });

  const avgScore = matchedZones > 0 ? totalScore / matchedZones : 70;
  
  let riskLevel: RiskLevel = 'moderate';
  if (avgScore >= 75) riskLevel = 'safe';
  else if (avgScore < 50) riskLevel = 'risky';

  if (riskyAreas.length > 0) {
    warnings.push(`Route passes through risky areas: ${riskyAreas.join(', ')}`);
  }

  return { 
    score: Math.round(avgScore), 
    riskLevel,
    warnings 
  };
};
