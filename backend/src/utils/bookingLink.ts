import { isSafeUrl, isGenericPlaceholderImage } from './mapsLink.js';
import { searchPlaces } from './places.js';

export interface AccommodationPreview {
  name: string | null;
  imageUrl: string | null;
  images: string[];
  category: 'Unterkunft';
  address: string | null;
  city: string | null;
  amount: number | null;
  currency: string | null;
  lat: number | null;
  lng: number | null;
  checkin: string | null;
  checkout: string | null;
  startDate: string | null;
  endDate: string | null;
  contact: string | null;
  sourceUrl: string;
}

const BOOKING_DOMAINS_REGEX =
  /(?:^|\.)(?:booking\.com|airbnb\.[a-z.]+|abnb\.me|trivago\.[a-z.]+|fewo-direkt\.de|vrbo\.com|expedia\.[a-z.]+|hotels\.com|agoda\.com|hostelworld\.com|tripadvisor\.[a-z.]+|kayak\.[a-z.]+|momondo\.[a-z.]+|holidu\.[a-z.]+|hrs\.[a-z.]+|accor\.[a-z.]+|marriott\.[a-z.]+|hilton\.[a-z.]+|hyatt\.[a-z.]+|ihg\.[a-z.]+|bestwestern\.[a-z.]+)(?::\d+)?(?:\/|$)/i;

const ACCOMMODATION_PATH_REGEX =
  /\/(?:hotel|hotels|rooms|room|accommodations|accommodation|unterkunft|ferienwohnung|chalet|resort|hostel|pension)\//i;

/** Prüft, ob ein URL-String zu einer bekannten Buchungsplattform oder Unterkunftsseite gehört. */
export function isBookingLinkUrl(urlString: string | null | undefined): boolean {
  if (!urlString) return false;
  const trimmed = urlString.trim();
  if (!trimmed) return false;

  let urlToTest = trimmed;
  if (!/^[a-z]+:\/\//i.test(urlToTest)) {
    urlToTest = 'https://' + urlToTest;
  }

  try {
    const parsed = new URL(urlToTest);
    const host = parsed.hostname.toLowerCase();
    if (BOOKING_DOMAINS_REGEX.test(host)) return true;
    if (ACCOMMODATION_PATH_REGEX.test(parsed.pathname)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Bereinigt typische Marketing- und Plattform-Zusätze aus Hotel-/Unterkunftstiteln. */
export function cleanAccommodationTitle(raw: string): string {
  let title = raw.trim();
  if (!title) return '';

  // Typische Booking.com-Zusätze: "Hotel Sacher Wien, Wien – Aktualisierte Preise für 2026"
  title = title.replace(/\s*–\s*Aktualisierte Preise.*$/i, '');
  title = title.replace(/\s*–\s*Updated \d{4} Prices.*$/i, '');
  title = title.replace(/\s*\([^)]*Preise[^)]*\)/gi, '');
  title = title.replace(/\s*\([^)]*Prices[^)]*\)/gi, '');
  title = title.replace(/\s*\|\s*Booking\.com$/i, '');
  title = title.replace(/\s*-\s*Booking\.com$/i, '');

  // Typische Airbnb-Zusätze: "Loft in Lisbon - Wohnungen zur Miete in Lisbon - Airbnb"
  title = title.replace(/\s*-\s*Airbnb$/i, '');
  title = title.replace(/\s*\|\s*Airbnb$/i, '');
  title = title.replace(/\s*-\s*Wohnungen zur Miete.*$/i, '');
  title = title.replace(/\s*-\s*Apartments for Rent.*$/i, '');
  title = title.replace(/\s*·\s*★.*$/i, ''); // Rating-Snippets wie · ★4,9 · 2 Schlafzimmer

  // Typische Trivago-Zusätze: "Hotel Adlon Kempinski, Berlin | trivago.de"
  title = title.replace(/\s*\|\s*trivago\.[a-z.]+$/i, '');
  title = title.replace(/\s*-\s*trivago\.[a-z.]+$/i, '');

  // Allgemeine Plattform-Suffixe
  title = title.replace(
    /\s*\|\s*(?:Expedia|Hotels\.com|Agoda|Tripadvisor|Fewo-direkt|Vrbo).*$/i,
    ''
  );
  title = title.replace(
    /\s*-\s*(?:Expedia|Hotels\.com|Agoda|Tripadvisor|Fewo-direkt|Vrbo).*$/i,
    ''
  );

  // HTML-Entities dekodieren falls vorhanden
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  return title.trim();
}

/** Extrahiert Datumsangaben im Format YYYY-MM-DD oder YYYYMMDD aus Query-Parametern. */
export function parseDateParam(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const matchCompact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (matchCompact) {
    return `${matchCompact[1]}-${matchCompact[2]}-${matchCompact[3]}`;
  }
  return null;
}

/** Extrahiert einen numerischen Betrag aus einem Preiswert (String oder Zahl). */
export function parsePrice(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  if (typeof val !== 'string') return null;

  let str = val.trim();
  if (!str) return null;

  // Währungssymbole und Buchstaben entfernen
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return null;

  // Format 1.250,50 -> 1250.50
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

/** Formatiert eine Zeitangabe (z. B. "15:00:00" -> "15:00"). */
function formatTime(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const match = /(\d{1,2}:\d{2})/.exec(val);
  return match ? match[1] : val.trim().slice(0, 10);
}

/** Parst alle JSON-LD Skriptblöcke aus dem HTML und flacht Arrays / @graph-Strukturen ab. */
export function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed: unknown = JSON.parse(rawJson);
      collectJsonLdObjects(parsed, results);
    } catch {
      // Ignoriere invalides JSON
    }
  }

  return results;
}

function collectJsonLdObjects(obj: unknown, target: Record<string, unknown>[]) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectJsonLdObjects(item, target);
    return;
  }
  if (typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    target.push(rec);
    if (rec['@graph']) {
      collectJsonLdObjects(rec['@graph'], target);
    }
  }
}

const LODGING_TYPES = new Set([
  'hotel',
  'lodgingbusiness',
  'accommodation',
  'resort',
  'motel',
  'hostel',
  'bedandbreakfast',
  'apartment',
  'house',
  'vacationrental',
  'place',
  'product',
  'localbusiness',
]);

function isLodgingType(typeVal: unknown): boolean {
  if (!typeVal) return false;
  if (typeof typeVal === 'string') {
    return LODGING_TYPES.has(typeVal.toLowerCase());
  }
  if (Array.isArray(typeVal)) {
    return typeVal.some((t) => typeof t === 'string' && LODGING_TYPES.has(t.toLowerCase()));
  }
  return false;
}

function extractMetaTag(html: string, nameOrProperty: string): string | null {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const reg of regexes) {
    const m = reg.exec(html);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  return null;
}

function extractMetaTagsAll(html: string, nameOrProperty: string): string[] {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const results: string[] = [];
  const regexes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'gi'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'gi'),
  ];
  for (const reg of regexes) {
    let m: RegExpExecArray | null;
    while ((m = reg.exec(html)) !== null) {
      if (m[1]) results.push(m[1].trim());
    }
  }
  return results;
}

/** Extrahiert Metadaten aus dem geladenen HTML und der Ziel-URL. */
export function extractBookingMetadataFromHtml(
  html: string,
  url: string
): Partial<AccommodationPreview> {
  let name: string | null = null;
  let imageUrl: string | null = null;
  const images: string[] = [];
  let address: string | null = null;
  let city: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let checkin: string | null = null;
  let checkout: string | null = null;
  let contact: string | null = null;

  // 1. JSON-LD prüfen
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const lodgingObject = jsonLdBlocks.find((b) => isLodgingType(b['@type'])) || jsonLdBlocks[0];

  if (lodgingObject) {
    if (lodgingObject.name && typeof lodgingObject.name === 'string') {
      name = cleanAccommodationTitle(lodgingObject.name);
    }

    // Bild(er)
    if (lodgingObject.image) {
      const rawImgs = Array.isArray(lodgingObject.image)
        ? lodgingObject.image
        : [lodgingObject.image];
      for (const img of rawImgs) {
        const u = typeof img === 'string' ? img : img?.url || img?.contentUrl;
        if (u && typeof u === 'string' && isSafeUrl(u) && !isGenericPlaceholderImage(u)) {
          if (!images.includes(u)) images.push(u);
        }
      }
      if (images.length > 0 && !imageUrl) {
        imageUrl = images[0];
      }
    }

    // Adresse
    if (lodgingObject.address) {
      const addr = lodgingObject.address;
      if (typeof addr === 'string') {
        address = addr.trim();
      } else if (typeof addr === 'object') {
        const parts: string[] = [];
        if (addr.streetAddress) parts.push(String(addr.streetAddress).trim());
        const localityParts: string[] = [];
        if (addr.postalCode) localityParts.push(String(addr.postalCode).trim());
        if (addr.addressLocality) {
          localityParts.push(String(addr.addressLocality).trim());
          city = String(addr.addressLocality).trim();
        }
        if (localityParts.length > 0) parts.push(localityParts.join(' '));
        if (addr.addressCountry) {
          const c =
            typeof addr.addressCountry === 'string'
              ? addr.addressCountry
              : addr.addressCountry.name;
          if (c) parts.push(String(c).trim());
        }
        if (parts.length > 0) {
          address = parts.join(', ');
        }
      }
    }

    // Geo-Koordinaten
    if (lodgingObject.geo && typeof lodgingObject.geo === 'object') {
      const gLat = parseFloat(lodgingObject.geo.latitude);
      const gLng = parseFloat(lodgingObject.geo.longitude);
      if (Number.isFinite(gLat) && Number.isFinite(gLng)) {
        lat = gLat;
        lng = gLng;
      }
    }

    // Angebote / Preis
    if (lodgingObject.offers) {
      const offers = Array.isArray(lodgingObject.offers)
        ? lodgingObject.offers[0]
        : lodgingObject.offers;
      if (offers) {
        const p = parsePrice(offers.price ?? offers.lowPrice);
        if (p != null) amount = p;
        if (offers.priceCurrency && typeof offers.priceCurrency === 'string') {
          currency = offers.priceCurrency.trim();
        }
      }
    }

    // Checkin / Checkout
    if (lodgingObject.checkinTime) {
      checkin = formatTime(lodgingObject.checkinTime);
    }
    if (lodgingObject.checkoutTime) {
      checkout = formatTime(lodgingObject.checkoutTime);
    }

    // Kontakt / Telefon
    if (lodgingObject.telephone && typeof lodgingObject.telephone === 'string') {
      contact = lodgingObject.telephone.trim();
    }
  }

  // 2. OpenGraph & Meta Tags als Ergänzung/Fallback
  if (!name) {
    const ogTitle =
      extractMetaTag(html, 'og:title') ||
      extractMetaTag(html, 'twitter:title') ||
      /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
    if (ogTitle) {
      name = cleanAccommodationTitle(ogTitle);
    }
  }

  // Zusätzliche OpenGraph-Bilder
  const ogImages = [
    ...extractMetaTagsAll(html, 'og:image'),
    ...extractMetaTagsAll(html, 'twitter:image'),
  ];
  for (const img of ogImages) {
    let cleanImg = img;
    if (cleanImg.startsWith('//')) cleanImg = 'https:' + cleanImg;
    if (isSafeUrl(cleanImg) && !isGenericPlaceholderImage(cleanImg)) {
      if (!images.includes(cleanImg)) images.push(cleanImg);
      if (!imageUrl) imageUrl = cleanImg;
    }
  }

  // Meta-Adresse & Ort
  if (!address) {
    const street =
      extractMetaTag(html, 'business:contact_data:street_address') ||
      extractMetaTag(html, 'og:street-address');
    const locality =
      extractMetaTag(html, 'business:contact_data:locality') ||
      extractMetaTag(html, 'og:locality') ||
      extractMetaTag(html, 'geo.placename');
    const postal =
      extractMetaTag(html, 'business:contact_data:postal_code') ||
      extractMetaTag(html, 'og:postal-code');
    const country =
      extractMetaTag(html, 'business:contact_data:country_name') ||
      extractMetaTag(html, 'og:country-name');

    const parts: string[] = [];
    if (street) parts.push(street);
    const locParts: string[] = [];
    if (postal) locParts.push(postal);
    if (locality) {
      locParts.push(locality);
      if (!city) city = locality;
    }
    if (locParts.length > 0) parts.push(locParts.join(' '));
    if (country) parts.push(country);

    if (parts.length > 0) {
      address = parts.join(', ');
    }
  }

  // Meta-Koordinaten
  if (lat == null || lng == null) {
    const pLat = extractMetaTag(html, 'place:location:latitude');
    const pLng = extractMetaTag(html, 'place:location:longitude');
    if (pLat && pLng) {
      const parsedLat = parseFloat(pLat);
      const parsedLng = parseFloat(pLng);
      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }
  }

  if (lat == null || lng == null) {
    const geoPos = extractMetaTag(html, 'geo.position') || extractMetaTag(html, 'ICBM');
    if (geoPos) {
      const parts = geoPos.split(/[;,]/).map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        lat = parts[0];
        lng = parts[1];
      }
    }
  }

  // HTML Data-Attributes / Regex für Koordinaten (z. B. Booking.com data-atlas-latlng)
  if (lat == null || lng == null) {
    const bookingCoordsMatch =
      /data-atlas-latlng=["'](-?\d+\.\d+),(-?\d+\.\d+)["']/i.exec(html) ||
      /b_map_center_latitude\s*=\s*['"]?(-?\d+\.\d+)['"]?[\s\S]*?b_map_center_longitude\s*=\s*['"]?(-?\d+\.\d+)['"]?/i.exec(
        html
      ) ||
      /"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/i.exec(html);

    if (bookingCoordsMatch) {
      const parsedLat = parseFloat(bookingCoordsMatch[1]);
      const parsedLng = parseFloat(bookingCoordsMatch[2]);
      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }
  }

  // Meta-Preise
  if (amount == null) {
    const priceMeta =
      extractMetaTag(html, 'product:price:amount') || extractMetaTag(html, 'og:price:amount');
    if (priceMeta) {
      amount = parsePrice(priceMeta);
    }
    const currMeta =
      extractMetaTag(html, 'product:price:currency') || extractMetaTag(html, 'og:price:currency');
    if (currMeta) {
      currency = currMeta.trim();
    }
  }

  // 3. Fallback: Name aus URL-Pfad extrahieren, falls im HTML nichts gefunden
  if (!name && url) {
    try {
      const parsedUrl = new URL(url);
      // Booking.com: /hotel/at/hotel-sacher-wien.html
      const hotelMatch = /\/hotel\/[a-z]{2}\/([^/.]+)/i.exec(parsedUrl.pathname);
      if (hotelMatch) {
        name = cleanAccommodationTitle(hotelMatch[1].replace(/-/g, ' '));
      }
      // Trivago: /de/srl/hotel-adlon-kempinski-berlin
      const trivagoMatch = /\/(?:srl|hotel)\/([^/?]+)/i.exec(parsedUrl.pathname);
      if (!name && trivagoMatch) {
        name = cleanAccommodationTitle(trivagoMatch[1].replace(/-/g, ' '));
      }
    } catch {
      // Ignoriere Parsing-Fehler
    }
  }

  return {
    name,
    imageUrl,
    images,
    category: 'Unterkunft',
    address,
    city,
    amount,
    currency,
    lat,
    lng,
    checkin,
    checkout,
    contact,
  };
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
};

const MAX_REDIRECT_HOPS = 5;

/** Lädt eine Unterkunfts-URL ab, folgt Redirects sicher und extrahiert strukturierte Metadaten. */
export async function fetchAccommodationPreview(
  url: string | null | undefined
): Promise<AccommodationPreview | null> {
  if (!url) return null;
  const trimmed = url.trim();
  let normalizedUrl = trimmed;
  if (!/^[a-z]+:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  if (!isSafeUrl(normalizedUrl)) return null;

  let current = normalizedUrl;
  let finalHtml = '';
  let finalUrl = normalizedUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current)) return null;
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers: FETCH_HEADERS,
      });
    } catch {
      // Bei Netzwerkfehler: Best-Effort Fallback basierend auf der URL selbst
      break;
    }

    const location = res.headers?.get?.('location');
    if (location && (res.status == null || (res.status >= 300 && res.status < 400))) {
      try {
        current = new URL(location, current).toString();
      } catch {
        break;
      }
      continue;
    }

    try {
      finalHtml = await res.text();
      finalUrl = res.url || current;
      break;
    } catch {
      break;
    }
  }

  // Metadaten aus HTML extrahieren (falls Abruf erfolgreich)
  const meta = finalHtml ? extractBookingMetadataFromHtml(finalHtml, finalUrl) : {};

  // Checkin-/Checkout-Daten aus URL-Query-Parametern extrahieren
  let startDate: string | null = null;
  let endDate: string | null = null;
  try {
    const parsed = new URL(finalUrl);
    startDate =
      parseDateParam(parsed.searchParams.get('checkin')) ||
      parseDateParam(parsed.searchParams.get('check_in')) ||
      parseDateParam(parsed.searchParams.get('arrival')) ||
      parseDateParam(parsed.searchParams.get('from'));

    endDate =
      parseDateParam(parsed.searchParams.get('checkout')) ||
      parseDateParam(parsed.searchParams.get('check_out')) ||
      parseDateParam(parsed.searchParams.get('departure')) ||
      parseDateParam(parsed.searchParams.get('to'));
  } catch {
    // Ignoriere URL-Fehler
  }

  let finalLat = meta.lat ?? null;
  let finalLng = meta.lng ?? null;
  let finalAddress = meta.address ?? null;

  // 4. Geocoding-Fallback: Wenn Koordinaten fehlen, aber eine Adresse oder Name+Ort vorhanden ist
  if ((finalLat == null || finalLng == null) && (finalAddress || (meta.name && meta.city))) {
    try {
      const query = finalAddress || `${meta.name}, ${meta.city}`;
      const searchRes = await searchPlaces({ query, limit: 1 });
      if (searchRes.length > 0) {
        finalLat = searchRes[0].lat;
        finalLng = searchRes[0].lng;
        if (!finalAddress && searchRes[0].formatted_address) {
          finalAddress = searchRes[0].formatted_address;
        }
      }
    } catch {
      // Geocoding-Fehler stillschweigend ignorieren
    }
  }

  return {
    name: meta.name ?? null,
    imageUrl: meta.imageUrl ?? null,
    images: meta.images ?? [],
    category: 'Unterkunft',
    address: finalAddress,
    city: meta.city ?? null,
    amount: meta.amount ?? null,
    currency: meta.currency ?? null,
    lat: finalLat,
    lng: finalLng,
    checkin: meta.checkin ?? null,
    checkout: meta.checkout ?? null,
    startDate,
    endDate,
    contact: meta.contact ?? null,
    sourceUrl: trimmed,
  };
}
