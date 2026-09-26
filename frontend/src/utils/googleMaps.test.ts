import { describe, expect, it } from 'vitest';
import {
  buildAppleMapsLink,
  buildGenericMapsLink,
  buildGoogleMapsLink,
  buildOsmLink,
  parseLatLngFromMapsLink,
  tilePreviewUrl,
} from './googleMaps';

describe('parseLatLngFromMapsLink', () => {
  it('prefers !3d/!4d over a leading @lat,lng', () => {
    const url = 'https://www.google.com/maps/place/@40.0,10.0,15z/data=!3d48.2082!4d16.3738';
    expect(parseLatLngFromMapsLink(url)).toEqual({ lat: 48.2082, lng: 16.3738 });
  });

  it('parses a plain @lat,lng URL', () => {
    expect(parseLatLngFromMapsLink('https://www.google.com/maps/@48.2082,16.3738,15z')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses Apple Maps coordinate= param, including %2C-encoded commas', () => {
    expect(parseLatLngFromMapsLink('https://maps.apple.com/?coordinate=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(parseLatLngFromMapsLink('https://maps.apple.com/?coordinate=48.2082%2C16.3738')).toEqual(
      {
        lat: 48.2082,
        lng: 16.3738,
      }
    );
  });

  it('parses ?ll= and ?q= variants', () => {
    expect(parseLatLngFromMapsLink('https://maps.example/?ll=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(parseLatLngFromMapsLink('https://maps.example/?q=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('falls back to the raw text on malformed percent-encoding instead of throwing', () => {
    expect(() => parseLatLngFromMapsLink('https://maps.example/?q=48.2082,16.3738%')).not.toThrow();
    expect(parseLatLngFromMapsLink('https://maps.example/?q=48.2082,16.3738%')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses an OpenStreetMap ?mlat=&mlon= link (as produced by buildOsmLink)', () => {
    expect(
      parseLatLngFromMapsLink(
        'https://www.openstreetmap.org/?mlat=48.2082&mlon=16.3738#map=15/48.2082/16.3738'
      )
    ).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses an OpenStreetMap hash-only link without mlat/mlon', () => {
    expect(
      parseLatLngFromMapsLink('https://www.openstreetmap.org/#map=16/48.2082/16.3738')
    ).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses RFC 5870 / Android geo: URIs', () => {
    expect(parseLatLngFromMapsLink('geo:48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(parseLatLngFromMapsLink('geo:48.2082,16.3738?q=Stephansdom')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(parseLatLngFromMapsLink('geo:0,0?q=48.2082,16.3738(Stephansdom)')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('returns null when no pattern matches', () => {
    expect(parseLatLngFromMapsLink('https://maps.app.goo.gl/abc123')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(parseLatLngFromMapsLink(null)).toBeNull();
    expect(parseLatLngFromMapsLink(undefined)).toBeNull();
  });
});

describe('buildGoogleMapsLink', () => {
  it('builds a google search query URL for lat/lng', () => {
    expect(buildGoogleMapsLink(48.2082, 16.3738)).toBe(
      'https://www.google.com/maps/search/?api=1&query=48.2082,16.3738'
    );
  });
});

describe('buildAppleMapsLink', () => {
  it('builds an apple maps URL with lat/lng and optional title query', () => {
    expect(buildAppleMapsLink(48.2082, 16.3738)).toBe('https://maps.apple.com/?ll=48.2082,16.3738');
    expect(buildAppleMapsLink(48.2082, 16.3738, 'Stephansdom')).toBe(
      'https://maps.apple.com/?ll=48.2082,16.3738&q=Stephansdom'
    );
  });
});

describe('buildGenericMapsLink', () => {
  const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

  it('builds maps:// URL for iOS devices', () => {
    expect(buildGenericMapsLink(48.2082, 16.3738, 'Stephansdom', IPHONE_UA)).toBe(
      'maps://?ll=48.2082,16.3738&q=Stephansdom'
    );
  });

  it('builds geo: URI for Android devices and delegates to OS', () => {
    expect(buildGenericMapsLink(48.2082, 16.3738, 'Stephansdom', ANDROID_UA)).toBe(
      'geo:48.2082,16.3738?q=48.2082,16.3738(Stephansdom)'
    );
  });

  it('sanitizes parentheses from title in geo: URI', () => {
    expect(buildGenericMapsLink(48.2082, 16.3738, 'Café Central (Wien)', ANDROID_UA)).toBe(
      'geo:48.2082,16.3738?q=48.2082,16.3738(Caf%C3%A9%20Central%20Wien)'
    );
  });

  it('omits query if no title is given', () => {
    expect(buildGenericMapsLink(48.2082, 16.3738, undefined, ANDROID_UA)).toBe(
      'geo:48.2082,16.3738'
    );
  });

  it('round-trips through parseLatLngFromMapsLink', () => {
    const iosLink = buildGenericMapsLink(48.2082, 16.3738, 'Stephansdom', IPHONE_UA);
    const androidLink = buildGenericMapsLink(48.2082, 16.3738, 'Stephansdom', ANDROID_UA);
    expect(parseLatLngFromMapsLink(iosLink)).toEqual({ lat: 48.2082, lng: 16.3738 });
    expect(parseLatLngFromMapsLink(androidLink)).toEqual({ lat: 48.2082, lng: 16.3738 });
  });
});

describe('buildOsmLink', () => {
  it('builds a link that parseLatLngFromMapsLink can round-trip', () => {
    const link = buildOsmLink(48.2082, 16.3738);
    expect(parseLatLngFromMapsLink(link)).toEqual({ lat: 48.2082, lng: 16.3738 });
  });
});

describe('tilePreviewUrl', () => {
  it('computes the expected OSM tile x/y for a known coordinate/zoom', () => {
    expect(tilePreviewUrl(48.2082, 16.3738, 15)).toBe(
      'https://tile.openstreetmap.org/15/17874/11362.png'
    );
  });
});
