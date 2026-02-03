import { LatLng } from '@/types/route';
import { CrimeType } from './crimeTypeMapping';

// Street-level coordinates within each area for more granular crime zone marking
// Each area can have multiple streets with specific coordinates
export interface StreetLocation {
  street: string;
  coords: LatLng;
  crimeTypes?: CrimeType[]; // Common crime types at this location
}

export const areaStreetCoordinates: Record<string, StreetLocation[]> = {
  // Anakapalli - Multiple crime hotspots
  'Anakapalli': [
    { street: 'Town Center', coords: { lat: 17.6890, lng: 83.0035 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Ring Road', coords: { lat: 17.6946, lng: 83.0086 }, crimeTypes: ['accident'] },
    { street: 'Bus Stand Area', coords: { lat: 17.6875, lng: 82.9980 }, crimeTypes: ['theft', 'assault'] },
    { street: 'Railway Station Road', coords: { lat: 17.6920, lng: 83.0050 }, crimeTypes: ['murder', 'kidnap'] },
    { street: 'Market Road', coords: { lat: 17.6860, lng: 83.0010 }, crimeTypes: ['robbery', 'accident'] },
  ],
  
  // Beach Road - Tourist area with multiple crime spots
  'Beach Road': [
    { street: 'RK Beach', coords: { lat: 17.7215, lng: 83.3150 }, crimeTypes: ['theft', 'harassment'] },
    { street: 'Kali Temple Area', coords: { lat: 17.7180, lng: 83.3120 }, crimeTypes: ['robbery'] },
    { street: 'Dolphin Hill', coords: { lat: 17.7250, lng: 83.3170 }, crimeTypes: ['assault'] },
    { street: 'VUDA Park', coords: { lat: 17.7290, lng: 83.3190 }, crimeTypes: ['accident'] },
    { street: 'Ramakrishna Beach', coords: { lat: 17.7160, lng: 83.3100 }, crimeTypes: ['harassment', 'theft'] },
  ],
  
  // Madhurawada - NH16 corridor
  'Madhurawada': [
    { street: 'NH16 Highway', coords: { lat: 17.7957, lng: 83.3756 }, crimeTypes: ['accident'] },
    { street: 'APHB Colony', coords: { lat: 17.8056, lng: 83.3705 }, crimeTypes: ['theft'] },
    { street: 'IT Park Junction', coords: { lat: 17.7980, lng: 83.3780 }, crimeTypes: ['robbery'] },
    { street: 'Rushikonda Road', coords: { lat: 17.8010, lng: 83.3720 }, crimeTypes: ['accident', 'assault'] },
  ],
  
  // Gajuwaka - Industrial area
  'Gajuwaka': [
    { street: 'NAD-Gajuwaka Road', coords: { lat: 17.6853, lng: 83.2037 }, crimeTypes: ['robbery', 'assault'] },
    { street: 'Old Gajuwaka', coords: { lat: 17.6820, lng: 83.2010 }, crimeTypes: ['theft', 'murder'] },
    { street: 'Steel Plant Junction', coords: { lat: 17.6880, lng: 83.2070 }, crimeTypes: ['accident'] },
    { street: 'Autonagar', coords: { lat: 17.6790, lng: 83.1980 }, crimeTypes: ['robbery'] },
    { street: 'Kurmannapalem Junction', coords: { lat: 17.6910, lng: 83.2100 }, crimeTypes: ['kidnap'] },
  ],
  
  // Dwaraka Nagar - Commercial hub
  'Dwaraka Nagar': [
    { street: 'Dwaraka Nagar Road', coords: { lat: 17.72867, lng: 83.308634 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Siripuram Junction', coords: { lat: 17.7260, lng: 83.3050 }, crimeTypes: ['assault'] },
    { street: 'CMR Central', coords: { lat: 17.7310, lng: 83.3110 }, crimeTypes: ['theft'] },
    { street: 'Main Road', coords: { lat: 17.7295, lng: 83.3070 }, crimeTypes: ['accident', 'robbery'] },
  ],
  'Dwarakanagar': [
    { street: 'Dwaraka Nagar Road', coords: { lat: 17.72867, lng: 83.308634 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Siripuram Junction', coords: { lat: 17.7260, lng: 83.3050 }, crimeTypes: ['assault'] },
  ],
  
  // Vizianagaram - Multiple areas
  'Vizianagaram': [
    { street: 'Fort Area', coords: { lat: 18.1067, lng: 83.3956 }, crimeTypes: ['murder', 'assault'] },
    { street: 'Bus Station', coords: { lat: 18.1100, lng: 83.3920 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Railway Station', coords: { lat: 18.1040, lng: 83.3990 }, crimeTypes: ['kidnap'] },
    { street: 'Main Bazaar', coords: { lat: 18.1080, lng: 83.3940 }, crimeTypes: ['accident'] },
  ],
  
  // Kancharapalem - Market area
  'Kancharapalem': [
    { street: 'Market Area', coords: { lat: 17.7354, lng: 83.2738 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Junction Road', coords: { lat: 17.7380, lng: 83.2760 }, crimeTypes: ['assault'] },
    { street: 'Temple Street', coords: { lat: 17.7330, lng: 83.2720 }, crimeTypes: ['accident'] },
  ],
  
  // Simhachalam - Temple area
  'Simhachalam': [
    { street: 'Simhachalam Ghat Road', coords: { lat: 17.75, lng: 83.22 }, crimeTypes: ['accident'] },
    { street: 'Temple Road', coords: { lat: 17.7530, lng: 83.2230 }, crimeTypes: ['theft'] },
    { street: 'Simhapuri Colony', coords: { lat: 17.7470, lng: 83.2180 }, crimeTypes: ['robbery'] },
  ],
  
  // MVP Colony
  'MVP Colony': [
    { street: 'MVP Double Road', coords: { lat: 17.7407, lng: 83.3367 }, crimeTypes: ['assault', 'robbery'] },
    { street: 'Sector 1', coords: { lat: 17.7420, lng: 83.3340 }, crimeTypes: ['theft'] },
    { street: 'Sector 6', coords: { lat: 17.7390, lng: 83.3390 }, crimeTypes: ['accident'] },
    { street: 'Pandurangapuram', coords: { lat: 17.7380, lng: 83.3350 }, crimeTypes: ['harassment'] },
  ],
  
  // One Town
  'One Town': [
    { street: 'Town Kotha Road', coords: { lat: 17.7, lng: 83.29 }, crimeTypes: ['robbery', 'theft'] },
    { street: 'Market Street', coords: { lat: 17.7020, lng: 83.2920 }, crimeTypes: ['assault'] },
    { street: 'Fish Market', coords: { lat: 17.6980, lng: 83.2880 }, crimeTypes: ['accident'] },
  ],
  
  // Jagadamba Junction
  'Jagadamba Junction': [
    { street: 'Jagadamba Road', coords: { lat: 17.7073, lng: 83.001 }, crimeTypes: ['robbery', 'theft'] },
    { street: 'Main Circle', coords: { lat: 17.7090, lng: 83.0030 }, crimeTypes: ['accident'] },
    { street: 'CMR Road', coords: { lat: 17.7060, lng: 82.9990 }, crimeTypes: ['assault'] },
  ],
  'Jagadamba Jct': [
    { street: 'Jagadamba Road', coords: { lat: 17.7073, lng: 83.001 }, crimeTypes: ['robbery'] },
  ],
  
  // Maddilapalem
  'Maddilapalem': [
    { street: 'Maddilapalem Road', coords: { lat: 17.7382, lng: 83.323 }, crimeTypes: ['harassment', 'theft'] },
    { street: 'Housing Board', coords: { lat: 17.7360, lng: 83.3210 }, crimeTypes: ['assault'] },
    { street: 'Main Junction', coords: { lat: 17.7400, lng: 83.3250 }, crimeTypes: ['accident'] },
  ],
  
  // Lawsons Bay Colony
  'Lawsons Bay Colony': [
    { street: 'Lawsons Bay Road', coords: { lat: 17.73, lng: 83.33 }, crimeTypes: ['harassment'] },
    { street: 'Beach Side', coords: { lat: 17.7320, lng: 83.3320 }, crimeTypes: ['theft'] },
    { street: 'Colony Main', coords: { lat: 17.7280, lng: 83.3280 }, crimeTypes: ['assault'] },
  ],
  'Lawsons Bay': [
    { street: 'Lawsons Bay Road', coords: { lat: 17.73, lng: 83.33 }, crimeTypes: ['harassment'] },
  ],
  
  // Anandapuram
  'Anandapuram': [
    { street: 'Anandapuram Bypass', coords: { lat: 17.9, lng: 83.37 }, crimeTypes: ['kidnap', 'robbery'] },
    { street: 'Main Road', coords: { lat: 17.8980, lng: 83.3680 }, crimeTypes: ['accident'] },
    { street: 'Junction Area', coords: { lat: 17.9020, lng: 83.3720 }, crimeTypes: ['assault'] },
  ],
  
  // Marripalem
  'Marripalem': [
    { street: 'Airport Road', coords: { lat: 17.74, lng: 83.25 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'VUDA Layout', coords: { lat: 17.7420, lng: 83.2530 }, crimeTypes: ['assault'] },
    { street: 'Colony Area', coords: { lat: 17.7380, lng: 83.2470 }, crimeTypes: ['accident'] },
  ],
  
  // Steel Plant Township
  'Steel Plant Township': [
    { street: 'Ukkunagaram Road', coords: { lat: 17.61, lng: 83.19 }, crimeTypes: ['assault', 'robbery'] },
    { street: 'Sector 1', coords: { lat: 17.6120, lng: 83.1920 }, crimeTypes: ['theft'] },
    { street: 'Main Gate', coords: { lat: 17.6080, lng: 83.1880 }, crimeTypes: ['accident'] },
  ],
  'Steel Plant': [
    { street: 'Main Road', coords: { lat: 17.61, lng: 83.19 }, crimeTypes: ['assault'] },
  ],
  
  // Pendurthi
  'Pendurthi': [
    { street: 'Vepagunta Junction', coords: { lat: 17.78, lng: 83.26 }, crimeTypes: ['robbery', 'accident'] },
    { street: 'Bus Station', coords: { lat: 17.7820, lng: 83.2620 }, crimeTypes: ['theft'] },
    { street: 'Market Road', coords: { lat: 17.7780, lng: 83.2580 }, crimeTypes: ['assault'] },
  ],
  
  // Rushikonda
  'Rushikonda': [
    { street: 'Rushikonda Beach Road', coords: { lat: 17.7920, lng: 83.3850 }, crimeTypes: ['accident'] },
    { street: 'Beach Area', coords: { lat: 17.7880, lng: 83.3820 }, crimeTypes: ['theft'] },
    { street: 'TDP Circle', coords: { lat: 17.7950, lng: 83.3880 }, crimeTypes: ['robbery'] },
  ],
  
  // Yendada
  'Yendada': [
    { street: 'NH5 Road', coords: { lat: 17.77, lng: 83.36 }, crimeTypes: ['accident'] },
    { street: 'IT Park Road', coords: { lat: 17.7720, lng: 83.3620 }, crimeTypes: ['robbery'] },
    { street: 'Layout Area', coords: { lat: 17.7680, lng: 83.3580 }, crimeTypes: ['theft'] },
  ],
  
  // Akkayapalem
  'Akkayapalem': [
    { street: 'NH16 Highway', coords: { lat: 17.7347, lng: 83.2977 }, crimeTypes: ['accident'] },
    { street: 'Colony Main', coords: { lat: 17.7370, lng: 83.3000 }, crimeTypes: ['theft'] },
  ],
  
  // Bheemunipatnam
  'Bheemunipatnam': [
    { street: 'Beach Road', coords: { lat: 17.89, lng: 83.45 }, crimeTypes: ['accident'] },
    { street: 'Town Center', coords: { lat: 17.8920, lng: 83.4520 }, crimeTypes: ['theft'] },
    { street: 'Temple Area', coords: { lat: 17.8880, lng: 83.4480 }, crimeTypes: ['robbery'] },
  ],
  
  // PM Palem
  'PM Palem': [
    { street: 'Vasundhara Nagar', coords: { lat: 17.7996, lng: 83.3531 }, crimeTypes: ['harassment'] },
    { street: 'Main Road', coords: { lat: 17.8010, lng: 83.3550 }, crimeTypes: ['theft'] },
  ],
  
  // NAD Junction
  'NAD Junction': [
    { street: 'NAD Flyover', coords: { lat: 17.74, lng: 83.23 }, crimeTypes: ['accident'] },
    { street: 'Kotha Road', coords: { lat: 17.7420, lng: 83.2320 }, crimeTypes: ['robbery'] },
  ],
  'NAD': [
    { street: 'NAD Main', coords: { lat: 17.74, lng: 83.23 }, crimeTypes: ['accident'] },
  ],
  
  // Malkapuram
  'Malkapuram': [
    { street: 'Malkapuram Road', coords: { lat: 17.688, lng: 83.245 }, crimeTypes: ['assault'] },
    { street: 'Junction Area', coords: { lat: 17.6900, lng: 83.2470 }, crimeTypes: ['theft'] },
  ],
  
  // Seethammadhara
  'Seethammadhara': [
    { street: 'Main Road', coords: { lat: 17.7425, lng: 83.3124 }, crimeTypes: ['harassment'] },
    { street: 'Extension', coords: { lat: 17.7445, lng: 83.3150 }, crimeTypes: ['theft'] },
  ],
  
  // Arilova
  'Arilova': [
    { street: 'Hanumantha Junction', coords: { lat: 17.7673, lng: 83.3134 }, crimeTypes: ['theft'] },
    { street: 'Main Road', coords: { lat: 17.7690, lng: 83.3150 }, crimeTypes: ['accident'] },
  ],
  
  // Poorna Market
  'Poorna Market': [
    { street: 'Market Road', coords: { lat: 17.7064, lng: 83.2982 }, crimeTypes: ['theft', 'robbery'] },
    { street: 'Old Town', coords: { lat: 17.7050, lng: 83.2960 }, crimeTypes: ['assault'] },
  ],
  
  // Tagarapuvalasa
  'Tagarapuvalasa': [
    { street: 'Gostani Bridge', coords: { lat: 17.930125, lng: 83.425659 }, crimeTypes: ['accident'] },
    { street: 'Beach Road', coords: { lat: 17.9280, lng: 83.4230 }, crimeTypes: ['theft'] },
  ],
  
  // Marikavalasa
  'Marikavalasa': [
    { street: 'NH16 Highway', coords: { lat: 17.8359, lng: 83.3581 }, crimeTypes: ['accident'] },
    { street: 'Junction', coords: { lat: 17.8340, lng: 83.3560 }, crimeTypes: ['robbery'] },
  ],
  
  // Sheela Nagar
  'Sheela Nagar': [
    { street: 'NH16 Signal', coords: { lat: 17.719, lng: 83.202 }, crimeTypes: ['robbery', 'accident'] },
    { street: 'Industrial Area', coords: { lat: 17.7210, lng: 83.2040 }, crimeTypes: ['theft'] },
  ],
  'Sheelanagar': [
    { street: 'Main Road', coords: { lat: 17.719, lng: 83.202 }, crimeTypes: ['robbery'] },
  ],
};

// Get all street locations for an area
export const getStreetLocations = (area: string): StreetLocation[] => {
  const normalizedArea = area.toLowerCase().trim();
  
  for (const [key, locations] of Object.entries(areaStreetCoordinates)) {
    if (key.toLowerCase() === normalizedArea || 
        normalizedArea.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalizedArea)) {
      return locations;
    }
  }
  
  return [];
};

// Get street locations that match a specific crime type
export const getStreetLocationsForCrimeType = (
  area: string, 
  crimeType: CrimeType
): StreetLocation[] => {
  const allLocations = getStreetLocations(area);
  return allLocations.filter(loc => 
    loc.crimeTypes?.includes(crimeType)
  );
};
