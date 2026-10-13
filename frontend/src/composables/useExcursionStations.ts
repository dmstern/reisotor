import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import type { Excursion, LocationTrack, Spot, TravelItem } from '../api/types';
import {
  excursionStationKeys,
  resolveStations,
  type ExcursionStation,
} from '../utils/excursionStations';
import { formatTravelDuration, tourTotalDurationMinutes } from '../utils/travelDuration';
import { useTracksStore } from '../stores/tracks';

export interface UseExcursionStationsOptions {
  excursion: MaybeRefOrGetter<Excursion>;
  stations: MaybeRefOrGetter<Spot[]>;
  travelItems: MaybeRefOrGetter<TravelItem[]>;
}

export interface UseExcursionStationsReturn {
  resolvedStations: ComputedRef<ExcursionStation[]>;
  hasMappedStations: ComputedRef<boolean>;
  routeLabel: ComputedRef<string | null>;
  effectiveDepartureTime: ComputedRef<string | null | undefined>;
  effectiveArrivalTime: ComputedRef<string | null | undefined>;
  travelDuration: ComputedRef<string | null>;
  stationsSummaryText: ComputedRef<string | null>;
  linkedTracks: ComputedRef<LocationTrack[]>;
}

export function useExcursionStations(
  options: UseExcursionStationsOptions
): UseExcursionStationsReturn {
  const tracksStore = useTracksStore();

  const resolvedStations = computed(() => {
    const excursion = toValue(options.excursion);
    const stations = toValue(options.stations);
    const travelItems = toValue(options.travelItems);
    return resolveStations(excursionStationKeys(excursion.spot_ids), stations, travelItems);
  });

  const hasMappedStations = computed(() =>
    resolvedStations.value.some((s) => s.lat != null && s.lng != null)
  );

  const routeLabel = computed(() => {
    const excursion = toValue(options.excursion);
    if (!excursion.role || resolvedStations.value.length < 2) return null;
    if (resolvedStations.value.length === 2) {
      return `${resolvedStations.value[0].title} → ${resolvedStations.value[1].title}`;
    }
    const stopCount = resolvedStations.value.length - 2;
    const stopText = stopCount === 1 ? '1 Zwischenstopp' : `${stopCount} Zwischenstopps`;
    return `${resolvedStations.value[0].title} → ${resolvedStations.value[resolvedStations.value.length - 1].title} · ${stopText}`;
  });

  const effectiveDepartureTime = computed(() => {
    const excursion = toValue(options.excursion);
    if (excursion.legs && excursion.legs.length > 0) {
      return (
        excursion.legs.find((l) => !!l.departure_time)?.departure_time || excursion.departure_time
      );
    }
    return excursion.departure_time;
  });

  const effectiveArrivalTime = computed(() => {
    const excursion = toValue(options.excursion);
    if (excursion.legs && excursion.legs.length > 0) {
      return (
        [...excursion.legs].reverse().find((l) => !!l.arrival_time)?.arrival_time ||
        excursion.arrival_time
      );
    }
    return excursion.arrival_time;
  });

  const travelDuration = computed(() => {
    const excursion = toValue(options.excursion);
    const minutes = tourTotalDurationMinutes(excursion);
    return minutes == null ? null : formatTravelDuration(minutes);
  });

  const stationsSummaryText = computed(() => {
    if (!resolvedStations.value.length) return null;
    if (resolvedStations.value.length === 1) {
      return resolvedStations.value[0].title;
    }
    if (resolvedStations.value.length === 2) {
      return `${resolvedStations.value[0].title} → ${resolvedStations.value[1].title}`;
    }
    const stopCount = resolvedStations.value.length - 2;
    const stopText = stopCount === 1 ? '1 Zwischenstopp' : `${stopCount} Zwischenstopps`;
    return `${resolvedStations.value[0].title} → ${resolvedStations.value[resolvedStations.value.length - 1].title} · ${stopText}`;
  });

  const linkedTracks = computed(() => {
    const excursion = toValue(options.excursion);
    return tracksStore.tracks.filter((t) => t.excursion_id === excursion.id);
  });

  return {
    resolvedStations,
    hasMappedStations,
    routeLabel,
    effectiveDepartureTime,
    effectiveArrivalTime,
    travelDuration,
    stationsSummaryText,
    linkedTracks,
  };
}
