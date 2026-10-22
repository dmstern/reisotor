export interface PhotonFeatureProperties {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  locality?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

export interface PhotonFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
  properties: PhotonFeatureProperties;
}

export interface PhotonResponse {
  type: string;
  features?: PhotonFeature[];
}

export interface PlaceSearchResult {
  id?: string;
  name: string;
  formatted_address: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  osmKey?: string;
  osmValue?: string;
  osmType?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

export interface SearchPlacesOptions {
  q: string;
  lat?: number;
  lng?: number;
  limit?: number;
  offset?: number;
  lang?: string;
}

export function mapOsmToCategory(osmKey?: string, osmValue?: string): string {
  if (!osmKey || !osmValue) return '';

  if (osmKey === 'tourism') {
    if (['hotel', 'motel', 'hostel', 'guest_house', 'chalet', 'apartment'].includes(osmValue)) {
      return 'Unterkunft';
    }
    if (['camp_site', 'caravan_site'].includes(osmValue)) {
      return 'Campingplatz';
    }
    if (osmValue === 'museum') return 'Museum';
    if (osmValue === 'viewpoint') return 'Aussichtspunkt';
    if (['zoo', 'theme_park'].includes(osmValue)) return 'Zoo & Tierpark';
    if (osmValue === 'attraction') return 'Sehenswürdigkeit';
    return 'Ausflugsziel';
  }

  if (osmKey === 'office') {
    if (
      ['advertising', 'graphic_design', 'it', 'web_design', 'media', 'marketing'].includes(osmValue)
    ) {
      return 'Agentur';
    }
    return 'Unternehmen';
  }

  if (osmKey === 'healthcare') {
    if (['hospital', 'clinic'].includes(osmValue)) return 'Krankenhaus & Klinik';
    return 'Gesundheit';
  }

  if (osmKey === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court'].includes(osmValue)) return 'Restaurant';
    if (osmValue === 'cafe') return 'Café';
    if (osmValue === 'ice_cream') return 'Eiscafé';
    if (osmValue === 'nightclub') return 'Club';
    if (osmValue === 'bar') return 'Bar';
    if (['pub', 'biergarten'].includes(osmValue)) return 'Kneipe';
    if (osmValue === 'cinema') return 'Kino';
    if (osmValue === 'library') return 'Bibliothek & Buchhandlung';
    if (osmValue === 'hospital') return 'Krankenhaus & Klinik';
    if (osmValue === 'pharmacy') return 'Apotheke';
    if (['dentist', 'doctors', 'clinic'].includes(osmValue)) return 'Gesundheit';
    if (['fuel', 'charging_station'].includes(osmValue)) return 'Tankstelle';
    if (['bank', 'atm'].includes(osmValue)) return 'Geldautomat & Bank';
    if (osmValue === 'place_of_worship') return 'Kirche & Tempel';
    if (['theatre', 'arts_centre'].includes(osmValue)) return 'Theater & Bühne';
    if (['parking', 'parking_space', 'parking_entrance'].includes(osmValue)) return 'Parkplatz';
    if (osmValue === 'bus_station') return 'Busbahnhof';
  }

  if (osmKey === 'craft' && ['brewery'].includes(osmValue)) {
    return 'Kneipe';
  }

  if (osmKey === 'historic') {
    if (
      ['castle', 'monument', 'memorial', 'ruins', 'archaeological_site', 'city_gate'].includes(
        osmValue
      )
    ) {
      return 'Sehenswürdigkeit';
    }
    if (osmValue === 'church') return 'Kirche & Tempel';
    return 'Sehenswürdigkeit';
  }

  if (osmKey === 'leisure') {
    if (['park', 'garden'].includes(osmValue)) return 'Park & Garten';
    if (osmValue === 'playground') return 'Spielplatz';
    if (['sports_centre', 'pitch', 'fitness_centre', 'stadium'].includes(osmValue)) {
      return 'Sport & Fitness';
    }
    if (osmValue === 'nature_reserve') return 'Natur';
    if (osmValue === 'beach_resort') return 'Strand';
    if (['water_park', 'miniature_golf'].includes(osmValue)) return 'Aktivität';
    if (['spa', 'sauna'].includes(osmValue)) return 'Wellness & Therme';
  }

  if (osmKey === 'shop') {
    if (['supermarket', 'convenience', 'grocery'].includes(osmValue)) return 'Supermarkt';
    if (['bakery', 'pastry'].includes(osmValue)) return 'Bäckerei';
    if (['books', 'bookstore'].includes(osmValue)) return 'Bibliothek & Buchhandlung';
    return 'Shop';
  }

  if (osmKey === 'natural') {
    if (osmValue === 'beach') return 'Strand';
    if (['peak', 'volcano', 'cliff'].includes(osmValue)) return 'Aussichtspunkt';
    if (['wood', 'tree', 'scrub', 'water'].includes(osmValue)) return 'Natur';
  }

  if (osmKey === 'aeroway' && ['aerodrome', 'terminal', 'gate'].includes(osmValue)) {
    return 'Flughafen';
  }
  if (osmKey === 'railway' && ['station', 'halt', 'subway_entrance'].includes(osmValue)) {
    return 'Bahnhof';
  }
  if (osmKey === 'highway' && ['bus_stop'].includes(osmValue)) {
    return 'Busbahnhof';
  }

  if (osmKey === 'place') {
    if (['city', 'town', 'village', 'hamlet', 'island'].includes(osmValue)) {
      return 'Ausflugsziel';
    }
  }

  return '';
}

export function formatAddress(props: PhotonFeatureProperties): string {
  const streetLine = [props.street, props.housenumber].filter(Boolean).join(' ');
  const cityLine = [props.postcode, props.city || props.district || props.locality]
    .filter(Boolean)
    .join(' ');
  const parts: string[] = [];
  if (streetLine) parts.push(streetLine);
  if (cityLine) parts.push(cityLine);
  if (props.country && !cityLine.includes(props.country)) {
    parts.push(props.country);
  }
  return parts.join(', ');
}

export function derivePlaceName(props: PhotonFeatureProperties): string {
  if (props.name?.trim()) {
    return props.name.trim();
  }
  const streetLine = [props.street, props.housenumber].filter(Boolean).join(' ');
  if (streetLine) {
    return streetLine;
  }
  return (
    props.city ||
    props.district ||
    props.locality ||
    props.state ||
    props.country ||
    'Unbekannter Ort'
  );
}

interface CacheEntry {
  expiresAt: number;
  data: PlaceSearchResult[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Stunde
const MAX_CACHE_ENTRIES = 500;
const placesCache = new Map<string, CacheEntry>();

export function buildCacheKey(
  q: string,
  lat?: number,
  lng?: number,
  limit = 5,
  lang = 'de'
): string {
  const latStr = lat != null && Number.isFinite(lat) ? lat.toFixed(3) : '';
  const lngStr = lng != null && Number.isFinite(lng) ? lng.toFixed(3) : '';
  return `${q.trim().toLowerCase()}|${latStr}|${lngStr}|${limit}|${lang}`;
}

export function getCachedPlaces(key: string): PlaceSearchResult[] | null {
  const entry = placesCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    placesCache.delete(key);
    return null;
  }
  // LRU Refresh: Löschen und wieder ans Ende einfügen
  placesCache.delete(key);
  placesCache.set(key, entry);
  return entry.data;
}

export function setCachedPlaces(key: string, data: PlaceSearchResult[]): void {
  if (placesCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = placesCache.keys().next().value;
    if (oldestKey !== undefined) {
      placesCache.delete(oldestKey);
    }
  }
  placesCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
}

export function clearPlacesCache(): void {
  placesCache.clear();
}

export const _clearPlacesCache = clearPlacesCache;

export function getPlacesCacheSize(): number {
  return placesCache.size;
}

export interface ParsedCategory {
  keyword: string;
  label: string;
  tags: Array<{ key: string; value?: string }>;
}

export interface ParsedLocationQuery {
  raw: string;
  cleaned: string;
  category?: ParsedCategory;
  strippedQuery: string;
  cleanedTerms: string[];
  wantsStreet: boolean;
}

const CATEGORY_KEYWORDS: Record<
  string,
  { label: string; tags: Array<{ key: string; value?: string }> }
> = {
  // Clubs
  club: {
    tags: [
      { key: 'amenity', value: 'nightclub' },
      { key: 'amenity', value: 'bar' },
    ],
    label: 'Club',
  },
  clubs: {
    tags: [
      { key: 'amenity', value: 'nightclub' },
      { key: 'amenity', value: 'bar' },
    ],
    label: 'Club',
  },
  nachtclub: { tags: [{ key: 'amenity', value: 'nightclub' }], label: 'Club' },
  nightclub: { tags: [{ key: 'amenity', value: 'nightclub' }], label: 'Club' },
  disco: { tags: [{ key: 'amenity', value: 'nightclub' }], label: 'Club' },
  diskothek: { tags: [{ key: 'amenity', value: 'nightclub' }], label: 'Club' },
  discotheque: { tags: [{ key: 'amenity', value: 'nightclub' }], label: 'Club' },
  nachtleben: {
    tags: [
      { key: 'amenity', value: 'nightclub' },
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'pub' },
    ],
    label: 'Nachtleben',
  },
  nightlife: {
    tags: [
      { key: 'amenity', value: 'nightclub' },
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'pub' },
    ],
    label: 'Nachtleben',
  },

  // Bars
  bar: {
    tags: [
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'pub' },
    ],
    label: 'Bar',
  },
  bars: {
    tags: [
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'pub' },
    ],
    label: 'Bar',
  },
  cocktailbar: { tags: [{ key: 'amenity', value: 'bar' }], label: 'Bar' },
  lounge: { tags: [{ key: 'amenity', value: 'bar' }], label: 'Bar' },

  // Kneipen & Pubs
  kneipe: {
    tags: [
      { key: 'amenity', value: 'pub' },
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'biergarten' },
    ],
    label: 'Kneipe',
  },
  kneipen: {
    tags: [
      { key: 'amenity', value: 'pub' },
      { key: 'amenity', value: 'bar' },
      { key: 'amenity', value: 'biergarten' },
    ],
    label: 'Kneipe',
  },
  pub: {
    tags: [
      { key: 'amenity', value: 'pub' },
      { key: 'amenity', value: 'bar' },
    ],
    label: 'Kneipe',
  },
  pubs: {
    tags: [
      { key: 'amenity', value: 'pub' },
      { key: 'amenity', value: 'bar' },
    ],
    label: 'Kneipe',
  },
  biergarten: {
    tags: [
      { key: 'amenity', value: 'biergarten' },
      { key: 'amenity', value: 'pub' },
    ],
    label: 'Kneipe',
  },
  brauhaus: {
    tags: [
      { key: 'amenity', value: 'pub' },
      { key: 'craft', value: 'brewery' },
    ],
    label: 'Kneipe',
  },

  // Agencies
  agentur: {
    tags: [{ key: 'office', value: 'company' }, { key: 'office', value: 'it' }, { key: 'office' }],
    label: 'Agentur',
  },
  agency: { tags: [{ key: 'office', value: 'company' }, { key: 'office' }], label: 'Agentur' },
  digitalagentur: {
    tags: [
      { key: 'office', value: 'company' },
      { key: 'office', value: 'it' },
    ],
    label: 'Agentur',
  },
  werbeagentur: {
    tags: [{ key: 'office', value: 'advertising' }, { key: 'office' }],
    label: 'Agentur',
  },

  // Companies / Offices
  firma: { tags: [{ key: 'office', value: 'company' }, { key: 'office' }], label: 'Unternehmen' },
  unternehmen: {
    tags: [{ key: 'office', value: 'company' }, { key: 'office' }],
    label: 'Unternehmen',
  },
  company: { tags: [{ key: 'office', value: 'company' }, { key: 'office' }], label: 'Unternehmen' },
  büro: { tags: [{ key: 'office' }], label: 'Unternehmen' },
  office: { tags: [{ key: 'office' }], label: 'Unternehmen' },

  // Cafés
  café: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  cafe: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  cafes: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  cafés: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  kaffee: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  coffee: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },
  coffeeshop: { tags: [{ key: 'amenity', value: 'cafe' }], label: 'Café' },

  // Restaurants & Food
  restaurant: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  restaurants: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  gaststätte: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  gasthaus: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  gasthof: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  lokal: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  bistro: {
    tags: [
      { key: 'amenity', value: 'restaurant' },
      { key: 'amenity', value: 'cafe' },
    ],
    label: 'Restaurant',
  },
  pizzeria: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },
  imbiss: { tags: [{ key: 'amenity', value: 'fast_food' }], label: 'Restaurant' },
  döner: { tags: [{ key: 'amenity', value: 'fast_food' }], label: 'Restaurant' },
  burger: {
    tags: [
      { key: 'amenity', value: 'fast_food' },
      { key: 'amenity', value: 'restaurant' },
    ],
    label: 'Restaurant',
  },
  sushi: { tags: [{ key: 'amenity', value: 'restaurant' }], label: 'Restaurant' },

  // Bakeries
  bäcker: { tags: [{ key: 'shop', value: 'bakery' }], label: 'Bäckerei' },
  bäckerei: { tags: [{ key: 'shop', value: 'bakery' }], label: 'Bäckerei' },
  bäckereien: { tags: [{ key: 'shop', value: 'bakery' }], label: 'Bäckerei' },
  bakery: { tags: [{ key: 'shop', value: 'bakery' }], label: 'Bäckerei' },
  konditorei: {
    tags: [
      { key: 'shop', value: 'bakery' },
      { key: 'shop', value: 'pastry' },
    ],
    label: 'Bäckerei',
  },

  // Pharmacy
  apotheke: { tags: [{ key: 'amenity', value: 'pharmacy' }], label: 'Apotheke' },
  apotheken: { tags: [{ key: 'amenity', value: 'pharmacy' }], label: 'Apotheke' },
  pharmacy: { tags: [{ key: 'amenity', value: 'pharmacy' }], label: 'Apotheke' },

  // Supermarket & Groceries
  supermarkt: {
    tags: [
      { key: 'shop', value: 'supermarket' },
      { key: 'shop', value: 'convenience' },
    ],
    label: 'Supermarkt',
  },
  supermärkte: { tags: [{ key: 'shop', value: 'supermarket' }], label: 'Supermarkt' },
  supermarket: { tags: [{ key: 'shop', value: 'supermarket' }], label: 'Supermarkt' },
  lebensmittel: {
    tags: [
      { key: 'shop', value: 'supermarket' },
      { key: 'shop', value: 'convenience' },
    ],
    label: 'Supermarkt',
  },

  // Medical / Health
  zahnarzt: { tags: [{ key: 'amenity', value: 'dentist' }], label: 'Gesundheit' },
  dentist: { tags: [{ key: 'amenity', value: 'dentist' }], label: 'Gesundheit' },
  arzt: {
    tags: [
      { key: 'amenity', value: 'doctors' },
      { key: 'amenity', value: 'clinic' },
    ],
    label: 'Gesundheit',
  },
  ärzte: { tags: [{ key: 'amenity', value: 'doctors' }], label: 'Gesundheit' },
  doctor: { tags: [{ key: 'amenity', value: 'doctors' }], label: 'Gesundheit' },
  praxis: {
    tags: [
      { key: 'amenity', value: 'doctors' },
      { key: 'amenity', value: 'dentist' },
    ],
    label: 'Gesundheit',
  },
  klinik: {
    tags: [
      { key: 'amenity', value: 'clinic' },
      { key: 'amenity', value: 'hospital' },
    ],
    label: 'Krankenhaus & Klinik',
  },
  krankenhaus: { tags: [{ key: 'amenity', value: 'hospital' }], label: 'Krankenhaus & Klinik' },
  hospital: { tags: [{ key: 'amenity', value: 'hospital' }], label: 'Krankenhaus & Klinik' },
  spital: { tags: [{ key: 'amenity', value: 'hospital' }], label: 'Krankenhaus & Klinik' },

  // Accommodations
  hotel: {
    tags: [
      { key: 'tourism', value: 'hotel' },
      { key: 'tourism', value: 'guest_house' },
    ],
    label: 'Unterkunft',
  },
  hotels: { tags: [{ key: 'tourism', value: 'hotel' }], label: 'Unterkunft' },
  hostel: { tags: [{ key: 'tourism', value: 'hostel' }], label: 'Unterkunft' },
  hostels: { tags: [{ key: 'tourism', value: 'hostel' }], label: 'Unterkunft' },
  motel: { tags: [{ key: 'tourism', value: 'motel' }], label: 'Unterkunft' },
  unterkunft: {
    tags: [
      { key: 'tourism', value: 'hotel' },
      { key: 'tourism', value: 'hostel' },
      { key: 'tourism', value: 'guest_house' },
    ],
    label: 'Unterkunft',
  },
  pension: { tags: [{ key: 'tourism', value: 'guest_house' }], label: 'Unterkunft' },
  ferienwohnung: { tags: [{ key: 'tourism', value: 'apartment' }], label: 'Unterkunft' },
  camping: {
    tags: [
      { key: 'tourism', value: 'camp_site' },
      { key: 'tourism', value: 'caravan_site' },
    ],
    label: 'Campingplatz',
  },
  campingplatz: { tags: [{ key: 'tourism', value: 'camp_site' }], label: 'Campingplatz' },
  zeltplatz: { tags: [{ key: 'tourism', value: 'camp_site' }], label: 'Campingplatz' },

  // Sights & Culture
  museum: { tags: [{ key: 'tourism', value: 'museum' }], label: 'Museum' },
  museen: { tags: [{ key: 'tourism', value: 'museum' }], label: 'Museum' },
  sehenswürdigkeit: {
    tags: [{ key: 'tourism', value: 'attraction' }, { key: 'historic' }],
    label: 'Sehenswürdigkeit',
  },
  sehenswürdigkeiten: {
    tags: [{ key: 'tourism', value: 'attraction' }, { key: 'historic' }],
    label: 'Sehenswürdigkeit',
  },
  attraktion: { tags: [{ key: 'tourism', value: 'attraction' }], label: 'Sehenswürdigkeit' },
  schloss: { tags: [{ key: 'historic', value: 'castle' }], label: 'Sehenswürdigkeit' },
  burg: { tags: [{ key: 'historic', value: 'castle' }], label: 'Sehenswürdigkeit' },
  aussichtspunkt: { tags: [{ key: 'tourism', value: 'viewpoint' }], label: 'Aussichtspunkt' },
  viewpoint: { tags: [{ key: 'tourism', value: 'viewpoint' }], label: 'Aussichtspunkt' },

  // Parks & Nature
  park: { tags: [{ key: 'leisure', value: 'park' }], label: 'Park & Garten' },
  parks: { tags: [{ key: 'leisure', value: 'park' }], label: 'Park & Garten' },
  garten: { tags: [{ key: 'leisure', value: 'garden' }], label: 'Park & Garten' },
  strand: {
    tags: [
      { key: 'natural', value: 'beach' },
      { key: 'leisure', value: 'beach_resort' },
    ],
    label: 'Strand',
  },
  beach: { tags: [{ key: 'natural', value: 'beach' }], label: 'Strand' },

  // Entertainment & Cinema
  kino: { tags: [{ key: 'amenity', value: 'cinema' }], label: 'Kino' },
  cinema: { tags: [{ key: 'amenity', value: 'cinema' }], label: 'Kino' },
  filmpalast: { tags: [{ key: 'amenity', value: 'cinema' }], label: 'Kino' },
  theater: {
    tags: [
      { key: 'amenity', value: 'theatre' },
      { key: 'amenity', value: 'arts_centre' },
    ],
    label: 'Theater & Bühne',
  },
  theatre: { tags: [{ key: 'amenity', value: 'theatre' }], label: 'Theater & Bühne' },

  // Ice Cream / Eiscafé
  eiscafé: { tags: [{ key: 'amenity', value: 'ice_cream' }], label: 'Eiscafé' },
  eiscafe: { tags: [{ key: 'amenity', value: 'ice_cream' }], label: 'Eiscafé' },
  eisdiele: { tags: [{ key: 'amenity', value: 'ice_cream' }], label: 'Eiscafé' },
  gelateria: { tags: [{ key: 'amenity', value: 'ice_cream' }], label: 'Eiscafé' },

  // Books & Library
  bibliothek: { tags: [{ key: 'amenity', value: 'library' }], label: 'Bibliothek & Buchhandlung' },
  bücherei: { tags: [{ key: 'amenity', value: 'library' }], label: 'Bibliothek & Buchhandlung' },
  buchhandlung: { tags: [{ key: 'shop', value: 'books' }], label: 'Bibliothek & Buchhandlung' },
  buchladen: { tags: [{ key: 'shop', value: 'books' }], label: 'Bibliothek & Buchhandlung' },

  // Transport & Mobility
  tankstelle: {
    tags: [
      { key: 'amenity', value: 'fuel' },
      { key: 'amenity', value: 'charging_station' },
    ],
    label: 'Tankstelle',
  },
  ladestation: { tags: [{ key: 'amenity', value: 'charging_station' }], label: 'Tankstelle' },
  parkplatz: { tags: [{ key: 'amenity', value: 'parking' }], label: 'Parkplatz' },
  parkhaus: { tags: [{ key: 'amenity', value: 'parking' }], label: 'Parkplatz' },
  parking: { tags: [{ key: 'amenity', value: 'parking' }], label: 'Parkplatz' },
  bahnhof: { tags: [{ key: 'railway', value: 'station' }], label: 'Bahnhof' },
  station: { tags: [{ key: 'railway', value: 'station' }], label: 'Bahnhof' },
  hbf: { tags: [{ key: 'railway', value: 'station' }], label: 'Bahnhof' },
  hauptbahnhof: { tags: [{ key: 'railway', value: 'station' }], label: 'Bahnhof' },
  flughafen: { tags: [{ key: 'aeroway', value: 'aerodrome' }], label: 'Flughafen' },
  airport: { tags: [{ key: 'aeroway', value: 'aerodrome' }], label: 'Flughafen' },
};

const STOP_WORDS = new Set([
  'in',
  'im',
  'am',
  'an',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'bei',
  'beim',
  'von',
  'vom',
  'near',
  'at',
  'of',
  'and',
  'und',
  '&',
]);

const STREET_TERMS = [
  'straße',
  'strasse',
  'str.',
  'str',
  'street',
  'road',
  'gasse',
  'weg',
  'allee',
  'boulevard',
  'avenue',
  'platz',
];

export function parseLocationQuery(rawQ: string): ParsedLocationQuery {
  // Klammern (z. B. ]init[ AG) und redundante Zeichen entfernen
  const cleaned = rawQ
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  let detectedCategory: ParsedCategory | undefined;

  for (const word of words) {
    const entry = CATEGORY_KEYWORDS[word];
    if (entry) {
      detectedCategory = {
        keyword: word,
        label: entry.label,
        tags: entry.tags,
      };
      break;
    }
  }

  const cleanedTerms: string[] = [];
  for (const word of words) {
    if (detectedCategory && word === detectedCategory.keyword) {
      continue;
    }
    if (STOP_WORDS.has(word)) {
      continue;
    }
    cleanedTerms.push(word);
  }

  const strippedQuery = cleanedTerms.join(' ');
  const rawLower = cleaned.toLowerCase();
  const wantsStreet = STREET_TERMS.some((term) => rawLower.includes(term));

  return {
    raw: rawQ,
    cleaned,
    category: detectedCategory,
    strippedQuery,
    cleanedTerms,
    wantsStreet,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function scorePlace(
  place: PlaceSearchResult,
  parsed: ParsedLocationQuery,
  targetLat?: number,
  targetLng?: number
): number {
  let score = 0;
  const nameLower = place.name.toLowerCase();
  const addressLower = (place.formatted_address || place.address || '').toLowerCase();

  // 1. Kategorie-Übereinstimmung
  if (parsed.category) {
    const hasTagMatch = parsed.category.tags.some(
      (t) => t.key === place.osmKey && (!t.value || t.value === place.osmValue)
    );
    if (hasTagMatch) {
      score += 60;
    } else if (
      place.category &&
      place.category.toLowerCase() === parsed.category.label.toLowerCase()
    ) {
      score += 40;
    }
  }

  // 2. Namens- & Adressübereinstimmung für die Kernbegriffe
  const terms = parsed.cleanedTerms;
  let matchedTermsCount = 0;
  for (const term of terms) {
    if (nameLower.includes(term)) {
      matchedTermsCount++;
      score += 25;
    } else if (addressLower.includes(term)) {
      matchedTermsCount++;
      score += 10;
    }
  }
  if (terms.length > 0 && matchedTermsCount === terms.length) {
    score += 30; // Volltreffer: alle Kernsuchbegriffe gefunden
  }

  // 3. POI vs. Straße: POIs (Kneipen, Clubs, Agenturen, Cafés) vor reinen Wohnstraßen bevorzugen
  const isStreetOrHighway =
    place.osmKey === 'highway' ||
    place.osmValue === 'residential' ||
    place.osmValue === 'living_street' ||
    place.osmValue === 'service';

  if (isStreetOrHighway) {
    if (parsed.wantsStreet) {
      score += 30;
    } else {
      score -= 20; // Straßen abwerten, wenn nicht explizit nach Straße gesucht wurde
    }
  } else {
    score += 15; // POI-Grundbonus
  }

  // 4. Näherungsbonus (falls Koordinaten übergeben)
  if (
    targetLat != null &&
    targetLng != null &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  ) {
    const distKm = haversineDistance(targetLat, targetLng, place.lat, place.lng);
    if (distKm < 5) score += 30;
    else if (distKm < 20) score += 20;
    else if (distKm < 50) score += 10;
    else if (distKm < 100) score += 5;
  }

  return score;
}

function parsePhotonFeatures(data: PhotonResponse): PlaceSearchResult[] {
  if (!data || !Array.isArray(data.features)) {
    return [];
  }

  const results: PlaceSearchResult[] = [];
  for (const feature of data.features) {
    if (
      !feature.geometry ||
      feature.geometry.type !== 'Point' ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length < 2
    ) {
      continue;
    }

    const [lon, featLat] = feature.geometry.coordinates;
    if (
      typeof lon !== 'number' ||
      typeof featLat !== 'number' ||
      !Number.isFinite(lon) ||
      !Number.isFinite(featLat)
    ) {
      continue;
    }

    const props = feature.properties || {};
    const name = derivePlaceName(props);
    const formattedAddress = formatAddress(props) || name;
    const category = mapOsmToCategory(props.osm_key, props.osm_value);
    const id =
      props.osm_type && props.osm_id != null ? `${props.osm_type}${props.osm_id}` : undefined;

    results.push({
      id,
      name,
      formatted_address: formattedAddress,
      address: formattedAddress,
      lat: featLat,
      lng: lon,
      category: category || undefined,
      osmKey: props.osm_key,
      osmValue: props.osm_value,
      osmType: props.osm_type,
      city: props.city || props.district || props.locality,
      country: props.country,
      countryCode: props.countrycode,
      postcode: props.postcode,
    });
  }

  return results;
}

interface FetchPhotonOptions {
  lat?: number;
  lng?: number;
  limit?: number;
  lang?: string;
  tags?: Array<{ key: string; value?: string }>;
  signal?: AbortSignal;
}

async function fetchPhotonPlaces(
  baseUrl: string,
  query: string,
  options: FetchPhotonOptions = {}
): Promise<PlaceSearchResult[]> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return [];
  }

  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(options.limit ?? 10));
  url.searchParams.set('lang', options.lang || 'de');

  if (options.lat != null && Number.isFinite(options.lat)) {
    url.searchParams.set('lat', String(options.lat));
  }
  if (options.lng != null && Number.isFinite(options.lng)) {
    // CRITICAL: Photon requires 'lon', NOT 'lng'. Photon returns 400 if 'lng' is sent.
    url.searchParams.set('lon', String(options.lng));
  }

  if (options.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      url.searchParams.append('osm_tag', tag.value ? `${tag.key}:${tag.value}` : tag.key);
    }
  }

  try {
    const res = await fetch(url.toString(), {
      signal: options.signal || AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Reisotor/1.0',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as PhotonResponse;
    return parsePhotonFeatures(data);
  } catch {
    return [];
  }
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimPlace {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  name?: string;
  display_name: string;
  address?: NominatimAddress;
}

function formatNominatimAddress(item: NominatimPlace): string {
  const addr = item.address;
  if (!addr) return item.display_name || '';
  const streetLine = [addr.road, addr.house_number].filter(Boolean).join(' ');
  const cityPart = addr.city || addr.town || addr.village || addr.suburb || addr.municipality;
  const cityLine = [addr.postcode, cityPart].filter(Boolean).join(' ');
  const parts: string[] = [];
  if (streetLine) parts.push(streetLine);
  if (cityLine) parts.push(cityLine);
  if (addr.country && !cityLine.includes(addr.country)) {
    parts.push(addr.country);
  }
  return parts.length > 0 ? parts.join(', ') : item.display_name;
}

async function fetchNominatimPlaces(
  query: string,
  options: {
    lat?: number;
    lng?: number;
    limit?: number;
    lang?: string;
    signal?: AbortSignal;
  } = {}
): Promise<PlaceSearchResult[]> {
  if (process.env.NOMINATIM_ENABLED === 'false') {
    return [];
  }

  const baseUrl = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org/search';
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return [];
  }

  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(options.limit ?? 10));
  if (options.lang) {
    url.searchParams.set('accept-language', options.lang);
  }

  try {
    const res = await fetch(url.toString(), {
      signal: options.signal || AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'Reisotor/1.3 (https://github.com/dmstern/reisotor)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as NominatimPlace[];
    if (!Array.isArray(data)) {
      return [];
    }

    const results: PlaceSearchResult[] = [];
    for (const item of data) {
      const latNum = Number(item.lat);
      const lngNum = Number(item.lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        continue;
      }

      const name = item.name?.trim() || item.display_name.split(',')[0].trim() || 'Unbekannter Ort';
      const formattedAddress = formatNominatimAddress(item) || name;
      const category = mapOsmToCategory(item.category, item.type);
      const osmTypePrefix = item.osm_type ? item.osm_type.charAt(0).toUpperCase() : undefined;
      const id =
        osmTypePrefix && item.osm_id != null ? `${osmTypePrefix}${item.osm_id}` : undefined;

      results.push({
        id,
        name,
        formatted_address: formattedAddress,
        address: formattedAddress,
        lat: latNum,
        lng: lngNum,
        category: category || undefined,
        osmKey: item.category,
        osmValue: item.type,
        osmType: osmTypePrefix,
        city:
          item.address?.city || item.address?.town || item.address?.village || item.address?.suburb,
        country: item.address?.country,
        countryCode: item.address?.country_code
          ? item.address.country_code.toUpperCase()
          : undefined,
        postcode: item.address?.postcode,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function searchPlaces(options: SearchPlacesOptions): Promise<PlaceSearchResult[]> {
  const rawQ = options.q?.trim();
  if (!rawQ) {
    return [];
  }

  const limit =
    options.limit != null && Number.isFinite(options.limit)
      ? Math.min(Math.max(Math.floor(options.limit), 1), 10)
      : 5;
  const lang = options.lang?.trim() || 'de';
  const lat = options.lat != null && Number.isFinite(options.lat) ? options.lat : undefined;
  const lng = options.lng != null && Number.isFinite(options.lng) ? options.lng : undefined;

  const offset =
    options.offset != null && Number.isFinite(options.offset)
      ? Math.max(Math.floor(options.offset), 0)
      : 0;

  const cacheKey = buildCacheKey(`${rawQ}|off:${offset}`, lat, lng, limit, lang);
  const cached = getCachedPlaces(cacheKey);
  if (cached) {
    return cached;
  }

  const parsed = parseLocationQuery(rawQ);
  const baseUrl = process.env.PHOTON_API_URL || 'https://photon.komoot.io/api/';
  const fetchLimit = Math.min(Math.max(limit + offset, 10), 30);

  // 1. Primäre Photon-Abfrage (mit bereinigter Suchanfrage)
  let primaryUrl: URL;
  try {
    primaryUrl = new URL(baseUrl);
  } catch {
    return [];
  }

  primaryUrl.searchParams.set('q', parsed.cleaned);
  primaryUrl.searchParams.set('limit', String(offset === 0 ? limit : fetchLimit));
  primaryUrl.searchParams.set('lang', lang);

  if (lat != null) {
    primaryUrl.searchParams.set('lat', String(lat));
  }
  if (lng != null) {
    // CRITICAL: Photon requires 'lon', NOT 'lng'. Photon returns 400 if 'lng' is sent.
    primaryUrl.searchParams.set('lon', String(lng));
  }

  let primaryResponse: Response;
  try {
    primaryResponse = await fetch(primaryUrl.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Reisotor/1.0',
        Accept: 'application/json',
      },
    });
  } catch {
    return [];
  }

  if (!primaryResponse.ok) {
    return [];
  }

  let primaryData: PhotonResponse;
  try {
    primaryData = (await primaryResponse.json()) as PhotonResponse;
  } catch {
    return [];
  }

  const primaryResults = parsePhotonFeatures(primaryData);
  const allCandidates: PlaceSearchResult[] = [...primaryResults];

  // Prüfen, ob Primärabfrage bereits die gesuchte Kategorie + Name gefunden hat (z. B. "Hotel Sacher", "Café Central")
  const hasExactCategoryInPrimary =
    parsed.category &&
    primaryResults.some((p) => {
      if (!parsed.category) return false;
      const tagMatch = parsed.category.tags.some(
        (t) => t.key === p.osmKey && (!t.value || t.value === p.osmValue)
      );
      const nameMatch =
        parsed.cleanedTerms.length === 0 ||
        parsed.cleanedTerms.some((term) => p.name.toLowerCase().includes(term));
      return tagMatch && nameMatch;
    });

  // 2. Sekundäre Strategien: Tag-Filterung & Nominatim-Bereicherung
  // Nur nötig, wenn ein Orts-/Namensbegriff neben der Kategorie existiert und noch kein passender Ort gefunden wurde (oder offset > 0)
  if (parsed.category && parsed.strippedQuery && (!hasExactCategoryInPrimary || offset > 0)) {
    const secondaryTasks: Promise<PlaceSearchResult[]>[] = [];

    // Tag-gefilterte Photon-Abfrage mit bereinigtem Suchbegriff (z. B. "else berlin" mit Tags für Club/Bar)
    if (parsed.category.tags.length > 0) {
      secondaryTasks.push(
        fetchPhotonPlaces(baseUrl, parsed.strippedQuery, {
          lat,
          lng,
          limit: fetchLimit,
          lang,
          tags: parsed.category.tags,
        })
      );
    }

    // Nominatim-Abfrage für Phrasen & Kategorien (z. B. "cafes in ystad", "zahnarzt treptow", "else bar berlin")
    secondaryTasks.push(
      fetchNominatimPlaces(rawQ, {
        lat,
        lng,
        limit: fetchLimit,
        lang,
      })
    );

    if (parsed.strippedQuery !== rawQ) {
      secondaryTasks.push(
        fetchNominatimPlaces(parsed.strippedQuery, {
          lat,
          lng,
          limit: fetchLimit,
          lang,
        })
      );
    }

    const settled = await Promise.allSettled(secondaryTasks);
    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allCandidates.push(...res.value);
      }
    }
  } else if (
    !parsed.category &&
    primaryResults.length === 0 &&
    !parsed.wantsStreet &&
    parsed.cleaned.length > 2 &&
    (parsed.cleaned.includes(' ') || parsed.cleanedTerms.length > 1)
  ) {
    // Falls keine Kategorie erkannt wurde, Photon aber 0 Treffer lieferte: Nominatim als Fallback versuchen
    const nomFallback = await fetchNominatimPlaces(parsed.cleaned, {
      lat,
      lng,
      limit: fetchLimit,
      lang,
    });
    allCandidates.push(...nomFallback);
  }

  // 3. Deduplizierung (nach OSM-ID oder geographischer Nähe + Namen)
  const seenIds = new Set<string>();
  const deduplicated: PlaceSearchResult[] = [];

  for (const place of allCandidates) {
    if (place.id && seenIds.has(place.id)) {
      continue;
    }

    const isDuplicate = deduplicated.some((existing) => {
      if (
        Math.abs(existing.lat - place.lat) < 0.0005 &&
        Math.abs(existing.lng - place.lng) < 0.0005
      ) {
        const n1 = existing.name.toLowerCase().trim();
        const n2 = place.name.toLowerCase().trim();
        return n1 === n2 || n1.includes(n2) || n2.includes(n1);
      }
      return false;
    });

    if (isDuplicate) {
      continue;
    }

    if (place.id) {
      seenIds.add(place.id);
    }
    deduplicated.push(place);
  }

  // 4. Scoring & Priorisierung
  const scored = deduplicated.map((place) => ({
    place,
    score: scorePlace(place, parsed, lat, lng),
  }));

  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(offset, offset + limit).map((s) => s.place);
  setCachedPlaces(cacheKey, results);
  return results;
}

export interface ReverseGeocodeOptions {
  lat: number;
  lng: number;
  lang?: string;
}

export interface ReverseGeocodeResult {
  name: string;
  formatted_address: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  osmKey?: string;
  osmValue?: string;
  city?: string;
  district?: string;
  locality?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface ReverseCacheEntry {
  expiresAt: number;
  data: ReverseGeocodeResult | null;
}

const reverseCache = new Map<string, ReverseCacheEntry>();

export function clearReverseCache(): void {
  reverseCache.clear();
}

export function setCachedReverse(key: string, data: ReverseGeocodeResult | null): void {
  if (reverseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = reverseCache.keys().next().value;
    if (oldestKey !== undefined) reverseCache.delete(oldestKey);
  }
  reverseCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
}

export async function reverseGeocode(
  options: ReverseGeocodeOptions
): Promise<ReverseGeocodeResult | null> {
  const { lat, lng } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const lang = options.lang?.trim() || 'de';
  const cacheKey = `rev|${lat.toFixed(4)}|${lng.toFixed(4)}|${lang}`;
  const cached = reverseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  let urlStr = 'https://photon.komoot.io/reverse';
  if (process.env.PHOTON_API_URL) {
    try {
      const u = new URL(process.env.PHOTON_API_URL);
      u.pathname = u.pathname.replace(/\/api\/?$/, '/reverse');
      urlStr = u.toString();
    } catch {
      // fallback
    }
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  if (lang) {
    url.searchParams.set('lang', lang);
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Reisotor/1.0',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as PhotonResponse;
    if (!data?.features || !Array.isArray(data.features) || data.features.length === 0) {
      setCachedReverse(cacheKey, null);
      return null;
    }

    const feature = data.features[0];
    const props = feature.properties || {};
    const name = derivePlaceName(props);
    const formattedAddress = formatAddress(props);

    if (!formattedAddress && (!name || name === 'Unbekannter Ort')) {
      setCachedReverse(cacheKey, null);
      return null;
    }

    const [lon, featLat] = feature.geometry?.coordinates ?? [lng, lat];
    const result: ReverseGeocodeResult = {
      name,
      formatted_address: formattedAddress || name,
      address: formattedAddress || name,
      lat: typeof featLat === 'number' && Number.isFinite(featLat) ? featLat : lat,
      lng: typeof lon === 'number' && Number.isFinite(lon) ? lon : lng,
      category: mapOsmToCategory(props.osm_key, props.osm_value) || undefined,
      osmKey: props.osm_key,
      osmValue: props.osm_value,
      city: props.city || props.district || props.locality,
      district: props.district,
      locality: props.locality,
      state: props.state,
      country: props.country,
      postcode: props.postcode,
    };

    setCachedReverse(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
