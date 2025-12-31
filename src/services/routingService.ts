import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';

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
  
  return data || [];
};

// Calculate safety score for a route based on areas it passes through
const calculateRouteSafetyScore = (
  routeCoords: LatLng[],
  safetyZones: SafetyZone[]
): { score: number; riskLevel: RiskLevel } => {
  if (safetyZones.length === 0) {
    // No safety data available, return neutral score
    return { score: 70, riskLevel: 'moderate' };
  }

  // For now, we'll use a simple scoring mechanism
  // When the Excel data is uploaded, this will use actual area matching
  const avgScore = safetyZones.reduce((sum, zone) => sum + zone.safety_score, 0) / safetyZones.length;
  
  let riskLevel: RiskLevel = 'moderate';
  if (avgScore >= 75) riskLevel = 'safe';
  else if (avgScore < 50) riskLevel = 'risky';

  return { score: Math.round(avgScore), riskLevel };
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
  isSafest: boolean
): RouteInfo => {
  const path: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  const { score, riskLevel } = calculateRouteSafetyScore(path, safetyZones);

  // The first route from OSRM is the fastest
  // We'll mark one as safest based on safety score calculation
  const type = isSafest ? 'safest' : (index === 0 ? 'fastest' : 'optimized');

  return {
    id: `route-${index + 1}`,
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

  if (osrmRoutes.length === 0) {
    console.error('No routes found from OSRM');
    return [];
  }

  // Convert all routes and calculate safety scores
  const routes: RouteInfo[] = osrmRoutes.map((route, index) => 
    osrmRouteToRouteInfo(route, index, safetyZones, false)
  );

  // Find the route with the highest safety score and mark it as safest
  if (routes.length > 0) {
    const safestIndex = routes.reduce((bestIdx, route, idx, arr) => 
      route.safetyScore > arr[bestIdx].safetyScore ? idx : bestIdx
    , 0);
    
    // Update the safest route
    if (safestIndex !== 0) {
      routes[safestIndex] = { ...routes[safestIndex], type: 'safest' };
      routes[0] = { ...routes[0], type: 'fastest' };
    } else if (routes.length > 1) {
      // If fastest is also safest, mark second as optimized
      routes[0] = { ...routes[0], type: 'safest' };
      routes[1] = { ...routes[1], type: 'fastest' };
    }
  }

  // Sort routes: safest first, then fastest, then optimized
  const sortOrder = { safest: 0, fastest: 1, optimized: 2 };
  routes.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

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
