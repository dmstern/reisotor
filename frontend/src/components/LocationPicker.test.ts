// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// Polyfills
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

interface MockMap {
  setView: ReturnType<typeof vi.fn>;
  attributionControl: { setPrefix: ReturnType<typeof vi.fn> };
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: ReturnType<typeof vi.fn>;
  invalidateSize: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
}

interface MockMarker {
  setLatLng: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getLatLng: ReturnType<typeof vi.fn>;
  on: (event: string, handler: () => void) => void;
  dragging: { enable: ReturnType<typeof vi.fn> };
}

// Mock Leaflet
let mockMapInstance: MockMap | null = null;
let mockMarkerInstance: MockMarker | null = null;
const mapClickHandlers: ((e: { latlng: { lat: number; lng: number } }) => void)[] = [];
let markerDragEndHandler: (() => void) | null = null;

vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn((_el: HTMLElement, _opts: unknown) => {
        mockMapInstance = {
          setView: vi.fn().mockReturnThis(),
          attributionControl: { setPrefix: vi.fn() },
          on: vi.fn(
            (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => {
              if (event === 'click') mapClickHandlers.push(handler);
            }
          ),
          remove: vi.fn(),
          invalidateSize: vi.fn(),
          getZoom: vi.fn().mockReturnValue(15),
          getCenter: vi.fn().mockReturnValue({ lat: 48.5, lng: 10 }),
        };
        return mockMapInstance;
      }),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
      })),
      marker: vi.fn((coords: [number, number], _opts?: unknown) => {
        mockMarkerInstance = {
          setLatLng: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          remove: vi.fn(),
          getLatLng: vi.fn().mockReturnValue({ lat: coords[0], lng: coords[1] }),
          on: vi.fn((event: string, handler: () => void) => {
            if (event === 'dragend') markerDragEndHandler = handler;
          }),
          dragging: { enable: vi.fn() },
        };
        return mockMarkerInstance;
      }),
      layerGroup: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        clearLayers: vi.fn(),
      })),
      divIcon: vi.fn(() => ({})),
    },
  };
});

import LocationPicker, { type PlaceSearchResult } from './LocationPicker.vue';

describe('LocationPicker', () => {
  let pinia: ReturnType<typeof createPinia>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    mapClickHandlers.length = 0;
    markerDragEndHandler = null;
    mockMapInstance = null;
    mockMarkerInstance = null;
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mountPicker(
    props: Record<string, unknown> = {},
    listeners: Record<string, unknown> = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(LocationPicker as unknown as import('vue').Component, {
          ...props,
          ...listeners,
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

  describe('Input Classification & Maps Link Detection', () => {
    it('detects standard Google Maps link and extracts coordinates without network query', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const updateModelValue = vi.fn();
      const updateMapsLink = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue, 'onUpdate:mapsLink': updateMapsLink }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      expect(input).toBeTruthy();

      input.value = 'https://www.google.com/maps/@48.20820,16.37380,15z';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      // Advancing timer should not trigger any fetch because it's recognized as maps_link
      vi.advanceTimersByTime(500);

      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2082, lng: 16.3738 });
      expect(updateMapsLink).toHaveBeenCalledWith(
        'https://www.google.com/maps/@48.20820,16.37380,15z'
      );
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });

    it('detects Google Maps !3d/!4d exact pin link without calling places API', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value =
        'https://www.google.com/maps/place/Cafe+Central/@48.2000,16.3000,12z/data=!3m1!4b1!4m6!3m5!1s0x476d07987!8m2!3d48.21040!4d16.36530';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      vi.advanceTimersByTime(500);

      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2104, lng: 16.3653 });
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });

    it('detects Apple Maps coordinate link without calling places API', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'https://maps.apple.com/?coordinate=48.2082%2C16.3738';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2082, lng: 16.3738 });
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });

    it('detects OpenStreetMap mlat/mlon link without calling places API', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value =
        'https://www.openstreetmap.org/?mlat=48.20820&mlon=16.37380#map=16/48.2082/16.3738';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2082, lng: 16.3738 });
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });

    it('detects Android geo: URI without calling places API', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'geo:48.21040,16.36530';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2104, lng: 16.3653 });
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });

    it('recognizes maps shortlink and shows notice without making geocoding request', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateMapsLink = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:mapsLink': updateMapsLink }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'https://maps.app.goo.gl/shortlink123';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      vi.advanceTimersByTime(500);

      expect(updateMapsLink).toHaveBeenCalledWith('https://maps.app.goo.gl/shortlink123');
      expect(fetchSpy).not.toHaveBeenCalled();

      const notice = container.querySelector('.hint.info');
      expect(notice).toBeTruthy();
      expect(notice?.textContent).toContain('Kurzlink');

      cleanUp();
    });

    it('does not trigger search for whitespace or single-character input', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;

      input.value = ' ';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(500);
      expect(fetchSpy).not.toHaveBeenCalled();

      input.value = 'C';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(500);
      expect(fetchSpy).not.toHaveBeenCalled();

      cleanUp();
    });
  });

  describe('Freitext Search & Autocomplete', () => {
    it('debounces search by 300ms and calls /api/places/search', async () => {
      const mockResults: PlaceSearchResult[] = [
        {
          name: 'Café Central',
          formatted_address: 'Herrengasse 14, 1010 Wien, Österreich',
          lat: 48.2104,
          lng: 16.3653,
          category: 'Café',
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResults,
      });
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Café Central';
      input.dispatchEvent(new Event('input'));

      // Before 300ms, fetch should not be called yet
      vi.advanceTimersByTime(200);
      expect(fetchSpy).not.toHaveBeenCalled();

      // At 300ms, fetch is executed
      vi.advanceTimersByTime(150);
      await nextTick();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/places/search?q=Caf%C3%A9%20Central'),
        expect.any(Object)
      );

      // Results rendered in dropdown
      await vi.runAllTimersAsync();
      await nextTick();

      const dropdown = container.querySelector('.location-dropdown');
      expect(dropdown).toBeTruthy();
      const option = container.querySelector('.location-result-item');
      expect(option?.textContent).toContain('Café Central');
      expect(option?.textContent).toContain('Herrengasse 14');
      expect(option?.textContent).toContain('Café');

      cleanUp();
    });

    it('forwards proximityBias coordinates as lat & lng query parameters', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({
        modelValue: null,
        proximityBias: { lat: 48.2082, lng: 16.3738 },
      });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Stephansdom';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await nextTick();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('lat=48.2082&lng=16.3738'),
        expect.any(Object)
      );

      cleanUp();
    });

    it('selecting a dropdown item updates coordinates, address, and emits select', async () => {
      const mockPlace: PlaceSearchResult = {
        name: 'Hotel Excelsior',
        formatted_address: 'Via Vittorio Veneto 125, 00187 Rom, Italien',
        lat: 41.9075,
        lng: 12.4914,
        category: 'Unterkunft',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockPlace],
      });

      const onSelect = vi.fn();
      const onUpdateModelValue = vi.fn();
      const onUpdateAddress = vi.fn();
      const onUpdateMapsLink = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        {
          onSelect,
          'onUpdate:modelValue': onUpdateModelValue,
          'onUpdate:address': onUpdateAddress,
          'onUpdate:mapsLink': onUpdateMapsLink,
        }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Hotel Excelsior';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      const option = container.querySelector('.location-result-item') as HTMLElement;
      expect(option).toBeTruthy();

      option.click();
      await nextTick();

      expect(onSelect).toHaveBeenCalledWith(mockPlace);
      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 41.9075, lng: 12.4914 });
      expect(onUpdateAddress).toHaveBeenCalledWith('Via Vittorio Veneto 125, 00187 Rom, Italien');
      expect(onUpdateMapsLink).toHaveBeenCalledWith(
        expect.stringContaining('https://www.google.com/maps/search/?api=1&query=41.9075,12.4914')
      );
      expect(input.value).toBe('');

      cleanUp();
    });

    it('handles keyboard navigation: ArrowDown, ArrowUp, Enter, and Escape', async () => {
      const mockPlaces: PlaceSearchResult[] = [
        {
          name: 'First Place',
          formatted_address: 'Address 1',
          lat: 10,
          lng: 20,
        },
        {
          name: 'Second Place',
          formatted_address: 'Address 2',
          lat: 30,
          lng: 40,
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPlaces,
      });

      const onSelect = vi.fn();
      const onUpdateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { onSelect, 'onUpdate:modelValue': onUpdateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Place';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      // ArrowDown to first
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextTick();
      let activeItem = container.querySelector('.location-result-item.is-active');
      expect(activeItem?.textContent).toContain('First Place');

      // ArrowDown to second
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextTick();
      activeItem = container.querySelector('.location-result-item.is-active');
      expect(activeItem?.textContent).toContain('Second Place');

      // Enter selects second
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await nextTick();
      expect(onSelect).toHaveBeenCalledWith(mockPlaces[1]);
      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 30, lng: 40 });

      cleanUp();
    });

    it('handles Escape to close dropdown without modifying state', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: 'Test', formatted_address: 'Addr', lat: 1, lng: 2 }],
      });

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Test';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      expect(container.querySelector('.location-dropdown')).toBeTruthy();

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await nextTick();
      vi.advanceTimersByTime(300);
      await nextTick();

      expect(container.querySelector('.location-dropdown')).toBeNull();

      cleanUp();
    });

    it('handles upstream 500 error gracefully without unhandled exceptions', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Geocoding Error' }),
      });

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Café Central';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      // UI remains intact, no unhandled exception
      expect(container.querySelector('.location-picker')).toBeTruthy();

      cleanUp();
    });
  });

  describe('Status Card & Clear Action', () => {
    it('renders status card with check icon and details when modelValue is present', async () => {
      const { container, cleanUp } = mountPicker({
        modelValue: { lat: 48.2082, lng: 16.3738 },
        address: 'Stephansplatz 3, Wien',
      });
      await nextTick();

      const statusCard = container.querySelector('[data-testid="location-status"]');
      expect(statusCard).toBeTruthy();
      expect(statusCard?.querySelector('.status-check-icon')).toBeTruthy();
      expect(statusCard?.textContent).toContain('48.2082');
      expect(statusCard?.textContent).toContain('16.3738');
      expect(statusCard?.textContent).toContain('Stephansplatz 3, Wien');

      const clearBtn = container.querySelector('button.clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn?.textContent).toContain('Entfernen');

      cleanUp();
    });

    it('hides status header when hideStatusHeader is true', async () => {
      const { container, cleanUp } = mountPicker({
        modelValue: { lat: 48.2082, lng: 16.3738 },
        hideStatusHeader: true,
      });
      await nextTick();

      const header = container.querySelector('.status-header');
      expect(header).toBeNull();
      cleanUp();
    });

    it('clicking "Entfernen" button emits null to modelValue, empties address & link, and emits clear', async () => {
      const onUpdateModelValue = vi.fn();
      const onUpdateAddress = vi.fn();
      const onUpdateMapsLink = vi.fn();
      const onClear = vi.fn();

      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2082, lng: 16.3738 },
          address: 'Wien',
          mapsLink: 'https://maps.google.com',
        },
        {
          'onUpdate:modelValue': onUpdateModelValue,
          'onUpdate:address': onUpdateAddress,
          'onUpdate:mapsLink': onUpdateMapsLink,
          onClear,
        }
      );
      await nextTick();

      const clearBtn = container.querySelector('button.clear-btn') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();

      clearBtn.click();
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith(null);
      expect(onUpdateAddress).toHaveBeenCalledWith('');
      expect(onUpdateMapsLink).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalled();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      expect(input.value).toBe('');

      cleanUp();
    });

    it('renders orange modified styling and "Standort geändert" badge when modified is true', async () => {
      const { container, cleanUp } = mountPicker({
        modelValue: { lat: 48.2082, lng: 16.3738 },
        modified: true,
      });
      await nextTick();

      const controlBox = container.querySelector('.location-control-box');
      expect(controlBox?.classList.contains('is-modified')).toBe(true);

      const checkCircle = container.querySelector('.status-check-circle');
      expect(checkCircle?.classList.contains('is-modified')).toBe(true);
      expect(checkCircle?.getAttribute('title')).toBe('Standort geändert');

      const badge = container.querySelector('.status-badge-modified');
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe('Standort geändert');

      const btn = container.querySelector('button.clear-btn') as HTMLButtonElement;
      expect(btn?.textContent).toContain('Zurücksetzen');

      cleanUp();
    });

    it('clicking "Zurücksetzen" button when modified emits reset event without emitting clear or update:modelValue', async () => {
      const onReset = vi.fn();
      const onClear = vi.fn();
      const onUpdateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2082, lng: 16.3738 },
          address: 'Wien',
          modified: true,
        },
        {
          onReset,
          onClear,
          'onUpdate:modelValue': onUpdateModelValue,
        }
      );
      await nextTick();

      const btn = container.querySelector('button.clear-btn') as HTMLButtonElement;
      expect(btn?.textContent).toContain('Zurücksetzen');

      btn.click();
      await nextTick();

      expect(onReset).toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
      expect(onUpdateModelValue).not.toHaveBeenCalled();

      cleanUp();
    });
  });

  describe('Mini-Map Leaflet Sync & Map Interaction', () => {
    it('initializes Leaflet map on mount', async () => {
      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      expect(container.querySelector('.location-picker-map')).toBeTruthy();
      expect(mockMapInstance).toBeTruthy();

      cleanUp();
    });

    it('clicking on map moves pin and emits update:modelValue with new coordinates', async () => {
      const onUpdateModelValue = vi.fn();
      const onUpdateMapsLink = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': onUpdateModelValue, 'onUpdate:mapsLink': onUpdateMapsLink }
      );
      await nextTick();

      expect(mapClickHandlers.length).toBeGreaterThan(0);
      const clickHandler = mapClickHandlers[0];

      // Simulate Leaflet map click
      clickHandler({ latlng: { lat: 43.7696, lng: 11.2558 } });
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 43.7696, lng: 11.2558 });
      expect(onUpdateMapsLink).toHaveBeenCalledWith(expect.stringContaining('43.7696'));

      cleanUp();
    });

    it('clicking on map performs reverse geocoding and updates address when found', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          formatted_address: 'Stephansplatz 1, 1010 Wien',
        }),
      });
      globalThis.fetch = fetchSpy;

      const onUpdateModelValue = vi.fn();
      const onUpdateAddress = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: null, address: 'Alte Adresse' },
        { 'onUpdate:modelValue': onUpdateModelValue, 'onUpdate:address': onUpdateAddress }
      );
      await nextTick();

      const clickHandler = mapClickHandlers[0];
      clickHandler({ latlng: { lat: 48.2085, lng: 16.3731 } });
      await nextTick();
      await vi.runAllTimersAsync();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/places/reverse?lat=48.2085&lng=16.3731'),
        expect.any(Object)
      );
      expect(onUpdateAddress).toHaveBeenCalledWith('Stephansplatz 1, 1010 Wien');

      cleanUp();
    });

    it('clicking on map clears address when reverse geocode finds no address', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => null,
      });
      globalThis.fetch = fetchSpy;

      const onUpdateModelValue = vi.fn();
      const onUpdateAddress = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: { lat: 48.2082, lng: 16.3738 }, address: 'Alte Adresse 123' },
        { 'onUpdate:modelValue': onUpdateModelValue, 'onUpdate:address': onUpdateAddress }
      );
      await nextTick();

      const clickHandler = mapClickHandlers[0];
      clickHandler({ latlng: { lat: 0, lng: 0 } });
      await nextTick();
      await vi.runAllTimersAsync();

      expect(onUpdateAddress).toHaveBeenCalledWith('');

      cleanUp();
    });

    it('dragging marker updates coordinates and emits update:modelValue', async () => {
      const onUpdateModelValue = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: { lat: 48.2082, lng: 16.3738 } },
        { 'onUpdate:modelValue': onUpdateModelValue }
      );
      await nextTick();

      expect(markerDragEndHandler).toBeTruthy();

      // Mock new position on marker
      mockMarkerInstance!.getLatLng = vi.fn().mockReturnValue({ lat: 48.21, lng: 16.38 });
      markerDragEndHandler!();
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 48.21, lng: 16.38 });

      cleanUp();
    });

    it('clicking locate-btn invokes navigator.geolocation and updates location', async () => {
      const getCurrentPositionMock = vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 48.2082,
            longitude: 16.3738,
          },
        });
      });

      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: getCurrentPositionMock,
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
      });

      const onUpdateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': onUpdateModelValue }
      );
      await nextTick();

      const locateBtn = container.querySelector('.locate-btn') as HTMLButtonElement;
      expect(locateBtn).toBeTruthy();

      locateBtn.click();
      await nextTick();

      expect(getCurrentPositionMock).toHaveBeenCalled();
      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 48.2082, lng: 16.3738 });

      cleanUp();
    });
  });

  describe('Unified Title & Address Editing', () => {
    it('does not mutate title when typing in the search input field', async () => {
      const updateTitle = vi.fn();
      const { container, cleanUp } = mountPicker(
        { modelValue: null, title: 'Mein Spot' },
        { 'onUpdate:title': updateTitle }
      );
      await nextTick();

      const searchInput = container.querySelector(
        'input.location-picker-input'
      ) as HTMLInputElement;
      searchInput.value = 'Neuer Suchbegriff';
      searchInput.dispatchEvent(new Event('input'));
      await nextTick();

      expect(updateTitle).not.toHaveBeenCalled();
      cleanUp();
    });

    it('emits update:title when typing in the spot title input field', async () => {
      const updateTitle = vi.fn();
      const { container, cleanUp } = mountPicker(
        { modelValue: null, title: '' },
        { 'onUpdate:title': updateTitle }
      );
      await nextTick();

      const titleInput = container.querySelector(
        '.status-title-row [data-testid="spot-title-input"]'
      ) as HTMLInputElement;
      expect(titleInput).toBeTruthy();

      titleInput.value = 'Mein Spot';
      titleInput.dispatchEvent(new Event('input'));
      await nextTick();

      expect(updateTitle).toHaveBeenCalledWith('Mein Spot');
      cleanUp();
    });

    it('emits update:title with place name when selecting a search result', async () => {
      const updateTitle = vi.fn();
      const updateAddress = vi.fn();
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null, title: '' },
        {
          'onUpdate:title': updateTitle,
          'onUpdate:address': updateAddress,
          'onUpdate:modelValue': updateModelValue,
        }
      );
      await nextTick();

      const dummyPlace: PlaceSearchResult = {
        name: 'Café Central',
        formatted_address: 'Herrengasse 14, 1010 Wien',
        lat: 48.2104,
        lng: 16.3653,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [dummyPlace],
      });

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Central';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      const item = container.querySelector('.location-result-item') as HTMLElement;
      expect(item).toBeTruthy();
      item.click();
      await nextTick();

      expect(updateTitle).toHaveBeenCalledWith('Café Central');
      expect(updateAddress).toHaveBeenCalledWith('Herrengasse 14, 1010 Wien');
      expect(updateModelValue).toHaveBeenCalledWith({ lat: 48.2104, lng: 16.3653 });
      cleanUp();
    });

    it('clearing location resets coordinates and address but preserves custom spot title', async () => {
      const updateModelValue = vi.fn();
      const updateAddress = vi.fn();
      const updateTitle = vi.fn();
      const onClear = vi.fn();

      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2104, lng: 16.3653 },
          title: 'Mein Spot',
          address: 'Herrengasse 14',
        },
        {
          'onUpdate:modelValue': updateModelValue,
          'onUpdate:address': updateAddress,
          'onUpdate:title': updateTitle,
          onClear: onClear,
        }
      );
      await nextTick();

      const clearBtn = container.querySelector('.clear-btn') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();
      clearBtn.click();
      await nextTick();

      expect(updateModelValue).toHaveBeenCalledWith(null);
      expect(updateAddress).toHaveBeenCalledWith('');
      expect(updateTitle).not.toHaveBeenCalled();
      expect(onClear).toHaveBeenCalled();

      const titleEl = container.querySelector('.status-title') as HTMLElement;
      expect(titleEl?.textContent?.trim()).toBe('Mein Spot');
      cleanUp();
    });

    it('clearing location after selecting search result resets coordinates and address but preserves title', async () => {
      const state = reactive({
        modelValue: null as { lat: number; lng: number } | null,
        title: '',
        address: '',
      });
      const onClear = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = createApp({
        render: () =>
          h(LocationPicker as unknown as import('vue').Component, {
            modelValue: state.modelValue,
            title: state.title,
            address: state.address,
            'onUpdate:modelValue': (val: { lat: number; lng: number } | null) => {
              state.modelValue = val;
            },
            'onUpdate:title': (val: string) => {
              state.title = val;
            },
            'onUpdate:address': (val: string) => {
              state.address = val;
            },
            onClear,
          }),
      });
      app.use(pinia);
      app.mount(container);
      await nextTick();

      const dummyPlace: PlaceSearchResult = {
        name: 'Café Central',
        formatted_address: 'Herrengasse 14, 1010 Wien',
        lat: 48.2104,
        lng: 16.3653,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [dummyPlace],
      });

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Central';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      const item = container.querySelector('.location-result-item') as HTMLElement;
      expect(item).toBeTruthy();
      item.click();
      await nextTick();

      expect(state.title).toBe('Café Central');
      expect(state.modelValue).toEqual({ lat: 48.2104, lng: 16.3653 });

      const clearBtn = container.querySelector('.clear-btn') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();
      clearBtn.click();
      await nextTick();

      expect(state.modelValue).toBeNull();
      expect(state.address).toBe('');
      expect(state.title).toBe('Café Central');
      expect(onClear).toHaveBeenCalled();
      expect(input.value).toBe('');

      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    });

    it('renders address and allows inline edit via pencil button', async () => {
      const updateAddress = vi.fn();
      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2104, lng: 16.3653 },
          title: 'Café Central',
          address: 'Herrengasse 14',
        },
        {
          'onUpdate:address': updateAddress,
        }
      );
      await nextTick();

      const addressSpan = container.querySelector('.status-address') as HTMLElement;
      expect(addressSpan).toBeTruthy();
      expect(addressSpan.textContent?.trim()).toBe('Herrengasse 14');

      // Click edit pencil button in address row
      const editAddressBtn = container.querySelector(
        '.status-address-row .inline-edit-btn'
      ) as HTMLButtonElement;
      expect(editAddressBtn).toBeTruthy();
      editAddressBtn.click();
      await nextTick();

      const editInput = container.querySelector(
        '.status-address-row .inline-edit-input'
      ) as HTMLInputElement;
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Herrengasse 14');

      editInput.value = 'Herrengasse 14, Wien';
      editInput.dispatchEvent(new Event('input'));
      await nextTick();

      const saveBtn = container.querySelector(
        '.status-address-row .inline-save-btn'
      ) as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      saveBtn.click();
      await nextTick();

      expect(updateAddress).toHaveBeenCalledWith('Herrengasse 14, Wien');
      cleanUp();
    });

    it('allows inline editing of title via pencil button in status card', async () => {
      const updateTitle = vi.fn();
      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2104, lng: 16.3653 },
          title: 'Alter Titel',
        },
        {
          'onUpdate:title': updateTitle,
        }
      );
      await nextTick();

      const editTitleBtn = container.querySelector(
        '.status-title-row .inline-edit-btn'
      ) as HTMLButtonElement;
      expect(editTitleBtn).toBeTruthy();
      editTitleBtn.click();
      await nextTick();

      const editInput = container.querySelector(
        '.status-title-row .inline-edit-input'
      ) as HTMLInputElement;
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Alter Titel');

      editInput.value = 'Neuer Titel';
      editInput.dispatchEvent(new Event('input'));
      await nextTick();

      // Press Enter to save
      editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();

      expect(updateTitle).toHaveBeenCalledWith('Neuer Titel');
      cleanUp();
    });

    it('allows entering manual address when no location is set via "+ Adresse hinzufügen"', async () => {
      const updateAddress = vi.fn();
      const { container, cleanUp } = mountPicker(
        {
          modelValue: null,
          title: 'Geheimer Spot',
          address: '',
        },
        {
          'onUpdate:address': updateAddress,
        }
      );
      await nextTick();

      const manualBtn = container.querySelector('.add-address-btn') as HTMLButtonElement;
      expect(manualBtn).toBeTruthy();
      expect(manualBtn.textContent).toContain('Adresse hinzufügen');

      manualBtn.click();
      await nextTick();

      const editInput = container.querySelector(
        '.status-address-row .inline-edit-input'
      ) as HTMLInputElement;
      expect(editInput).toBeTruthy();

      editInput.value = 'Musterstraße 1, 1010 Wien';
      editInput.dispatchEvent(new Event('input'));
      await nextTick();

      const saveBtn = container.querySelector(
        '.status-address-row .inline-save-btn'
      ) as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      saveBtn.click();
      await nextTick();

      expect(updateAddress).toHaveBeenCalledWith('Musterstraße 1, 1010 Wien');
      cleanUp();
    });

    it('renders CategoryChip with edit button when location and category are present, and allows inline edit', async () => {
      const updateCategory = vi.fn();
      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2082, lng: 16.3738 },
          title: 'Stephansdom',
          category: 'Sehenswürdigkeit',
        },
        {
          'onUpdate:category': updateCategory,
        }
      );
      await nextTick();

      // Check CategoryChip is rendered in status-details
      const chip = container.querySelector('.status-category-row .category-chip');
      expect(chip).toBeTruthy();
      expect(chip?.textContent).toContain('Sehenswürdigkeit');

      // Click pencil icon to edit category
      const editBtn = container.querySelector(
        '.status-category-row .inline-edit-btn'
      ) as HTMLButtonElement;
      expect(editBtn).toBeTruthy();
      editBtn.click();
      await nextTick();

      // Combobox should now be rendered
      const comboboxInput = container.querySelector(
        '.status-category-row .inline-category-combobox input'
      ) as HTMLInputElement;
      expect(comboboxInput).toBeTruthy();
      expect(comboboxInput.value).toBe('Sehenswürdigkeit');

      comboboxInput.value = 'Museum';
      comboboxInput.dispatchEvent(new Event('input'));
      await nextTick();

      // Save via Enter
      comboboxInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();

      expect(updateCategory).toHaveBeenCalledWith('Museum');
      cleanUp();
    });

    it('renders "+ Kategorie wählen" when category is empty and allows selecting category', async () => {
      const updateCategory = vi.fn();
      const { container, cleanUp } = mountPicker(
        {
          modelValue: null,
          title: 'Mein Spot',
          category: '',
        },
        {
          'onUpdate:category': updateCategory,
        }
      );
      await nextTick();

      const addCategoryBtn = container.querySelector('.add-category-btn') as HTMLButtonElement;
      expect(addCategoryBtn).toBeTruthy();
      expect(addCategoryBtn.textContent).toContain('Kategorie wählen');

      addCategoryBtn.click();
      await nextTick();

      const comboboxInput = container.querySelector(
        '.status-category-row .inline-category-combobox input'
      ) as HTMLInputElement;
      expect(comboboxInput).toBeTruthy();

      comboboxInput.value = 'Café';
      comboboxInput.dispatchEvent(new Event('input'));
      await nextTick();

      const saveBtn = container.querySelector(
        '.status-category-row .inline-save-btn'
      ) as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      saveBtn.click();
      await nextTick();

      expect(updateCategory).toHaveBeenCalledWith('Café');
      cleanUp();
    });
  });
});
