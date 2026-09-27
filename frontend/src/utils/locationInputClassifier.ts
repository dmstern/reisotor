import { parseLatLngFromMapsLink, type LatLng } from './googleMaps';

export type LocationInputType = 'empty' | 'maps_link' | 'query';

export interface EmptyLocationInput {
  type: 'empty';
}

export interface MapsLinkLocationInput {
  type: 'maps_link';
  url: string;
  coords: LatLng | null;
  isShortlink: boolean;
}

export interface QueryLocationInput {
  type: 'query';
  query: string;
}

export type LocationInputClassification =
  EmptyLocationInput | MapsLinkLocationInput | QueryLocationInput;

const MAPS_SHORTLINK_REGEX =
  /(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com\/p\/|bit\.ly\/|tinyurl\.com\/)/i;

const MAPS_DOMAIN_OR_SCHEME_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|openstreetmap\.org|osm\.org)/i;

const GEO_OR_MAPS_SCHEME_REGEX = /^(?:geo:|maps:\/\/)/i;

/**
 * Checks whether an input string represents a known maps link (Google Maps, Apple Maps,
 * OpenStreetMap, geo: URI, or known shortlink).
 */
export function isMapsLink(input: string | null | undefined): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (GEO_OR_MAPS_SCHEME_REGEX.test(trimmed)) return true;
  if (MAPS_DOMAIN_OR_SCHEME_REGEX.test(trimmed)) return true;
  if (MAPS_SHORTLINK_REGEX.test(trimmed)) return true;

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

  // 3. Otherwise treat as free-text search query
  return {
    type: 'query',
    query: trimmed,
  };
}
