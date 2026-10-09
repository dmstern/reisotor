import { ref, unref, type ComputedRef, type Ref } from 'vue';
import type { DiaryEntry, Trip } from '../api/types';
import { fetchMergedWeather, type DailyWeather } from '../utils/weather';
import { useWeatherProviderStore } from '../stores/weatherProvider';

export interface UseDiaryWeatherOptions {
  trip: Ref<Trip | null> | ComputedRef<Trip | null>;
  tripId: number | Ref<number> | ComputedRef<number>;
}

export function useDiaryWeather(options: UseDiaryWeatherOptions) {
  const { trip, tripId } = options;
  const weatherProvider = useWeatherProviderStore();
  const weatherDays = ref<DailyWeather[] | null>(null);

  async function loadDiaryWeather() {
    const currentTrip = unref(trip);
    const currentTripId = unref(tripId);
    if (currentTrip?.lat == null || currentTrip?.lng == null) return;
    try {
      weatherDays.value = await fetchMergedWeather(
        currentTripId,
        currentTrip.lat,
        currentTrip.lng,
        weatherProvider.model
      );
    } catch {
      weatherDays.value = null;
    }
  }

  function weatherForEntry(entry: DiaryEntry): DailyWeather | null {
    return weatherDays.value?.find((d) => d.date === entry.date) ?? null;
  }

  return {
    weatherDays,
    loadDiaryWeather,
    weatherForEntry,
  };
}
