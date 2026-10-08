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
  todayWeather: ComputedRef<DailyWeather | null>;
  todayHomeWeather: ComputedRef<DailyWeather | null>;
  openWeatherDayDialog: (
    day: DailyWeather,
    loc?: { lat?: number | null; lng?: number | null; label: string }
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
  const selectedWeatherLocation = ref<{
    lat?: number | null;
    lng?: number | null;
    label: string;
  } | null>(null);
  const weatherDayDialogOpen = ref(false);

  function openWeatherDayDialog(
    day: DailyWeather,
    loc?: { lat?: number | null; lng?: number | null; label: string }
  ) {
    selectedWeatherDay.value = day;
    selectedWeatherLocation.value = loc ?? {
      lat: trip.value?.lat,
      lng: trip.value?.lng,
      label: destinationName.value || 'Reiseziel',
    };
    weatherDayDialogOpen.value = true;
  }

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
    todayWeather,
    todayHomeWeather,
    openWeatherDayDialog,
    getDayAlert,
    loadWeather,
    loadHomeWeather,
    formatWeekdayDate,
  };
}
