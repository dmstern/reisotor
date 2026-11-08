import { parseLatLngFromMapsLink, type LatLng } from './googleMaps';

export type LocationInputType = 'empty' | 'maps_link' | 'booking_link' | 'query';

export interface EmptyLocationInput {
  type: 'empty';
}

export interface MapsLinkLocationInput {
  type: 'maps_link';
  url: string;
  coords: LatLng | null;
  isShortlink: boolean;
}

export interface BookingLinkLocationInput {
  type: 'booking_link';
  url: string;
}

export interface QueryLocationInput {
  type: 'query';
  query: string;
}

export type LocationInputClassification =
  EmptyLocationInput | MapsLinkLocationInput | BookingLinkLocationInput | QueryLocationInput;

const MAPS_SHORTLINK_REGEX =
  /(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com\/p\/|bit\.ly\/|tinyurl\.com\/)/i;

const MAPS_DOMAIN_OR_SCHEME_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|openstreetmap\.org|osm\.org)/i;

const GEO_OR_MAPS_SCHEME_REGEX = /^(?:geo:|maps:\/\/)/i;

const BOOKING_DOMAINS_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)*(?:booking\.com|airbnb\.[a-z.]+|abnb\.me|trivago\.[a-z.]+|fewo-direkt\.de|vrbo\.com|expedia\.[a-z.]+|hotels\.com|agoda\.com|hostelworld\.com|tripadvisor\.[a-z.]+|kayak\.[a-z.]+|momondo\.[a-z.]+|holidu\.[a-z.]+|hrs\.[a-z.]+|accor\.[a-z.]+|marriott\.[a-z.]+|hilton\.[a-z.]+|hyatt\.[a-z.]+|ihg\.[a-z.]+|bestwestern\.[a-z.]+)(?::\d+)?(?:\/.*)?$/i;

const ACCOMMODATION_PATH_REGEX =
  /^https?:\/\/[^/]+\/(?:hotel|hotels|rooms|room|accommodations|accommodation|unterkunft|ferienwohnung|chalet|resort|hostel|pension)\//i;

/**
 * Checks whether an input string represents a known booking or accommodation website link
 * (e.g. Booking.com, Airbnb, Trivago, Expedia, VRBO, or accommodation paths).
 */
export function isBookingLink(input: string | null | undefined): boolean {
  if (!input) {return false;}

  const trimmed = input.trim();

  if (!trimmed) {return false;}

  if (BOOKING_DOMAINS_REGEX.test(trimmed)) {return true;}

  if (ACCOMMODATION_PATH_REGEX.test(trimmed)) {return true;}

  return false;
}

/**
 * Checks whether an input string represents a known maps link (Google Maps, Apple Maps,
 * OpenStreetMap, geo: URI, or known shortlink).
 */
export function isMapsLink(input: string | null | undefined): boolean {
  if (!input) {
    return false;
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return false;
  }

  if (GEO_OR_MAPS_SCHEME_REGEX.test(trimmed)) {
    return true;
  }

  if (MAPS_DOMAIN_OR_SCHEME_REGEX.test(trimmed)) {
    return true;
  }

  if (MAPS_SHORTLINK_REGEX.test(trimmed)) {
    return true;
  }

  // Also verify if coordinates can be extracted directly (e.g. embed links, custom formats)
  return parseLatLngFromMapsLink(trimmed) !== null;
}

/**
 * Classifies an arbitrary user input string into:
 * - 'empty': Empty string or whitespace
 * - 'maps_link': A recognized Maps link or geo: URI, returning extracted coords (if any) and shortlink flag
 * - 'query': Free-text POI or address search query
 */
export function classifyLocationInput(
  input: string | null | undefined
): LocationInputClassification {
  if (!input) {
    return { type: 'empty' };
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'empty' };
  }

  // 1. Try extracting coordinates directly via parseLatLngFromMapsLink
  const coords = parseLatLngFromMapsLink(trimmed);

  if (coords) {
    return {
      type: 'maps_link',
      url: trimmed,
      coords,
      isShortlink: false,
    };
  }

  // 2. Check if it's a known maps link without directly extractable coordinates (e.g. shortlink or search link)
  if (isMapsLink(trimmed)) {
    const isShortlink = MAPS_SHORTLINK_REGEX.test(trimmed);
    return {
      type: 'maps_link',
      url: trimmed,
      coords: null,
      isShortlink,
    };
  }

  // 3. Check if it's a booking / accommodation link (Booking.com, Airbnb, Trivago, etc.)
  if (isBookingLink(trimmed)) {
    let normalized = trimmed;

    if (!/^[a-z]+:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }

    return {
      type: 'booking_link',
      url: normalized,
    };
  }

  // 4. Otherwise treat as free-text search query
  return {
    type: 'query',
    query: trimmed,
  };
}
