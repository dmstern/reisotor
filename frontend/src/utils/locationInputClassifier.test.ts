import { describe, it, expect } from 'vitest';
import { classifyLocationInput, isMapsLink } from './locationInputClassifier';

describe('locationInputClassifier', () => {
  describe('empty inputs', () => {
    it('classifies null as empty', () => {
      expect(classifyLocationInput(null)).toEqual({ type: 'empty' });
    });

    it('classifies undefined as empty', () => {
      expect(classifyLocationInput(undefined)).toEqual({ type: 'empty' });
    });

    it('classifies empty string as empty', () => {
      expect(classifyLocationInput('')).toEqual({ type: 'empty' });
    });

    it('classifies whitespace-only string as empty', () => {
      expect(classifyLocationInput('   \t\n  ')).toEqual({ type: 'empty' });
    });
  });

  describe('maps links with coordinates', () => {
    it('classifies standard Google Maps @lat,lng link', () => {
      const url = 'https://www.google.com/maps/@48.20820,16.37380,15z';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.url).toBe(url);
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
        expect(result.isShortlink).toBe(false);
      }
    });

    it('classifies Google Maps link with !3d/!4d exact pin', () => {
      const url =
        'https://www.google.com/maps/place/Cafe+Central/@48.2000,16.3000,12z/data=!3m1!4b1!4m6!3m5!1s0x476d07987!8m2!3d48.21040!4d16.36530';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2104, lng: 16.3653 });
        expect(result.isShortlink).toBe(false);
      }
    });

    it('classifies Apple Maps coordinate parameter with comma and %2C', () => {
      const url = 'https://maps.apple.com/?coordinate=48.2082%2C16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
        expect(result.isShortlink).toBe(false);
      }
    });

    it('classifies Apple Maps maps:// schema link', () => {
      const url = 'maps://?ll=48.2082,16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('classifies OpenStreetMap mlat/mlon link', () => {
      const url =
        'https://www.openstreetmap.org/?mlat=48.20820&mlon=16.37380#map=16/48.2082/16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
        expect(result.isShortlink).toBe(false);
      }
    });

    it('classifies OpenStreetMap hash link', () => {
      const url = 'https://www.openstreetmap.org/#map=16/48.2082/16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('classifies RFC 5870 / Android geo: URI', () => {
      const uri = 'geo:48.21040,16.36530';
      const result = classifyLocationInput(uri);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2104, lng: 16.3653 });
        expect(result.isShortlink).toBe(false);
      }
    });

    it('trims whitespace around maps link', () => {
      const url = '  https://www.google.com/maps/@48.20820,16.37380,15z \n ';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.url).toBe('https://www.google.com/maps/@48.20820,16.37380,15z');
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });
  });

  describe('maps shortlinks and search links without coordinates', () => {
    it('classifies Google Maps shortlinks as maps_link with isShortlink=true', () => {
      const url = 'https://maps.app.goo.gl/shortlink123';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.url).toBe(url);
        expect(result.coords).toBeNull();
        expect(result.isShortlink).toBe(true);
      }
    });

    it('classifies goo.gl/maps shortlinks as maps_link with isShortlink=true', () => {
      const url = 'https://goo.gl/maps/abc12345';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toBeNull();
        expect(result.isShortlink).toBe(true);
      }
    });

    it('classifies general Google Maps search link as maps_link without coords', () => {
      const url = 'https://www.google.com/maps/search/Cafe+Central';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toBeNull();
        expect(result.isShortlink).toBe(false);
      }
    });
  });

  describe('free-text search queries', () => {
    it('classifies POI name as query', () => {
      const query = 'Café Central';
      expect(classifyLocationInput(query)).toEqual({
        type: 'query',
        query: 'Café Central',
      });
    });

    it('classifies street address as query', () => {
      const query = 'Stephansplatz 3, 1010 Wien, Österreich';
      expect(classifyLocationInput(query)).toEqual({
        type: 'query',
        query,
      });
    });

    it('classifies non-maps URL as query', () => {
      const url = 'https://example.com/not-a-map/page';
      expect(classifyLocationInput(url)).toEqual({
        type: 'query',
        query: url,
      });
    });

    it('classifies input with special characters and HTML tags as query', () => {
      const query = 'München <script>alert(1)</script>';
      expect(classifyLocationInput(query)).toEqual({
        type: 'query',
        query,
      });
    });
  });

  describe('isMapsLink helper', () => {
    it('returns true for maps links and geo URIs', () => {
      expect(isMapsLink('https://www.google.com/maps/@48.2,16.3,15z')).toBe(true);
      expect(isMapsLink('https://maps.app.goo.gl/xyz')).toBe(true);
      expect(isMapsLink('geo:48.2,16.3')).toBe(true);
      expect(isMapsLink('maps://?ll=48.2,16.3')).toBe(true);
      expect(isMapsLink('https://www.openstreetmap.org/#map=16/48.2/16.3')).toBe(true);
    });

    it('returns false for plain text and non-maps URLs', () => {
      expect(isMapsLink('Café Central')).toBe(false);
      expect(isMapsLink('Herrengasse 14')).toBe(false);
      expect(isMapsLink('https://example.com/something')).toBe(false);
      expect(isMapsLink('')).toBe(false);
      expect(isMapsLink(null)).toBe(false);
    });
  });
});
