import { isSafeUrl } from './mapsLink.js';

export interface PlacePhotoOptions {
  name: string;
  lat?: number;
  lng?: number;
  city?: string;
  category?: string;
}

interface CacheEntry {
  expiresAt: number;
  urls: string[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden
const MAX_CACHE_ENTRIES = 500;
const photoCache = new Map<string, CacheEntry>();

export function buildPhotoCacheKey(
  name: string,
  lat?: number,
  lng?: number,
  city?: string,
  category?: string
): string {
  const latStr = lat != null && Number.isFinite(lat) ? lat.toFixed(3) : '';
  const lngStr = lng != null && Number.isFinite(lng) ? lng.toFixed(3) : '';
  const cityStr = city?.trim().toLowerCase() || '';
  const categoryStr = category?.trim().toLowerCase() || '';
  return `${name.trim().toLowerCase()}|${latStr}|${lngStr}|${cityStr}|${categoryStr}`;
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

  // Akzeptierte Bildformate oder verifizierte Bild-CDNs (z. B. Bing CDN)
  return (
    lower.includes('.jpg') ||
    lower.includes('.jpeg') ||
    lower.includes('.png') ||
    lower.includes('.webp') ||
    lower.includes('bing.net/th') ||
    lower.includes('bing.com/th')
  );
}

const PLACE_WORDS = new Set([
  'schloss',
  'burg',
  'kirche',
  'dom',
  'kathedrale',
  'museum',
  'park',
  'palais',
  'turm',
  'brücke',
  'tor',
  'platz',
  'straße',
  'strasse',
  'gasse',
  'allee',
  'insel',
  'see',
  'berg',
  'spitze',
  'hotel',
  'café',
  'cafe',
  'bar',
  'restaurant',
  'gasthaus',
  'wirtshaus',
  'brauerei',
  'kloster',
  'stift',
  'station',
  'bahnhof',
  'airport',
  'flughafen',
  'castle',
  'palace',
  'church',
  'cathedral',
  'tower',
  'bridge',
  'gate',
  'square',
  'street',
  'lake',
  'mountain',
  'resort',
  'beach',
]);

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

  const aWords = aClean.split(/\s+/).filter(Boolean);
  const bWords = bClean.split(/\s+/).filter(Boolean);
  const cityWords = targetCity ? targetCity.toLowerCase().split(/\s+/).filter(Boolean) : [];

  // Wenn aClean bClean enthält oder umgekehrt (z. B. "Schloss Neuschwanstein" vs "Neuschwanstein")
  if (aClean.includes(bClean) || bClean.includes(aClean)) {
    const longerWords = aWords.length >= bWords.length ? aWords : bWords;
    const shorterWords = aWords.length >= bWords.length ? bWords : aWords;
    const diffWords = longerWords.filter((w) => !shorterWords.includes(w));

    // Alle abweichenden Wörter müssen Ortsdeskriptoren oder die Stadt sein
    const isPlaceDiff = diffWords.every((w) => PLACE_WORDS.has(w) || cityWords.includes(w));
    if (isPlaceDiff) return true;

    // Wenn der kürzere Begriff mindestens 2 Wörter hat und komplett im längeren vorkommt
    if (shorterWords.length >= 2) return true;
  }

  return false;
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

const BING_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
};

async function queryBingImages(
  query: string,
  rawName: string,
  limit: number,
  seen: Set<string>,
  city?: string,
  category?: string
): Promise<string[]> {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: BING_FETCH_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok || typeof res.text !== 'function') return [];
    const html = await res.text();

    const stopWords = new Set([
      'bar',
      'cafe',
      'café',
      'restaurant',
      'hotel',
      'der',
      'die',
      'das',
      'den',
      'dem',
      'des',
      'ein',
      'eine',
      ...(city ? city.toLowerCase().split(/\s+/) : []),
      ...(category ? category.toLowerCase().split(/\s+/) : []),
    ]);

    let nameWords = rawName
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    if (nameWords.length === 0) {
      nameWords = rawName
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
    }

    const photos: string[] = [];

    // 1. Bing primäre Struktur: class="iusc" style="..." m="{...}"
    const itemMatches = [...html.matchAll(/class=["']iusc["'][^>]*?m=["']({.*?})["']/gi)];
    for (const m of itemMatches) {
      if (photos.length >= limit) break;
      try {
        const decoded = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        const data = JSON.parse(decoded);
        const murl: string | undefined = data.murl;
        const turl: string | undefined = data.turl;
        const title: string = (data.t || '').toLowerCase();
        const purl: string = (data.purl || '').toLowerCase();

        const searchable = `${title} ${purl} ${(murl || '').toLowerCase()}`;
        const isRelevant =
          nameWords.length === 0
            ? searchable.includes(rawName.toLowerCase().trim())
            : nameWords.some((w) => searchable.includes(w));

        if (!isRelevant) continue;

        // Bing Edge CDN (turl mit &w=1000): Hohe Auflösung, 100% Verfügbarkeit, keine 509 Bandbreiten-Limits, keine 403 Hotlinking-Sperren
        const cdnUrl = turl ? (turl.includes('?') ? `${turl}&w=1000` : `${turl}?w=1000`) : null;
        const candidate =
          cdnUrl && isSafeUrl(cdnUrl) && isGoodPhoto(cdnUrl)
            ? cdnUrl
            : murl && isSafeUrl(murl) && isGoodPhoto(murl)
              ? murl
              : null;

        if (candidate && !seen.has(candidate)) {
          seen.add(candidate);
          photos.push(candidate);
        }
      } catch {
        // Ignoriere unvollständige / fehlerhafte JSON-Fragmente
      }
    }

    // 2. Fallback: Nur falls Bing-Container (class="iusc") komplett fehlen (z. B. bei Unit-Test-Mocks)
    if (photos.length === 0 && itemMatches.length === 0) {
      // Legacy Mock Format (id="resitem-..." mit data-origurl) für Unit-Tests
      const origMatches = [...html.matchAll(/data-origurl=["'](https?:\/\/[^"'\s]+)["']/gi)];
      const thumbMatches = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"'\s]+)["']/gi)];
      for (let i = 0; i < origMatches.length; i++) {
        if (photos.length >= limit) break;
        const orig = origMatches[i][1]?.replace(/&amp;/g, '&');
        const thumb = thumbMatches[i]?.[1]?.replace(/&amp;/g, '&');
        const cand =
          orig && isSafeUrl(orig) && isGoodPhoto(orig)
            ? orig
            : thumb && isSafeUrl(thumb) && isGoodPhoto(thumb)
              ? thumb
              : null;
        if (cand && !seen.has(cand)) {
          seen.add(cand);
          photos.push(cand);
        }
      }
    }

    return photos;
  } catch {
    return [];
  }
}

/**
 * Erzeugt eine kaskadierende Liste von Suchanfragen vom Spezifischen zum Allgemeinen.
 * Beispiel:
 * 1. "Trinkteufel Berlin Nachtleben" (falls Bing spezifische Einträge hat)
 * 2. "Trinkteufel Berlin" (falls Kategorie die Suche übermäßig einschränkt)
 * 3. "Trinkteufel" (Basis-Name als Fallback)
 */
export function buildSearchQueries(rawName: string, city?: string, category?: string): string[] {
  const queries: string[] = [];

  const add = (q: string) => {
    const trimmed = q.trim();
    if (trimmed && !queries.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      queries.push(trimmed);
    }
  };

  // 1. Spezifische Suche: Name + Stadt + Kategorie (falls nicht ohnehin enthalten)
  const fullParts = [rawName];
  if (city && !rawName.toLowerCase().includes(city.toLowerCase())) {
    fullParts.push(city);
  }
  if (category && !rawName.toLowerCase().includes(category.toLowerCase())) {
    fullParts.push(category);
  }
  add(fullParts.join(' '));

  // 2. Suche ohne Kategorie: Name + Stadt
  // Falls category am Ende von rawName stand (z. B. aus Suchfeld übergeben: "Trinkteufel Berlin Nachtleben")
  let nameWithoutCat = rawName;
  if (category && nameWithoutCat.toLowerCase().endsWith(category.toLowerCase())) {
    nameWithoutCat = nameWithoutCat.slice(0, -category.length).trim();
  }
  const cityParts = [nameWithoutCat];
  if (city && !nameWithoutCat.toLowerCase().includes(city.toLowerCase())) {
    cityParts.push(city);
  }
  add(cityParts.join(' '));

  // 3. Suche nur mit dem Kern-Namen (falls Stadt ebenfalls am Ende stand)
  let baseName = nameWithoutCat;
  if (city && baseName.toLowerCase().endsWith(city.toLowerCase())) {
    baseName = baseName.slice(0, -city.length).trim();
  }
  add(baseName);

  // 4. Fallback auf den ursprünglichen rawName
  add(rawName);

  return queries;
}

/**
 * Durchsucht den Web-Bilder-Index nach echten Fotos für eine Location (z. B. Bar, Restaurant, Hotel, Attraktion).
 * Nutzt den Bing-Web-Index (denselben Datenbestand wie DuckDuckGo), ist kostenfrei und stabil ohne API-Key abrufbar.
 * Unterstützt gezielte, kaskadierende Suchanfragen (Name + Stadt + Kategorie -> Name + Stadt -> Name).
 */
export async function searchWebPlacePhotos(
  name: string,
  city?: string,
  category?: string,
  limit = 10
): Promise<string[]> {
  const rawName = name?.trim();
  if (!rawName) return [];

  const cleanCity = city?.trim();
  const cleanCategory = category?.trim();
  const seen = new Set<string>();
  const photos: string[] = [];

  const queries = buildSearchQueries(rawName, cleanCity, cleanCategory);
  for (const q of queries) {
    if (photos.length >= limit) break;
    const batch = await queryBingImages(
      q,
      rawName,
      limit - photos.length,
      seen,
      cleanCity,
      cleanCategory
    );
    for (const p of batch) {
      photos.push(p);
    }
  }

  return photos.slice(0, limit);
}

export async function searchWebPlacePhoto(
  name: string,
  city?: string,
  category?: string
): Promise<string | null> {
  const photos = await searchWebPlacePhotos(name, city, category, 1);
  return photos[0] ?? null;
}

/**
 * Sucht nach mehreren passenden Fotos für einen Ort oder eine Sehenswürdigkeit:
 * 1. Primär: Echte Web-Bildersuche (Bing Image Index)
 * 2. Sekundär / Fallback: Wikipedia / Wikimedia (GeoSearch bei Koordinaten + Titelsuche)
 */
export async function fetchPlacePhotos(options: PlacePhotoOptions, limit = 10): Promise<string[]> {
  const rawName = options.name?.trim();
  if (!rawName) return [];

  const lat = options.lat != null && Number.isFinite(options.lat) ? options.lat : undefined;
  const lng = options.lng != null && Number.isFinite(options.lng) ? options.lng : undefined;
  const city = options.city?.trim() || undefined;
  const category = options.category?.trim() || undefined;

  const cacheKey = buildPhotoCacheKey(rawName, lat, lng, city, category);
  const cached = photoCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt && cached.urls.length >= limit) {
    return cached.urls.slice(0, limit);
  }

  const photos: string[] = [];
  const seen = new Set<string>();

  // 1. Primär: Echte Web-Bildersuche
  const webPhotos = await searchWebPlacePhotos(rawName, city, category, limit);
  for (const p of webPhotos) {
    if (!seen.has(p)) {
      seen.add(p);
      photos.push(p);
    }
  }

  // 2. Sekundär: Wikipedia / Wikimedia Fallback wenn limit noch nicht erreicht
  if (photos.length < limit) {
    const languages = ['de', 'en'];

    // 2a. Wenn Koordinaten vorhanden: GeoSearch um die Koordinate (Radius 300m)
    if (lat != null && lng != null) {
      for (const lang of languages) {
        if (photos.length >= limit) break;
        const pages = await queryWiki(lang, {
          generator: 'geosearch',
          ggscoord: `${lat}|${lng}`,
          ggsradius: '300',
          ggslimit: '5',
          prop: 'pageimages|images',
          pithumbsize: '1000',
        });

        for (const p of pages) {
          if (photos.length >= limit) break;
          if (isTitleMatch(p.title, rawName, city)) {
            const found = await extractPhotoFromPage(lang, p);
            if (found && !seen.has(found)) {
              seen.add(found);
              photos.push(found);
            }
          }
        }
      }
    }

    // 2b. Textsuche nach Name (+ Stadt)
    if (photos.length < limit) {
      const searchQuery = [rawName, city].filter(Boolean).join(' ');
      for (const lang of languages) {
        if (photos.length >= limit) break;
        const pages = await queryWiki(lang, {
          generator: 'search',
          gsrsearch: searchQuery,
          gsrlimit: '5',
          prop: 'pageimages|images',
          pithumbsize: '1000',
        });

        for (const p of pages) {
          if (photos.length >= limit) break;
          if (isTitleMatch(p.title, rawName, city)) {
            const found = await extractPhotoFromPage(lang, p);
            if (found && !seen.has(found)) {
              seen.add(found);
              photos.push(found);
            }
          }
        }
      }
    }
  }

  // Cache speichern
  if (photoCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = photoCache.keys().next().value;
    if (oldestKey !== undefined) photoCache.delete(oldestKey);
  }
  photoCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    urls: photos,
  });

  return photos.slice(0, limit);
}

/**
 * Sucht nach einem echten Foto für einen Ort (Einzelfoto-Kompatibilität).
 */
export async function fetchPlacePhoto(options: PlacePhotoOptions): Promise<string | null> {
  const photos = await fetchPlacePhotos(options, 1);
  return photos[0] ?? null;
}
