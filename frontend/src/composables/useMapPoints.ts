import { computed, type ComputedRef, type Ref } from 'vue';
import type {
  Excursion,
  LocationTrack,
  ScheduleItem,
  Spot,
  TrackPoint,
  TravelItem,
} from '../api/types';
import type { IconDef } from '../utils/icon';
import type { MapFocusGallery } from '../stores/drawers';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useTracksStore } from '../stores/tracks';
import { useAuthStore } from '../stores/auth';
import { buildDayStations } from '../utils/dayStations';
import { buildTravelDerivedLocations } from '../utils/travelDerivedLocations';
import { spotCategoryMeta } from '../utils/spotCategory';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { excursionStationKeys, type ExcursionStation } from '../utils/excursionStations';
import { toLocalDateString } from '../utils/dateFormat';

export type MapOrigin = 'travel' | 'spot' | 'location';

export interface MapPoint {
  key: string;
  origin: MapOrigin;
  lat: number;
  lng: number;
  title: string;
  icon: IconDef;
  imageUrl?: string;
  dateBadge?: string;
  color: string;
  category: string;
  homeSide?: boolean;
  done?: boolean;
  gallery?: MapFocusGallery;
}

export const TRAVEL_COLOR = '#4a3aa7';

export interface UseMapPointsOptions {
  travelItems: ComputedRef<TravelItem[]>;
  scheduleItems: Ref<ScheduleItem[]>;
  excursionPhotoPoints: Ref<MapPoint[]>;
  allTripPhotoPoints: Ref<MapPoint[]>;
  categoryFilter?: Ref<string[] | undefined>;
  statusFilter?: Ref<('planned' | 'unplanned' | 'done')[] | undefined>;
  tourRoleFilter?: Ref<string[] | undefined>;
}

export function useMapPoints(options: UseMapPointsOptions) {
  const tripStore = useTripStore();
  const drawers = useDrawersStore();
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const tracksStore = useTracksStore();
  const auth = useAuthStore();

  const focusedExcursion = computed<Excursion | null>(() => {
    if (drawers.mapFocusExcursionId == null) {
      return null;
    }

    return excursionsStore.excursions.find((e) => e.id === drawers.mapFocusExcursionId) ?? null;
  });

  const focusedSpot = computed<Spot | null>(() => {
    if (!drawers.mapFocusKey?.startsWith('spot-')) {
      return null;
    }

    const spotId = Number(drawers.mapFocusKey.replace('spot-', ''));

    if (Number.isNaN(spotId)) {
      return null;
    }

    return spotsStore.spots.find((spot) => spot.id === spotId) ?? null;
  });

  const focusedTrack = computed<LocationTrack | null>(() => {
    if (drawers.mapFocusTrackId == null) {
      return null;
    }

    const found = tracksStore.tracks.find(
      (track) => Number(track.id) === Number(drawers.mapFocusTrackId)
    );

    if (found) {
      return found;
    }

    return {
      id: drawers.mapFocusTrackId,
      trip_id: Number(tripStore.currentTripId) || 0,
      user_id: auth.user?.id ?? 0,
      excursion_id: null,
      title: null,
      visibility: 'private',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };
  });

  const focusedTrackPoints = computed<TrackPoint[]>(() => {
    if (!focusedTrack.value) {
      return [];
    }

    return tracksStore.getPointsForTrack(focusedTrack.value.id);
  });

  const focusedDateStations = computed<ExcursionStation[]>(() => {
    if (focusedExcursion.value || !drawers.mapFocusDate) {
      return [];
    }

    return buildDayStations(
      drawers.mapFocusDate,
      options.scheduleItems.value,
      excursionsStore.excursions,
      options.travelItems.value,
      spotsStore.spots
    );
  });

  const points = computed<MapPoint[]>(() => {
    const result: MapPoint[] = [];

    for (const loc of buildTravelDerivedLocations(options.travelItems.value)) {
      result.push({
        key: loc.key,
        origin: 'travel',
        lat: loc.lat,
        lng: loc.lng,
        title: loc.title,
        category: loc.category,
        homeSide: loc.homeSide,
        icon: loc.tabler,
        color: TRAVEL_COLOR,
      });
    }

    for (const spot of spotsStore.spots) {
      if (spot.lat != null && spot.lng != null) {
        const meta = spotCategoryMeta(spot.category);
        result.push({
          key: `spot-${spot.id}`,
          origin: 'spot',
          lat: spot.lat,
          lng: spot.lng,
          title: spot.title,
          icon: meta.tabler,
          color: meta.color,
          category: spot.category ?? 'Sonstiges',
          homeSide: !!spot.is_home,
          done: !!spot.done,
        });
      }
    }

    if (drawers.mapFocusLocation) {
      result.push({
        key: 'photo-location',
        origin: 'location',
        lat: drawers.mapFocusLocation.lat,
        lng: drawers.mapFocusLocation.lng,
        title: drawers.mapFocusLocation.title || 'Foto-Standort',
        icon: FORM_FIELD_ICONS.image,
        imageUrl: drawers.mapFocusLocation.imageUrl,
        dateBadge: drawers.mapFocusLocation.dateBadge,
        color: '#9141ac',
        category: 'Foto',
      });
    }

    if (focusedExcursion.value && options.excursionPhotoPoints.value.length) {
      for (const pt of options.excursionPhotoPoints.value) {
        result.push(pt);
      }
    }

    if (drawers.mapFocusAllPhotos && options.allTripPhotoPoints.value.length) {
      for (const pt of options.allTripPhotoPoints.value) {
        result.push(pt);
      }
    }

    return result;
  });

  const spotScheduledDates = computed(() => {
    const map = new Map<number, string>();

    for (const item of options.scheduleItems.value) {
      if (item.spot_id == null) {
        continue;
      }

      const existing = map.get(item.spot_id);

      if (!existing || item.date < existing) {
        map.set(item.spot_id, item.date);
      }
    }

    for (const excursion of excursionsStore.excursions) {
      if (!excursion.date) {
        continue;
      }

      for (const spotId of excursion.spot_ids) {
        const existing = map.get(spotId);

        if (!existing || excursion.date < existing) {
          map.set(spotId, excursion.date);
        }
      }
    }

    return map;
  });

  const filteredPoints = computed(() => {
    const categoryFilterActive =
      options.categoryFilter?.value && options.categoryFilter.value.length > 0;
    const statusFilterActive = options.statusFilter?.value && options.statusFilter.value.length > 0;
    const tourRoleFilterActive =
      options.tourRoleFilter?.value && options.tourRoleFilter.value.length > 0;

    if (!categoryFilterActive && !statusFilterActive && !tourRoleFilterActive) {
      return points.value;
    }

    return points.value.filter((point) => {
      if (point.origin === 'location') {
        return true;
      }

      if (categoryFilterActive && !options.categoryFilter!.value!.includes(point.category)) {
        return false;
      }

      if (statusFilterActive && point.origin === 'spot') {
        const spotId = Number(point.key.slice('spot-'.length));
        const status = spotScheduledDates.value.has(spotId) ? 'planned' : 'unplanned';
        const matchesStatus = options.statusFilter!.value!.includes(status);
        const matchesDone = options.statusFilter!.value!.includes('done') && !!point.done;

        if (!matchesStatus && !matchesDone) {
          return false;
        }
      }

      if (tourRoleFilterActive) {
        if (point.origin === 'travel') {
          const matchesTravel = options.travelItems.value.some((travelItem) => {
            const tRole = travelItem.role ?? 'arrival';
            return options.tourRoleFilter!.value!.includes(tRole);
          });

          if (!matchesTravel) {
            return false;
          }
        } else if (point.origin === 'spot') {
          const spotId = Number(point.key.slice('spot-'.length));
          const spotTours = excursionsStore.excursions.filter((e) => e.spot_ids.includes(spotId));
          const matchesTourRole = spotTours.some((tour) =>
            tour.role
              ? options.tourRoleFilter!.value!.includes(tour.role)
              : options.tourRoleFilter!.value!.includes('excursion')
          );

          if (!matchesTourRole) {
            return false;
          }
        }
      }

      return true;
    });
  });

  const vacationPoints = computed(() => filteredPoints.value.filter((point) => !point.homeSide));
  const homePoints = computed(() => filteredPoints.value.filter((point) => !!point.homeSide));

  const visiblePoints = computed(() => {
    if (drawers.mapFocusAllPhotos) {
      return options.allTripPhotoPoints.value;
    }

    const excursion = focusedExcursion.value;

    if (excursion) {
      const excursionKeys = excursionStationKeys(excursion.spot_ids);
      return points.value.filter(
        (point) => point.origin !== 'spot' || excursionKeys.includes(point.key)
      );
    }

    if (drawers.mapFocusDate) {
      const keys = new Set(focusedDateStations.value.map((station) => station.key));
      return points.value.filter((point) => point.origin !== 'spot' || keys.has(point.key));
    }

    return filteredPoints.value;
  });

  const vacationDays = computed<string[]>(() => {
    const trip = tripStore.currentTrip;

    if (!trip || !trip.start_date || !trip.end_date) {
      return [];
    }

    const days: string[] = [];
    const cursor = new Date(trip.start_date);
    const end = new Date(trip.end_date);

    while (cursor <= end) {
      days.push(toLocalDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  });

  function dayHasContent(date: string): boolean {
    if (excursionsStore.excursions.some((e) => e.date === date)) {
      return true;
    }

    if (options.travelItems.value.some((travelItem) => travelItem.date === date)) {
      return true;
    }

    if (
      spotsStore.spots.some(
        (spot) =>
          spot.category === 'Unterkunft' &&
          spot.start_date &&
          spot.end_date &&
          spot.start_date <= date &&
          date <= spot.end_date
      )
    ) {
      return true;
    }

    return options.scheduleItems.value.some(
      (i) => i.lat != null && i.lng != null && i.date <= date && date <= (i.end_date ?? i.date)
    );
  }

  function toggleDayFocus(date: string) {
    if (drawers.mapFocusDate === date) {
      drawers.mapFocusDate = null;
    } else {
      drawers.focusMapOnDate(date);
    }
  }

  const totalAccommodationsCount = computed(
    () => spotsStore.spots.filter((spot) => spot.category === 'Unterkunft').length
  );

  const accommodationPoints = computed(() =>
    points.value.filter((point) => point.category === 'Unterkunft')
  );

  return {
    focusedExcursion,
    focusedSpot,
    focusedTrack,
    focusedTrackPoints,
    focusedDateStations,
    points,
    spotScheduledDates,
    filteredPoints,
    vacationPoints,
    homePoints,
    visiblePoints,
    vacationDays,
    dayHasContent,
    toggleDayFocus,
    totalAccommodationsCount,
    accommodationPoints,
  };
}
