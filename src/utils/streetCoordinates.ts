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
  // Akkayapalem - NH16 corridor
  'Akkayapalem': [
    { street: 'NH16 Highway', coords: { lat: 17.7347, lng: 83.2977 }, crimeTypes: ['accident'] },
    { street: 'Colony Main Road', coords: { lat: 17.7370, lng: 83.3000 }, crimeTypes: ['theft', 'murder'] },
    { street: 'Akkayapalem Junction', coords: { lat: 17.7330, lng: 83.2950 }, crimeTypes: ['kidnap', 'robbery'] },
  ],
  
  // Allipuram
  'Allipuram': [
    { street: 'Jalaripeta Road', coords: { lat: 17.7162, lng: 83.2965 }, crimeTypes: ['kidnap', 'murder'] },
    { street: 'Allipuram Main', coords: { lat: 17.7180, lng: 83.2980 }, crimeTypes: ['robbery'] },
  ],
  
  // Anakapalli - Multiple crime hotspots
  'Anakapalli': [
    { street: 'Town Center', coords: { lat: 17.6890, lng: 83.0035 }, crimeTypes: ['murder', 'robbery'] },
    { street: 'Ring Road', coords: { lat: 17.6946, lng: 83.0086 }, crimeTypes: ['accident'] },
    { street: 'Bus Stand Area', coords: { lat: 17.6875, lng: 82.9980 }, crimeTypes: ['theft', 'assault'] },
    { street: 'Railway Station Road', coords: { lat: 17.6920, lng: 83.0050 }, crimeTypes: ['kidnap'] },
    { street: 'Market Road', coords: { lat: 17.6860, lng: 83.0010 }, crimeTypes: ['robbery', 'accident'] },
  ],
  
  // Anandapuram
  'Anandapuram': [
    { street: 'Anandapuram Bypass', coords: { lat: 17.9000, lng: 83.3700 }, crimeTypes: ['kidnap', 'robbery'] },
    { street: 'Main Road', coords: { lat: 17.8980, lng: 83.3680 }, crimeTypes: ['accident', 'murder'] },
    { street: 'Junction Area', coords: { lat: 17.9020, lng: 83.3720 }, crimeTypes: ['assault'] },
  ],
  
  // Andhra University
  'Andhra University': [
    { street: 'AU Campus Road', coords: { lat: 17.7320, lng: 83.3190 }, crimeTypes: ['murder'] },
    { street: 'Engineering College', coords: { lat: 17.7300, lng: 83.3170 }, crimeTypes: ['theft'] },
  ],
  
  // Arilova
  'Arilova': [
    { street: 'Hanumantha Junction', coords: { lat: 17.7673, lng: 83.3134 }, crimeTypes: ['theft', 'kidnap'] },
    { street: 'Main Road', coords: { lat: 17.7690, lng: 83.3150 }, crimeTypes: ['accident'] },
    { street: 'Arilova Center', coords: { lat: 17.7660, lng: 83.3120 }, crimeTypes: ['assault'] },
  ],
  
  // Balayya Sastri Layout
  'Balayya Sastri Layout': [
    { street: 'Layout Main Road', coords: { lat: 17.7250, lng: 83.3050 }, crimeTypes: ['accident'] },
  ],
  
  // Beach Road - Tourist area with multiple crime spots
  'Beach Road': [
    { street: 'RK Beach', coords: { lat: 17.7215, lng: 83.3150 }, crimeTypes: ['accident', 'assault'] },
    { street: 'Kali Temple Area', coords: { lat: 17.7180, lng: 83.3120 }, crimeTypes: ['kidnap'] },
    { street: 'Dolphin Hill', coords: { lat: 17.7250, lng: 83.3170 }, crimeTypes: ['murder'] },
    { street: 'VUDA Park', coords: { lat: 17.7290, lng: 83.3190 }, crimeTypes: ['accident'] },
  ],
  
  // Bheemunipatnam
  'Bheemunipatnam': [
    { street: 'Beach Road', coords: { lat: 17.8900, lng: 83.4500 }, crimeTypes: ['accident'] },
    { street: 'Town Center', coords: { lat: 17.8920, lng: 83.4520 }, crimeTypes: ['assault'] },
    { street: 'Temple Area', coords: { lat: 17.8880, lng: 83.4480 }, crimeTypes: ['murder'] },
  ],
  
  // Bhogapuram
  'Bhogapuram': [
    { street: 'Airport Road', coords: { lat: 18.0300, lng: 83.4900 }, crimeTypes: ['accident'] },
    { street: 'Village Center', coords: { lat: 18.0280, lng: 83.4880 }, crimeTypes: ['accident'] },
  ],
  
  // Boyapalem
  'Boyapalem': [
    { street: 'Boyapalem Main', coords: { lat: 17.7312, lng: 83.2859 }, crimeTypes: ['accident'] },
    { street: 'Junction Road', coords: { lat: 17.7295, lng: 83.2840 }, crimeTypes: ['accident'] },
  ],
  
  // Chinna Waltair
  'Chinna Waltair': [
    { street: 'AU Out Gate', coords: { lat: 17.7280, lng: 83.3200 }, crimeTypes: ['accident'] },
    { street: 'Beach Road Junction', coords: { lat: 17.7260, lng: 83.3180 }, crimeTypes: ['theft'] },
  ],
  
  // Dabagardens
  'Dabagardens': [
    { street: 'Prakashrao Junction', coords: { lat: 17.7150, lng: 83.3050 }, crimeTypes: ['assault', 'murder'] },
    { street: 'Main Road', coords: { lat: 17.7170, lng: 83.3070 }, crimeTypes: ['theft'] },
  ],
  
  // Daspalla Hills
  'Daspalla Hills': [
    { street: 'Daspalla Hotel Area', coords: { lat: 17.7220, lng: 83.3100 }, crimeTypes: ['kidnap'] },
  ],
  
  // Dwaraka Nagar - Commercial hub
  'Dwaraka Nagar': [
    { street: 'Dwaraka Nagar Road', coords: { lat: 17.7287, lng: 83.3086 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Siripuram Junction', coords: { lat: 17.7260, lng: 83.3050 }, crimeTypes: ['assault'] },
    { street: 'CMR Central', coords: { lat: 17.7310, lng: 83.3110 }, crimeTypes: ['robbery'] },
    { street: 'Main Road', coords: { lat: 17.7295, lng: 83.3070 }, crimeTypes: ['accident'] },
  ],
  'Dwarakanagar': [
    { street: 'Dwarakanagar Main', coords: { lat: 17.7287, lng: 83.3086 }, crimeTypes: ['accident'] },
  ],
  
  // Gajuwaka - Industrial area
  'Gajuwaka': [
    { street: 'NAD-Gajuwaka Road', coords: { lat: 17.6853, lng: 83.2037 }, crimeTypes: ['accident'] },
    { street: 'Old Gajuwaka', coords: { lat: 17.6820, lng: 83.2010 }, crimeTypes: ['murder'] },
    { street: 'Steel Plant Junction', coords: { lat: 17.6880, lng: 83.2070 }, crimeTypes: ['accident'] },
    { street: 'Autonagar', coords: { lat: 17.6790, lng: 83.1980 }, crimeTypes: ['robbery', 'assault'] },
    { street: 'Kurmannapalem Junction', coords: { lat: 17.6910, lng: 83.2100 }, crimeTypes: ['kidnap'] },
  ],
  
  // Ghat Road
  'Ghat road': [
    { street: 'Simhachalam Ghat', coords: { lat: 17.7650, lng: 83.2380 }, crimeTypes: ['accident'] },
  ],
  
  // Gopalapatnam
  'Gopalapatnam': [
    { street: 'Baji Junction', coords: { lat: 17.7550, lng: 83.2700 }, crimeTypes: ['robbery'] },
    { street: 'Main Road', coords: { lat: 17.7530, lng: 83.2680 }, crimeTypes: ['theft'] },
  ],
  
  // Jagadamba Junction
  'Jagadamba Junction': [
    { street: 'Jagadamba Circle', coords: { lat: 17.7105, lng: 83.2980 }, crimeTypes: ['accident', 'robbery'] },
    { street: 'CMR Road', coords: { lat: 17.7090, lng: 83.2960 }, crimeTypes: ['kidnap'] },
    { street: 'Shopping Complex', coords: { lat: 17.7120, lng: 83.3000 }, crimeTypes: ['assault'] },
    { street: 'Cinema Road', coords: { lat: 17.7080, lng: 83.2940 }, crimeTypes: ['murder'] },
  ],
  
  // Kancharapalem - Market area
  'Kancharapalem': [
    { street: 'Market Area', coords: { lat: 17.7354, lng: 83.2738 }, crimeTypes: ['robbery', 'murder'] },
    { street: 'Junction Road', coords: { lat: 17.7380, lng: 83.2760 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Temple Street', coords: { lat: 17.7330, lng: 83.2720 }, crimeTypes: ['accident'] },
    { street: 'Old Kancharapalem', coords: { lat: 17.7360, lng: 83.2750 }, crimeTypes: ['murder'] },
  ],
  
  // Kommadhi
  'Kommadhi': [
    { street: 'Kommadi Junction', coords: { lat: 17.8100, lng: 83.3800 }, crimeTypes: ['accident', 'murder'] },
    { street: 'IT Corridor', coords: { lat: 17.8080, lng: 83.3780 }, crimeTypes: ['theft'] },
  ],
  
  // Kurmannapalem
  'Kurmannapalem': [
    { street: 'Steel Plant Road', coords: { lat: 17.6900, lng: 83.1700 }, crimeTypes: ['accident'] },
    { street: 'Junction', coords: { lat: 17.6880, lng: 83.1720 }, crimeTypes: ['murder'] },
  ],
  
  // Lawsons Bay Colony
  'Lawsons Bay Colony': [
    { street: 'Lawsons Bay Road', coords: { lat: 17.7300, lng: 83.3300 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Beach Side', coords: { lat: 17.7320, lng: 83.3320 }, crimeTypes: ['robbery'] },
    { street: 'Colony Main', coords: { lat: 17.7280, lng: 83.3280 }, crimeTypes: ['accident'] },
    { street: 'Residential Area', coords: { lat: 17.7290, lng: 83.3290 }, crimeTypes: ['murder'] },
  ],
  
  // Maddilapalem
  'Maddilapalem': [
    { street: 'Maddilapalem Road', coords: { lat: 17.7382, lng: 83.3230 }, crimeTypes: ['kidnap', 'murder'] },
    { street: 'Housing Board', coords: { lat: 17.7360, lng: 83.3210 }, crimeTypes: ['assault'] },
    { street: 'Main Junction', coords: { lat: 17.7400, lng: 83.3250 }, crimeTypes: ['accident'] },
    { street: 'Inner Colony', coords: { lat: 17.7375, lng: 83.3220 }, crimeTypes: ['robbery'] },
  ],
  
  // Madhurawada - NH16 corridor
  'Madhurawada': [
    { street: 'NH16 Highway', coords: { lat: 17.7957, lng: 83.3756 }, crimeTypes: ['accident'] },
    { street: 'APHB Colony', coords: { lat: 17.8056, lng: 83.3705 }, crimeTypes: ['murder'] },
    { street: 'IT Park Junction', coords: { lat: 17.7980, lng: 83.3780 }, crimeTypes: ['assault'] },
  ],
  
  // Malkapuram
  'Malkapuram': [
    { street: 'Malkapuram Road', coords: { lat: 17.6880, lng: 83.2450 }, crimeTypes: ['assault', 'murder'] },
    { street: 'Junction Area', coords: { lat: 17.6900, lng: 83.2470 }, crimeTypes: ['robbery'] },
  ],
  
  // Marikavalasa
  'Marikavalasa': [
    { street: 'NH16 Highway', coords: { lat: 17.8359, lng: 83.3581 }, crimeTypes: ['accident'] },
    { street: 'Junction', coords: { lat: 17.8340, lng: 83.3560 }, crimeTypes: ['accident'] },
  ],
  
  // Marripalem
  'Marripalem': [
    { street: 'Airport Road', coords: { lat: 17.7400, lng: 83.2500 }, crimeTypes: ['accident', 'robbery'] },
    { street: 'VUDA Layout', coords: { lat: 17.7420, lng: 83.2530 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Colony Area', coords: { lat: 17.7380, lng: 83.2470 }, crimeTypes: ['murder'] },
  ],
  
  // MVP Colony
  'MVP Colony': [
    { street: 'MVP Double Road', coords: { lat: 17.7407, lng: 83.3367 }, crimeTypes: ['assault', 'robbery'] },
    { street: 'Sector 1', coords: { lat: 17.7420, lng: 83.3340 }, crimeTypes: ['murder'] },
    { street: 'Sector 6', coords: { lat: 17.7390, lng: 83.3390 }, crimeTypes: ['accident'] },
    { street: 'Pandurangapuram', coords: { lat: 17.7380, lng: 83.3350 }, crimeTypes: ['assault'] },
  ],
  
  // NAD Junction
  'NAD Junction': [
    { street: 'NAD Flyover', coords: { lat: 17.7400, lng: 83.2300 }, crimeTypes: ['accident'] },
    { street: 'Kotha Road', coords: { lat: 17.7420, lng: 83.2320 }, crimeTypes: ['murder'] },
  ],
  
  // One Town
  'One Town': [
    { street: 'Town Kotha Road', coords: { lat: 17.7000, lng: 83.2900 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Market Street', coords: { lat: 17.7020, lng: 83.2920 }, crimeTypes: ['robbery'] },
    { street: 'Fish Market', coords: { lat: 17.6980, lng: 83.2880 }, crimeTypes: ['accident'] },
    { street: 'Old Town', coords: { lat: 17.7010, lng: 83.2910 }, crimeTypes: ['murder'] },
  ],
  
  // Pendurthi
  'Pendurthi': [
    { street: 'Vepagunta Junction', coords: { lat: 17.7800, lng: 83.2600 }, crimeTypes: ['murder'] },
    { street: 'Bus Station', coords: { lat: 17.7820, lng: 83.2620 }, crimeTypes: ['accident'] },
    { street: 'Market Road', coords: { lat: 17.7780, lng: 83.2580 }, crimeTypes: ['kidnap', 'robbery'] },
  ],
  
  // PM Palem
  'PM Palem': [
    { street: 'Vasundhara Nagar', coords: { lat: 17.7996, lng: 83.3531 }, crimeTypes: ['accident'] },
    { street: 'Main Road', coords: { lat: 17.8010, lng: 83.3550 }, crimeTypes: ['accident'] },
  ],
  
  // Poorna Market
  'Poorna Market': [
    { street: 'Market Road', coords: { lat: 17.7064, lng: 83.2982 }, crimeTypes: ['robbery', 'kidnap'] },
    { street: 'Old Town', coords: { lat: 17.7050, lng: 83.2960 }, crimeTypes: ['murder'] },
    { street: 'Main Bazaar', coords: { lat: 17.7080, lng: 83.3000 }, crimeTypes: ['assault'] },
  ],
  
  // Port Area
  'Port Area': [
    { street: 'Port Gate', coords: { lat: 17.6950, lng: 83.2850 }, crimeTypes: ['kidnap'] },
    { street: 'Harbour Road', coords: { lat: 17.6930, lng: 83.2830 }, crimeTypes: ['robbery'] },
  ],
  
  // Railway New Colony
  'Railway new Colony': [
    { street: 'Station Road', coords: { lat: 17.7245, lng: 83.2956 }, crimeTypes: ['kidnap'] },
    { street: 'Colony Main', coords: { lat: 17.7230, lng: 83.2940 }, crimeTypes: ['theft'] },
  ],
  
  // RK Beach
  'RK Beach': [
    { street: 'Beach Promenade', coords: { lat: 17.7180, lng: 83.3250 }, crimeTypes: ['robbery', 'kidnap'] },
    { street: 'Submarine Museum', coords: { lat: 17.7160, lng: 83.3230 }, crimeTypes: ['murder'] },
    { street: 'Aquarium Area', coords: { lat: 17.7200, lng: 83.3270 }, crimeTypes: ['accident'] },
  ],
  
  // RTC Complex
  'RTC Complex': [
    { street: 'Bus Stand', coords: { lat: 17.7200, lng: 83.3100 }, crimeTypes: ['murder'] },
    { street: 'Taxi Stand', coords: { lat: 17.7180, lng: 83.3080 }, crimeTypes: ['robbery'] },
  ],
  
  // Rushikonda
  'Rushikonda': [
    { street: 'Rushikonda Beach Road', coords: { lat: 17.7920, lng: 83.3850 }, crimeTypes: ['accident'] },
    { street: 'Beach Area', coords: { lat: 17.7880, lng: 83.3820 }, crimeTypes: ['robbery', 'kidnap'] },
    { street: 'TDP Circle', coords: { lat: 17.7950, lng: 83.3880 }, crimeTypes: ['assault'] },
  ],
  
  // Scindia
  'Scindia': [
    { street: 'Scindia Colony', coords: { lat: 17.7150, lng: 83.2900 }, crimeTypes: ['murder'] },
    { street: 'Main Road', coords: { lat: 17.7130, lng: 83.2880 }, crimeTypes: ['accident'] },
  ],
  
  // Seethammadhara
  'Seethammadhara': [
    { street: 'Main Road', coords: { lat: 17.7425, lng: 83.3124 }, crimeTypes: ['accident', 'murder'] },
    { street: 'Extension', coords: { lat: 17.7445, lng: 83.3150 }, crimeTypes: ['kidnap'] },
  ],
  
  // Sheela Nagar
  'Sheela Nagar': [
    { street: 'NH16 Signal', coords: { lat: 17.7190, lng: 83.2020 }, crimeTypes: ['robbery', 'accident'] },
    { street: 'Industrial Area', coords: { lat: 17.7210, lng: 83.2040 }, crimeTypes: ['murder'] },
  ],
  
  // Simhachalam - Temple area
  'Simhachalam': [
    { street: 'Simhachalam Ghat Road', coords: { lat: 17.7500, lng: 83.2200 }, crimeTypes: ['accident'] },
    { street: 'Temple Road', coords: { lat: 17.7530, lng: 83.2230 }, crimeTypes: ['murder', 'robbery'] },
    { street: 'Simhapuri Colony', coords: { lat: 17.7470, lng: 83.2180 }, crimeTypes: ['assault', 'kidnap'] },
  ],
  
  // Siripuram
  'Siripuram': [
    { street: 'Dutt Island', coords: { lat: 17.7198, lng: 83.3163 }, crimeTypes: ['murder'] },
    { street: 'VIP Road', coords: { lat: 17.7215, lng: 83.3180 }, crimeTypes: ['assault'] },
  ],
  
  // Steel Plant Township
  'Steel Plant Township': [
    { street: 'Ukkunagaram Road', coords: { lat: 17.6100, lng: 83.1900 }, crimeTypes: ['assault', 'robbery'] },
    { street: 'Sector 1', coords: { lat: 17.6120, lng: 83.1920 }, crimeTypes: ['murder'] },
    { street: 'Main Gate', coords: { lat: 17.6080, lng: 83.1880 }, crimeTypes: ['accident'] },
  ],
  
  // Tagarapuvalasa
  'Tagarapuvalasa': [
    { street: 'Gostani Bridge', coords: { lat: 17.9301, lng: 83.4257 }, crimeTypes: ['accident'] },
    { street: 'Beach Road', coords: { lat: 17.9280, lng: 83.4230 }, crimeTypes: ['murder'] },
  ],
  
  // Venkojipalem
  'Venkojipalem': [
    { street: 'Main Road', coords: { lat: 17.7100, lng: 83.2920 }, crimeTypes: ['murder'] },
    { street: 'Temple Street', coords: { lat: 17.7080, lng: 83.2900 }, crimeTypes: ['assault'] },
  ],
  
  // Vishalakshinagar
  'Vishalakshinagar': [
    { street: 'Main Colony', coords: { lat: 17.7350, lng: 83.3200 }, crimeTypes: ['murder', 'assault'] },
    { street: 'Layout Road', coords: { lat: 17.7330, lng: 83.3180 }, crimeTypes: ['accident'] },
  ],
  
  // Vizianagaram - Multiple areas
  'Vizianagaram': [
    { street: 'Fort Area', coords: { lat: 18.1067, lng: 83.3956 }, crimeTypes: ['murder', 'assault'] },
    { street: 'Bus Station', coords: { lat: 18.1100, lng: 83.3920 }, crimeTypes: ['robbery'] },
    { street: 'Railway Station', coords: { lat: 18.1040, lng: 83.3990 }, crimeTypes: ['kidnap'] },
    { street: 'Main Bazaar', coords: { lat: 18.1080, lng: 83.3940 }, crimeTypes: ['accident'] },
  ],
  
  // Yendada
  'Yendada': [
    { street: 'NH5 Road', coords: { lat: 17.7700, lng: 83.3600 }, crimeTypes: ['accident'] },
    { street: 'IT Park Road', coords: { lat: 17.7720, lng: 83.3620 }, crimeTypes: ['murder'] },
    { street: 'Layout Area', coords: { lat: 17.7680, lng: 83.3580 }, crimeTypes: ['robbery'] },
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
