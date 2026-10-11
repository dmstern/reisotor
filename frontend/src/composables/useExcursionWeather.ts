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

export interface UseExcursionWeatherReturn {
  mappedStations: ComputedRef<ExcursionStation[]>;
  weatherSummary: Ref<WeatherRangeSummary | null>;
  statusDateLabel: ComputedRef<string>;
}

export function useExcursionWeather(
  options: UseExcursionWeatherOptions
): UseExcursionWeatherReturn {
  const weatherProvider = useWeatherProviderStore();

  const mappedStations = computed(() => {
    const stations = toValue(options.resolvedStations);
    return stations.filter((s) => s.lat != null && s.lng != null);
  });

  const weatherSummary = ref<WeatherRangeSummary | null>(null);

  watch(
    () => {
      const excursion = toValue(options.excursion);
      return [
        excursion.date,
        excursion.trip_id,
        mappedStations.value,
        weatherProvider.model,
      ] as const;
    },
    async ([date, tripId, stations, model]) => {
      weatherSummary.value = null;
      if (!date || !stations.length) return;
      try {
        const stationWeathers: DailyWeather[] = [];
        const fetchedKeys = new Set<string>();

        for (const st of stations) {
          if (st.lat == null || st.lng == null) continue;
          const locKey = `${st.lat.toFixed(3)},${st.lng.toFixed(3)}`;
          if (fetchedKeys.has(locKey)) continue;
          fetchedKeys.add(locKey);

          const days = await fetchMergedWeather(tripId, st.lat, st.lng, model);
          const match = days.find((d) => d.date === date);
          if (match) stationWeathers.push(match);
        }

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
  };
}
