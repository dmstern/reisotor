// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { computed, ref } from 'vue';
import {
  useLeafletTripMap,
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
    const visiblePoints = computed<MapPoint[]>(() => []);
    const accommodationPoints = computed<MapPoint[]>(() => []);
    const excursionPoints = computed<MapPoint[]>(() => []);
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
      visiblePoints,
      accommodationPoints,
      excursionPoints,
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
      leafletTripMap.fitAccommodations();
      leafletTripMap.fitExcursions();
      leafletTripMap.fitAllPhotos();
      leafletTripMap.focusCategory('Sonstiges');
      leafletTripMap.renderMarkers();
      leafletTripMap.renderRoutes();
      leafletTripMap.renderTracks();
      leafletTripMap.renderPositions();
      leafletTripMap.updateTrackPlaybackMarker();
    }).not.toThrow();
  });
});
