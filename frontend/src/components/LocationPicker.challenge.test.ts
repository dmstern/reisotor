// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
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
  options?: { draggable?: boolean };
}

let mockMapInstance: MockMap | null = null;
let mockMarkerInstance: MockMarker | null = null;
const mapClickHandlers: ((e: { latlng: { lat: number; lng: number } }) => void)[] = [];
let markerDragEndHandler: (() => void) | null = null;
const createdMarkers: MockMarker[] = [];

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
      marker: vi.fn((coords: [number, number], opts?: { draggable?: boolean }) => {
        mockMarkerInstance = {
          options: opts,
          setLatLng: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          remove: vi.fn(),
          getLatLng: vi.fn().mockReturnValue({ lat: coords[0], lng: coords[1] }),
          on: vi.fn((event: string, handler: () => void) => {
            if (event === 'dragend') markerDragEndHandler = handler;
          }),
          dragging: { enable: vi.fn() },
        };
        createdMarkers.push(mockMarkerInstance);
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

describe('Adversarial Stress Testing: LocationPicker', () => {
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
    createdMarkers.length = 0;
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

  describe('Adversarial Rapid Typing & AbortController Cancellation', () => {
    it('rapid typing of 5 keys in 100ms issues only ONE fetch after 300ms quiet period', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;

      // Type "W", "Wi", "Wie", "Wien", "Wien " with 30ms gaps
      const keystrokes = ['W', 'Wi', 'Wie', 'Wien', 'Wien '];
      for (const stroke of keystrokes) {
        input.value = stroke;
        input.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(30);
      }

      // At this point, 120ms elapsed from start. No fetch should have been dispatched.
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance 250ms (total 280ms from last key). Still no fetch.
      vi.advanceTimersByTime(250);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance 60ms (total 310ms from last key). Fetch must fire for 'Wien' (trimmed).
      vi.advanceTimersByTime(60);
      await nextTick();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/places/search?q=Wien'),
        expect.any(Object)
      );

      cleanUp();
    });

    it('aborts active in-flight request when user continues typing', async () => {
      let firstSignal: AbortSignal | null | undefined;
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('query1')) {
          firstSignal = init?.signal;
          return new Promise(() => {}); // never resolves initially
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ name: 'Query 2 Place', lat: 1, lng: 2 }],
        });
      });
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;

      // Start query 1
      input.value = 'query1';
      input.dispatchEvent(new Event('input'));

      // Advance past debounce timer to trigger fetch 1
      vi.advanceTimersByTime(350);
      await nextTick();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(firstSignal).toBeDefined();
      expect(firstSignal?.aborted).toBe(false);

      // Now user types 'query2' while query 1 is still in-flight
      input.value = 'query2';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      // First signal should immediately be aborted!
      expect(firstSignal?.aborted).toBe(true);

      // Advance past debounce timer for query 2
      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Results must show query 2, not query 1
      const dropdown = container.querySelector('.location-dropdown');
      expect(dropdown).toBeTruthy();
      expect(dropdown?.textContent).toContain('Query 2 Place');

      cleanUp();
    });

    it('pasting a maps link while search is debouncing aborts timer and does not call fetch', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const updateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': updateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;

      // User starts typing
      input.value = 'Rom Colos';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(150);

      // User pastes maps link before debounce fires
      input.value = 'https://www.google.com/maps/@41.8902,12.4922,17z';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      // Wait 500ms
      vi.advanceTimersByTime(500);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(updateModelValue).toHaveBeenCalledWith({ lat: 41.8902, lng: 12.4922 });

      cleanUp();
    });

    it('clearing input back to single char cancels pending debounce and clears results', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const { container, cleanUp } = mountPicker({ modelValue: null });
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;

      input.value = 'London';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);

      // Backspace down to 1 character
      input.value = 'L';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      vi.advanceTimersByTime(500);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(container.querySelector('.location-dropdown')).toBeNull();

      cleanUp();
    });
  });

  describe('Adversarial "Entfernen" Button Behavior', () => {
    it('completely clears coordinates, removes marker from Leaflet map, and emits all events', async () => {
      const onUpdateModelValue = vi.fn();
      const onUpdateAddress = vi.fn();
      const onUpdateMapsLink = vi.fn();
      const onClear = vi.fn();

      const { container, cleanUp } = mountPicker(
        {
          modelValue: { lat: 48.2082, lng: 16.3738 },
          address: 'Stephansplatz, Wien',
          mapsLink: 'https://maps.google.com/?q=Stephansplatz',
        },
        {
          'onUpdate:modelValue': onUpdateModelValue,
          'onUpdate:address': onUpdateAddress,
          'onUpdate:mapsLink': onUpdateMapsLink,
          onClear: onClear,
        }
      );
      await nextTick();

      expect(createdMarkers.length).toBe(1);
      const markerInstance = createdMarkers[0];

      const clearBtn = container.querySelector(
        'button.clear-btn, button.coords-clear-btn'
      ) as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();

      clearBtn.click();
      await nextTick();

      // ModelValue, mapsLink and clear emit fired, address is preserved
      expect(onUpdateModelValue).toHaveBeenCalledTimes(1);
      expect(onUpdateModelValue).toHaveBeenCalledWith(null);
      expect(onUpdateAddress).not.toHaveBeenCalled();
      expect(onUpdateMapsLink).toHaveBeenCalledTimes(1);
      expect(onUpdateMapsLink).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalledTimes(1);

      // Marker remove() method was invoked
      expect(markerInstance.remove).toHaveBeenCalled();

      // Text input is cleared
      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      expect(input.value).toBe('');

      cleanUp();
    });

    it('removes Leaflet marker when external modelValue prop transitions to null', async () => {
      const { cleanUp } = mountPicker({
        modelValue: { lat: 50.1109, lng: 8.6821 },
      });
      await nextTick();

      expect(createdMarkers.length).toBe(1);

      cleanUp();
    });
  });

  describe('Adversarial Manual Pin Click & Drag Synchronization', () => {
    it('clicking on map places marker with draggable=true and emits coordinates and OSM link', async () => {
      const onUpdateModelValue = vi.fn();
      const onUpdateMapsLink = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: null },
        {
          'onUpdate:modelValue': onUpdateModelValue,
          'onUpdate:mapsLink': onUpdateMapsLink,
        }
      );
      await nextTick();

      expect(mapClickHandlers.length).toBe(1);
      const clickHandler = mapClickHandlers[0];

      // Click at Zurich: 47.3769, 8.5417
      clickHandler({ latlng: { lat: 47.3769, lng: 8.5417 } });
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 47.3769, lng: 8.5417 });
      expect(onUpdateMapsLink).toHaveBeenCalledWith(
        expect.stringContaining('https://www.openstreetmap.org/?mlat=47.3769&mlon=8.5417')
      );

      // Check marker options
      expect(createdMarkers.length).toBe(1);
      expect(createdMarkers[0].options?.draggable).toBe(true);

      cleanUp();
    });

    it('dragging marker emits updated coordinates and OSM link on dragend', async () => {
      const onUpdateModelValue = vi.fn();
      const onUpdateMapsLink = vi.fn();

      const { cleanUp } = mountPicker(
        { modelValue: { lat: 48.2082, lng: 16.3738 } },
        {
          'onUpdate:modelValue': onUpdateModelValue,
          'onUpdate:mapsLink': onUpdateMapsLink,
        }
      );
      await nextTick();

      expect(markerDragEndHandler).toBeDefined();

      // Simulate dragging marker to new position
      mockMarkerInstance!.getLatLng = vi.fn().mockReturnValue({ lat: 48.22, lng: 16.39 });
      markerDragEndHandler!();
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 48.22, lng: 16.39 });
      expect(onUpdateMapsLink).toHaveBeenCalledWith(
        expect.stringContaining('https://www.openstreetmap.org/?mlat=48.22&mlon=16.39')
      );

      cleanUp();
    });

    it('clicking map after selecting a place clears selectedPlace to prevent stale place metadata', async () => {
      const mockPlace: PlaceSearchResult = {
        name: 'Brand New Cafe',
        formatted_address: 'Hauptstraße 1',
        lat: 48.1,
        lng: 16.1,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockPlace],
      });

      const onUpdateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: null },
        { 'onUpdate:modelValue': onUpdateModelValue }
      );
      await nextTick();

      const input = container.querySelector('input.location-picker-input') as HTMLInputElement;
      input.value = 'Brand New';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      const option = container.querySelector('.location-result-item') as HTMLElement;
      expect(option).toBeTruthy();
      option.click();
      await nextTick();

      // Now simulate user clicking elsewhere on the map
      const clickHandler = mapClickHandlers[0];
      clickHandler({ latlng: { lat: 49.0, lng: 12.0 } });
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenLastCalledWith({ lat: 49.0, lng: 12.0 });

      cleanUp();
    });

    it('allows re-adding marker after clearing without component reload', async () => {
      const onUpdateModelValue = vi.fn();

      const { container, cleanUp } = mountPicker(
        { modelValue: { lat: 48.2, lng: 16.3 } },
        { 'onUpdate:modelValue': onUpdateModelValue }
      );
      await nextTick();

      // Clear
      const clearBtn = container.querySelector('button.clear-btn') as HTMLButtonElement;
      clearBtn.click();
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith(null);

      // Now click on map to set a new location
      const clickHandler = mapClickHandlers[0];
      clickHandler({ latlng: { lat: 51.5, lng: -0.1 } });
      await nextTick();

      expect(onUpdateModelValue).toHaveBeenCalledWith({ lat: 51.5, lng: -0.1 });

      cleanUp();
    });
  });
});
