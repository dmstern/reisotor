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
  if (!urlString) {
    return false;
  }

  const trimmed = urlString.trim();

  if (!trimmed) {
    return false;
  }

  let urlToTest = trimmed;

  if (!/^[a-z]+:\/\//i.test(urlToTest)) {
    urlToTest = 'https://' + urlToTest;
  }

  try {
    const parsed = new URL(urlToTest);
    const host = parsed.hostname.toLowerCase();

    if (BOOKING_DOMAINS_REGEX.test(host)) {
      return true;
    }

    if (ACCOMMODATION_PATH_REGEX.test(parsed.pathname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/** Bereinigt typische Marketing- und Plattform-Zusätze aus Hotel-/Unterkunftstiteln. */
export function cleanAccommodationTitle(raw: string): string {
  let title = raw.trim();

  if (!title) {
    return '';
  }

  // Typische Booking.com-Zusätze: "Hotel Sacher Wien, Wien – Aktualisierte Preise für 2026"
  title = title.replace(/\s*[-–—]\s*Aktualisierte Preise.*$/i, '');
  title = title.replace(/\s*[-–—]\s*Updated \d{4} Prices.*$/i, '');
  title = title.replace(/\s*\([^)]*Preise[^)]*\)/gi, '');
  title = title.replace(/\s*\([^)]*Prices[^)]*\)/gi, '');
  title = title.replace(/\s*[|–—-]\s*Booking\.com$/i, '');

  // Typische Airbnb-Zusätze: "Loft in Lisbon - Wohnungen zur Miete in Lisbon - Airbnb"
  title = title.replace(/\s*[|–—-]\s*Airbnb$/i, '');
  title = title.replace(/\s*[-–—]\s*Wohnungen zur Miete.*$/i, '');
  title = title.replace(/\s*[-–—]\s*Apartments for Rent.*$/i, '');
  title = title.replace(/\s*·\s*★.*$/i, ''); // Rating-Snippets wie · ★4,9 · 2 Schlafzimmer

  // Typische Trivago-Zusätze: "Hotel Adlon Kempinski, Berlin | trivago.de" oder "Parkhotel | trivago"
  title = title.replace(/\s*[|–—-]\s*trivago(?:\.[a-z.]+)?$/i, '');

  // Allgemeine Plattform-Suffixe
  title = title.replace(
    /\s*[|–—-]\s*(?:Expedia|Hotels\.com|Agoda|Tripadvisor|Fewo-direkt|Vrbo).*$/i,
    ''
  );

  // HTML-Entities dekodieren falls vorhanden
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Booking.com URL-Slug Transliteration für Umlaute (z. B. ma1-4ritz -> müritz, a1-4 -> ü)
  title = title
    .replace(/\b([a-z]+)a1-4([a-z]+)\b/gi, '$1ü$2')
    .replace(/([a-z]+)a-1-4([a-z]+)/gi, '$1ä$2')
    .replace(/([a-z]+)o-?1-4([a-z]+)/gi, '$1ö$2')
    .replace(/\ba1-4/gi, 'ü');

  return title.trim();
}

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
  'referrer',
  // Booking.com Tracking & Session-Parameter
  'aid',
  'label',
  'sid',
  'srepoch',
  'srpvid',
  'ucfs',
  'hapos',
  'hpos',
  'matching_block_id',
  'sb_price_type',
  'sr_order',
  'sr_pri_blocks',
  'type',
  // Airbnb Tracking-Parameter
  'source_impression_id',
  'previous_page_section_name',
  'federated_search_id',
  'search_id',
  'section_id',
  // Trivago Tracking-Parameter
  'pceid',
  'psrid',
]);

/**
 * Bereinigt eine Buchungs- oder Web-URL von überflüssigen Marketing- und Tracking-Parametern,
 * behält jedoch Reisedaten, Zimmer-IDs und Orts-IDs bei.
 */
export function cleanBookingUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  const trimmed = rawUrl.trim();
  let normalized = trimmed;

  if (!/^[a-z]+:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  try {
    const url = new URL(normalized);
    const keysToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();

      if (TRACKING_QUERY_PARAMS.has(lower) || lower.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });

    for (const k of keysToDelete) {
      url.searchParams.delete(k);
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

/** Extrahiert Datumsangaben im Format YYYY-MM-DD oder YYYYMMDD aus Query-Parametern. */
export function parseDateParam(val: string | null | undefined): string | null {
  if (!val) {
    return null;
  }

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
  if (val == null) {
    return null;
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  if (typeof val !== 'string') {
    return null;
  }

  let str = val.trim();

  if (!str) {
    return null;
  }

  // Währungssymbole und Buchstaben entfernen
  str = str.replace(/[^0-9.,]/g, '');

  if (!str) {
    return null;
  }

  // Format 1.250,50 vs 1,250.50
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

/** Formatiert eine Zeitangabe (z. B. "15:00:00" -> "15:00"). */
function formatTime(val: unknown): string | null {
  if (!val || typeof val !== 'string') {
    return null;
  }

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

    if (!rawJson) {
      continue;
    }

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
  if (!obj) {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectJsonLdObjects(item, target);
    }

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

function normalizeTypeString(val: string): string {
  return val
    .replace(/^https?:\/\/schema\.org\//i, '')
    .replace(/^schema:/i, '')
    .toLowerCase();
}

function isLodgingType(typeVal: unknown): boolean {
  if (!typeVal) {
    return false;
  }

  if (typeof typeVal === 'string') {
    return LODGING_TYPES.has(normalizeTypeString(typeVal));
  }

  if (Array.isArray(typeVal)) {
    return typeVal.some((t) => typeof t === 'string' && LODGING_TYPES.has(normalizeTypeString(t)));
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
      if (m[1]) {
        results.push(m[1].trim());
      }
    }
  }

  return results;
}

function parsePostalAddress(addr: Record<string, unknown> | string | undefined): {
  address: string | null;
  city: string | null;
} {
  if (!addr) {
    return { address: null, city: null };
  }

  if (typeof addr === 'string') {
    return { address: addr.trim(), city: null };
  }

  if (typeof addr !== 'object') {
    return { address: null, city: null };
  }

  let city: string | null = null;
  let address: string | null = null;

  const street = addr.streetAddress ? String(addr.streetAddress).trim() : '';
  const postal = addr.postalCode ? String(addr.postalCode).trim() : '';
  const locality = addr.addressLocality ? String(addr.addressLocality).trim() : '';
  let country = '';

  if (typeof addr.addressCountry === 'string') {
    country = addr.addressCountry.trim();
  } else if (addr.addressCountry) {
    country = (addr.addressCountry as { name?: string })?.name?.trim() || '';
  }

  if (locality) {
    city = locality;
  }

  if (street) {
    const zipCityMatch = /\b\d{4,5}\s+([A-Za-zäöüÄÖÜß\s-]+?)(?:,|$)/.exec(street);

    if (zipCityMatch?.[1].trim()) {
      city = zipCityMatch[1].trim();
    }
  }

  if (street && ((postal && street.includes(postal)) || (country && street.includes(country)))) {
    address = street;
  } else {
    const parts: string[] = [];

    if (street) {
      parts.push(street);
    }

    const locParts: string[] = [];

    if (postal) {
      locParts.push(postal);
    }

    if (locality && (!street || !street.includes(locality))) {
      locParts.push(locality);
    }

    if (locParts.length > 0) {
      parts.push(locParts.join(' '));
    }

    if (country && (!street || !street.includes(country))) {
      parts.push(country);
    }

    if (parts.length > 0) {
      address = parts.join(', ');
    }
  }

  return { address, city };
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
        let candidate = typeof img === 'string' ? img : img?.url || img?.contentUrl;

        if (!candidate || typeof candidate !== 'string') {
          continue;
        }

        if (candidate.startsWith('//')) {
          candidate = 'https:' + candidate;
        }

        if (
          isSafeUrl(candidate) &&
          !isGenericPlaceholderImage(candidate) &&
          !images.includes(candidate)
        ) {
          images.push(candidate);
        }
      }

      if (images.length > 0 && !imageUrl) {
        imageUrl = images[0];
      }
    }

    // Adresse
    if (lodgingObject.address) {
      const parsed = parsePostalAddress(lodgingObject.address as Record<string, unknown> | string);

      if (parsed.address) {
        address = parsed.address;
      }

      if (parsed.city) {
        city = parsed.city;
      }
    }

    // Geo-Koordinaten
    if (lodgingObject.geo && typeof lodgingObject.geo === 'object' && lodgingObject.geo !== null) {
      const geo = lodgingObject.geo as Record<string, unknown>;
      const gLat = parseFloat(String(geo.latitude));
      const gLng = parseFloat(String(geo.longitude));

      if (Number.isFinite(gLat) && Number.isFinite(gLng)) {
        lat = gLat;
        lng = gLng;
      }
    }

    // Angebote / Preis
    if (lodgingObject.offers) {
      const rawOffers = lodgingObject.offers;
      const offers = (Array.isArray(rawOffers) ? rawOffers[0] : rawOffers) as
        Record<string, unknown> | undefined;

      if (offers) {
        const p = parsePrice(offers.price ?? offers.lowPrice);

        if (p != null) {
          amount = p;
        }

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

    if (cleanImg.startsWith('//')) {
      cleanImg = 'https:' + cleanImg;
    }

    if (isSafeUrl(cleanImg) && !isGenericPlaceholderImage(cleanImg)) {
      if (!images.includes(cleanImg)) {
        images.push(cleanImg);
      }

      if (!imageUrl) {
        imageUrl = cleanImg;
      }
    }
  }

  // Falls keine Adresse aus einem Haupt-LodgingObject extrahiert wurde,
  // prüfe ob ein eigenständiges PostalAddress-Objekt im JSON-LD existiert (z. B. bei Trivago):
  if (!address) {
    const postalObj = jsonLdBlocks.find(
      (obj) =>
        normalizeTypeString(String(obj['@type'])) === 'postaladdress' ||
        (obj.address && typeof obj.address === 'object')
    );

    if (postalObj) {
      const addrData =
        normalizeTypeString(String(postalObj['@type'])) === 'postaladdress'
          ? postalObj
          : (postalObj.address as Record<string, unknown>);

      if (addrData && typeof addrData === 'object') {
        const parsed = parsePostalAddress(addrData);

        if (parsed.address) {
          address = parsed.address;
        }

        if (parsed.city && !city) {
          city = parsed.city.split(',')[0].trim();
        }
      }
    }
  }

  // Meta-Adresse & Ort (Fallback)
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

    if (street) {
      parts.push(street);
    }

    const locParts: string[] = [];

    if (postal) {
      locParts.push(postal);
    }

    if (locality) {
      locParts.push(locality);

      if (!city) {
        city = locality;
      }
    }

    if (locParts.length > 0) {
      parts.push(locParts.join(' '));
    }

    if (country) {
      parts.push(country);
    }

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

  // HTML Data-Attributes / Regex für Koordinaten (z. B. Booking.com data-atlas-latlng oder "Auf der Karte anzeigen")
  if (lat == null || lng == null) {
    const bookingCoordsMatch =
      /data-atlas-latlng=["'](-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)["']/i.exec(html) ||
      /data-lat=["'](-?\d+\.\d+)["'][\s\S]*?data-lng=["'](-?\d+\.\d+)["']/i.exec(html) ||
      /booking\.env\.b_map_center_latitude\s*=\s*['"]?(-?\d+\.\d+)['"]?[\s\S]*?booking\.env\.b_map_center_longitude\s*=\s*['"]?(-?\d+\.\d+)['"]?/i.exec(
        html
      ) ||
      /b_map_center_latitude\s*:\s*['"]?(-?\d+\.\d+)['"]?[\s\S]*?b_map_center_longitude\s*:\s*['"]?(-?\d+\.\d+)['"]?/i.exec(
        html
      ) ||
      /"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/i.exec(html) ||
      /"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/i.exec(html) ||
      /maps\.google\.[a-z.]+(?:\/maps)?\?[^"']*?[?&](?:q|ll|center|markers)=(-?\d+\.\d+),(-?\d+\.\d+)/i.exec(
        html
      ) ||
      /maps\.googleapis\.com\/maps\/api\/staticmap\?[^"']*?[?&](?:center|markers)=(-?\d+\.\d+),(-?\d+\.\d+)/i.exec(
        html
      ) ||
      /openstreetmap\.org[^\s"']*?[?&]mlat=(-?\d+\.\d+)[?&]mlon=(-?\d+\.\d+)/i.exec(html);

    if (bookingCoordsMatch) {
      const parsedLat = parseFloat(bookingCoordsMatch[1]);
      const parsedLng = parseFloat(bookingCoordsMatch[2]);

      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }
  }

  // Fallback: data-atlas-bbox (z. B. auf Booking-Karten)
  if (lat == null || lng == null) {
    const bboxMatch =
      /data-atlas-bbox=["'](-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+)["']/i.exec(html);

    if (bboxMatch) {
      const lat1 = parseFloat(bboxMatch[1]);
      const lng1 = parseFloat(bboxMatch[2]);
      const lat2 = parseFloat(bboxMatch[3]);
      const lng2 = parseFloat(bboxMatch[4]);

      if (
        Number.isFinite(lat1) &&
        Number.isFinite(lat2) &&
        Number.isFinite(lng1) &&
        Number.isFinite(lng2)
      ) {
        lat = (lat1 + lat2) / 2;
        lng = (lng1 + lng2) / 2;
      }
    }
  }

  // Checkin / Checkout Zeiten aus HTML-Text / FAQ extrahieren falls noch nicht gesetzt
  if (!checkin) {
    const ciMatch = /Check-in[^<>\n]{0,60}?(?:ab|von)\s*(\d{1,2}:\d{2})/i.exec(html);

    if (ciMatch) {
      checkin = formatTime(ciMatch[1]);
    }
  }

  if (!checkout) {
    const coMatch = /Check-out[^<>\n]{0,60}?(?:bis)\s*(\d{1,2}:\d{2})/i.exec(html);

    if (coMatch) {
      checkout = formatTime(coMatch[1]);
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

const PREVIEW_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const MAX_REDIRECT_HOPS = 5;

function isBotChallenge(html: string): boolean {
  if (!html || html.length > 80000) {
    return false;
  }

  return (
    html.includes('awsWafCookieDomainList') ||
    html.includes('challenge.js') ||
    html.includes('cf-browser-verification') ||
    html.includes('challenge-running') ||
    html.includes('Just a moment...')
  );
}

async function fetchWithFollowRedirects(
  initialUrl: string,
  userAgent: string
): Promise<{ html: string; finalUrl: string } | null> {
  let current = initialUrl;
  let finalHtml = '';
  let finalUrl = initialUrl;

  const headers = {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current)) {
      return null;
    }

    let res: Response;

    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers,
      });
    } catch {
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

  return { html: finalHtml, finalUrl };
}

/** Lädt eine Unterkunfts-URL ab, folgt Redirects sicher und extrahiert strukturierte Metadaten. */
export async function fetchAccommodationPreview(
  url: string | null | undefined
): Promise<AccommodationPreview | null> {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  let normalizedUrl = trimmed;

  if (!/^[a-z]+:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  if (!isSafeUrl(normalizedUrl)) {
    return null;
  }

  let isBookingDomain = false;

  try {
    const host = new URL(normalizedUrl).hostname.toLowerCase();
    isBookingDomain = host.includes('booking.com') || host.includes('bstatic.com');
  } catch {
    // ignore
  }

  // Booking.com blockiert Standard-Browser-User-Agents mit AWS WAF, erlaubt aber Social Preview Bots
  const primaryUa = isBookingDomain ? PREVIEW_UA : BROWSER_UA;
  const secondaryUa = isBookingDomain ? BROWSER_UA : PREVIEW_UA;

  const fetchResult = await fetchWithFollowRedirects(normalizedUrl, primaryUa);
  let finalHtml = fetchResult?.html || '';
  let finalUrl = fetchResult?.finalUrl || normalizedUrl;

  // Wenn der primäre Abruf durch eine WAF / Bot-Challenge abgefangen wurde oder leer war:
  if (!finalHtml || isBotChallenge(finalHtml)) {
    const retryResult = await fetchWithFollowRedirects(normalizedUrl, secondaryUa);

    if (retryResult?.html && !isBotChallenge(retryResult.html)) {
      finalHtml = retryResult.html;
      finalUrl = retryResult.finalUrl;
    }
  }

  // Metadaten aus HTML extrahieren (falls Abruf erfolgreich)
  const meta = finalHtml ? extractBookingMetadataFromHtml(finalHtml, finalUrl) : {};

  // Checkin-/Checkout-Daten & Preise aus URL-Query-Parametern extrahieren (sowohl aus Original- als auch Ziel-URL)
  let startDate: string | null = null;
  let endDate: string | null = null;

  try {
    const origUrl = new URL(normalizedUrl);
    const finalParsed = finalUrl !== normalizedUrl ? new URL(finalUrl) : null;

    const getParam = (name: string) =>
      origUrl.searchParams.get(name) || finalParsed?.searchParams.get(name);

    startDate =
      parseDateParam(getParam('checkin')) ||
      parseDateParam(getParam('checkIn')) ||
      parseDateParam(getParam('check_in')) ||
      parseDateParam(getParam('arrival')) ||
      parseDateParam(getParam('from'));

    endDate =
      parseDateParam(getParam('checkout')) ||
      parseDateParam(getParam('checkOut')) ||
      parseDateParam(getParam('check_out')) ||
      parseDateParam(getParam('departure')) ||
      parseDateParam(getParam('to'));

    // Trivago Datumsbereich (;dr-YYYYMMDD-YYYYMMDD)
    if (!startDate || !endDate) {
      const searchParam = getParam('search') || '';
      const drMatch = /;?dr-(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/i.exec(searchParam);

      if (drMatch) {
        if (!startDate) {
          startDate = `${drMatch[1]}-${drMatch[2]}-${drMatch[3]}`;
        }

        if (!endDate) {
          endDate = `${drMatch[4]}-${drMatch[5]}-${drMatch[6]}`;
        }
      }
    }

    // Preis aus Booking sr_pri_blocks extrahieren falls vorhanden (z. B. sr_pri_blocks=...__23409 -> 234.09)
    if (meta.amount == null) {
      const priParam = getParam('sr_pri_blocks');
      const priMatch = priParam ? /__(\d+)(?:$|&)/.exec(priParam) : null;

      if (priMatch && priMatch[1].length >= 3) {
        const cents = parseInt(priMatch[1], 10);

        if (!Number.isNaN(cents) && cents > 0) {
          meta.amount = Math.round((cents / 100) * 100) / 100;
          meta.currency ||= 'EUR';
        }
      }
    }
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
      const searchRes = await searchPlaces({ q: query, limit: 1 });

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
    sourceUrl: cleanBookingUrl(trimmed),
  };
}
