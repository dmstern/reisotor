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
} from './useLeafletTripMap';
import type { TravelItem } from '../api/types';
import type { MapPoint } from './useMapPoints';

describe('useLeafletTripMap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it('uses standard banner-aware padding when not in photo mode', () => {
    const withBanner = calcFitBoundsPadding({
      isPhotos: false,
      hasFocusBanner: true,
      mapSize: { x: 1000, y: 800 },
    });
    expect(withBanner.paddingTop).toBe(170);

    const withoutBanner = calcFitBoundsPadding({
      isPhotos: false,
      hasFocusBanner: false,
      mapSize: { x: 1000, y: 800 },
    });
    expect(withoutBanner.paddingTop).toBe(96);
  });
});
