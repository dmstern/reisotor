// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
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

let mockMapInstance: MockMap | null = null;
let lastSetViewCoords: [number, number] | null = null;
let lastSetViewZoom: number | null = null;

vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn((_el: HTMLElement, _opts: unknown) => {
        mockMapInstance = {
          setView: vi.fn().mockImplementation((coords: [number, number], zoom: number) => {
            lastSetViewCoords = coords;
            lastSetViewZoom = zoom;
            return mockMapInstance;
          }),
          attributionControl: { setPrefix: vi.fn() },
          on: vi.fn(),
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
      marker: vi.fn((coords: [number, number]) => ({
        addTo: vi.fn().mockReturnThis(),
        setLatLng: vi.fn().mockImplementation((newCoords: [number, number]) => {
          lastSetViewCoords = newCoords;
        }),
        remove: vi.fn(),
        getLatLng: vi.fn().mockReturnValue({ lat: coords[0], lng: coords[1] }),
        on: vi.fn(),
        dragging: { enable: vi.fn() },
      })),
      divIcon: vi.fn(() => ({})),
      layerGroup: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        clearLayers: vi.fn(),
      })),
    },
  };
});

// Mock api client for useDraftAutosave
vi.mock('../api/client', () => {
  return {
    api: {
      get: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import LocationPicker from './LocationPicker.vue';
import TripForm from './TripForm.vue';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useTripStore, type TripFormData } from '../stores/trip';
import { api } from '../api/client';
import type { Trip } from '../api/types';

describe('Milestone 3 Empirical Challenger: Edit Flow & Draft Autosave', () => {
  let pinia: ReturnType<typeof createPinia>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    originalFetch = globalThis.fetch;
    mockMapInstance = null;
    lastSetViewCoords = null;
    lastSetViewZoom = null;
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  describe('1. Spot Edit Mode: Coordinate Population & Status Badge', () => {
    it('populates coordinates in LocationPicker, displays status card, and centers map when editing existing spot', async () => {
      const existingSpotCoords = { lat: 48.2082, lng: 16.3738 };
      const existingSpotAddress = 'Stephansplatz, Wien';

      const container = document.createElement('div');
      document.body.appendChild(container);

      const spotManualPin = ref<{ lat: number; lng: number } | null>(existingSpotCoords);
      const spotAddress = ref(existingSpotAddress);
      const spotMapsLink = ref('https://maps.google.com/?q=48.2082,16.3738');

      const app = createApp({
        render: () =>
          h(LocationPicker, {
            modelValue: spotManualPin.value,
            address: spotAddress.value,
            mapsLink: spotMapsLink.value,
            'onUpdate:modelValue': (val: { lat: number; lng: number } | null) => {
              spotManualPin.value = val;
            },
            'onUpdate:address': (val: string) => {
              spotAddress.value = val;
            },
            'onUpdate:mapsLink': (val: string) => {
              spotMapsLink.value = val;
            },
          }),
      });
      app.use(pinia);
      app.mount(container);
      await nextTick();

      // 1. Status card must be present immediately with coordinates and address
      const statusCard = container.querySelector('[data-testid="location-status"]');
      expect(statusCard).not.toBeNull();
      expect(statusCard?.textContent).toContain('48.20820, 16.37380');
      expect(statusCard?.textContent).toContain(existingSpotAddress);

      // 2. Map must be centered on the spot's coordinates with zoom 15
      expect(lastSetViewCoords).toEqual([48.2082, 16.3738]);
      expect(lastSetViewZoom).toBe(15);

      app.unmount();
      container.remove();
    });
  });

  describe('2. Trip Edit Mode: Coordinate Population in TripsView & TripSwitcher', () => {
    it('BUG REPRODUCTION: TripsView / TripSwitcher does NOT pass lat and lng to TripForm in edit mode', async () => {
      // In TripsView.vue (lines 107-119) and TripSwitcher.vue (lines 247-259), :initial is constructed as:
      // editingTrip ? {
      //   name: editingTrip.name,
      //   destination: editingTrip.destination ?? '',
      //   start_date: editingTrip.start_date,
      //   end_date: editingTrip.end_date,
      //   maps_link: editingTrip.maps_link ?? '',
      //   image_url: editingTrip.image_url ?? '',
      //   packing_category_required: editingTrip.packing_category_required !== 0,
      //   weather_model: editingTrip.weather_model ?? 'ecmwf_ifs025',
      // } : undefined

      const existingTrip: Trip = {
        id: 42,
        name: 'Urlaub Paris',
        destination: 'Paris, Frankreich',
        start_date: '2026-08-01',
        end_date: '2026-08-15',
        maps_link: '',
        lat: 48.8566,
        lng: 2.3522,
        image_url: null,
        packing_category_required: 1,
        weather_model: 'ecmwf_ifs025',
      };

      // Exactly the object passed in TripsView.vue:107 and TripSwitcher.vue:247:
      const initialFromView = {
        name: existingTrip.name,
        destination: existingTrip.destination ?? '',
        start_date: existingTrip.start_date,
        end_date: existingTrip.end_date,
        maps_link: existingTrip.maps_link ?? '',
        image_url: existingTrip.image_url ?? '',
        packing_category_required: existingTrip.packing_category_required !== 0,
        weather_model: existingTrip.weather_model ?? 'ecmwf_ifs025',
      };

      // Notice: lat and lng are undefined in initialFromView!
      expect((initialFromView as Record<string, unknown>).lat).toBeUndefined();
      expect((initialFromView as Record<string, unknown>).lng).toBeUndefined();

      let submittedData: TripFormData | null = null;
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = createApp({
        render: () =>
          h(TripForm, {
            initial: initialFromView,
            onSubmit: (d: TripFormData) => {
              submittedData = d;
            },
          }),
      });
      app.use(pinia);
      app.mount(container);
      await nextTick();

      // Check if LocationPicker got coordinates
      const coordsRow = container.querySelector('.status-coords-row');

      // EMPIRICAL FINDING: Because lat/lng are omitted, coordinates row is NOT rendered!
      expect(coordsRow).toBeNull();

      // If user submits form without manually clicking map, lat and lng are lost:
      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      expect(submittedData).not.toBeNull();
      // EMPIRICAL FINDING: Coordinates are wiped to undefined!
      expect((submittedData as TripFormData | null)?.lat).toBeUndefined();
      expect((submittedData as TripFormData | null)?.lng).toBeUndefined();

      app.unmount();
      container.remove();
    });

    it('CORRECT BEHAVIOR: when initial includes lat and lng, LocationPicker populates coordinates', async () => {
      const initialWithCoords: TripFormData = {
        name: 'Urlaub Paris',
        destination: 'Paris, Frankreich',
        start_date: '2026-08-01',
        end_date: '2026-08-15',
        maps_link: '',
        lat: 48.8566,
        lng: 2.3522,
        image_url: '',
        packing_category_required: true,
        weather_model: 'ecmwf_ifs025',
      };

      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = createApp({
        render: () =>
          h(TripForm, {
            initial: initialWithCoords,
          }),
      });
      app.use(pinia);
      app.mount(container);
      await nextTick();

      const statusBadge = container.querySelector('[data-testid="location-status"]');
      expect(statusBadge).not.toBeNull();
      expect(statusBadge?.textContent).toContain('48.85660, 2.35220');

      app.unmount();
      container.remove();
    });
  });

  describe('3. Draft Autosave: Reactivity, Debouncing & Loop Safety', () => {
    it('properly records changes to address and maps_link without infinite loops', async () => {
      const tripStore = useTripStore();
      tripStore.currentTripId = 99;

      const form = ref({
        title: 'Initial Spot',
        address: 'Old Address',
        maps_link: 'https://maps.google.com/?q=1,1',
      });
      const active = ref(true);

      const autosave = useDraftAutosave('spots:edit:1', form, active);
      // Wait for waitForTripId and restoreIfPresent async promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      await nextTick();

      // Initially baseline is set, status should be idle
      expect(autosave.status.value).toBe('idle');
      expect(api.put).not.toHaveBeenCalled();

      // 1. Mutate address
      form.value.address = 'New Address 123';
      await nextTick();
      expect(autosave.status.value).toBe('dirty');

      // Fast-forward debounce (600ms)
      vi.advanceTimersByTime(600);
      await nextTick();

      // Check localStorage
      const savedLocal = JSON.parse(localStorage.getItem('reisotor-draft:99:spots:edit:1') || '{}');
      expect(savedLocal.data?.address).toBe('New Address 123');
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.put).toHaveBeenCalledWith('/drafts', {
        trip_id: 99,
        draft_key: 'spots:edit:1',
        data: expect.objectContaining({ address: 'New Address 123' }),
      });

      // 2. Rapid stress test: 50 rapid mutations to maps_link
      for (let i = 0; i < 50; i++) {
        form.value.maps_link = `https://maps.google.com/?q=48.${i},16.${i}`;
        vi.advanceTimersByTime(10); // less than 600ms debounce
      }
      await nextTick();

      // Debounce timer should still prevent execution until full 600ms after last change
      expect(api.put).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600);
      await nextTick();

      // Only ONE additional put call for all 50 rapid changes
      expect(api.put).toHaveBeenCalledTimes(2);
      const finalLocal = JSON.parse(localStorage.getItem('reisotor-draft:99:spots:edit:1') || '{}');
      expect(finalLocal.data?.maps_link).toBe('https://maps.google.com/?q=48.49,16.49');
    });

    it('restores draft with address and maps_link when form becomes active', async () => {
      const tripStore = useTripStore();
      tripStore.currentTripId = 99;

      // Seed localStorage with an existing draft
      const draftData = {
        title: 'Draft Spot',
        address: 'Restored Street 42',
        maps_link: 'https://maps.google.com/?q=48.2082,16.3738',
      };
      localStorage.setItem(
        'reisotor-draft:99:spots:new',
        JSON.stringify({ data: draftData, updated_at: new Date().toISOString() })
      );

      const form = ref({
        title: '',
        address: '',
        maps_link: '',
      });
      const active = ref(false);

      const autosave = useDraftAutosave('spots:new', form, active);
      await nextTick();

      expect(form.value.address).toBe('');

      // Activate form
      active.value = true;
      await nextTick();
      await vi.runAllTimersAsync();
      await nextTick();

      expect(autosave.restored.value).toBe(true);
      expect(form.value.address).toBe('Restored Street 42');
      expect(form.value.maps_link).toBe('https://maps.google.com/?q=48.2082,16.3738');
    });

    it('EMPIRICAL EDGE CASE: draft restore of maps_link does not update spotManualPin unless parsed', async () => {
      // Simulate spot draft restore scenario
      const spot = {
        id: 10,
        title: 'Original Spot',
        lat: 48.2082,
        lng: 16.3738,
        address: 'Vienna',
        maps_link: 'https://maps.google.com/?q=48.2082,16.3738',
      };

      // Draft has a different location saved (e.g. Rome)
      const draftData = {
        title: 'Original Spot',
        address: 'Rome',
        maps_link: 'https://maps.google.com/?q=41.9028,12.4964',
      };
      localStorage.setItem(
        'reisotor-draft:99:spots:edit:10',
        JSON.stringify({ data: draftData, updated_at: new Date().toISOString() })
      );

      const tripStore = useTripStore();
      tripStore.currentTripId = 99;

      const editSpotForm = ref({
        title: spot.title,
        address: spot.address,
        maps_link: spot.maps_link,
      });
      const spotManualPin = ref<{ lat: number; lng: number } | null>({
        lat: spot.lat,
        lng: spot.lng,
      });
      const active = ref(true);

      const autosave = useDraftAutosave('spots:edit:10', editSpotForm, active);
      await Promise.resolve();
      await Promise.resolve();
      await nextTick();

      // Form text fields are restored from draft:
      expect(autosave.restored.value).toBe(true);
      expect(editSpotForm.value.address).toBe('Rome');
      expect(editSpotForm.value.maps_link).toBe('https://maps.google.com/?q=41.9028,12.4964');

      // But spotManualPin in ExcursionsView is disconnected from formRef:
      // It still holds the old coordinates:
      expect(spotManualPin.value).toEqual({ lat: 48.2082, lng: 16.3738 });
    });
  });
});
