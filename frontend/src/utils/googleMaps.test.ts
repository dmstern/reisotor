import { describe, expect, it } from 'vitest';
import { buildOsmLink, parseLatLngFromMapsLink, tilePreviewUrl } from './googleMaps';

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

  it('returns null when no pattern matches', () => {
    expect(parseLatLngFromMapsLink('https://maps.app.goo.gl/abc123')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(parseLatLngFromMapsLink(null)).toBeNull();
    expect(parseLatLngFromMapsLink(undefined)).toBeNull();
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
