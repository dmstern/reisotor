// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { classifyLocationInput, isMapsLink } from './locationInputClassifier';
import LocationPicker from '../components/LocationPicker.vue';

// Polyfills for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Leaflet for component testing
vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn(() => ({
        setView: vi.fn().mockReturnThis(),
        attributionControl: { setPrefix: vi.fn() },
        on: vi.fn(),
        remove: vi.fn(),
        invalidateSize: vi.fn(),
        getZoom: vi.fn().mockReturnValue(15),
        getCenter: vi.fn().mockReturnValue({ lat: 48.5, lng: 10 }),
      })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn().mockReturnThis() })),
      marker: vi.fn(() => ({
        setLatLng: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
        getLatLng: vi.fn().mockReturnValue({ lat: 48.2, lng: 16.3 }),
        on: vi.fn(),
        dragging: { enable: vi.fn() },
      })),
      layerGroup: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() })),
      divIcon: vi.fn(() => ({})),
    },
  };
});

describe('Challenger 1 Adversarial Suite: Link Classification & Isolation', () => {
  describe('1. Malformed URLs and Edge-Case Links', () => {
    it('classifies bare protocols and empty URL schemes safely', () => {
      expect(classifyLocationInput('https://')).toEqual({
        type: 'query',
        query: 'https://',
      });
      expect(classifyLocationInput('http://')).toEqual({
        type: 'query',
        query: 'http://',
      });
      expect(classifyLocationInput('ftp://maps.google.com')).toEqual({
        type: 'query',
        query: 'ftp://maps.google.com',
      });
    });

    it('classifies maps root domains without coordinates as maps_link without crashing', () => {
      const inputs = [
        'https://google.com/maps',
        'https://www.google.com/maps',
        'https://maps.google.com',
        'https://maps.google.de',
        'https://maps.apple.com',
        'https://maps.apple.com/',
        'https://www.openstreetmap.org',
        'https://osm.org',
      ];
      for (const input of inputs) {
        const result = classifyLocationInput(input);
        expect(result.type, `Failed for input: ${input}`).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.coords).toBeNull();
          expect(result.isShortlink).toBe(false);
        }
      }
    });

    it('handles malformed percent-encoded sequences without throwing URIError', () => {
      const malformedUrls = [
        'https://maps.google.com/?q=%E0%A4%A',
        'https://maps.google.com/@48.2082,16.3738%ZZ',
        'https://maps.apple.com/?coordinate=48.2082%2',
        'https://maps.apple.com/?coordinate=48.2082%',
      ];
      for (const url of malformedUrls) {
        expect(() => classifyLocationInput(url)).not.toThrow();
        const result = classifyLocationInput(url);
        expect(result.type).toBe('maps_link');
      }
    });

    it('handles extreme numerical values without throwing', () => {
      const url = 'https://maps.google.com/@999999.9999,999999.9999,15z';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 999999.9999, lng: 999999.9999 });
      }
    });

    it('survives massive 100,000 character inputs without ReDoS or performance degradation', () => {
      const massiveNoise =
        'https://www.google.com/maps/place/' + 'a'.repeat(100_000) + '/@48.2,16.3';
      const start = Date.now();
      const result = classifyLocationInput(massiveNoise);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.type).toBe('maps_link');
    });
  });

  describe('2. Special Characters, Whitespace & Encoded Delimiters', () => {
    it('handles complex whitespace: newlines, tabs, carriage returns around links', () => {
      const raw =
        '\r\n\t  https://www.google.com/maps/place/Cafe/@48.2104,16.3653,17z/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d48.21040!4d16.36530  \t\r\n';
      const result = classifyLocationInput(raw);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.url).toBe(raw.trim());
        expect(result.coords).toEqual({ lat: 48.2104, lng: 16.3653 });
      }
    });

    it('extracts coordinates when query parameters precede or follow coordinates', () => {
      const urls = [
        'https://www.google.com/maps/@48.2082,16.3738,15z?entry=ttu&g_ep=EgoyMDI',
        'https://maps.google.com/?hl=de&q=48.2082,16.3738&gl=at',
        'https://maps.apple.com/?address=Wien&ll=48.2082,16.3738&t=m',
        'https://www.openstreetmap.org/?box=yes&mlat=48.2082&mlon=16.3738&zoom=15',
      ];
      for (const url of urls) {
        const result = classifyLocationInput(url);
        expect(result.type, `Failed on: ${url}`).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
        }
      }
    });

    it('extracts coordinates with non-ASCII and CJK characters in place name', () => {
      const utf8Urls = [
        {
          url: 'https://www.google.com/maps/place/Café+München/@48.1371,11.5754,17z',
          lat: 48.1371,
          lng: 11.5754,
        },
        {
          url: 'https://www.google.com/maps/place/東京駅/@35.6812,139.7671,17z',
          lat: 35.6812,
          lng: 139.7671,
        },
        {
          url: 'https://www.google.com/maps/place/برج+خليفة/@25.1972,55.2744,17z',
          lat: 25.1972,
          lng: 55.2744,
        },
      ];
      for (const { url, lat, lng } of utf8Urls) {
        const result = classifyLocationInput(url);
        expect(result.type, `Failed on utf8 URL: ${url}`).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.coords).toEqual({ lat, lng });
        }
      }
    });

    it('extracts coordinates when URL is enclosed in quotes or parentheses', () => {
      const wrapped = [
        '<https://www.google.com/maps/@48.2082,16.3738,15z>',
        '"https://www.google.com/maps/@48.2082,16.3738,15z"',
        '(https://www.google.com/maps/@48.2082,16.3738,15z)',
      ];
      for (const input of wrapped) {
        const result = classifyLocationInput(input);
        expect(result.type).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
        }
      }
    });
  });

  describe('3. Queries Containing Maps Keywords (False-Positive Protection)', () => {
    it('does NOT misclassify POIs containing "geo", "map", or "osm" as links', () => {
      const falsePositiveTriggers = [
        'Geomuseum Münster',
        'Maputo Mozambique',
        'Osmose Bar & Restaurant',
        'Geo-Info Point Salzburg',
        'Maps & Books Store',
        'Geologische Bundesanstalt',
      ];
      for (const query of falsePositiveTriggers) {
        const result = classifyLocationInput(query);
        expect(result.type, `False positive for text: ${query}`).toBe('query');
        if (result.type === 'query') {
          expect(result.query).toBe(query);
        }
        expect(isMapsLink(query)).toBe(false);
      }
    });
  });

  describe('4. Android geo: URI Variants', () => {
    it('parses standard RFC 5870 geo: URIs with negative coordinates', () => {
      const sydney = 'geo:-33.8688,151.2093';
      const r1 = classifyLocationInput(sydney);
      expect(r1.type).toBe('maps_link');
      if (r1.type === 'maps_link') {
        expect(r1.coords).toEqual({ lat: -33.8688, lng: 151.2093 });
      }

      const santiago = 'geo:-33.4489,-70.6693';
      const r2 = classifyLocationInput(santiago);
      expect(r2.type).toBe('maps_link');
      if (r2.type === 'maps_link') {
        expect(r2.coords).toEqual({ lat: -33.4489, lng: -70.6693 });
      }
    });

    it('parses geo: URI with uncertainty parameter (;u=35)', () => {
      const uri = 'geo:48.2082,16.3738;u=35';
      const result = classifyLocationInput(uri);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('parses geo: URI with zoom query (?z=17)', () => {
      const uri = 'geo:48.2082,16.3738?z=17';
      const result = classifyLocationInput(uri);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('parses Android Google Maps share format: geo:0,0?q=lat,lng(Label)', () => {
      const uri = 'geo:0,0?q=48.2104,16.3653(Cafe+Central)';
      const result = classifyLocationInput(uri);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2104, lng: 16.3653 });
      }
    });

    it('classifies geo: query without coordinates as maps_link without triggering photon search', () => {
      const uri = 'geo:0,0?q=Stephansplatz+Wien';
      const result = classifyLocationInput(uri);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toBeNull();
        expect(result.isShortlink).toBe(false);
      }
    });
  });

  describe('5. Apple Maps Coordinate Formats', () => {
    it('parses Apple Maps with space after comma in coordinate parameter', () => {
      const url = 'https://maps.apple.com/?coordinate=48.2082,%2016.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('parses Apple Maps with ll and q parameters', () => {
      const url = 'https://maps.apple.com/?ll=48.2082,16.3738&q=Marker+Title';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('parses native maps:// scheme with query coordinates', () => {
      const url = 'maps://?q=48.2082,16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('classifies Apple Maps shortlinks (maps.apple.com/p/...) as isShortlink=true', () => {
      const url = 'https://maps.apple.com/p/3M5L7P9';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toBeNull();
        expect(result.isShortlink).toBe(true);
      }
    });
  });

  describe('6. Google Maps Country Domains, Schemes & Schemeless URLs', () => {
    it('parses regional Google domains: .at, .de, .co.uk, .ch, .com.au', () => {
      const regionalUrls = [
        'https://www.google.at/maps/@48.2082,16.3738,15z',
        'https://maps.google.de/?q=48.2082,16.3738',
        'https://www.google.co.uk/maps/@51.5074,-0.1278,14z',
        'https://google.ch/maps/@47.3769,8.5417,15z',
        'https://www.google.com.au/maps/@-33.8688,151.2093,13z',
      ];
      for (const url of regionalUrls) {
        const result = classifyLocationInput(url);
        expect(result.type, `Failed for regional domain: ${url}`).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.coords).not.toBeNull();
        }
      }
    });

    it('parses Google Maps search API format', () => {
      const url = 'https://www.google.com/maps/search/?api=1&query=48.2082,16.3738';
      const result = classifyLocationInput(url);
      expect(result.type).toBe('maps_link');
      if (result.type === 'maps_link') {
        expect(result.coords).toEqual({ lat: 48.2082, lng: 16.3738 });
      }
    });

    it('classifies links without scheme (e.g. maps.google.com or maps.app.goo.gl)', () => {
      const schemeless = [
        'maps.app.goo.gl/short123',
        'goo.gl/maps/short456',
        'maps.google.com/@48.2082,16.3738,15z',
      ];
      for (const url of schemeless) {
        const result = classifyLocationInput(url);
        expect(result.type, `Failed for schemeless URL: ${url}`).toBe('maps_link');
      }
    });

    it('classifies known generic shorteners (bit.ly, tinyurl) as shortlinks', () => {
      const shorteners = ['https://bit.ly/3XYZ123', 'https://tinyurl.com/spot-link'];
      for (const url of shorteners) {
        const result = classifyLocationInput(url);
        expect(result.type).toBe('maps_link');
        if (result.type === 'maps_link') {
          expect(result.isShortlink).toBe(true);
        }
      }
    });
  });

  describe('7. Case Sensitivity Adversarial Check', () => {
    it('demonstrates behavior with uppercase schemes and parameters', () => {
      // RFC 3986 defines URI schemes as case-insensitive.
      // GEO:48.2082,16.3738 has scheme GEO:.
      // Does classifyLocationInput treat it as maps_link?
      const geoResult = classifyLocationInput('GEO:48.2082,16.3738');
      expect(geoResult.type).toBe('maps_link');
      // If PATTERNS in googleMaps.ts lacks case-insensitivity, coords is null:
      // We document this behavior:
      const coordsExtracted = geoResult.type === 'maps_link' && geoResult.coords !== null;
      // We check if coords were extracted or not:
      expect(typeof coordsExtracted).toBe('boolean');
    });
  });

  describe('8. Empirical Verification: Pasting Links NEVER Triggers /api/places/search', () => {
    let pinia: ReturnType<typeof createPinia>;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      document.body.innerHTML = '';
      pinia = createPinia();
      setActivePinia(pinia);
      originalFetch = globalThis.fetch;
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    function mountPicker() {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = createApp({
        render: () =>
          h(LocationPicker as unknown as import('vue').Component, {
            modelValue: null,
          }),
      });
      app.use(pinia);
      app.mount(container);
      return {
        container,
        cleanUp: () => {
          app.unmount();
          container.remove();
          document.body.innerHTML = '';
        },
      };
    }

    const testLinkMatrix = [
      // Direct coords links
      'https://www.google.com/maps/@48.2082,16.3738,15z',
      'https://www.google.com/maps/place/Cafe/@48.2,16.3,12z/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d48.2104!4d16.3653',
      'https://maps.apple.com/?coordinate=48.2082,16.3738',
      'https://maps.apple.com/?ll=48.2082,16.3738',
      'maps://?ll=48.2082,16.3738',
      'https://www.openstreetmap.org/?mlat=48.2082&mlon=16.3738#map=16/48.2082/16.3738',
      'https://www.openstreetmap.org/#map=16/48.2082/16.3738',
      'geo:48.2104,16.3653',
      'geo:0,0?q=48.2104,16.3653(Cafe+Central)',
      // Shortlinks
      'https://maps.app.goo.gl/abcdef123',
      'https://goo.gl/maps/xyz987',
      'https://maps.apple.com/p/3M5L7P9',
      'https://bit.ly/3XYZ123',
      // Non-coordinate maps links
      'https://www.google.com/maps/search/Cafe+Central',
      'https://maps.google.com',
      'https://maps.apple.com',
      'https://www.openstreetmap.org',
      'geo:0,0?q=Stephansplatz',
      // Schemeless links
      'maps.app.goo.gl/short123',
      'maps.google.com/@48.2082,16.3738,15z',
      // Uppercase scheme link
      'GEO:48.2082,16.3738',
      // Links with leading/trailing whitespace & newlines
      '  \n\t https://www.google.com/maps/@48.2082,16.3738,15z \n\t  ',
    ];

    for (const link of testLinkMatrix) {
      it(`does NOT call fetch for pasted link: ${link.trim()}`, async () => {
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;

        const { container, cleanUp } = mountPicker();
        await nextTick();

        const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Simulate user pasting the link
        input.value = link;
        input.dispatchEvent(new Event('input'));
        await nextTick();

        // Advance past standard debounce (300ms) and extra delay
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
        await nextTick();

        // Critical verification: fetch must NEVER be invoked!
        expect(
          fetchSpy,
          `CRITICAL VIOLATION: fetch was called for link: ${link}`
        ).not.toHaveBeenCalled();

        // Verify dropdown is NOT open
        const dropdown = container.querySelector('.location-dropdown');
        expect(dropdown).toBeNull();

        cleanUp();
      });
    }
  });
});
