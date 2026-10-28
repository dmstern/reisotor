// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { computed, ref } from 'vue';
import {
  useLeafletTripMap,
  calcFitBoundsPadding,
  trackPlaybackIcon,
  TRACK_START_ICON,
  TRACK_GOAL_ICON,
  getDefaultMapCenterAndZoom,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  DEFAULT_TRIP_ZOOM,
} from './useLeafletTripMap';
import { useTripStore } from '../stores/trip';
import type { TravelItem, Trip } from '../api/types';
import type { MapPoint } from './useMapPoints';

describe('useLeafletTripMap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('getDefaultMapCenterAndZoom falls back to Europe when trip has no coordinates', () => {
    expect(getDefaultMapCenterAndZoom(null)).toEqual({
      center: [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng],
      zoom: FALLBACK_ZOOM,
    });
    expect(getDefaultMapCenterAndZoom({ lat: null, lng: null })).toEqual({
      center: [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng],
      zoom: FALLBACK_ZOOM,
    });
  });

  it('getDefaultMapCenterAndZoom uses trip destination coordinates when available', () => {
    expect(getDefaultMapCenterAndZoom({ lat: 41.9, lng: 12.5 })).toEqual({
      center: [41.9, 12.5],
      zoom: DEFAULT_TRIP_ZOOM,
    });
  });

  it('initializes map with Europe default view when trip has no coordinates and no points', () => {
    const tripStore = useTripStore();
    vi.spyOn(tripStore, 'currentTrip', 'get').mockReturnValue({
      id: 1,
      name: 'Urlaub ohne Ort',
      destination: null,
      lat: null,
      lng: null,
      start_date: null,
      end_date: null,
      maps_link: null,
      image_url: null,
      packing_category_required: 0,
      weather_model: 'best_match',
    } as Trip);

    const mapEl = document.createElement('div');
    document.body.appendChild(mapEl);

    const leafletTripMap = useLeafletTripMap({
      travelItems: computed(() => []),
      points: computed(() => []),
      filteredPoints: computed(() => []),
      vacationPoints: computed(() => []),
      homePoints: computed(() => []),
      visiblePoints: computed(() => []),
      accommodationPoints: computed(() => []),
      focusedExcursion: computed(() => null),
      focusedTrack: computed(() => null),
      focusedTrackPoints: computed(() => []),
      focusedDateStations: computed(() => []),
      excursionPhotoPoints: ref([]),
      allTripPhotoPoints: ref([]),
      ownPosition: ref(null),
      ownHeading: ref(null),
      currentBearing: ref(0),
      users: ref([]),
      trackPlaybackProgress: ref(0),
      onPointClick: vi.fn(),
    });

    leafletTripMap.initMap(mapEl);

    // Leaflet map is loaded immediately, does NOT throw 'Set map center and zoom first'
    expect(() => leafletTripMap.fitAll()).not.toThrow();
    expect(leafletTripMap.getBounds()).toBeDefined();

    leafletTripMap.destroyMap();
    mapEl.remove();
  });

  it('initializes map with trip destination coordinates when present', () => {
    const tripStore = useTripStore();
    vi.spyOn(tripStore, 'currentTrip', 'get').mockReturnValue({
      id: 2,
      name: 'Italien Reise',
      destination: 'Rom',
      lat: 41.9028,
      lng: 12.4964,
      start_date: null,
      end_date: null,
      maps_link: null,
      image_url: null,
      packing_category_required: 0,
      weather_model: 'best_match',
    } as Trip);

    const mapEl = document.createElement('div');
    document.body.appendChild(mapEl);

    const leafletTripMap = useLeafletTripMap({
      travelItems: computed(() => []),
      points: computed(() => []),
      filteredPoints: computed(() => []),
      vacationPoints: computed(() => []),
      homePoints: computed(() => []),
      visiblePoints: computed(() => []),
      accommodationPoints: computed(() => []),
      focusedExcursion: computed(() => null),
      focusedTrack: computed(() => null),
      focusedTrackPoints: computed(() => []),
      focusedDateStations: computed(() => []),
      excursionPhotoPoints: ref([]),
      allTripPhotoPoints: ref([]),
      ownPosition: ref(null),
      ownHeading: ref(null),
      currentBearing: ref(0),
      users: ref([]),
      trackPlaybackProgress: ref(0),
      onPointClick: vi.fn(),
    });

    leafletTripMap.initMap(mapEl);

    expect(() => leafletTripMap.fitAll()).not.toThrow();

    leafletTripMap.destroyMap();
    mapEl.remove();
  });

  it('exports valid track marker icons and creates div icon for playback', () => {
    expect(TRACK_START_ICON.id).toBe('flag');
    expect(TRACK_GOAL_ICON.id).toBe('target');

    const icon = trackPlaybackIcon();
    expect(icon).toBeDefined();
    expect(icon.options.html).toContain('track-playback-marker');
  });

  it('provides camera fitting and rendering methods without errors when uninitialized', () => {
    const travelItems = computed<TravelItem[]>(() => []);
    const points = computed<MapPoint[]>(() => []);
    const filteredPoints = computed<MapPoint[]>(() => []);
    const vacationPoints = computed<MapPoint[]>(() => []);
    const homePoints = computed<MapPoint[]>(() => []);
    const visiblePoints = computed<MapPoint[]>(() => []);
    const accommodationPoints = computed<MapPoint[]>(() => []);
    const focusedExcursion = computed(() => null);
    const focusedTrack = computed(() => null);
    const focusedTrackPoints = computed(() => []);
    const focusedDateStations = computed(() => []);
    const excursionPhotoPoints = ref<MapPoint[]>([]);
    const allTripPhotoPoints = ref<MapPoint[]>([]);
    const ownPosition = ref(null);
    const ownHeading = ref(null);
    const currentBearing = ref(0);
    const users = ref([]);
    const trackPlaybackProgress = ref(0);
    const onPointClick = vi.fn();

    const leafletTripMap = useLeafletTripMap({
      travelItems,
      points,
      filteredPoints,
      vacationPoints,
      homePoints,
      visiblePoints,
      accommodationPoints,
      focusedExcursion,
      focusedTrack,
      focusedTrackPoints,
      focusedDateStations,
      excursionPhotoPoints,
      allTripPhotoPoints,
      ownPosition,
      ownHeading,
      currentBearing,
      users,
      trackPlaybackProgress,
      onPointClick,
    });

    expect(() => {
      leafletTripMap.fitAll();
      leafletTripMap.fitVacation();
      leafletTripMap.fitHome();
      leafletTripMap.fitAccommodations();
      leafletTripMap.fitAllPhotos();
      leafletTripMap.focusCategory('Sonstiges');
      leafletTripMap.renderMarkers();
      leafletTripMap.renderRoutes();
      leafletTripMap.renderTracks();
      leafletTripMap.renderPositions();
      leafletTripMap.updateTrackPlaybackMarker();
    }).not.toThrow();
  });

  it('calculates generous centered padding for photos with room for focus banner and day strip', () => {
    // Foto-Fokus: Mindestens 190px oben (unter Fokus-Banner), 120px unten (über Day-Strip), 90px links/rechts
    const padding = calcFitBoundsPadding({
      isPhotos: true,
      hasFocusBanner: true,
      coveredLeftPx: 0,
      coveredBottomPx: 0,
      mapSize: { x: 1200, y: 800 },
    });

    expect(padding.paddingTop).toBe(190);
    expect(padding.paddingBottom).toBe(120);
    expect(padding.paddingLeft).toBe(90);
    expect(padding.paddingRight).toBe(90);
  });

  it('incorporates coveredLeftPx and coveredBottomPx with photo margins', () => {
    const padding = calcFitBoundsPadding({
      isPhotos: true,
      hasFocusBanner: true,
      coveredLeftPx: 400,
      coveredBottomPx: 200,
      mapSize: { x: 1400, y: 900 },
    });

    expect(padding.paddingLeft).toBe(400 + 90);
    expect(padding.paddingBottom).toBe(200 + 48);
    expect(padding.paddingTop).toBe(190);
    expect(padding.paddingRight).toBe(90);
  });

  it('scales down padding on small screens to prevent map clipping', () => {
    // 300px Höhe -> max 75% = 225px. 190 + 120 = 310 > 225
    const padding = calcFitBoundsPadding({
      isPhotos: true,
      hasFocusBanner: true,
      mapSize: { x: 200, y: 300 },
    });

    expect(padding.paddingTop + padding.paddingBottom).toBeLessThanOrEqual(225);
    expect(padding.paddingLeft + padding.paddingRight).toBeLessThanOrEqual(150);
  });

  it('uses standard padding when not in photo mode', () => {
    const standard = calcFitBoundsPadding({
      isPhotos: false,
      coveredLeftPx: 0,
      coveredBottomPx: 0,
      mapSize: { x: 1000, y: 800 },
    });
    expect(standard.paddingTop).toBe(32);
    expect(standard.paddingBottom).toBe(32);
    expect(standard.paddingLeft).toBe(32);
    expect(standard.paddingRight).toBe(32);
  });
});
