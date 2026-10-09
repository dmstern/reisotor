import {
  computed,
  ref,
  watch,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import type { Spot } from '../api/types';
import { useScheduleStore } from '../stores/schedule';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import { fetchMergedWeather, type DailyWeather } from '../utils/weather';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';

export interface UseSpotWeatherOptions {
  spot: MaybeRefOrGetter<Spot>;
  scheduledDate: MaybeRefOrGetter<string | null>;
  expanded: MaybeRefOrGetter<boolean>;
}

export interface UseSpotWeatherReturn {
  scheduledDatesForSpot: ComputedRef<Set<string>>;
  scheduledDaysCount: ComputedRef<number>;
  weatherDate: ComputedRef<string | null>;
  dayWeather: Ref<DailyWeather | null>;
  plannedDateLabel: ComputedRef<string>;
}

export function useSpotWeather(options: UseSpotWeatherOptions): UseSpotWeatherReturn {
  const scheduleStore = useScheduleStore();
  const weatherProvider = useWeatherProviderStore();

  const scheduledDatesForSpot = computed(() => {
    const spot = toValue(options.spot);
    const dates = new Set<string>();
    for (const item of scheduleStore.items) {
      if (item.spot_id === spot.id && item.date) {
        if (item.end_date && item.end_date > item.date) {
          const cur = new Date(`${item.date}T00:00:00`);
          const end = new Date(`${item.end_date}T00:00:00`);
          while (cur <= end) {
            dates.add(toLocalDateString(cur));
            cur.setDate(cur.getDate() + 1);
          }
        } else {
          dates.add(item.date);
        }
      }
    }
    return dates;
  });

  const scheduledDaysCount = computed(() => scheduledDatesForSpot.value.size);

  const weatherDate = computed(() => {
    if (scheduledDaysCount.value > 1) return null;
    const scheduledDate = toValue(options.scheduledDate);
    if (scheduledDate) return scheduledDate;
    const spot = toValue(options.spot);
    const expanded = toValue(options.expanded);
    if (spot.done || !expanded) return null;
    return toLocalDateString(new Date());
  });

  const dayWeather = ref<DailyWeather | null>(null);

  watch(
    () => {
      const spot = toValue(options.spot);
      return [
        weatherDate.value,
        spot.lat,
        spot.lng,
        spot.trip_id,
        weatherProvider.model,
        toValue(options.expanded),
      ] as const;
    },
    async ([date, lat, lng, tripId, model]) => {
      dayWeather.value = null;
      if (!date || lat == null || lng == null) return;
      try {
        const days = await fetchMergedWeather(tripId, lat, lng, model);
        dayWeather.value = days.find((d) => d.date === date) ?? null;
      } catch {
        // best effort wie überall sonst bei Wetter
      }
    },
    { immediate: true }
  );

  const plannedDateLabel = computed(() => {
    const scheduledDate = toValue(options.scheduledDate);
    return scheduledDate ? formatDateShared(scheduledDate, { includeYear: false }) : '';
  });

  return {
    scheduledDatesForSpot,
    scheduledDaysCount,
    weatherDate,
    dayWeather,
    plannedDateLabel,
  };
}
