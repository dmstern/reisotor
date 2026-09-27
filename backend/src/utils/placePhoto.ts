import { isSafeUrl } from './mapsLink.js';

export interface PlacePhotoOptions {
  name: string;
  lat?: number;
  lng?: number;
  city?: string;
}

interface CacheEntry {
  expiresAt: number;
  url: string | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden
const MAX_CACHE_ENTRIES = 500;
const photoCache = new Map<string, CacheEntry>();

export function buildPhotoCacheKey(
  name: string,
  lat?: number,
  lng?: number,
  city?: string
): string {
  const latStr = lat != null && Number.isFinite(lat) ? lat.toFixed(3) : '';
  const lngStr = lng != null && Number.isFinite(lng) ? lng.toFixed(3) : '';
  const cityStr = city?.trim().toLowerCase() || '';
  return `${name.trim().toLowerCase()}|${latStr}|${lngStr}|${cityStr}`;
}

export function clearPhotoCache(): void {
  photoCache.clear();
}

export function isGoodPhoto(filenameOrUrl: string): boolean {
  if (!filenameOrUrl) return false;
  const lower = filenameOrUrl.toLowerCase();

  // SVGs und Vektorgrafiken ausschließen (in Wikipedia fast immer Logos, Wappen oder Karten)
  if (lower.endsWith('.svg') || lower.includes('.svg.')) return false;

  // Ungeeignete Bildtypen ausschließen
  const badKeywords = [
    'logo',
    'icon',
    'symbol',
    'wappen',
    'coat_of_arms',
    'flag',
    'flagge',
    'karte',
    'map',
    'plan',
    'schema',
    'diagram',
    'disambig',
    'commons-logo',
    'sign',
    'pfeil',
    'arrow',
  ];
  for (const kw of badKeywords) {
    if (lower.includes(kw)) return false;
  }

  // Akzeptierte Bildformate
  return (
    lower.includes('.jpg') ||
    lower.includes('.jpeg') ||
    lower.includes('.png') ||
    lower.includes('.webp')
  );
}

export function isTitleMatch(
  articleTitle: string,
  placeName: string,
  targetCity?: string
): boolean {
  if (!articleTitle || !placeName) return false;

  const a = articleTitle.toLowerCase();
  const b = placeName.toLowerCase();

  // Stadt-Konfliktprüfung: falls im Wikipedia-Titel ein Klammerzusatz mit einer anderen Stadt steht
  // (z. B. "Blumental (Solingen)" bei gesuchter Stadt "Berlin"), diesen ausschließen.
  const parenMatch = a.match(/\(([^)]+)\)/);
  if (parenMatch && targetCity) {
    const parenText = parenMatch[1].trim();
    const cityLower = targetCity.trim().toLowerCase();
    if (parenText.length > 3 && !parenText.includes(cityLower) && !cityLower.includes(parenText)) {
      return false;
    }
  }

  // Klammern für Namensvergleich entfernen
  const aClean = a.replace(/\([^)]*\)/g, '').trim();
  const bClean = b.replace(/\([^)]*\)/g, '').trim();

  if (aClean === bClean) return true;
  if (aClean.includes(bClean) || bClean.includes(aClean)) return true;

  // Wort-Overlap (z. B. "Schloss Neuschwanstein" vs "Neuschwanstein")
  const aWords = aClean.split(/\s+/).filter((w) => w.length > 3);
  const bWords = bClean.split(/\s+/).filter((w) => w.length > 3);
  return aWords.some((w) => bWords.includes(w));
}

interface WikiPage {
  pageid: number;
  title: string;
  index?: number;
  pageimage?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  images?: Array<{ title: string }>;
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiPage>;
  };
}

const WIKI_FETCH_HEADERS = {
  'User-Agent': 'Reisotor/1.0 (https://github.com/dmstern/reisotor; travel planning app)',
  Accept: 'application/json',
};

async function queryWiki(lang: string, params: Record<string, string>): Promise<WikiPage[]> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: WIKI_FETCH_HEADERS,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as WikiQueryResponse;
    if (!data?.query?.pages) return [];
    return Object.values(data.query.pages).sort((x, y) => (x.index || 0) - (y.index || 0));
  } catch {
    return [];
  }
}

async function resolveImageInfo(lang: string, imageTitle: string): Promise<string | null> {
  const pages = await queryWiki(lang, {
    titles: imageTitle,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1000',
  });
  const info = (pages[0] as { imageinfo?: Array<{ thumburl?: string; url?: string }> })
    ?.imageinfo?.[0];
  const url = info?.thumburl || info?.url;
  return url && isSafeUrl(url) ? url : null;
}

async function extractPhotoFromPage(lang: string, page: WikiPage): Promise<string | null> {
  // 1. Wenn thumbnail existiert und ein echtes Foto ist
  if (page.thumbnail?.source) {
    const isPhoto = isGoodPhoto(page.pageimage || page.thumbnail.source);
    if (isPhoto && isSafeUrl(page.thumbnail.source)) {
      return page.thumbnail.source;
    }
  }

  // 2. Falls Thumbnail ein SVG/Logo war: Erstes passendes Foto aus den Seiten-Bildern ermitteln
  if (Array.isArray(page.images) && page.images.length > 0) {
    const photoImg = page.images.find((img) => isGoodPhoto(img.title));
    if (photoImg) {
      return resolveImageInfo(lang, photoImg.title);
    }
  }

  return null;
}

/**
 * Sucht über die freie Wikipedia / Wikimedia API nach einem echten Foto für einen Ort
 * oder eine Sehenswürdigkeit (GeoSearch bei Koordinaten + Titelsuche).
 * Liefert null zurück, falls kein echtes Foto gefunden wurde (damit die App sauber
 * auf die Kartenvorschau zurückfällt, statt ein generisches Logo anzuzeigen).
 */
export async function fetchPlacePhoto(options: PlacePhotoOptions): Promise<string | null> {
  const rawName = options.name?.trim();
  if (!rawName) return null;

  const lat = options.lat != null && Number.isFinite(options.lat) ? options.lat : undefined;
  const lng = options.lng != null && Number.isFinite(options.lng) ? options.lng : undefined;
  const city = options.city?.trim() || undefined;

  const cacheKey = buildPhotoCacheKey(rawName, lat, lng, city);
  const cached = photoCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  let photoUrl: string | null = null;
  const languages = ['de', 'en'];

  // 1. Wenn Koordinaten vorhanden: GeoSearch um die Koordinate (Radius 300m)
  if (lat != null && lng != null) {
    for (const lang of languages) {
      const pages = await queryWiki(lang, {
        generator: 'geosearch',
        ggscoord: `${lat}|${lng}`,
        ggsradius: '300',
        ggslimit: '5',
        prop: 'pageimages|images',
        pithumbsize: '1000',
      });

      for (const p of pages) {
        if (isTitleMatch(p.title, rawName, city)) {
          const found = await extractPhotoFromPage(lang, p);
          if (found) {
            photoUrl = found;
            break;
          }
        }
      }
      if (photoUrl) break;
    }
  }

  // 2. Textsuche nach Name (+ Stadt)
  if (!photoUrl) {
    const searchQuery = [rawName, city].filter(Boolean).join(' ');
    for (const lang of languages) {
      const pages = await queryWiki(lang, {
        generator: 'search',
        gsrsearch: searchQuery,
        gsrlimit: '3',
        prop: 'pageimages|images',
        pithumbsize: '1000',
      });

      for (const p of pages) {
        if (isTitleMatch(p.title, rawName, city)) {
          const found = await extractPhotoFromPage(lang, p);
          if (found) {
            photoUrl = found;
            break;
          }
        }
      }
      if (photoUrl) break;
    }
  }

  // Cache speichern
  if (photoCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = photoCache.keys().next().value;
    if (oldestKey !== undefined) photoCache.delete(oldestKey);
  }
  photoCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    url: photoUrl,
  });

  return photoUrl;
}
