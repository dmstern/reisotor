import {
  computed,
  ref,
  watch,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import {
  fetchMergedWeather,
  summarizeWeatherRange,
  type DailyWeather,
  type WeatherRangeSummary,
} from '../utils/weather';
import { formatDate as formatDateShared } from '../utils/dateFormat';

export interface UseExcursionWeatherOptions {
  excursion: MaybeRefOrGetter<Excursion>;
  resolvedStations: MaybeRefOrGetter<ExcursionStation[]>;
}

export interface ExcursionWeatherLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface UseExcursionWeatherReturn {
  mappedStations: ComputedRef<ExcursionStation[]>;
  weatherSummary: Ref<WeatherRangeSummary | null>;
  statusDateLabel: ComputedRef<string>;
  primaryWeatherDay: Ref<DailyWeather | null>;
  primaryWeatherDays: Ref<DailyWeather[]>;
  primaryWeatherLocation: Ref<ExcursionWeatherLocation | null>;
}

export function useExcursionWeather(
  options: UseExcursionWeatherOptions
): UseExcursionWeatherReturn {
  const weatherProvider = useWeatherProviderStore();
  const COORD_KEY_PRECISION = 3;

  const mappedStations = computed(() => {
    const stations = toValue(options.resolvedStations);
    return stations.filter((station) => station.lat != null && station.lng != null);
  });

  // Primitiver Koordinaten-/Titel-Schlüssel verhindert unnötige Wetter-Reloads (und UI-Flackern),
  // wenn sich nur die Array-Referenz durch z. B. done/note-Updates am Excursion-Objekt ändert.
  const mappedStationsKey = computed(() =>
    mappedStations.value
      .map(
        (station) =>
          `${station.lat!.toFixed(COORD_KEY_PRECISION)},${station.lng!.toFixed(COORD_KEY_PRECISION)}:${station.title || ''}`
      )
      .join('|')
  );

  const weatherSummary = ref<WeatherRangeSummary | null>(null);
  const primaryWeatherDay = ref<DailyWeather | null>(null);
  const primaryWeatherDays = ref<DailyWeather[]>([]);
  const primaryWeatherLocation = ref<ExcursionWeatherLocation | null>(null);
  let activeRequestSeq = 0;

  watch(
    [
      () => toValue(options.excursion).date,
      () => toValue(options.excursion).trip_id,
      () => toValue(options.excursion).title,
      mappedStationsKey,
      () => weatherProvider.model,
    ],
    async ([date, tripId, tourTitle, _stationsKey, model]) => {
      const requestSeq = ++activeRequestSeq;
      const stations = mappedStations.value;

      weatherSummary.value = null;
      primaryWeatherDay.value = null;
      primaryWeatherDays.value = [];
      primaryWeatherLocation.value = null;

      if (!date || !stations.length) {
        return;
      }

      try {
        const stationWeathers: DailyWeather[] = [];
        const fetchedKeys = new Set<string>();
        let nextPrimaryDay: DailyWeather | null = null;
        let nextPrimaryDays: DailyWeather[] = [];
        let nextPrimaryLocation: ExcursionWeatherLocation | null = null;

        for (const st of stations) {
          if (st.lat == null || st.lng == null) {
            continue;
          }

          const locKey = `${st.lat.toFixed(COORD_KEY_PRECISION)},${st.lng.toFixed(COORD_KEY_PRECISION)}`;

          if (fetchedKeys.has(locKey)) {
            continue;
          }

          fetchedKeys.add(locKey);

          const days = await fetchMergedWeather(tripId, st.lat, st.lng, model);

          if (requestSeq !== activeRequestSeq) {
            return;
          }

          const match = days.find((day) => day.date === date);

          if (match) {
            stationWeathers.push(match);

            if (!nextPrimaryDay) {
              nextPrimaryDay = match;
              nextPrimaryDays = days;
              nextPrimaryLocation = {
                lat: st.lat,
                lng: st.lng,
                label: st.title || tourTitle || 'Reiseziel',
              };
            }
          }
        }

        if (requestSeq !== activeRequestSeq) {
          return;
        }

        primaryWeatherDay.value = nextPrimaryDay;
        primaryWeatherDays.value = nextPrimaryDays;
        primaryWeatherLocation.value = nextPrimaryLocation;
        weatherSummary.value = summarizeWeatherRange(stationWeathers);
      } catch {
        // best effort wie überall bei Wetter
      }
    },
    { immediate: true }
  );

  const statusDateLabel = computed(() => {
    const excursion = toValue(options.excursion);
    return excursion.date ? formatDateShared(excursion.date, { includeYear: false }) : '';
  });

  return {
    mappedStations,
    weatherSummary,
    statusDateLabel,
    primaryWeatherDay,
    primaryWeatherDays,
    primaryWeatherLocation,
  };
}
