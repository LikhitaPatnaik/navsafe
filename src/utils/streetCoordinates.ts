import { LatLng } from '@/types/route';
import { CrimeType } from './crimeTypeMapping';

// Street-level coordinates within each area for more granular crime zone marking
// Each area can have multiple streets with specific coordinates
export interface StreetLocation {
  street: string;
  coords: LatLng;
  crimeTypes?: CrimeType[]; // Common crime types at this location
}

// Complete street-level data from NAVSAFE DATASET (495 rows)
// Every unique Area+Street combination is represented with all applicable crime types
export const areaStreetCoordinates: Record<string, StreetLocation[]> = {
  // Akkayapalem - 11 crimes
  'Akkayapalem': [
    { street: 'Akkayapalem Intersection Junction', coords: { lat: 17.7347, lng: 83.2977 }, crimeTypes: ['accident'] },
    { street: 'Thatichetlapalem Junction', coords: { lat: 17.7360, lng: 83.2960 }, crimeTypes: ['accident', 'murder', 'robbery'] },
    { street: 'NH16 Highway, Thatichetlapalem', coords: { lat: 17.7370, lng: 83.2990 }, crimeTypes: ['accident'] },
    { street: 'Lalitha Nagar', coords: { lat: 17.7335, lng: 83.2950 }, crimeTypes: ['kidnap'] },
    { street: 'Akkayyapalem 80 Feet Rd', coords: { lat: 17.7380, lng: 83.3010 }, crimeTypes: ['robbery'] },
    { street: 'Nandagiri Nagar', coords: { lat: 17.7320, lng: 83.2940 }, crimeTypes: ['murder'] },
    { street: 'Shantipuram', coords: { lat: 17.7355, lng: 83.2995 }, crimeTypes: ['accident'] },
    { street: 'Akkayapalem Highway', coords: { lat: 17.7365, lng: 83.3000 }, crimeTypes: ['accident'] },
  ],

  // Allipuram - 6 crimes
  'Allipuram': [
    { street: 'Yellamma Temple', coords: { lat: 17.7193, lng: 83.2971 }, crimeTypes: ['accident'] },
    { street: 'Allipuram Main Road', coords: { lat: 17.7200, lng: 83.2985 }, crimeTypes: ['murder', 'robbery'] },
    { street: 'Jalaripeta', coords: { lat: 17.7185, lng: 83.2960 }, crimeTypes: ['robbery'] },
    { street: 'Shankaramatham Road', coords: { lat: 17.7195, lng: 83.2975 }, crimeTypes: ['robbery'] },
    { street: 'National Highway 16', coords: { lat: 17.7210, lng: 83.2990 }, crimeTypes: ['kidnap'] },
  ],

  // Anakapalli - 27 crimes
  'Anakapalli': [
    { street: 'NH16, Nutulaguntla Palem', coords: { lat: 17.6890, lng: 83.0035 }, crimeTypes: ['accident'] },
    { street: 'Makavarapalem Village', coords: { lat: 17.6910, lng: 83.0095 }, crimeTypes: ['accident'] },
    { street: 'Vijayaramarajupet', coords: { lat: 17.6855, lng: 83.0015 }, crimeTypes: ['robbery'] },
    { street: 'ShankarMuttam Junction', coords: { lat: 17.6946, lng: 83.0086 }, crimeTypes: ['accident'] },
    { street: 'Sabbavaram', coords: { lat: 17.6820, lng: 83.0100 }, crimeTypes: ['accident', 'murder'] },
    { street: 'Narsipatnam Town', coords: { lat: 17.6860, lng: 83.0010 }, crimeTypes: ['murder', 'assault'] },
    { street: 'Gavarapalem', coords: { lat: 17.6875, lng: 82.9980 }, crimeTypes: ['robbery'] },
    { street: 'Bayyavarm, NH16', coords: { lat: 17.6920, lng: 83.0050 }, crimeTypes: ['accident', 'murder'] },
    { street: 'Kokkirapalli, Yelamanchili', coords: { lat: 17.6930, lng: 83.0070 }, crimeTypes: ['kidnap'] },
    { street: 'Lokavari Peta', coords: { lat: 17.6910, lng: 83.0040 }, crimeTypes: ['kidnap'] },
    { street: 'Lankelapalem Junction', coords: { lat: 17.6850, lng: 83.0000 }, crimeTypes: ['accident'] },
    { street: 'Sunkarpeta', coords: { lat: 17.6880, lng: 83.0060 }, crimeTypes: ['accident'] },
    { street: 'Kanakamahalakshmi Bank', coords: { lat: 17.6900, lng: 83.0025 }, crimeTypes: ['robbery'] },
    { street: 'Vooderu', coords: { lat: 17.6870, lng: 83.0055 }, crimeTypes: ['murder'] },
    { street: 'Madugula', coords: { lat: 17.6845, lng: 83.0075 }, crimeTypes: ['murder'] },
    { street: 'Koppugondupalem', coords: { lat: 17.6935, lng: 83.0090 }, crimeTypes: ['murder'] },
    { street: 'Anakapalli-Simhachalam Road', coords: { lat: 17.6925, lng: 83.0065 }, crimeTypes: ['kidnap'] },
    { street: 'Dharmavaram Agraharam', coords: { lat: 17.6840, lng: 83.0045 }, crimeTypes: ['murder'] },
    { street: 'Batajangalapalem Village', coords: { lat: 17.6865, lng: 83.0030 }, crimeTypes: ['murder'] },
    { street: 'Devarapalli-Anandapuram Road', coords: { lat: 17.6895, lng: 83.0080 }, crimeTypes: ['accident'] },
    { street: 'Anakapalle Express Highway', coords: { lat: 17.6885, lng: 83.0060 }, crimeTypes: ['accident'] },
  ],

  // Anandapuram - 19 crimes
  'Anandapuram': [
    { street: 'Anandapuram National Highway', coords: { lat: 17.9000, lng: 83.3700 }, crimeTypes: ['accident', 'murder'] },
    { street: 'Anandapuram Bypass', coords: { lat: 17.8980, lng: 83.3680 }, crimeTypes: ['assault', 'robbery', 'murder'] },
    { street: 'Sontyam Junction', coords: { lat: 17.9020, lng: 83.3720 }, crimeTypes: ['murder', 'accident'] },
    { street: 'Kallivani Palem', coords: { lat: 17.8960, lng: 83.3660 }, crimeTypes: ['murder'] },
    { street: 'Gummadi Vanipalem Highway', coords: { lat: 17.9040, lng: 83.3740 }, crimeTypes: ['accident'] },
    { street: 'Gudilova', coords: { lat: 17.9060, lng: 83.3760 }, crimeTypes: ['robbery'] },
    { street: 'AH45 Highway', coords: { lat: 17.9010, lng: 83.3710 }, crimeTypes: ['accident'] },
    { street: 'Enugulapalem', coords: { lat: 17.8970, lng: 83.3690 }, crimeTypes: ['accident'] },
    { street: 'Kondapuram', coords: { lat: 17.9030, lng: 83.3730 }, crimeTypes: ['murder'] },
    { street: 'Ramavaram', coords: { lat: 17.8990, lng: 83.3695 }, crimeTypes: ['murder'] },
  ],

  // Andhra University - 2 crimes
  'Andhra University': [
    { street: 'Near AU Samatha Hostel', coords: { lat: 17.7320, lng: 83.3190 }, crimeTypes: ['murder'] },
    { street: 'AU Engineering College Ground', coords: { lat: 17.7300, lng: 83.3170 }, crimeTypes: ['robbery'] },
  ],

  // Arilova - 9 crimes
  'Arilova': [
    { street: 'Ambedkar Nagar', coords: { lat: 17.7673, lng: 83.3134 }, crimeTypes: ['murder'] },
    { street: 'Healthcity, Q1 Hospitals Road', coords: { lat: 17.7690, lng: 83.3150 }, crimeTypes: ['accident'] },
    { street: 'Seethakonda Road', coords: { lat: 17.7660, lng: 83.3120 }, crimeTypes: ['kidnap', 'accident'] },
    { street: 'BRTS Road', coords: { lat: 17.7680, lng: 83.3140 }, crimeTypes: ['accident'] },
    { street: 'Hanumanthawaka Junction', coords: { lat: 17.7650, lng: 83.3100 }, crimeTypes: ['accident'] },
    { street: 'Darapalem', coords: { lat: 17.7700, lng: 83.3160 }, crimeTypes: ['robbery'] },
    { street: 'Adarsh Nagar', coords: { lat: 17.7640, lng: 83.3110 }, crimeTypes: ['robbery'] },
    { street: 'Near Mudasarlova Park', coords: { lat: 17.7665, lng: 83.3125 }, crimeTypes: ['assault'] },
  ],

  // Balayya Sastri Layout - 1 crime
  'Balayya Sastri Layout': [
    { street: 'Gurudwara Highway', coords: { lat: 17.7250, lng: 83.3050 }, crimeTypes: ['accident'] },
  ],

  // Beach Road - 11 crimes
  'Beach Road': [
    { street: 'Sagar Nagar Area', coords: { lat: 17.7215, lng: 83.3150 }, crimeTypes: ['kidnap'] },
    { street: 'Appughar Road', coords: { lat: 17.7180, lng: 83.3120 }, crimeTypes: ['accident'] },
    { street: 'Tenneti Park', coords: { lat: 17.7230, lng: 83.3160 }, crimeTypes: ['accident'] },
    { street: 'YMCA Parking Lot', coords: { lat: 17.7200, lng: 83.3140 }, crimeTypes: ['assault'] },
    { street: 'VUDA Park Road', coords: { lat: 17.7250, lng: 83.3170 }, crimeTypes: ['assault'] },
    { street: 'NTR Statue Road', coords: { lat: 17.7190, lng: 83.3130 }, crimeTypes: ['assault'] },
    { street: 'Bhimili Beach Road', coords: { lat: 17.7270, lng: 83.3190 }, crimeTypes: ['accident'] },
    { street: 'Madhavadhara', coords: { lat: 17.7160, lng: 83.3100 }, crimeTypes: ['murder'] },
    { street: 'RK Beach Children Park', coords: { lat: 17.7240, lng: 83.3165 }, crimeTypes: ['accident'] },
    { street: 'MARLIN CAY BEACH RESORTS, Bhimili', coords: { lat: 17.7275, lng: 83.3195 }, crimeTypes: ['accident'] },
  ],

  // Bheemunipatnam - 14 crimes
  'Bheemunipatnam': [
    { street: 'SOS Junction Beach Road', coords: { lat: 17.8900, lng: 83.4500 }, crimeTypes: ['accident'] },
    { street: 'Gollapalem, Vellanki', coords: { lat: 17.8920, lng: 83.4520 }, crimeTypes: ['robbery'] },
    { street: 'Chillapet, Bhimili-Tagarapuvalasa Road', coords: { lat: 17.8940, lng: 83.4540 }, crimeTypes: ['robbery'] },
    { street: 'Nerellavalasa', coords: { lat: 17.8880, lng: 83.4480 }, crimeTypes: ['kidnap', 'assault'] },
    { street: 'Near Hospital, Bheemunipatnam', coords: { lat: 17.8910, lng: 83.4510 }, crimeTypes: ['murder'] },
    { street: 'INS Kalinga', coords: { lat: 17.8860, lng: 83.4460 }, crimeTypes: ['accident'] },
    { street: 'Timmapuram Beach Road', coords: { lat: 17.8930, lng: 83.4530 }, crimeTypes: ['accident'] },
    { street: 'Dakkamarri Fortune Layout', coords: { lat: 17.8870, lng: 83.4470 }, crimeTypes: ['murder'] },
    { street: 'Kapuluppada', coords: { lat: 17.8950, lng: 83.4550 }, crimeTypes: ['murder'] },
    { street: 'Thotlakonda', coords: { lat: 17.8840, lng: 83.4440 }, crimeTypes: ['assault'] },
    { street: 'Satyanarayanapuram, Padmanabham', coords: { lat: 17.8890, lng: 83.4490 }, crimeTypes: ['robbery'] },
    { street: 'Majjivalasa', coords: { lat: 17.8915, lng: 83.4515 }, crimeTypes: ['robbery'] },
    { street: 'Mangamaripet-Bhimili Road', coords: { lat: 17.8925, lng: 83.4525 }, crimeTypes: ['accident'] },
  ],

  // Bhogapuram - 3 crimes
  'Bhogapuram': [
    { street: 'Ravivalasa', coords: { lat: 18.0300, lng: 83.4900 }, crimeTypes: ['accident'] },
    { street: 'Polipalli', coords: { lat: 18.0280, lng: 83.4880 }, crimeTypes: ['accident'] },
  ],

  // Boyapalem - 2 crimes
  'Boyapalem': [
    { street: 'Boyapalem Junction', coords: { lat: 17.7312, lng: 83.2859 }, crimeTypes: ['accident'] },
    { street: 'Boyapalem Signal Junction', coords: { lat: 17.7295, lng: 83.2840 }, crimeTypes: ['accident'] },
  ],

  // Dabagardens - 2 crimes
  'Dabagardens': [
    { street: 'Pedagantyada Area', coords: { lat: 17.7150, lng: 83.3050 }, crimeTypes: ['assault'] },
    { street: 'Near Prakashrao Junction', coords: { lat: 17.7170, lng: 83.3070 }, crimeTypes: ['murder'] },
  ],

  // Daspalla Hills - 2 crimes
  'Daspalla Hills': [
    { street: '75 Feet Service Road', coords: { lat: 17.7220, lng: 83.3100 }, crimeTypes: ['robbery'] },
    { street: 'Harbour Park, Jagannadha Swamy Temple', coords: { lat: 17.7200, lng: 83.3080 }, crimeTypes: ['kidnap'] },
  ],

  // Dwaraka Nagar - 11 crimes
  'Dwaraka Nagar': [
    { street: 'Dwaraka Nagar Road', coords: { lat: 17.7287, lng: 83.3086 }, crimeTypes: ['assault'] },
    { street: 'Indian Bank, VIP Road', coords: { lat: 17.7260, lng: 83.3050 }, crimeTypes: ['robbery'] },
    { street: 'DRM Office Road, Dondaparthy', coords: { lat: 17.7310, lng: 83.3110 }, crimeTypes: ['kidnap'] },
    { street: 'Madhuranagar', coords: { lat: 17.7295, lng: 83.3070 }, crimeTypes: ['robbery'] },
  ],
  'Dwarakanagar': [
    { street: 'Satyam Junction, Rama Talkies', coords: { lat: 17.7287, lng: 83.3086 }, crimeTypes: ['accident'] },
    { street: 'Dwarakanagar 5th Lane', coords: { lat: 17.7270, lng: 83.3070 }, crimeTypes: ['accident'] },
    { street: 'Sangam Sarath Theatre Junction', coords: { lat: 17.7300, lng: 83.3100 }, crimeTypes: ['accident'] },
  ],

  // Gajuwaka - 27 crimes
  'Gajuwaka': [
    { street: 'Autonagar Signal Junction', coords: { lat: 17.6853, lng: 83.2037 }, crimeTypes: ['accident'] },
    { street: 'Krishna Nagar', coords: { lat: 17.6830, lng: 83.2010 }, crimeTypes: ['robbery'] },
    { street: 'Gopalapatnam Railway Station', coords: { lat: 17.6870, lng: 83.2060 }, crimeTypes: ['kidnap'] },
    { street: 'Aganampudi Junction', coords: { lat: 17.6810, lng: 83.1990 }, crimeTypes: ['accident', 'robbery'] },
    { street: 'Butchirajupalem', coords: { lat: 17.6890, lng: 83.2080 }, crimeTypes: ['accident'] },
    { street: 'NH16, Nathayyapalem', coords: { lat: 17.6840, lng: 83.2020 }, crimeTypes: ['accident'] },
    { street: 'Pentayya Nagar', coords: { lat: 17.6800, lng: 83.1980 }, crimeTypes: ['murder'] },
    { street: 'Gajuwaka Junction', coords: { lat: 17.6860, lng: 83.2050 }, crimeTypes: ['murder', 'robbery'] },
    { street: 'Kanithi Road Market', coords: { lat: 17.6820, lng: 83.2000 }, crimeTypes: ['assault'] },
    { street: 'Jaggu Junction', coords: { lat: 17.6880, lng: 83.2070 }, crimeTypes: ['murder', 'accident'] },
    { street: 'Old Gajuwaka Junction', coords: { lat: 17.6850, lng: 83.2040 }, crimeTypes: ['accident'] },
    { street: 'Gangavaram Port Road', coords: { lat: 17.6790, lng: 83.1970 }, crimeTypes: ['robbery'] },
    { street: 'NAD-Gajuwaka Road', coords: { lat: 17.6845, lng: 83.2030 }, crimeTypes: ['assault', 'murder'] },
    { street: 'Happy Mobile Store, Scindia Road', coords: { lat: 17.6835, lng: 83.2025 }, crimeTypes: ['robbery'] },
    { street: 'Yarada Beach', coords: { lat: 17.6780, lng: 83.1960 }, crimeTypes: ['robbery'] },
    { street: 'Hanuman Koodali, Aganampudi', coords: { lat: 17.6815, lng: 83.1995 }, crimeTypes: ['murder'] },
    { street: 'Mindi Village', coords: { lat: 17.6795, lng: 83.1975 }, crimeTypes: ['robbery'] },
    { street: 'Balacheruvu, Pedaganthyada', coords: { lat: 17.6825, lng: 83.2005 }, crimeTypes: ['assault'] },
    { street: 'Malkapuram', coords: { lat: 17.6855, lng: 83.2045 }, crimeTypes: ['murder'] },
    { street: 'Sundharayya Colony', coords: { lat: 17.6865, lng: 83.2055 }, crimeTypes: ['accident'] },
    { street: 'Kurmannapalem', coords: { lat: 17.6875, lng: 83.2065 }, crimeTypes: ['accident'] },
  ],

  // Ghat Road - 1 crime
  'Ghat road': [
    { street: 'Kailasagiri Ghat Road', coords: { lat: 17.7650, lng: 83.2380 }, crimeTypes: ['accident'] },
  ],

  // Gopalapatnam - 1 crime
  'Gopalapatnam': [
    { street: 'Baji Junction Area', coords: { lat: 17.7550, lng: 83.2700 }, crimeTypes: ['robbery'] },
  ],

  // Jagadamba Junction - 15 crimes
  'Jagadamba Junction': [
    { street: 'Karakachettu Polamamba Temple', coords: { lat: 17.7105, lng: 83.2980 }, crimeTypes: ['robbery'] },
    { street: 'Near Public Sector Bank', coords: { lat: 17.7090, lng: 83.2960 }, crimeTypes: ['robbery'] },
    { street: 'Jagadamba Road', coords: { lat: 17.7120, lng: 83.3000 }, crimeTypes: ['murder', 'kidnap', 'accident', 'assault'] },
    { street: 'Maharanipeta', coords: { lat: 17.7080, lng: 83.2940 }, crimeTypes: ['murder'] },
    { street: 'Fishing Harbour Area', coords: { lat: 17.7070, lng: 83.2950 }, crimeTypes: ['accident'] },
    { street: 'KGH Hospital', coords: { lat: 17.7100, lng: 83.2990 }, crimeTypes: ['assault'] },
  ],

  // Kancharapalem - 22 crimes
  'Kancharapalem': [
    { street: 'Pydimamba Temple', coords: { lat: 17.7354, lng: 83.2738 }, crimeTypes: ['murder'] },
    { street: 'Kancharapalem Road', coords: { lat: 17.7380, lng: 83.2760 }, crimeTypes: ['murder', 'assault', 'accident', 'kidnap'] },
    { street: 'Gnanapuram', coords: { lat: 17.7340, lng: 83.2720 }, crimeTypes: ['robbery'] },
    { street: 'Ayyappanagar, MuraliNagar', coords: { lat: 17.7360, lng: 83.2750 }, crimeTypes: ['robbery'] },
    { street: 'Burma Colony, Madhavadhara', coords: { lat: 17.7330, lng: 83.2710 }, crimeTypes: ['assault'] },
    { street: 'Madhava Swamy Temple, Madhavadhara', coords: { lat: 17.7370, lng: 83.2770 }, crimeTypes: ['robbery'] },
    { street: 'Urvashi Junction', coords: { lat: 17.7350, lng: 83.2740 }, crimeTypes: ['assault', 'accident'] },
    { street: 'ITI Junction', coords: { lat: 17.7390, lng: 83.2780 }, crimeTypes: ['robbery'] },
    { street: 'Reddi Kancharapalem', coords: { lat: 17.7320, lng: 83.2700 }, crimeTypes: ['murder'] },
    { street: 'Sanjeevayya Colony', coords: { lat: 17.7400, lng: 83.2790 }, crimeTypes: ['murder'] },
    { street: 'Indra Nagar', coords: { lat: 17.7345, lng: 83.2730 }, crimeTypes: ['robbery'] },
    { street: 'Bowdra Ring Road', coords: { lat: 17.7365, lng: 83.2755 }, crimeTypes: ['accident'] },
    { street: 'Kancharapalem Mettu', coords: { lat: 17.7375, lng: 83.2765 }, crimeTypes: ['murder'] },
  ],

  // Kommadi - 4 crimes
  'Kommadi': [
    { street: 'Vikalangula Colony', coords: { lat: 17.8440, lng: 83.3225 }, crimeTypes: ['murder'] },
    { street: 'National Highway 16', coords: { lat: 17.8450, lng: 83.3240 }, crimeTypes: ['accident'] },
    { street: 'Kommadi Junction', coords: { lat: 17.8428, lng: 83.3215 }, crimeTypes: ['accident'] },
    { street: 'SwayamKrushiNagar', coords: { lat: 17.8415, lng: 83.3200 }, crimeTypes: ['murder'] },
  ],

  // Kurmannapalem - 9 crimes
  'Kurmannapalem': [
    { street: 'JNNURM Colony, Duvvada', coords: { lat: 17.6900, lng: 83.1700 }, crimeTypes: ['murder'] },
    { street: 'Kurmannapalem Junction', coords: { lat: 17.6880, lng: 83.1720 }, crimeTypes: ['accident'] },
    { street: 'RTC Depot', coords: { lat: 17.6860, lng: 83.1680 }, crimeTypes: ['accident'] },
    { street: 'Simon Nagar', coords: { lat: 17.6910, lng: 83.1740 }, crimeTypes: ['robbery'] },
    { street: 'Rajivnagar, Duvvada', coords: { lat: 17.6890, lng: 83.1710 }, crimeTypes: ['murder'] },
    { street: 'National Highway 16', coords: { lat: 17.6870, lng: 83.1690 }, crimeTypes: ['accident'] },
    { street: 'Sector 1, Duvvada', coords: { lat: 17.6895, lng: 83.1715 }, crimeTypes: ['accident'] },
  ],

  // Lawsons Bay Colony - 15 crimes
  'Lawsons Bay Colony': [
    { street: 'Lawsons Bay Road', coords: { lat: 17.7300, lng: 83.3300 }, crimeTypes: ['kidnap', 'murder', 'assault', 'accident'] },
    { street: 'Lawsons Bay Main Road', coords: { lat: 17.7320, lng: 83.3320 }, crimeTypes: ['robbery'] },
    { street: 'Bharat Petrol Bunk', coords: { lat: 17.7280, lng: 83.3280 }, crimeTypes: ['assault'] },
  ],

  // Maddilapalem - 23 crimes
  'Maddilapalem': [
    { street: 'Maddilapalem Road', coords: { lat: 17.7382, lng: 83.3230 }, crimeTypes: ['kidnap', 'murder', 'assault', 'accident', 'robbery'] },
    { street: 'KRM Colony', coords: { lat: 17.7360, lng: 83.3210 }, crimeTypes: ['murder'] },
    { street: 'Kranthi Nagar', coords: { lat: 17.7370, lng: 83.3220 }, crimeTypes: ['murder'] },
    { street: 'CMR Function Hall', coords: { lat: 17.7390, lng: 83.3240 }, crimeTypes: ['murder'] },
    { street: 'HB Colony', coords: { lat: 17.7375, lng: 83.3225 }, crimeTypes: ['assault'] },
    { street: 'Pithapuram Colony', coords: { lat: 17.7400, lng: 83.3250 }, crimeTypes: ['murder'] },
    { street: 'Nakkavanipalem', coords: { lat: 17.7365, lng: 83.3215 }, crimeTypes: ['murder'] },
    { street: 'Maddilapalem Signal Junction', coords: { lat: 17.7395, lng: 83.3245 }, crimeTypes: ['accident'] },
  ],

  // Madhurawada - 10 crimes
  'Madhurawada': [
    { street: 'NH16 Highway', coords: { lat: 17.8017, lng: 83.3533 }, crimeTypes: ['accident', 'murder'] },
    { street: 'NGOs Colony', coords: { lat: 17.8056, lng: 83.3505 }, crimeTypes: ['murder'] },
    { street: 'Chandrampalem High School', coords: { lat: 17.7990, lng: 83.3550 }, crimeTypes: ['accident'] },
    { street: 'Panorama Hills', coords: { lat: 17.8030, lng: 83.3520 }, crimeTypes: ['robbery'] },
    { street: 'PM Palem', coords: { lat: 17.7990, lng: 83.3531 }, crimeTypes: ['assault'] },
    { street: 'IT SEZ Road', coords: { lat: 17.8040, lng: 83.3560 }, crimeTypes: ['accident'] },
    { street: 'Rickshaw Colony, Srinivasa Nagar', coords: { lat: 17.8025, lng: 83.3515 }, crimeTypes: ['murder'] },
  ],

  // Malkapuram - 5 crimes
  'Malkapuram': [
    { street: 'Malkapuram Area', coords: { lat: 17.6880, lng: 83.2450 }, crimeTypes: ['robbery'] },
    { street: 'Signal Junction, Agnampudi', coords: { lat: 17.6900, lng: 83.2470 }, crimeTypes: ['murder'] },
    { street: 'Janatha Colony', coords: { lat: 17.6870, lng: 83.2440 }, crimeTypes: ['robbery'] },
    { street: 'Coast Guard Quarters', coords: { lat: 17.6890, lng: 83.2460 }, crimeTypes: ['murder'] },
    { street: 'Malkapuram Road', coords: { lat: 17.6860, lng: 83.2430 }, crimeTypes: ['assault'] },
  ],

  // Marikavalasa - 4 crimes
  'Marikavalasa': [
    { street: 'Marikavalasa Road', coords: { lat: 17.8359, lng: 83.3581 }, crimeTypes: ['robbery'] },
    { street: 'Marikavalasa Highway Junction', coords: { lat: 17.8340, lng: 83.3560 }, crimeTypes: ['murder', 'accident'] },
    { street: 'NH16 Highway', coords: { lat: 17.8350, lng: 83.3570 }, crimeTypes: ['accident'] },
  ],

  // Marripalem - 15 crimes
  'Marripalem': [
    { street: 'Airport Road', coords: { lat: 17.7400, lng: 83.2500 }, crimeTypes: ['kidnap', 'murder', 'assault', 'accident', 'robbery'] },
    { street: 'Shyamnagar Colony', coords: { lat: 17.7420, lng: 83.2530 }, crimeTypes: ['robbery'] },
    { street: 'Near Railway Quarters', coords: { lat: 17.7380, lng: 83.2470 }, crimeTypes: ['murder'] },
    { street: 'Marripalem VUDA Colony', coords: { lat: 17.7410, lng: 83.2520 }, crimeTypes: ['robbery'] },
    { street: 'Devi Residents', coords: { lat: 17.7415, lng: 83.2515 }, crimeTypes: ['robbery'] },
    { street: 'Railway Station', coords: { lat: 17.7385, lng: 83.2480 }, crimeTypes: ['murder'] },
  ],

  // MVP Colony - 20 crimes
  'MVP Colony': [
    { street: 'MVP Double Road', coords: { lat: 17.7407, lng: 83.3367 }, crimeTypes: ['robbery', 'assault', 'accident', 'murder'] },
    { street: 'Ushodaya Junction', coords: { lat: 17.7420, lng: 83.3340 }, crimeTypes: ['murder'] },
    { street: 'MVP Sector 2', coords: { lat: 17.7390, lng: 83.3390 }, crimeTypes: ['robbery'] },
    { street: 'MVP Sector 6', coords: { lat: 17.7395, lng: 83.3380 }, crimeTypes: ['robbery', 'accident'] },
    { street: 'Mangalapuram Colony', coords: { lat: 17.7380, lng: 83.3350 }, crimeTypes: ['robbery'] },
    { street: 'Sivajipalem Road', coords: { lat: 17.7415, lng: 83.3360 }, crimeTypes: ['murder', 'accident'] },
    { street: 'Nakkavanipalem Area', coords: { lat: 17.7400, lng: 83.3370 }, crimeTypes: ['murder'] },
    { street: 'Samatha College', coords: { lat: 17.7385, lng: 83.3355 }, crimeTypes: ['assault'] },
    { street: 'Near Venkojipalem Junction', coords: { lat: 17.7410, lng: 83.3375 }, crimeTypes: ['accident'] },
    { street: 'MVP Colony Sector 1', coords: { lat: 17.7392, lng: 83.3385 }, crimeTypes: ['robbery'] },
  ],

  // NAD Junction - 7 crimes
  'NAD Junction': [
    { street: 'NAD Junction', coords: { lat: 17.7400, lng: 83.2300 }, crimeTypes: ['accident'] },
    { street: 'NAD Flyover', coords: { lat: 17.7420, lng: 83.2320 }, crimeTypes: ['accident'] },
    { street: 'Regional Forensic Laboratory Road', coords: { lat: 17.7410, lng: 83.2310 }, crimeTypes: ['accident'] },
    { street: 'Vasavi Apartments, Ganesh Nagar', coords: { lat: 17.7390, lng: 83.2290 }, crimeTypes: ['robbery'] },
    { street: 'Viman Nagar', coords: { lat: 17.7430, lng: 83.2330 }, crimeTypes: ['murder'] },
  ],

  // One Town - 15 crimes
  'One Town': [
    { street: 'Town Kotha Road', coords: { lat: 17.7000, lng: 83.2900 }, crimeTypes: ['assault', 'kidnap'] },
    { street: 'Kurupam Market', coords: { lat: 17.7020, lng: 83.2920 }, crimeTypes: ['robbery'] },
    { street: 'KGH Hospital', coords: { lat: 17.6990, lng: 83.2890 }, crimeTypes: ['kidnap'] },
    { street: 'Relliveedhi', coords: { lat: 17.7010, lng: 83.2910 }, crimeTypes: ['murder'] },
    { street: 'Fishing Harbour Area', coords: { lat: 17.6980, lng: 83.2880 }, crimeTypes: ['murder'] },
    { street: 'Chilakapeta', coords: { lat: 17.7030, lng: 83.2930 }, crimeTypes: ['murder'] },
  ],

  // Pendurthi - 20 crimes
  'Pendurthi': [
    { street: 'Juttada Village', coords: { lat: 17.7990, lng: 83.1960 }, crimeTypes: ['murder'] },
    { street: 'Chinthalagraham Village', coords: { lat: 17.8010, lng: 83.1970 }, crimeTypes: ['kidnap'] },
    { street: 'SujathaNagar', coords: { lat: 17.7970, lng: 83.1930 }, crimeTypes: ['kidnap', 'murder'] },
    { street: '80 Feet Rd', coords: { lat: 17.7980, lng: 83.1950 }, crimeTypes: ['robbery'] },
    { street: 'Brundavan Gardens', coords: { lat: 17.7960, lng: 83.1920 }, crimeTypes: ['murder'] },
    { street: 'Vepagunta Junction', coords: { lat: 17.8020, lng: 83.1980 }, crimeTypes: ['accident', 'robbery'] },
    { street: 'Anakapalli-Anandapuram Highway', coords: { lat: 17.8030, lng: 83.1990 }, crimeTypes: ['accident'] },
    { street: 'Saripalli Flyover Road', coords: { lat: 17.7950, lng: 83.1910 }, crimeTypes: ['accident'] },
    { street: 'Appannapalem', coords: { lat: 17.8000, lng: 83.1965 }, crimeTypes: ['murder'] },
    { street: 'National Highway', coords: { lat: 17.8040, lng: 83.2000 }, crimeTypes: ['accident'] },
    { street: 'Rajayyapeta Area', coords: { lat: 17.7985, lng: 83.1955 }, crimeTypes: ['murder'] },
    { street: 'Chinnamushidiwada, SaptagiriNagar', coords: { lat: 17.7995, lng: 83.1940 }, crimeTypes: ['murder'] },
    { street: 'Cheemalapalli', coords: { lat: 17.8005, lng: 83.1975 }, crimeTypes: ['robbery'] },
    { street: 'Mutyamamba Colony, Vepagunta', coords: { lat: 17.8015, lng: 83.1985 }, crimeTypes: ['robbery'] },
    { street: 'Araku-Visakhapatnam Rd', coords: { lat: 17.8025, lng: 83.1995 }, crimeTypes: ['accident'] },
    { street: 'Akkireddypalem', coords: { lat: 17.7975, lng: 83.1945 }, crimeTypes: ['accident'] },
    { street: 'SBI ATM near Nataraj Cinema Hall', coords: { lat: 17.7965, lng: 83.1935 }, crimeTypes: ['robbery'] },
    { street: 'Pinagadi Village', coords: { lat: 17.8035, lng: 83.1998 }, crimeTypes: ['robbery'] },
  ],

  // PM Palem - 5 crimes
  'PM Palem': [
    { street: 'Vizag Conventions, Near Stadium', coords: { lat: 17.7996, lng: 83.3531 }, crimeTypes: ['accident'] },
    { street: 'Vasundhara Nagar, MVV City Road', coords: { lat: 17.8010, lng: 83.3550 }, crimeTypes: ['accident'] },
    { street: 'Midhilapuri VUDA Colony', coords: { lat: 17.8000, lng: 83.3540 }, crimeTypes: ['murder', 'assault'] },
    { street: 'PM Palem Road', coords: { lat: 17.7990, lng: 83.3520 }, crimeTypes: ['kidnap'] },
  ],

  // Poorna Market - 12 crimes
  'Poorna Market': [
    { street: 'Panda Street', coords: { lat: 17.7064, lng: 83.2982 }, crimeTypes: ['murder'] },
    { street: 'Market Road', coords: { lat: 17.7050, lng: 83.2960 }, crimeTypes: ['murder', 'kidnap', 'assault'] },
    { street: 'Shopping Area', coords: { lat: 17.7080, lng: 83.3000 }, crimeTypes: ['accident'] },
  ],

  // Port Area - 1 crime
  'Port Area': [
    { street: 'Gosha Hospitals, ChengalRaoPet', coords: { lat: 17.6950, lng: 83.2850 }, crimeTypes: ['kidnap'] },
  ],

  // Railway new Colony - 6 crimes
  'Railway new Colony': [
    { street: 'Railway Station', coords: { lat: 17.7245, lng: 83.2956 }, crimeTypes: ['kidnap'] },
    { street: 'BRTS Road, Near Gnanapuram', coords: { lat: 17.7230, lng: 83.2940 }, crimeTypes: ['accident'] },
    { street: 'Balaji Metro Residency, Dondaparthy', coords: { lat: 17.7260, lng: 83.2970 }, crimeTypes: ['robbery'] },
    { street: 'Railway Station Junction', coords: { lat: 17.7250, lng: 83.2950 }, crimeTypes: ['kidnap'] },
  ],

  // RK Beach - 19 crimes
  'RK Beach': [
    { street: 'Beach Road', coords: { lat: 17.7180, lng: 83.3250 }, crimeTypes: ['murder', 'robbery', 'accident', 'assault', 'kidnap'] },
    { street: 'Gokul Park', coords: { lat: 17.7160, lng: 83.3230 }, crimeTypes: ['murder'] },
    { street: 'Children Park', coords: { lat: 17.7200, lng: 83.3270 }, crimeTypes: ['kidnap'] },
  ],

  // RTC Complex - 4 crimes
  'RTC Complex': [
    { street: 'Telugu Thalli Flyover', coords: { lat: 17.7200, lng: 83.3100 }, crimeTypes: ['accident'] },
    { street: 'Rama Talkies Road', coords: { lat: 17.7180, lng: 83.3080 }, crimeTypes: ['robbery'] },
    { street: 'Dwaraka Bus Stop', coords: { lat: 17.7190, lng: 83.3090 }, crimeTypes: ['accident'] },
  ],

  // Rushikonda - 19 crimes
  'Rushikonda': [
    { street: 'Rushikonda Beach Road', coords: { lat: 17.7920, lng: 83.3850 }, crimeTypes: ['assault', 'murder', 'robbery', 'accident', 'kidnap'] },
    { street: 'Balaji Bay Mount Road', coords: { lat: 17.7900, lng: 83.3830 }, crimeTypes: ['kidnap'] },
    { street: 'Radisson Blue Junction', coords: { lat: 17.7940, lng: 83.3870 }, crimeTypes: ['accident'] },
  ],

  // Scindia - 1 crime
  'Scindia': [
    { street: 'Essar Junction, Port Area', coords: { lat: 17.7150, lng: 83.2900 }, crimeTypes: ['accident'] },
  ],

  // Seethammadhara - 5 crimes
  'Seethammadhara': [
    { street: 'ASR Nagar', coords: { lat: 17.7425, lng: 83.3124 }, crimeTypes: ['murder'] },
    { street: 'Port Hospital Junction', coords: { lat: 17.7440, lng: 83.3140 }, crimeTypes: ['accident'] },
    { street: 'Oxygen Towers', coords: { lat: 17.7410, lng: 83.3110 }, crimeTypes: ['assault'] },
    { street: 'Main Road, Near AMG Hospital', coords: { lat: 17.7435, lng: 83.3130 }, crimeTypes: ['accident'] },
    { street: 'SR Nagar', coords: { lat: 17.7420, lng: 83.3120 }, crimeTypes: ['assault'] },
  ],

  // Sheela Nagar (combined with Sheelanagar) - 6 crimes
  'Sheela Nagar': [
    { street: 'Kakani Nagar', coords: { lat: 17.7185, lng: 83.1984 }, crimeTypes: ['robbery'] },
    { street: 'Sheelanagar-Harbour City Road Flyover', coords: { lat: 17.7195, lng: 83.1994 }, crimeTypes: ['murder', 'accident'] },
    { street: 'Y Junction', coords: { lat: 17.7175, lng: 83.1974 }, crimeTypes: ['accident'] },
    { street: 'Venkateshwara Colony', coords: { lat: 17.7200, lng: 83.2000 }, crimeTypes: ['murder'] },
    { street: 'NH16 Signal Point', coords: { lat: 17.7170, lng: 83.1968 }, crimeTypes: ['accident'] },
  ],

  // Simhachalam - 18 crimes
  'Simhachalam': [
    { street: 'Simhachalam Ghat Road', coords: { lat: 17.7680, lng: 83.2500 }, crimeTypes: ['assault', 'accident', 'murder'] },
    { street: 'Viratnagar Locality', coords: { lat: 17.7700, lng: 83.2510 }, crimeTypes: ['murder'] },
    { street: 'Simhachalam Road', coords: { lat: 17.7690, lng: 83.2490 }, crimeTypes: ['murder', 'accident'] },
    { street: 'Adavivaram', coords: { lat: 17.7660, lng: 83.2470 }, crimeTypes: ['murder'] },
    { street: 'Old Adavivaram', coords: { lat: 17.7650, lng: 83.2460 }, crimeTypes: ['kidnap'] },
    { street: 'Simhapuri Colony', coords: { lat: 17.7640, lng: 83.2450 }, crimeTypes: ['accident'] },
    { street: 'Near Appanna, Simhachalam Road', coords: { lat: 17.7710, lng: 83.2520 }, crimeTypes: ['accident'] },
  ],

  // Siripuram - 3 crimes
  'Siripuram': [
    { street: 'Soma Restobar, VIP Road', coords: { lat: 17.7198, lng: 83.3163 }, crimeTypes: ['accident'] },
    { street: 'Siripuram Junction', coords: { lat: 17.7210, lng: 83.3175 }, crimeTypes: ['accident'] },
    { street: 'Siripuram Dutt Island', coords: { lat: 17.7190, lng: 83.3155 }, crimeTypes: ['accident'] },
  ],

  // Steel Plant Township - 10 crimes
  'Steel Plant Township': [
    { street: 'Ukkunagaram Road', coords: { lat: 17.6100, lng: 83.1900 }, crimeTypes: ['assault'] },
    { street: 'Sector 3 Road, Ukkunagaram', coords: { lat: 17.6120, lng: 83.1920 }, crimeTypes: ['robbery'] },
    { street: 'Balacheruvu Road, Sector 8', coords: { lat: 17.6090, lng: 83.1890 }, crimeTypes: ['accident'] },
    { street: 'Sector 2 Road', coords: { lat: 17.6110, lng: 83.1910 }, crimeTypes: ['accident'] },
    { street: 'Lankelapalem Junction', coords: { lat: 17.6080, lng: 83.1880 }, crimeTypes: ['accident'] },
    { street: 'Thatichetlapalem Junction', coords: { lat: 17.6130, lng: 83.1930 }, crimeTypes: ['accident'] },
    { street: 'Quarter 149-D, Sector 1', coords: { lat: 17.6105, lng: 83.1905 }, crimeTypes: ['robbery'] },
    { street: 'Pragati Maidan (RINL)', coords: { lat: 17.6095, lng: 83.1895 }, crimeTypes: ['murder'] },
  ],

  // Tagarapuvalasa - 9 crimes
  'Tagarapuvalasa': [
    { street: 'Tagarapuvalasa Main Road', coords: { lat: 17.9301, lng: 83.4257 }, crimeTypes: ['robbery', 'murder'] },
    { street: 'Sanghivalasa, NH16', coords: { lat: 17.9280, lng: 83.4230 }, crimeTypes: ['accident'] },
    { street: 'Sangivalasa Mulugulla', coords: { lat: 17.9260, lng: 83.4210 }, crimeTypes: ['accident'] },
    { street: 'Gollaveedhi', coords: { lat: 17.9290, lng: 83.4240 }, crimeTypes: ['murder'] },
    { street: 'SBI ATM, Avanti Engineering College', coords: { lat: 17.9310, lng: 83.4260 }, crimeTypes: ['robbery'] },
    { street: 'Gostani Bridge', coords: { lat: 17.9270, lng: 83.4220 }, crimeTypes: ['accident'] },
  ],

  // Venkojipalem - 2 crimes
  'Venkojipalem': [
    { street: 'Venkojipalem Junction', coords: { lat: 17.7456, lng: 83.3289 }, crimeTypes: ['accident'] },
    { street: 'Near Seethammadhara Road', coords: { lat: 17.7445, lng: 83.3275 }, crimeTypes: ['assault'] },
  ],

  // Vishalakshinagar - 1 crime
  'Vishalakshinagar': [
    { street: 'NH16, Near Visakha Valley School', coords: { lat: 17.7350, lng: 83.3200 }, crimeTypes: ['accident'] },
  ],

  // Vizianagaram - 24 crimes
  'Vizianagaram': [
    { street: 'Ravada Village', coords: { lat: 18.1067, lng: 83.3956 }, crimeTypes: ['assault'] },
    { street: 'Pasupatirega', coords: { lat: 18.1100, lng: 83.3920 }, crimeTypes: ['assault'] },
    { street: 'Kothapeta', coords: { lat: 18.1080, lng: 83.3940 }, crimeTypes: ['murder'] },
    { street: 'Gajapathi Nagaram', coords: { lat: 18.1040, lng: 83.3990 }, crimeTypes: ['accident'] },
    { street: 'S Kota Mandal', coords: { lat: 18.1090, lng: 83.3950 }, crimeTypes: ['murder'] },
    { street: 'Sringavarapukota', coords: { lat: 18.1030, lng: 83.3980 }, crimeTypes: ['kidnap'] },
    { street: 'Ettu Bridge', coords: { lat: 18.1060, lng: 83.3960 }, crimeTypes: ['kidnap'] },
    { street: 'NH16, Madhupada', coords: { lat: 18.1050, lng: 83.3970 }, crimeTypes: ['accident'] },
    { street: 'Gajularega', coords: { lat: 18.1070, lng: 83.3945 }, crimeTypes: ['assault'] },
    { street: 'RTC Complex', coords: { lat: 18.1110, lng: 83.3910 }, crimeTypes: ['accident'] },
    { street: 'YSR Nagar', coords: { lat: 18.1045, lng: 83.3975 }, crimeTypes: ['accident'] },
    { street: 'Vizianagaram Town', coords: { lat: 18.1055, lng: 83.3965 }, crimeTypes: ['robbery', 'assault', 'accident'] },
    { street: 'Donkinivalasa Village', coords: { lat: 18.1095, lng: 83.3935 }, crimeTypes: ['kidnap'] },
    { street: 'Gudivada', coords: { lat: 18.1075, lng: 83.3942 }, crimeTypes: ['assault'] },
    { street: 'Dwarapudi', coords: { lat: 18.1085, lng: 83.3948 }, crimeTypes: ['accident'] },
    { street: 'Venkataramanapeta Village', coords: { lat: 18.1065, lng: 83.3958 }, crimeTypes: ['murder'] },
    { street: 'Madhipadu', coords: { lat: 18.1048, lng: 83.3972 }, crimeTypes: ['accident'] },
    { street: 'Bondapalli', coords: { lat: 18.1035, lng: 83.3985 }, crimeTypes: ['accident'] },
    { street: 'Chelluru', coords: { lat: 18.1025, lng: 83.3978 }, crimeTypes: ['accident'] },
  ],

  // Waltair - 3 crimes
  'Waltair': [
    { street: 'Pedda Waltair', coords: { lat: 17.7280, lng: 83.3200 }, crimeTypes: ['murder'] },
    { street: 'AU Out Gate, Chinna Waltair', coords: { lat: 17.7260, lng: 83.3180 }, crimeTypes: ['accident'] },
    { street: 'CBM Compound Road', coords: { lat: 17.7270, lng: 83.3190 }, crimeTypes: ['robbery'] },
  ],

  // Yendada - 9 crimes
  'Yendada': [
    { street: 'Yendada Junction', coords: { lat: 17.7772, lng: 83.3628 }, crimeTypes: ['accident'] },
    { street: 'Vikalangula Colony', coords: { lat: 17.7760, lng: 83.3615 }, crimeTypes: ['kidnap'] },
    { street: 'Near Dairy Farm, Zoo Park', coords: { lat: 17.7780, lng: 83.3640 }, crimeTypes: ['accident'] },
    { street: 'National Highway 16', coords: { lat: 17.7790, lng: 83.3650 }, crimeTypes: ['accident', 'robbery'] },
    { street: 'Yendada Double Road', coords: { lat: 17.7755, lng: 83.3605 }, crimeTypes: ['murder'] },
    { street: 'Zoo Park Road', coords: { lat: 17.7800, lng: 83.3660 }, crimeTypes: ['accident'] },
    { street: 'NH5, Mahila Police Station Road', coords: { lat: 17.7810, lng: 83.3670 }, crimeTypes: ['accident'] },
  ],
};

// Mapping from DB area names (safety_zones/crime_type_counts) to streetCoordinates keys
// This handles naming differences like "Akkayapalem Central" → "Akkayapalem"
const dbToStreetKeyMap: Record<string, string[]> = {
  'akkayapalem central': ['Akkayapalem'],
  'anakapalle central': ['Anakapalli'],
  'anakapalle nh16': ['Anakapalli'],
  'anandapuram bypass': ['Anandapuram'],
  'arilova': ['Arilova'],
  'bheemunipatnam': ['Bheemunipatnam'],
  'dwaraka nagar hub': ['Dwaraka Nagar', 'Dwarakanagar'],
  'gajuwaka industrial': ['Gajuwaka'],
  'jagadamba jct': ['Jagadamba Junction'],
  'kancharapalem core': ['Kancharapalem'],
  'lawsons bay': ['Lawsons Bay Colony'],
  'maddilapalem jct': ['Maddilapalem'],
  'madhurawada hub': ['Madhurawada'],
  'marripalem': ['Marripalem'],
  'mvp colony core': ['MVP Colony'],
  'nad flyover zone': ['NAD Junction'],
  'old gajuwaka': ['Gajuwaka'],
  'one town heritage': ['One Town'],
  'pendurthi vepagunta': ['Pendurthi'],
  'pm palem': ['PM Palem'],
  'rk beach south': ['RK Beach', 'Beach Road'],
  'rushikonda north': ['Rushikonda'],
  'seethammadhara': ['Seethammadhara'],
  'sheelanagar': ['Sheela Nagar'],
  'simhachalam ghat': ['Simhachalam'],
  'steel plant east': ['Steel Plant Township'],
  'steel plant west': ['Steel Plant Township'],
  'tagarapuvalasa': ['Tagarapuvalasa'],
  'vizianagaram rural': ['Vizianagaram'],
  'vizianagaram town': ['Vizianagaram'],
};

// Get streetCoordinates keys that match a DB area name
export const getStreetKeysForDbArea = (dbArea: string): string[] => {
  const normalized = dbArea.toLowerCase().trim();
  const mapped = dbToStreetKeyMap[normalized];
  if (mapped) return mapped;

  // Fallback: try direct match against areaStreetCoordinates keys
  for (const key of Object.keys(areaStreetCoordinates)) {
    if (key.toLowerCase() === normalized ||
        normalized.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalized)) {
      return [key];
    }
  }
  return [];
};

// Get all street locations for a streetCoordinates key (exact or fuzzy)
export const getStreetLocations = (area: string): StreetLocation[] => {
  // Try exact key first
  if (areaStreetCoordinates[area]) return areaStreetCoordinates[area];

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
