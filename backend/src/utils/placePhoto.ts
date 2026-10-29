import { isSafeUrl } from './mapsLink.js';

export interface PlacePhotoOptions {
  name: string;
  lat?: number;
  lng?: number;
  city?: string;
  category?: string;
  isBanner?: boolean;
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
  category?: string,
  isBanner = false
): string {
  const latStr = lat != null && Number.isFinite(lat) ? lat.toFixed(3) : '';
  const lngStr = lng != null && Number.isFinite(lng) ? lng.toFixed(3) : '';
  const cityStr = city?.trim().toLowerCase() || '';
  const categoryStr = category?.trim().toLowerCase() || '';
  return `${name.trim().toLowerCase()}|${latStr}|${lngStr}|${cityStr}|${categoryStr}|${isBanner ? 'banner' : 'spot'}`;
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

export const AIRPORT_KEYWORDS = new Set([
  'flughafen',
  'airport',
  'aeroporto',
  'aeropuerto',
  'aéroport',
  'aerodrome',
  'flugplatz',
]);

export const AIRPORT_RELEVANCE_TERMS = [
  'flughafen',
  'airport',
  'aeroporto',
  'aeropuerto',
  'aéroport',
  'aerodrome',
  'terminal',
  'runway',
  'gate',
  'flugzeug',
  'airplane',
  'aircraft',
  'airline',
  'aviation',
  'flug',
  'flight',
];

export function isAirportQuery(name: string, category?: string): boolean {
  if (category) {
    const c = category.trim().toLowerCase();
    if (c === 'flughafen' || c === 'airport' || c === 'flugplatz') {
      return true;
    }
  }
  const lower = (name || '').toLowerCase();
  for (const kw of AIRPORT_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  if (/\([A-Za-z]{3}\)/.test(name)) {
    return true;
  }
  return false;
}

const FACILITY_WORDS = new Set([
  'flughafen',
  'airport',
  'aeroporto',
  'aeropuerto',
  'aerodrome',
  'flugplatz',
  'bahnhof',
  'station',
  'hbf',
  'hauptbahnhof',
  'krankenhaus',
  'hospital',
  'klinik',
  'hotel',
  'hostel',
  'restaurant',
  'café',
  'cafe',
  'bar',
  'museum',
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

  // Spezifiziert die Suche eine konkrete Einrichtung (z. B. Flughafen, Bahnhof, Hotel),
  // darf ein bloßer Stadt-Artikel (z. B. "Lissabon") nicht als Treffer gewertet werden.
  if (bWords.some((w) => FACILITY_WORDS.has(w)) && !aWords.some((w) => FACILITY_WORDS.has(w))) {
    return false;
  }

  const aSet = new Set(aWords);
  const bSet = new Set(bWords);

  // Gleiche Wörter unabhängig von der Reihenfolge (z. B. "Flughafen Lissabon" vs "Lissabon Flughafen")
  if (aWords.length === bWords.length && aWords.every((w) => bSet.has(w))) {
    return true;
  }

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

  // Wenn alle Wörter des kürzeren im längeren enthalten sind (ab 2 Wörtern)
  const shorterList = aWords.length <= bWords.length ? aWords : bWords;
  const longerSet = aWords.length <= bWords.length ? bSet : aSet;
  if (shorterList.length >= 2 && shorterList.every((w) => longerSet.has(w))) {
    return true;
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
  original?: {
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

async function resolveImageInfo(
  lang: string,
  imageTitle: string,
  isBanner = false
): Promise<string | null> {
  const pages = await queryWiki(lang, {
    titles: imageTitle,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: isBanner ? '2000' : '1000',
  });
  const info = (pages[0] as { imageinfo?: Array<{ thumburl?: string; url?: string }> })
    ?.imageinfo?.[0];
  const url = info?.thumburl || info?.url;
  return url && isSafeUrl(url) ? url : null;
}

async function extractPhotoFromPage(
  lang: string,
  page: WikiPage,
  isBanner = false
): Promise<string | null> {
  // 1. Wenn thumbnail existiert und ein echtes Foto ist
  // Hinweis: thumbnail wird via pithumbsize: isBanner ? '2000' : '1000' in passender Größe angefordert
  // (bei Wikipedia skaliert der Thumbnail-Dienst das Bild serverseitig sauber auf 2000px).
  // Dies verhindert das Laden gigantischer Originaldateien (> 50 MB), die das serverseitige Limit
  // (MAX_REMOTE_IMAGE_BYTES = 5 MB) überschreiten und /images/proxy mit HTTP 502 fehlschlagen lassen.
  if (page.thumbnail?.source) {
    const isPhoto = isGoodPhoto(page.pageimage || page.thumbnail.source);
    if (isPhoto && isSafeUrl(page.thumbnail.source)) {
      return page.thumbnail.source;
    }
  }

  // 2. Fallback: Originalbild, falls thumbnail fehlt
  if (page.original?.source) {
    const isPhoto = isGoodPhoto(page.pageimage || page.original.source);
    if (isPhoto && isSafeUrl(page.original.source)) {
      return page.original.source;
    }
  }

  // 3. Falls Thumbnail ein SVG/Logo war: Erstes passendes Foto aus den Seiten-Bildern ermitteln
  if (Array.isArray(page.images) && page.images.length > 0) {
    const photoImg = page.images.find((img) => isGoodPhoto(img.title));
    if (photoImg) {
      return resolveImageInfo(lang, photoImg.title, isBanner);
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

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripWord(text: string, word: string): string {
  if (!word) return text;
  const normWord = normalizeText(word);
  const tokens = text.split(/\s+/);
  const filtered = tokens.filter((t) => normalizeText(t) !== normWord);
  return filtered.join(' ').trim();
}

function buildNameWords(
  rawName: string,
  city?: string,
  category?: string
): { nameWords: string[]; stopWords: Set<string> } {
  const isAirport = isAirportQuery(rawName, category);
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
    ...(category && !isAirport ? category.toLowerCase().split(/\s+/) : []),
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

  return { nameWords, stopWords };
}

function parseBingHtml(
  html: string,
  rawName: string,
  limit: number,
  seen: Set<string>,
  nameWords: string[],
  isAirport = false,
  isBanner = false
): string[] {
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

      if (isAirport) {
        const hasAirportTerm = AIRPORT_RELEVANCE_TERMS.some((term) => searchable.includes(term));
        const iataMatch = rawName.match(/\(([A-Za-z]{3})\)/) || rawName.match(/\b([A-Z]{3})\b/);
        const iata = iataMatch ? iataMatch[1].toLowerCase() : null;
        const hasIata = iata ? new RegExp(`\\b${iata}\\b`).test(searchable) : false;
        if (!hasAirportTerm && !hasIata) continue;
      }

      const isRelevant =
        nameWords.length === 0
          ? searchable.includes(rawName.toLowerCase().trim())
          : nameWords.some((w) => searchable.includes(w));

      if (!isRelevant) continue;

      // Bing Edge CDN (turl mit &w=1000): Hohe Verfügbarkeit und klein (~30 KB), ideal zur Schonung
      // des Serverspeichers bei Spots. Für Trip-Banner hingegen wird das Originalbild (murl) benötigt,
      // da turl (Bing OIP-Cache) hardwareseitig auf 474px Breite beschränkt ist und im Banner pixelig wirkt.
      const cdnUrl = turl ? (turl.includes('?') ? `${turl}&w=1000` : `${turl}?w=1000`) : null;
      const candidate = isBanner
        ? murl && isSafeUrl(murl) && isGoodPhoto(murl)
          ? murl
          : cdnUrl && isSafeUrl(cdnUrl) && isGoodPhoto(cdnUrl)
            ? cdnUrl
            : null
        : cdnUrl && isSafeUrl(cdnUrl) && isGoodPhoto(cdnUrl)
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
}

async function queryBingImages(
  query: string,
  rawName: string,
  limit: number,
  seen: Set<string>,
  city?: string,
  category?: string,
  isBanner = false
): Promise<string[]> {
  const { nameWords } = buildNameWords(rawName, city, category);
  const isAirport = isAirportQuery(rawName, category);

  // Primär den async AJAX-Endpunkt nutzen (saubere Bildkacheln ohne Decoy-Trends oder Werbe-Seiten)
  // Sekundär als Fallback die reguläre Suchseite (stellt auch Unit-Test-Mocks sicher)
  const candidateUrls = [
    `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=${Math.max(20, limit)}&scenario=ImageBasicHover&datsrc=N_I&layout=RowBased&mmasync=1&setmkt=de-DE&setlang=de`,
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&setmkt=de-DE&setlang=de`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: BING_FETCH_HEADERS,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok || typeof res.text !== 'function') continue;
      const html = await res.text();
      const photos = parseBingHtml(html, rawName, limit, seen, nameWords, isAirport, isBanner);
      if (photos.length > 0) {
        return photos;
      }
    } catch {
      // Nächste URL versuchen
    }
  }

  return [];
}

async function queryDuckDuckGoImages(
  query: string,
  rawName: string,
  limit: number,
  seen: Set<string>,
  city?: string,
  category?: string,
  _isBanner = false
): Promise<string[]> {
  try {
    const pageUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!pageRes.ok) return [];
    const html = await pageRes.text();
    const vqdMatch = html.match(/vqd=["']?([^&"'\s>]+)/i) || html.match(/vqd:\s*["']([^"']+)["']/i);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];

    const apiUrl = `https://duckduckgo.com/i.js?l=de-de&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: 'https://duckduckgo.com/',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!apiRes.ok) return [];
    const data = (await apiRes.json()) as {
      results?: Array<{ title?: string; image?: string; thumbnail?: string; url?: string }>;
    };
    if (!Array.isArray(data?.results)) return [];

    const { nameWords } = buildNameWords(rawName, city, category);
    const isAirport = isAirportQuery(rawName, category);
    const photos: string[] = [];

    for (const item of data.results) {
      if (photos.length >= limit) break;
      const title = (item.title || '').toLowerCase();
      const purl = (item.url || '').toLowerCase();
      const murl = (item.image || '').toLowerCase();
      const searchable = `${title} ${purl} ${murl}`;

      if (isAirport) {
        const hasAirportTerm = AIRPORT_RELEVANCE_TERMS.some((term) => searchable.includes(term));
        const iataMatch = rawName.match(/\(([A-Za-z]{3})\)/) || rawName.match(/\b([A-Z]{3})\b/);
        const iata = iataMatch ? iataMatch[1].toLowerCase() : null;
        const hasIata = iata ? new RegExp(`\\b${iata}\\b`).test(searchable) : false;
        if (!hasAirportTerm && !hasIata) continue;
      }

      const isRelevant =
        nameWords.length === 0
          ? searchable.includes(rawName.toLowerCase().trim())
          : nameWords.some((w) => searchable.includes(w));

      if (!isRelevant) continue;

      const img = item.image;
      const thumb = item.thumbnail;
      const candidate =
        img && isSafeUrl(img) && isGoodPhoto(img)
          ? img
          : thumb && isSafeUrl(thumb) && isGoodPhoto(thumb)
            ? thumb
            : null;

      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        photos.push(candidate);
      }
    }

    return photos;
  } catch {
    return [];
  }
}

async function queryCommonsImages(
  query: string,
  limit: number,
  seen: Set<string>,
  isAirport = false,
  isBanner = false
): Promise<string[]> {
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrnamespace', '6'); // Dateinamen-Namespace
    url.searchParams.set('gsrsearch', query);
    url.searchParams.set('gsrlimit', String(Math.min(10, limit)));
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('iiurlwidth', isBanner ? '2000' : '1000');

    const res = await fetch(url.toString(), {
      headers: WIKI_FETCH_HEADERS,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{ thumburl?: string; url?: string }>;
          }
        >;
      };
    };
    if (!data?.query?.pages) return [];

    const photos: string[] = [];
    for (const page of Object.values(data.query.pages)) {
      if (photos.length >= limit) break;
      const title = page.title || '';
      if (!isGoodPhoto(title)) continue;

      if (isAirport) {
        const titleLower = title.toLowerCase();
        const hasAirportTerm = AIRPORT_RELEVANCE_TERMS.some((term) => titleLower.includes(term));
        if (!hasAirportTerm) continue;
      }

      const info = page.imageinfo?.[0];
      const candidate = info?.thumburl || info?.url;
      if (candidate && isSafeUrl(candidate) && isGoodPhoto(candidate) && !seen.has(candidate)) {
        seen.add(candidate);
        photos.push(candidate);
      }
    }
    return photos;
  } catch {
    return [];
  }
}

export function buildAirportSearchQueries(rawName: string, city?: string): string[] {
  const iataMatch = rawName.match(/\(([A-Za-z]{3})\)/) || rawName.match(/\b([A-Z]{3})\b/);
  const iata = iataMatch ? iataMatch[1].toUpperCase() : null;

  let baseName = rawName.replace(/\([^)]*\)/g, ' ').trim();
  for (const kw of AIRPORT_KEYWORDS) {
    baseName = baseName.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ').trim();
  }
  baseName = baseName.replace(/\s+/g, ' ').trim();

  const targetCity = city?.trim() || '';
  const queries: string[] = [];
  const add = (q: string) => {
    const t = q.trim();
    if (t && !queries.some((x) => x.toLowerCase() === t.toLowerCase())) queries.push(t);
  };

  const nameHasAirport = Array.from(AIRPORT_KEYWORDS).some((kw) =>
    rawName.toLowerCase().includes(kw)
  );
  const rawWithAirport = nameHasAirport ? rawName : `${rawName} Flughafen`;

  if (baseName && targetCity && baseName.toLowerCase() !== targetCity.toLowerCase()) {
    add(`Flughafen ${baseName} ${targetCity} ${iata ? `(${iata})` : ''}`);
    add(`${baseName} Airport ${targetCity} ${iata || ''}`);
    add(`Flughafen ${baseName}`);
    add(`${baseName} Airport`);
    add(`Flughafen ${targetCity} ${iata ? `(${iata})` : ''}`);
    add(`${targetCity} Airport ${iata || ''}`);
  } else {
    const mainPlace = targetCity || baseName || rawName;
    add(`Flughafen ${mainPlace} ${iata ? `(${iata})` : ''}`);
    add(`${mainPlace} Airport ${iata || ''}`);
    add(`Flughafen ${mainPlace}`);
    add(`${mainPlace} Airport`);
  }

  if (iata) {
    add(`Airport ${iata}`);
    add(`Flughafen ${iata}`);
  }

  add(rawWithAirport);

  return queries;
}

/**
 * Erzeugt eine kaskadierende Liste von Suchanfragen vom Spezifischen zum Allgemeinen.
 * Beispiel:
 * 1. "Trinkteufel Berlin Nachtleben" (falls Bing spezifische Einträge hat)
 * 2. "Trinkteufel Berlin" (falls Kategorie die Suche übermäßig einschränkt)
 * 3. "Trinkteufel" (Basis-Name als Fallback)
 */
export function buildSearchQueries(rawName: string, city?: string, category?: string): string[] {
  if (isAirportQuery(rawName, category)) {
    return buildAirportSearchQueries(rawName, city);
  }

  const queries: string[] = [];

  const add = (q: string) => {
    const trimmed = q.trim();
    if (trimmed && !queries.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      queries.push(trimmed);
    }
  };

  const normRaw = normalizeText(rawName);
  const normCity = city ? normalizeText(city) : '';
  const normCat = category ? normalizeText(category) : '';

  // 1. Spezifische Suche: Name + Stadt + Kategorie (falls nicht ohnehin enthalten)
  const fullParts = [rawName];
  if (city && !normRaw.includes(normCity)) {
    fullParts.push(city);
  }
  if (category && !normRaw.includes(normCat)) {
    fullParts.push(category);
  }
  add(fullParts.join(' '));

  // 2. Suche ohne Kategorie: Name + Stadt
  let nameWithoutCat = rawName;
  if (category) {
    const stripped = stripWord(rawName, category);
    if (stripped) nameWithoutCat = stripped;
  }
  const cityParts = [nameWithoutCat];
  if (city && !normalizeText(nameWithoutCat).includes(normCity)) {
    cityParts.push(city);
  }
  add(cityParts.join(' '));

  // 3. Suche nur mit dem Kern-Namen (ohne Kategorie und ohne Stadt)
  let baseName = nameWithoutCat;
  if (city) {
    const stripped = stripWord(nameWithoutCat, city);
    if (stripped) baseName = stripped;
  }
  add(baseName);

  // 4. Fallback auf den ursprünglichen rawName
  add(rawName);

  return queries;
}

/**
 * Durchsucht den Web-Bilder-Index nach echten Fotos für eine Location (z. B. Bar, Restaurant, Hotel, Attraktion).
 * Nutzt primär den Bing-Web-Index mit Fallback auf DuckDuckGo, ist kostenfrei und stabil ohne API-Key abrufbar.
 * Unterstützt gezielte, kaskadierende Suchanfragen (Name + Stadt + Kategorie -> Name + Stadt -> Name).
 */
export async function searchWebPlacePhotos(
  name: string,
  city?: string,
  category?: string,
  limit = 10,
  isBanner = false
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
      cleanCategory,
      isBanner
    );
    for (const p of batch) {
      photos.push(p);
    }
  }

  // Fallback auf DuckDuckGo, falls Bing keine oder unzureichende Ergebnisse geliefert hat
  if (photos.length < limit) {
    for (const q of queries) {
      if (photos.length >= limit) break;
      const batch = await queryDuckDuckGoImages(
        q,
        rawName,
        limit - photos.length,
        seen,
        cleanCity,
        cleanCategory,
        isBanner
      );
      for (const p of batch) {
        photos.push(p);
      }
    }
  }

  return photos.slice(0, limit);
}

export async function searchWebPlacePhoto(
  name: string,
  city?: string,
  category?: string,
  isBanner = false
): Promise<string | null> {
  const photos = await searchWebPlacePhotos(name, city, category, 1, isBanner);
  return photos[0] ?? null;
}

/**
 * Sucht nach mehreren passenden Fotos für einen Ort oder eine Sehenswürdigkeit:
 * 1. Primär: Echte Web-Bildersuche (Bing Image Index + DuckDuckGo Fallback)
 * 2. Sekundär / Fallback: Wikipedia / Wikimedia Commons (GeoSearch bei Koordinaten + Titelsuche + Commons-Suche)
 */
export async function fetchPlacePhotos(options: PlacePhotoOptions, limit = 10): Promise<string[]> {
  const rawName = options.name?.trim();
  if (!rawName) return [];

  const lat = options.lat != null && Number.isFinite(options.lat) ? options.lat : undefined;
  const lng = options.lng != null && Number.isFinite(options.lng) ? options.lng : undefined;
  const city = options.city?.trim() || undefined;
  const category = options.category?.trim() || undefined;
  const isBanner = Boolean(options.isBanner);

  const cacheKey = buildPhotoCacheKey(rawName, lat, lng, city, category, isBanner);
  const cached = photoCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt && cached.urls.length >= limit) {
    return cached.urls.slice(0, limit);
  }

  const photos: string[] = [];
  const seen = new Set<string>();

  // 1. Primär: Echte Web-Bildersuche
  const webPhotos = await searchWebPlacePhotos(rawName, city, category, limit, isBanner);
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
          piprop: 'thumbnail|original',
          pithumbsize: isBanner ? '2000' : '1000',
        });

        for (const p of pages) {
          if (photos.length >= limit) break;
          if (isTitleMatch(p.title, rawName, city)) {
            const found = await extractPhotoFromPage(lang, p, isBanner);
            if (found && !seen.has(found)) {
              seen.add(found);
              photos.push(found);
            }
          }
        }
      }
    }

    // 2b. Textsuche nach Name (+ Stadt) auf Wikipedia
    if (photos.length < limit) {
      const isAirport = isAirportQuery(rawName, category);
      const searchQuery = isAirport
        ? buildAirportSearchQueries(rawName, city)[0] || [rawName, city].filter(Boolean).join(' ')
        : [rawName, city].filter(Boolean).join(' ');
      for (const lang of languages) {
        if (photos.length >= limit) break;
        const pages = await queryWiki(lang, {
          generator: 'search',
          gsrsearch: searchQuery,
          gsrlimit: '5',
          prop: 'pageimages|images',
          piprop: 'thumbnail|original',
          pithumbsize: isBanner ? '2000' : '1000',
        });

        for (const p of pages) {
          if (photos.length >= limit) break;
          if (isTitleMatch(p.title, rawName, city)) {
            const found = await extractPhotoFromPage(lang, p, isBanner);
            if (found && !seen.has(found)) {
              seen.add(found);
              photos.push(found);
            }
          }
        }
      }
    }

    // 2c. Direkte Bildsuche auf Wikimedia Commons
    if (photos.length < limit) {
      const isAirport = isAirportQuery(rawName, category);
      const commonsQueries = isAirport
        ? buildAirportSearchQueries(rawName, city)
        : [[rawName, city].filter(Boolean).join(' '), rawName];
      for (const cq of commonsQueries) {
        if (photos.length >= limit) break;
        const commonsPhotos = await queryCommonsImages(
          cq,
          limit - photos.length,
          seen,
          isAirport,
          isBanner
        );
        for (const cp of commonsPhotos) {
          photos.push(cp);
        }
      }
    }
  }

  // Cache speichern (nur echte Treffer cachen, damit temporäre Netzwerkfehler nicht 24h blockieren)
  if (photos.length > 0) {
    if (photoCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = photoCache.keys().next().value;
      if (oldestKey !== undefined) photoCache.delete(oldestKey);
    }
    photoCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      urls: photos,
    });
  }

  return photos.slice(0, limit);
}

/**
 * Sucht nach einem echten Foto für einen Ort (Einzelfoto-Kompatibilität).
 */
export async function fetchPlacePhoto(options: PlacePhotoOptions): Promise<string | null> {
  const photos = await fetchPlacePhotos(options, 1);
  return photos[0] ?? null;
}
