import { describe, expect, it } from 'vitest';
import { parseLatLngFromText, tilePreviewUrl } from '../../src/utils/mapsLink.js';

describe('parseLatLngFromText', () => {
  it('prefers !3d/!4d over a leading @lat,lng (regression: !3d/!4d is the real pin, @ is just the map viewport)', () => {
    const url = 'https://www.google.com/maps/place/@40.0,10.0,15z/data=!3d48.2082!4d16.3738';
    expect(parseLatLngFromText(url)).toEqual({ lat: 48.2082, lng: 16.3738 });
  });

  it('parses a plain @lat,lng URL', () => {
    expect(parseLatLngFromText('https://www.google.com/maps/@48.2082,16.3738,15z')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses Apple Maps coordinate= param', () => {
    expect(parseLatLngFromText('https://maps.apple.com/?coordinate=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses a %2C-encoded comma in coordinate=', () => {
    expect(parseLatLngFromText('https://maps.apple.com/?coordinate=48.2082%2C16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses ?ll= and ?q= variants', () => {
    expect(parseLatLngFromText('https://maps.example/?ll=48.2082,16.3738')).toEqual({ lat: 48.2082, lng: 16.3738 });
    expect(parseLatLngFromText('https://maps.example/?q=48.2082,16.3738')).toEqual({ lat: 48.2082, lng: 16.3738 });
  });

  it('falls back to the raw text on malformed percent-encoding instead of throwing', () => {
    expect(() => parseLatLngFromText('https://maps.example/?q=48.2082,16.3738%')).not.toThrow();
    expect(parseLatLngFromText('https://maps.example/?q=48.2082,16.3738%')).toEqual({ lat: 48.2082, lng: 16.3738 });
  });

  it('returns null when no pattern matches', () => {
    expect(parseLatLngFromText('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseLatLngFromText('not a maps link at all')).toBeNull();
  });
});

describe('tilePreviewUrl', () => {
  it('computes the expected OSM tile x/y for a known coordinate/zoom', () => {
    expect(tilePreviewUrl(48.2082, 16.3738, 15)).toBe('https://tile.openstreetmap.org/15/17874/11362.png');
  });
});
