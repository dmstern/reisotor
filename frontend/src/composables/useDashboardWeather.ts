import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Spot, Trip } from '../api/types';
import { useSpotsStore } from '../stores/spots';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { useUiSettingsStore } from '../stores/uiSettings';
import {
  detectWeatherAlerts,
  fetchMergedWeather,
  fetchWeatherForecast,
  type DailyWeather,
  type WeatherAlert,
} from '../utils/weather';
import {
  formatDestinationLocationLabel,
  formatHomeLocationLabel,
  formatOverDestinationLabel,
} from '../utils/weatherLocationLabel';
import {
  formatWeekdayDate as formatWeekdayDateShared,
  toLocalDateString,
} from '../utils/dateFormat';

export interface UseDashboardWeatherOptions {
  trip: Ref<Trip | null | undefined> | ComputedRef<Trip | null | undefined>;
  tripId?: Ref<number | null | undefined> | ComputedRef<number | null | undefined> | number;
  isTripOver?: Ref<boolean> | ComputedRef<boolean>;
}

export interface UseDashboardWeatherReturn {
  weatherDays: Ref<DailyWeather[] | null>;
  weatherError: Ref<string | null>;
  weatherLoading: Ref<boolean>;
  homeSpot: ComputedRef<Spot | undefined>;
  home: ComputedRef<{ lat: number; lng: number } | null>;
  homeWeatherDays: Ref<DailyWeather[] | null>;
  homeWeatherError: Ref<string | null>;
  homeWeatherLoading: Ref<boolean>;
  destinationName: ComputedRef<string>;
  destinationLocationLabel: ComputedRef<string>;
  homeLocationLabel: ComputedRef<string>;
  overDestinationLabel: ComputedRef<string>;
  weatherModelLabel: ComputedRef<string>;
  selectedWeatherDay: Ref<DailyWeather | null>;
  selectedWeatherLocation: Ref<{ lat?: number | null; lng?: number | null; label: string } | null>;
  weatherDayDialogOpen: Ref<boolean>;
  vacationForecastDays: ComputedRef<DailyWeather[]>;
  homeForecastDays: ComputedRef<DailyWeather[]>;
  allWeatherDays: ComputedRef<DailyWeather[]>;
  todayWeather: ComputedRef<DailyWeather | null>;
  todayHomeWeather: ComputedRef<DailyWeather | null>;
  selectedWeatherLocationType: Ref<'vacation' | 'home'>;
  selectedVacationDay: ComputedRef<DailyWeather | null>;
  selectedHomeDay: ComputedRef<DailyWeather | null>;
  openWeatherDayDialog: (
    day: DailyWeather,
    loc?: {
      lat?: number | null;
      lng?: number | null;
      label?: string;
      type?: 'vacation' | 'home';
    }
  ) => void;
  getDayAlert: (day: DailyWeather | null) => WeatherAlert | undefined;
  loadWeather: () => Promise<void>;
  loadHomeWeather: () => Promise<void>;
  formatWeekdayDate: (d: string) => string;
}

export function useDashboardWeather(
  options: UseDashboardWeatherOptions
): UseDashboardWeatherReturn {
  const { trip } = options;
  const spotsStore = useSpotsStore();
  const weatherProvider = useWeatherProviderStore();
  const uiSettings = useUiSettingsStore();

  const weatherDays = ref<DailyWeather[] | null>(null);
  const weatherError = ref<string | null>(null);
  const weatherLoading = ref(false);

  const homeSpot = computed(() =>
    spotsStore.spots.find((s) => s.is_home && s.lat != null && s.lng != null)
  );
  const home = computed(() => {
    const p = homeSpot.value;
    return p ? { lat: p.lat as number, lng: p.lng as number } : null;
  });

  const homeWeatherDays = ref<DailyWeather[] | null>(null);
  const homeWeatherError = ref<string | null>(null);
  const homeWeatherLoading = ref(false);

  async function loadWeather() {
    const currentTrip = trip.value;
    if (currentTrip?.lat == null || currentTrip?.lng == null) return;
    weatherLoading.value = true;
    weatherError.value = null;
    try {
      const id =
        currentTrip.id ??
        (typeof options.tripId === 'object' ? options.tripId?.value : options.tripId) ??
        0;
      weatherDays.value = await fetchMergedWeather(
        id,
        currentTrip.lat,
        currentTrip.lng,
        weatherProvider.model
      );
      if (home.value && !homeWeatherDays.value && !homeWeatherLoading.value) {
        void loadHomeWeather();
      }
    } catch {
      weatherError.value = 'Wetterdaten konnten nicht geladen werden.';
    } finally {
      weatherLoading.value = false;
    }
  }

  async function loadHomeWeather() {
    if (!home.value) return;
    homeWeatherLoading.value = true;
    homeWeatherError.value = null;
    try {
      homeWeatherDays.value = await fetchWeatherForecast(
        home.value.lat,
        home.value.lng,
        weatherProvider.model
      );
    } catch {
      homeWeatherError.value = 'Wetterdaten konnten nicht geladen werden.';
    } finally {
      homeWeatherLoading.value = false;
    }
  }

  watch(
    () => [
      trip.value?.lat,
      trip.value?.lng,
      home.value?.lat,
      home.value?.lng,
      weatherProvider.model,
    ],
    () => {
      weatherDays.value = null;
      homeWeatherDays.value = null;
      loadWeather();
      loadHomeWeather();
    }
  );

  const destinationName = computed(
    () => trip.value?.destination?.trim() || trip.value?.name?.trim() || ''
  );

  const destinationLocationLabel = computed(() =>
    formatDestinationLocationLabel(trip.value?.destination, trip.value?.name)
  );

  const homeLocationLabel = computed(() => formatHomeLocationLabel(homeSpot.value?.title));

  const overDestinationLabel = computed(() =>
    formatOverDestinationLabel(trip.value?.destination, trip.value?.name)
  );

  const weatherModelLabel = computed(
    () =>
      WEATHER_MODEL_OPTIONS.find((o) => o.value === weatherProvider.model)?.label ??
      weatherProvider.model
  );

  const selectedWeatherDay = ref<DailyWeather | null>(null);
  const selectedWeatherLocationType = ref<'vacation' | 'home'>('vacation');
  const selectedWeatherLocation = ref<{
    lat?: number | null;
    lng?: number | null;
    label: string;
  } | null>(null);
  const weatherDayDialogOpen = ref(false);

  function openWeatherDayDialog(
    day: DailyWeather,
    loc?: {
      lat?: number | null;
      lng?: number | null;
      label?: string;
      type?: 'vacation' | 'home';
    }
  ) {
    selectedWeatherDay.value = day;
    const isHome =
      loc?.type === 'home' ||
      Boolean(
        home.value &&
        loc?.lat != null &&
        loc.lat === home.value.lat &&
        loc?.lng != null &&
        loc.lng === home.value.lng
      );
    selectedWeatherLocationType.value = isHome ? 'home' : 'vacation';
    selectedWeatherLocation.value = loc
      ? {
          lat: loc.lat,
          lng: loc.lng,
          label:
            loc.label ||
            (isHome ? homeSpot.value?.title || 'Zuhause' : destinationName.value || 'Reiseziel'),
        }
      : {
          lat: trip.value?.lat,
          lng: trip.value?.lng,
          label: destinationName.value || 'Reiseziel',
        };
    weatherDayDialogOpen.value = true;
  }

  const selectedVacationDay = computed(() => {
    if (!selectedWeatherDay.value) return null;
    const found = weatherDays.value?.find((d) => d.date === selectedWeatherDay.value?.date);
    if (found) return found;
    return selectedWeatherLocationType.value === 'vacation' ? selectedWeatherDay.value : null;
  });

  const selectedHomeDay = computed(() => {
    if (!selectedWeatherDay.value) return null;
    const found = homeWeatherDays.value?.find((d) => d.date === selectedWeatherDay.value?.date);
    if (found) return found;
    return selectedWeatherLocationType.value === 'home' ? selectedWeatherDay.value : null;
  });

  function getDayAlert(day: DailyWeather | null): WeatherAlert | undefined {
    if (!day) return undefined;
    return detectWeatherAlerts([day])[0];
  }

  const vacationForecastDays = computed(() => {
    if (!weatherDays.value || !trip.value || !trip.value.start_date || !trip.value.end_date)
      return [];
    const s = trip.value.start_date;
    const e = trip.value.end_date;
    return weatherDays.value.filter((d) => d.date >= s && d.date <= e);
  });

  function addDaysToDateStr(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return toLocalDateString(d);
  }

  const HOME_WEATHER_TAIL_DAYS = 3;
  const homeForecastDays = computed(() => {
    if (!homeWeatherDays.value || !trip.value || !trip.value.start_date || !trip.value.end_date)
      return [];
    const s = trip.value.start_date;
    const e = trip.value.end_date;
    const rangeStart = uiSettings.showHomeWeatherFullTrip
      ? s
      : addDaysToDateStr(e, -(HOME_WEATHER_TAIL_DAYS - 1));
    return homeWeatherDays.value.filter((d) => d.date >= rangeStart && d.date <= e);
  });

  const todayStr = () => toLocalDateString(new Date());

  const todayWeather = computed(
    () => weatherDays.value?.find((d) => d.date === todayStr()) ?? null
  );
  const todayHomeWeather = computed(
    () => homeWeatherDays.value?.find((d) => d.date === todayStr()) ?? null
  );

  const allWeatherDays = computed<DailyWeather[]>(() => {
    const map = new Map<string, DailyWeather>();

    // 1. Alle bekannten Wettertage (Historie + Live-Vorhersage)
    if (weatherDays.value) {
      for (const day of weatherDays.value) {
        if (day?.date) map.set(day.date, day);
      }
    }

    // 2. Nahtloser Übergang zwischen heute, der nahen Zukunft und dem Urlaub:
    // Falls ein Reisezeitraum definiert ist, stellen wir sicher, dass alle
    // Tage des Urlaubs sowie die Tage von heute (oder dem frühesten bekannten Tag)
    // bis zum Urlaubsende lückenlos enthalten sind.
    if (trip.value?.start_date && trip.value?.end_date) {
      const today = todayStr();
      const tripStart = trip.value.start_date;
      const tripEnd = trip.value.end_date;

      let rangeStart = tripStart;
      if (today < tripStart) {
        const earliestWeather = weatherDays.value?.[0]?.date;
        rangeStart = earliestWeather && earliestWeather < today ? earliestWeather : today;
      }

      const rangeEnd = tripEnd;

      // Begrenzung auf maximal 45 Tage Spanne
      const startDateObj = new Date(`${rangeStart}T00:00:00`);
      const endDateObj = new Date(`${rangeEnd}T00:00:00`);
      const diffDays = Math.round(
        (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays >= 0 && diffDays <= 45) {
        const cur = new Date(startDateObj);
        while (cur <= endDateObj) {
          const dStr = toLocalDateString(cur);
          if (!map.has(dStr)) {
            map.set(dStr, {
              date: dStr,
              weatherCode: null,
              tempMax: null,
              tempMin: null,
              precipitationProbability: null,
            });
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  });

  function formatWeekdayDate(d: string) {
    return formatWeekdayDateShared(d);
  }

  return {
    weatherDays,
    weatherError,
    weatherLoading,
    homeSpot,
    home,
    homeWeatherDays,
    homeWeatherError,
    homeWeatherLoading,
    destinationName,
    destinationLocationLabel,
    homeLocationLabel,
    overDestinationLabel,
    weatherModelLabel,
    selectedWeatherDay,
    selectedWeatherLocation,
    weatherDayDialogOpen,
    vacationForecastDays,
    homeForecastDays,
    allWeatherDays,
    todayWeather,
    todayHomeWeather,
    selectedWeatherLocationType,
    selectedVacationDay,
    selectedHomeDay,
    openWeatherDayDialog,
    getDayAlert,
    loadWeather,
    loadHomeWeather,
    formatWeekdayDate,
  };
}
