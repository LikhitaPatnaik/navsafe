import { LatLng } from '@/types/route';
import { areaCoordinates, haversineDistance } from '@/services/astarRouting';

export type CrimeType = 'kidnap' | 'robbery' | 'murder' | 'assault' | 'accident' | 'theft' | 'harassment';

export interface CrimeZone {
  area: string;
  street: string | null;
  crimeType: CrimeType;
  crimeCount: number;
  severity: string;
  safetyScore: number;
}

// Crime type mapping based on Visakhapatnam dataset patterns
// Areas are mapped to primary crime types based on historical crime patterns
// Crime type mapping based on Visakhapatnam dataset patterns
// All areas from safety_zones with safety_score < 85 are mapped to crime types
const areaCrimeTypeMap: Record<string, CrimeType> = {
  // Critical Areas (safety_score 32-38) - Mixed serious crimes
  'Gajuwaka': 'robbery',
  'Dwaraka Nagar': 'theft',
  'Jagadamba Junction': 'robbery',
  'MVP Colony': 'assault',
  'Simhachalam': 'accident',
  'Maddilapalem': 'harassment',
  'Anandapuram': 'kidnap',
  
  // High Risk Areas (safety_score 44-48)
  'Marripalem': 'theft',
  'One Town': 'robbery',
  'Steel Plant Township': 'assault',
  'Lawsons Bay Colony': 'harassment',
  'Vizianagaram': 'murder',
  'Rushikonda': 'accident',
  
  // Moderate Risk Areas (safety_score 65-82)
  'Anakapalli': 'theft',
  'Beach Road': 'accident',
  'Pendurthi': 'robbery',
  'Madhurawada': 'accident',
  'Akkayapalem': 'accident',
  'Kancharapalem': 'theft',
  'Poorna Market': 'theft',
  'Yendada': 'accident',
  'PM Palem': 'harassment',
  'NAD Junction': 'accident',
  'Malkapuram': 'assault',
  'Bheemunipatnam': 'accident',
  'Seethammadhara': 'harassment',
  'Arilova': 'theft',
  'Sheela Nagar': 'robbery',
  'Marikavalasa': 'accident',
  'Bhogapuram': 'accident',
};

// Crime type display configuration with 5 DISTINCT hex colors for map markers
// Colors chosen for maximum visual distinction on maps
export const crimeTypeConfig: Record<CrimeType, { label: string; color: string; mapColor: string; icon: string }> = {
  kidnap: { label: 'Kidnapping', color: 'text-red-600 bg-red-600/10 border-red-600/30', mapColor: '#dc2626', icon: '🚨' },      // RED
  robbery: { label: 'Robbery', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', mapColor: '#f97316', icon: '💰' }, // ORANGE
  murder: { label: 'Murder', color: 'text-violet-600 bg-violet-600/10 border-violet-600/30', mapColor: '#7c3aed', icon: '⚠️' },  // VIOLET/PURPLE
  assault: { label: 'Assault', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', mapColor: '#3b82f6', icon: '👊' },      // BLUE
  accident: { label: 'Accident', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', mapColor: '#eab308', icon: '🚗' }, // YELLOW
  theft: { label: 'Theft', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', mapColor: '#10b981', icon: '🔓' }, // GREEN (for internal use)
  harassment: { label: 'Harassment', color: 'text-pink-500 bg-pink-500/10 border-pink-500/30', mapColor: '#ec4899', icon: '⚡' }, // PINK (for internal use)
};

// Get crime type for an area - returns 'theft' as default for unmapped risky areas
export const getCrimeTypeForArea = (area: string): CrimeType => {
  const normalizedArea = area.toLowerCase();
  for (const [key, crimeType] of Object.entries(areaCrimeTypeMap)) {
    if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
      return crimeType;
    }
  }
  return 'theft'; // Default crime type for unmapped areas
};

// Find all crime zones along a route path
// Uses wider detection radius to catch all relevant crime zones
export const findCrimeZonesAlongRoute = (
  path: LatLng[],
  safetyZones: { area: string; street: string | null; crime_count: number; severity: string | null; safety_score: number }[],
  options?: { maxDistanceMeters?: number; maxSafetyScore?: number }
): CrimeZone[] => {
  const foundZones = new Map<string, { zone: CrimeZone; minDistance: number }>();
  
  // Use wider detection radius (1.5km) to catch zones near the route
  const maxDistance = options?.maxDistanceMeters ?? 1500;
  // Include zones with safety_score below 85 (anything not "very safe")
  const maxScoreThreshold = options?.maxSafetyScore ?? 85;
  
  // Sample more points along the path for better coverage
  const sampleRate = Math.max(1, Math.floor(path.length / 80));
  
  for (let i = 0; i < path.length; i += sampleRate) {
    const point = path[i];
    
    for (const zone of safetyZones) {
      // Only include zones that are not fully safe
      if (zone.safety_score >= maxScoreThreshold) continue;
      
      // Skip zones with 0 crime count
      if (zone.crime_count === 0) continue;
      
      // Find coordinates for this zone
      const normalizedArea = zone.area.toLowerCase();
      let zoneCenter: LatLng | null = null;
      
      for (const [key, coords] of Object.entries(areaCoordinates)) {
        if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
          zoneCenter = coords;
          break;
        }
      }
      
      if (!zoneCenter) continue;
      
      // Check if route passes within maxDistance of this zone
      const distance = haversineDistance(point, zoneCenter);
      
      if (distance < maxDistance) {
        const crimeType = getCrimeTypeForArea(zone.area);
        if (crimeType) {
          const existing = foundZones.get(zone.area);
          // Only update if this point is closer (route passes closer to zone center)
          if (!existing || distance < existing.minDistance) {
            foundZones.set(zone.area, {
              zone: {
                area: zone.area,
                street: zone.street,
                crimeType,
                crimeCount: zone.crime_count,
                severity: zone.severity || 'unknown',
                safetyScore: zone.safety_score,
              },
              minDistance: distance,
            });
          }
        }
      }
    }
  }
  
  // Sort by severity (most dangerous first) then by proximity
  const zones = Array.from(foundZones.values())
    .sort((a, b) => {
      const scoreDiff = a.zone.safetyScore - b.zone.safetyScore;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      return a.minDistance - b.minDistance;
    })
    .map(({ zone }) => zone);
  
  return zones;
};

// Get crime zone coordinates for map display
export const getCrimeZoneCoordinates = (zone: CrimeZone): LatLng | null => {
  const normalizedArea = zone.area.toLowerCase();
  for (const [key, coords] of Object.entries(areaCoordinates)) {
    if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
      return coords;
    }
  }
  return null;
};

// Group crime zones by type
export const groupCrimeZonesByType = (zones: CrimeZone[]): Record<CrimeType, CrimeZone[]> => {
  const grouped: Record<CrimeType, CrimeZone[]> = {
    kidnap: [],
    robbery: [],
    murder: [],
    assault: [],
    accident: [],
    theft: [],
    harassment: [],
  };
  
  for (const zone of zones) {
    grouped[zone.crimeType].push(zone);
  }
  
  return grouped;
};
