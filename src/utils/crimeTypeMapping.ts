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
const areaCrimeTypeMap: Record<string, CrimeType> = {
  // Critical Areas - Mixed serious crimes
  'Gajuwaka': 'robbery',
  'Dwaraka Nagar': 'theft',
  'Jagadamba Junction': 'robbery',
  'MVP Colony': 'assault',
  'Simhachalam': 'accident',
  'Maddilapalem': 'harassment',
  'Anandapuram': 'kidnap',
  
  // High Risk Areas
  'Marripalem': 'theft',
  'One Town': 'robbery',
  'Steel Plant Township': 'assault',
  'Lawsons Bay Colony': 'harassment',
  'Vizianagaram': 'murder',
  'Rushikonda': 'accident',
  
  // Moderate Risk Areas
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

// Crime type display configuration
export const crimeTypeConfig: Record<CrimeType, { label: string; icon: string; color: string }> = {
  kidnap: { label: 'Kidnapping Zone', icon: '🚨', color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  robbery: { label: 'Robbery Zone', icon: '💰', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
  murder: { label: 'High Crime Zone', icon: '⚠️', color: 'text-red-600 bg-red-600/10 border-red-600/30' },
  assault: { label: 'Assault Zone', icon: '👊', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  accident: { label: 'Accident Prone', icon: '🚗', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
  theft: { label: 'Theft Zone', icon: '🔓', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  harassment: { label: 'Harassment Zone', icon: '⚡', color: 'text-pink-500 bg-pink-500/10 border-pink-500/30' },
};

// Get crime type for an area
export const getCrimeTypeForArea = (area: string): CrimeType | null => {
  const normalizedArea = area.toLowerCase();
  for (const [key, crimeType] of Object.entries(areaCrimeTypeMap)) {
    if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
      return crimeType;
    }
  }
  return null;
};

// Find all crime zones along a route path
export const findCrimeZonesAlongRoute = (
  path: LatLng[],
  safetyZones: { area: string; street: string | null; crime_count: number; severity: string | null; safety_score: number }[]
): CrimeZone[] => {
  const foundZones = new Map<string, CrimeZone>();
  
  // Sample points along the path for performance
  const sampleRate = Math.max(1, Math.floor(path.length / 30));
  
  for (let i = 0; i < path.length; i += sampleRate) {
    const point = path[i];
    
    for (const zone of safetyZones) {
      // Only include risky zones (safety_score < 75)
      if (zone.safety_score >= 75) continue;
      
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
      
      // Check if route passes within 1.5km of this zone
      const distance = haversineDistance(point, zoneCenter);
      if (distance < 1500 && !foundZones.has(zone.area)) {
        const crimeType = getCrimeTypeForArea(zone.area);
        if (crimeType) {
          foundZones.set(zone.area, {
            area: zone.area,
            street: zone.street,
            crimeType,
            crimeCount: zone.crime_count,
            severity: zone.severity || 'unknown',
            safetyScore: zone.safety_score,
          });
        }
      }
    }
  }
  
  // Sort by severity (most dangerous first)
  const zones = Array.from(foundZones.values());
  zones.sort((a, b) => a.safetyScore - b.safetyScore);
  
  return zones;
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
