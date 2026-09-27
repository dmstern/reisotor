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

  if (osmKey === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court'].includes(osmValue)) return 'Restaurant';
    if (osmValue === 'cafe') return 'Café';
    if (['bar', 'pub', 'nightclub', 'biergarten'].includes(osmValue)) return 'Nachtleben';
    if (osmValue === 'pharmacy') return 'Apotheke';
    if (['fuel', 'charging_station'].includes(osmValue)) return 'Tankstelle';
    if (['bank', 'atm'].includes(osmValue)) return 'Geldautomat & Bank';
    if (osmValue === 'place_of_worship') return 'Kirche & Tempel';
    if (['theatre', 'cinema', 'arts_centre'].includes(osmValue)) return 'Theater & Bühne';
    if (['parking', 'parking_space', 'parking_entrance'].includes(osmValue)) return 'Parkplatz';
    if (osmValue === 'bus_station') return 'Busbahnhof';
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

  const cacheKey = buildCacheKey(rawQ, lat, lng, limit, lang);
  const cached = getCachedPlaces(cacheKey);
  if (cached) {
    return cached;
  }

  const baseUrl = process.env.PHOTON_API_URL || 'https://photon.komoot.io/api/';
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return [];
  }

  url.searchParams.set('q', rawQ);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', lang);

  if (lat != null) {
    url.searchParams.set('lat', String(lat));
  }
  if (lng != null) {
    // CRITICAL: Photon requires 'lon', NOT 'lng'. Photon returns 400 if 'lng' is sent.
    url.searchParams.set('lon', String(lng));
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
      return [];
    }

    const data = (await res.json()) as PhotonResponse;
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

    setCachedPlaces(cacheKey, results);
    return results;
  } catch {
    return [];
  }
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
      country: props.country,
      postcode: props.postcode,
    };

    setCachedReverse(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
