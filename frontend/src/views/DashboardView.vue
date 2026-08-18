<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type {
  DiaryEntry,
  Note,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  TodoItem,
  TravelItem,
  User,
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useBudgetStore } from '../stores/budget';
import { useDrawersStore } from '../stores/drawers';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { useHomeCurrencyStore } from '../stores/homeCurrency';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useDashboardConfigStore } from '../stores/dashboardConfig';
import { WIDGET_COLORS, SECURITY_TILE_COLOR } from '../utils/widgetColors';
import { buildAllEntries } from '../utils/calendarEntries';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACCOMMODATION_ICON, SECURITY_CHECK_ICON } from '../utils/dashboardTiles';
import { spotCategoryMeta } from '../utils/spotCategory';
import { fetchMergedWeather, fetchWeatherForecast, weatherCodeMeta, type DailyWeather } from '../utils/weather';
import { fetchRegionInfo, type RegionInfo } from '../utils/regionInfo';
import {
  formatDate as formatDateShared,
  formatWeekdayDate as formatWeekdayDateShared,
  toLocalDateString,
} from '../utils/dateFormat';
import { computeDepartureCountdown, computeVacationPhase } from '../utils/departureCountdown';
import BudgetMeter from '../components/BudgetMeter.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import AppIcon from '../components/AppIcon.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const auth = useAuthStore();
const tripStore = useTripStore();
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const budgetStore = useBudgetStore();
const drawers = useDrawersStore();
const weatherProvider = useWeatherProviderStore();
const homeCurrency = useHomeCurrencyStore();
const uiSettings = useUiSettingsStore();
const dashboardConfig = useDashboardConfigStore();
const visibleTileKeys = computed(() => dashboardConfig.entries.filter((e) => e.visible).map((e) => e.key));
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);
const schedule = ref<ScheduleItem[]>([]);
const todos = ref<TodoItem[]>([]);
const packing = ref<PackingItem[]>([]);
const shopping = ref<ShoppingItem[]>([]);
const travelItems = ref<TravelItem[]>([]);
// Unterkunft ist seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz
// normal ein Spot der Kategorie "Unterkunft" - kein eigener Fetch mehr nötig.
const accommodations = computed(() => spotsStore.spots.filter((s) => s.category === 'Unterkunft'));
const diaryEntries = ref<DiaryEntry[]>([]);
const notes = ref<Note[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

const weatherDays = ref<DailyWeather[] | null>(null);
const weatherError = ref<string | null>(null);
const weatherLoading = ref(false);

// Eigenständig geladen statt Teil des großen Promise.all unten: Open-Meteo ist ein externer Dienst,
// ein Fehlschlag/eine Verzögerung dort soll das Laden des restlichen Dashboards nicht blockieren.
async function loadWeather() {
  if (trip.value?.lat == null || trip.value?.lng == null) return;
  weatherLoading.value = true;
  weatherError.value = null;
  try {
    weatherDays.value = await fetchMergedWeather(tripId, trip.value.lat, trip.value.lng, weatherProvider.model);
  } catch {
    weatherError.value = 'Wetterdaten konnten nicht geladen werden.';
  } finally {
    weatherLoading.value = false;
  }
}

// "Zuhause" ist (wie im Kalender, siehe ScheduleView.vue) ein Spot mit is_home-Kennzeichnung statt
// eines eigenen Account-/Trip-Felds - kein Schema-Änderung nötig, dieselbe Quelle wie dort.
const home = computed(() => {
  const p = spotsStore.spots.find((s) => s.is_home && s.lat != null && s.lng != null);
  return p ? { lat: p.lat as number, lng: p.lng as number } : null;
});

const homeWeatherDays = ref<DailyWeather[] | null>(null);
const homeWeatherError = ref<string | null>(null);
const homeWeatherLoading = ref(false);

// Eigenständig geladen, analog zu loadWeather() oben - unabhängiger Fehlschlag (z. B. Zuhause noch
// nicht markiert) soll weder das restliche Dashboard noch das Reiseziel-Wetter blockieren.
async function loadHomeWeather() {
  if (!home.value) return;
  homeWeatherLoading.value = true;
  homeWeatherError.value = null;
  try {
    homeWeatherDays.value = await fetchWeatherForecast(home.value.lat, home.value.lng, weatherProvider.model);
  } catch {
    homeWeatherError.value = 'Wetterdaten konnten nicht geladen werden.';
  } finally {
    homeWeatherLoading.value = false;
  }
}

// Lädt neu, sobald sich die Koordinaten des Urlaubs oder des Zuhause-Spots tatsächlich ändern (z. B.
// nach dem Bearbeiten des Urlaubsorts) ODER der Wetteranbieter in den Einstellungen gewechselt wird –
// vorher lief loadWeather() nur einmal beim Mounten, eine Änderung danach hätte sonst weiterhin die
// alten (oder gar keine) Wetterdaten gezeigt. weatherDays vorher zurücksetzen, damit währenddessen
// nicht kurz die Vorhersage des alten Orts/Modells aufblitzt.
watch(
  () => [trip.value?.lat, trip.value?.lng, home.value?.lat, home.value?.lng, weatherProvider.model],
  () => {
    weatherDays.value = null;
    homeWeatherDays.value = null;
    loadWeather();
    loadHomeWeather();
  },
);

const weatherModelLabel = computed(
  () => WEATHER_MODEL_OPTIONS.find((o) => o.value === weatherProvider.model)?.label ?? weatherProvider.model,
);

const regionInfo = ref<RegionInfo | null>(null);
const regionError = ref<string | null>(null);
const regionLoading = ref(false);

// Eigenständig geladen (analog zu loadWeather() oben): ein externer Dienst soll das Laden des
// restlichen Dashboards nicht blockieren, ein Fehlschlag blendet nur diese Card aus.
async function loadRegionInfo() {
  if (!trip.value) return;
  regionLoading.value = true;
  regionError.value = null;
  try {
    regionInfo.value = await fetchRegionInfo(trip.value.id);
  } catch {
    regionError.value = 'Regionsinfos konnten nicht geladen werden.';
  } finally {
    regionLoading.value = false;
  }
}

// Neu laden, wenn sich der Urlaub oder die Heimatwährung (Wechselkurs-Vergleich) ändert.
watch(
  () => [trip.value?.id, homeCurrency.currency],
  () => {
    regionInfo.value = null;
    loadRegionInfo();
  },
);

// Sprache/Währung/Sicherheitshinweis sind je nach Land oft nur teilweise oder gar nicht verfügbar
// (z. B. keine Einträge bei travel-advisory.info, keine Wechselkurs-Notierung für die Währung) -
// nur die Quellen nennen, die tatsächlich zu einer sichtbaren Zeile im Template beigetragen haben,
// statt pauschal alle drei zu zitieren.
const regionSourceParts = computed(() => {
  if (!regionInfo.value) return [];
  const parts: string[] = [];
  if (regionInfo.value.languages.length || regionInfo.value.currency) parts.push('REST Countries');
  if (regionInfo.value.currency && regionInfo.value.exchangeRate != null) parts.push('open.er-api.com');
  if (regionInfo.value.advisory) parts.push('travel-advisory.info');
  return parts;
});
const regionShowsExchange = computed(() => !!(regionInfo.value?.currency && regionInfo.value.exchangeRate != null));

// WIDGET_COLORS/SECURITY_TILE_COLOR liegen jetzt in utils/widgetColors.ts (NavBar.vue nutzt sie für
// die optionale Nav-Einfärbung mit, siehe NAV_LINK_COLORS dort).

onMounted(async () => {
  try {
    const [scheduleRes, todosRes, packingRes, shoppingRes, travelRes, diaryRes, notesRes, usersRes] =
      await Promise.all([
        api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
        api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
        api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
        api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
        api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
        api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
        api.get<Note[]>(`/notes?trip_id=${tripId}`),
        api.get<User[]>(`/trips/${tripId}/members`),
        spotsStore.load(),
        budgetStore.load(),
      ]);
    schedule.value = scheduleRes;
    todos.value = todosRes;
    packing.value = packingRes;
    shopping.value = shoppingRes;
    travelItems.value = travelRes;
    diaryEntries.value = diaryRes;
    notes.value = notesRes;
    users.value = usersRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
  loadWeather();
  loadRegionInfo();
});

const todayStr = () => toLocalDateString(new Date());

// Tickt einmal pro Minute, damit die Stunden-Anzeige unten (departureCountdown) während einer
// offen gelassenen Seite nicht stehen bleibt, ohne bei jeder Sekunde unnötig neu zu rendern.
const now = ref(new Date());
let nowTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = new Date();
  }, 60_000);
});
onUnmounted(() => {
  if (nowTimer != null) clearInterval(nowTimer);
});

const departureCountdown = computed(() => (trip.value?.start_date ? computeDepartureCountdown(trip.value.start_date, now.value) : null));

// Löst departureCountdown's frühere 'departed'-Phase ab, die dauerhaft "Gute Reise!" zeigte - auch
// noch mitten im Urlaub oder lange nach dessen Ende. computeVacationPhase() liefert stattdessen
// eigene Phasen für Ankunft/laufenden Urlaub/letzten Tag/vorbei (siehe dortiger Kommentar).
const vacationPhase = computed(() => (trip.value ? computeVacationPhase(trip.value, now.value) : null));

// Kalender-Widget: echte Termine + eingebettete synthetische Einträge (Urlaub-Start/-Ende, ToDo
// mit Fälligkeitsdatum), sortiert, die nächsten drei statt nur den einen nächsten (Batch 12).
const upcomingEntries = computed(() =>
  buildAllEntries(
    schedule.value,
    trip.value,
    todos.value,
    travelItems.value,
    excursionsStore.excursions,
    spotsStore.spots,
  )
    .filter((e) => e.endDate >= todayStr())
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .slice(0, 3),
);

function formatDate(d: string) {
  return formatDateShared(d, { includeYear: false });
}

// Packliste: ein zusammengefasstes Widget (statt drei einzelner Tiles) mit Gesamtfortschritt
// plus kompakter Aufschlüsselung je Teilliste (Batch 12).
function progressOf(listItems: PackingItem[]) {
  const total = listItems.reduce((sum, p) => sum + p.quantity, 0);
  const checked = listItems.reduce((sum, p) => sum + Math.min(p.packed_count, p.quantity), 0);
  return { total, checked };
}
const packingTotal = computed(() => progressOf(packing.value));
const packingLists = computed(() => {
  const shared = { key: 'shared', title: 'Gemeinsam', avatar: '🤝', ...progressOf(packing.value.filter((p) => p.owner_id == null)) };
  const perUser = users.value.map((u) => ({
    key: `user-${u.id}`,
    title: u.id === auth.user?.id ? 'Meine Liste' : u.username,
    avatar: u.avatar,
    ...progressOf(packing.value.filter((p) => p.owner_id === u.id)),
  }));
  return [...perUser, shared];
});

const shoppingProgress = computed(() => {
  const total = shopping.value.length;
  const checked = shopping.value.filter((s) => s.checked).length;
  return { total, checked };
});

const todoProgress = computed(() => {
  const total = todos.value.length;
  const done = todos.value.filter((t) => t.done).length;
  return { total, done };
});

const nextTravelItem = computed(() =>
  [...travelItems.value].filter((t) => t.date && t.date >= todayStr()).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0],
);

const currentOrNextAccommodation = computed(() => {
  const today = todayStr();
  const current = accommodations.value.find((a) => a.start_date && a.end_date && a.start_date <= today && today <= a.end_date);
  if (current) return current;
  return [...accommodations.value]
    .filter((a) => a.start_date && a.start_date >= today)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0];
});

// Sortierung nach dem (frei änderbaren) Eintrags-Datum statt nur created_at - muss mit der
// Reihenfolge in DiaryView.vue übereinstimmen, sonst zeigt die Kachel hier einen anderen Eintrag
// als "zuletzt" als den, der dort tatsächlich ganz oben steht (z. B. nach einem rückblickend
// nachgetragenen Eintrag mit einem älteren Datum).
const latestDiaryEntry = computed(() =>
  [...diaryEntries.value].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  )[0],
);

function jumpToTrip() {
  tripStore.requestEditTrip();
}

// Nur die Tage zeigen, die tatsächlich im Urlaubszeitraum liegen UND von Open-Meteo abgedeckt sind
// (nur die kommenden ~16 Tage plus 1 Tag rückwirkend, siehe utils/weather.ts) – bei weiter
// entfernten Urlauben bleibt die Liste vorerst leer statt falsche/fehlende Tage zu zeigen.
const vacationForecastDays = computed(() => {
  if (!weatherDays.value || !trip.value) return [];
  return weatherDays.value.filter((d) => d.date >= trip.value!.start_date && d.date <= trip.value!.end_date);
});

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

// Standardmäßig nur die letzten paar Urlaubstage (Packen/Heimreise im Blick), wahlweise über
// uiSettings.showHomeWeatherFullTrip (ProfileView.vue) für den kompletten Urlaubszeitraum wie beim
// Reiseziel-Wetter oben.
const HOME_WEATHER_TAIL_DAYS = 3;
const homeForecastDays = computed(() => {
  if (!homeWeatherDays.value || !trip.value) return [];
  const rangeStart = uiSettings.showHomeWeatherFullTrip
    ? trip.value.start_date
    : addDaysToDateStr(trip.value.end_date, -(HOME_WEATHER_TAIL_DAYS - 1));
  return homeWeatherDays.value.filter((d) => d.date >= rangeStart && d.date <= trip.value!.end_date);
});

// Zeigt zusätzlich zur (ggf. noch nicht verfügbaren) Urlaubs-Vorhersage immer auch das aktuelle
// Wetter am Zielort – die Vorhersage deckt dank past_days:1 im Fetch (utils/weather.ts) ohnehin
// bereits heute mit ab, unabhängig davon, ob der Urlaub selbst schon im 16-Tage-Fenster liegt.
const todayWeather = computed(() => weatherDays.value?.find((d) => d.date === todayStr()) ?? null);

function formatWeekdayDate(d: string) {
  return formatWeekdayDateShared(d);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <header
      class="hero card"
      :style="trip?.image_url ? { backgroundImage: `linear-gradient(135deg, rgba(0,0,0,.35), rgba(0,0,0,.15)), url(${trip.image_url})` } : {}"
      :class="{ 'has-image': trip?.image_url }"
    >
      <button type="button" class="secondary banner-edit-btn" title="Urlaub bearbeiten" @click="jumpToTrip">
        <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" /> Bearbeiten
      </button>
      <h1>{{ trip?.name || 'Euer Urlaub' }}</h1>
      <p v-if="trip?.destination"><AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> {{ trip.destination }}</p>
      <p v-if="trip">{{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}</p>
      <p v-if="departureCountdown?.phase === 'days'" class="countdown">
        Noch {{ departureCountdown.days }} {{ departureCountdown.days === 1 ? 'Tag' : 'Tage' }} bis zur Abreise 🎒
      </p>
      <p v-else-if="departureCountdown?.phase === 'hours'" class="countdown">
        Noch {{ departureCountdown.hours }} {{ departureCountdown.hours === 1 ? 'Stunde' : 'Stunden' }} bis zur Abreise 🎒
      </p>
      <p v-else-if="vacationPhase?.phase === 'arrived'" class="countdown">Der Urlaub hat begonnen! 🌴</p>
      <p v-else-if="vacationPhase?.phase === 'ongoing' && uiSettings.showVacationCountdown" class="countdown">
        Noch {{ vacationPhase.daysLeft }} {{ vacationPhase.daysLeft === 1 ? 'Tag' : 'Tage' }} Urlaub 🏖️
      </p>
      <p v-else-if="vacationPhase?.phase === 'ongoing'" class="countdown">Genießt euren Urlaub! 🏖️</p>
      <p v-else-if="vacationPhase?.phase === 'lastDay'" class="countdown">Letzter Urlaubstag 🌅</p>
      <p v-else-if="vacationPhase?.phase === 'over'" class="countdown">Der Urlaub ist vorbei 👋</p>
    </header>

    <!-- Wetter + Reiseregion in einer Card statt zweier separater: beide sind "Infos über das
         Reiseziel" und passen inhaltlich zusammen; eine eigene, oft nur teilweise befüllte
         Reiseregion-Card daneben wirkte redundant. Reiseregion-Teil ist rein additiv (eigener
         v-if/v-else-if-Block unten) und bleibt komplett weg, wenn nichts davon tatsächlich Daten
         hat - keine Überschrift/Quelle ohne Inhalt. -->
    <section class="card weather-card">
      <h3><AppIcon :icon="ACTION_ICONS.sun" :size="16" group="actions" /> Wetter</h3>
      <template v-if="trip?.lat != null && trip?.lng != null">
        <p v-if="weatherLoading && !weatherDays" class="hint">Lädt …</p>
        <p v-else-if="weatherError" class="hint error">{{ weatherError }}</p>
        <template v-else>
          <div v-if="todayWeather" class="weather-today">
            <span class="weather-today-label">Heute{{ trip?.destination ? ` in ${trip.destination}` : '' }}</span>
            <WeatherIcon
              class="weather-icon"
              :size="22"
              :code="todayWeather.weatherCode"
              :title="weatherCodeMeta(todayWeather.weatherCode).label"
            />
            <span class="weather-temp">{{ Math.round(todayWeather.tempMax) }}° / {{ Math.round(todayWeather.tempMin) }}°</span>
            <span v-if="todayWeather.precipitationProbability != null" class="weather-rain">
              <AppIcon :icon="ACTION_ICONS.rain" :size="13" group="actions" />{{ todayWeather.precipitationProbability }}%
            </span>
          </div>
          <p class="weather-section-label">
            <AppIcon :icon="vacationPhase?.phase === 'over' ? ACTION_ICONS.sun : ACTION_ICONS.vacation" :size="14" group="actions" />
            {{ vacationPhase?.phase === 'over' ? 'Rückblick: Wetter im Urlaub' : 'Wetter im Urlaub' }}
          </p>
          <p v-if="!vacationForecastDays.length && vacationPhase?.phase !== 'over'" class="hint">
            Für die Urlaubstage liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden
            ~16 Tage ab, schau kurz vorher nochmal vorbei.
          </p>
          <p v-else-if="!vacationForecastDays.length" class="hint">
            Für diesen Zeitraum sind keine Wetterdaten gespeichert.
          </p>
          <div v-else class="weather-days">
            <div class="weather-day" :class="{ past: day.date < todayStr() }" v-for="day in vacationForecastDays" :key="day.date">
              <span class="weather-date">{{ formatWeekdayDate(day.date) }}</span>
              <WeatherIcon
                class="weather-icon"
                :size="22"
                :code="day.weatherCode"
                :title="weatherCodeMeta(day.weatherCode).label"
              />
              <span class="weather-temp">{{ Math.round(day.tempMax) }}° / {{ Math.round(day.tempMin) }}°</span>
              <span v-if="day.precipitationProbability != null" class="weather-rain">
                <AppIcon :icon="ACTION_ICONS.rain" :size="13" group="actions" />{{ day.precipitationProbability }}%
              </span>
            </div>
          </div>
          <!-- Andere Wetter-Apps (Apple Weather/Google) können abweichende Werte zeigen, v. a. bei der
               Bewölkung – eigenes Modell/eigene Quelle statt eines Fehlers, deshalb hier explizit
               benannt (wie DuckDuckGo es bei seinem eigenen Wetter-Widget genauso mit "Quelle: Apple
               Weather" macht). Klickbar statt reinem Text: springt direkt zur Wetter-Anbieter-Auswahl
               in den Einstellungen, falls der Wert einmal nicht passt. -->
          <router-link to="/profile?tab=trip#weather-provider-settings" class="weather-source">
            Quelle: Open-Meteo ({{ weatherModelLabel }}) · Anbieter wechseln
          </router-link>
        </template>
      </template>
      <p v-else class="hint">Hinterlege beim Urlaub einen Maps-Link, um hier die Wettervorhersage für die Urlaubstage zu sehen.</p>

      <!-- Unabhängig vom Trip-Maps-Link oben (kein v-if="trip?.lat...", das bezieht sich nur auf
           das Reiseziel) - Zuhause kommt aus einem eigenen, in Reise > Orte per is_home markierten
           Spot (siehe home-Computed, dasselbe Muster wie ScheduleView.vue's Kalender-Wetter). -->
      <template v-if="home">
        <p class="weather-section-label"><AppIcon :icon="ACTION_ICONS.home" :size="14" group="actions" /> Wetter zuhause</p>
        <p v-if="homeWeatherLoading && !homeWeatherDays" class="hint">Lädt …</p>
        <p v-else-if="homeWeatherError" class="hint error">{{ homeWeatherError }}</p>
        <p v-else-if="!homeForecastDays.length" class="hint">
          Für {{ uiSettings.showHomeWeatherFullTrip ? 'den Urlaubszeitraum' : 'die letzten Urlaubstage' }}
          liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden ~16 Tage ab, schau kurz
          vorher nochmal vorbei.
        </p>
        <div v-else class="weather-days">
          <div class="weather-day" v-for="day in homeForecastDays" :key="day.date">
            <span class="weather-date">{{ formatWeekdayDate(day.date) }}</span>
            <WeatherIcon
              class="weather-icon"
              :size="22"
              :code="day.weatherCode"
              :title="weatherCodeMeta(day.weatherCode).label"
            />
            <span class="weather-temp">{{ Math.round(day.tempMax) }}° / {{ Math.round(day.tempMin) }}°</span>
            <span v-if="day.precipitationProbability != null" class="weather-rain">💧{{ day.precipitationProbability }}%</span>
          </div>
        </div>
      </template>
      <p v-else class="hint">
        Markiere in Reise &gt; Orte einen Ort mit <AppIcon :icon="ACTION_ICONS.home" :size="13" group="actions" /> „Zuhause“, um hier
        zusätzlich das Wetter zuhause gegen Ende des Urlaubs zu sehen.
      </p>

      <template v-if="regionLoading && !regionInfo">
        <p class="weather-section-label"><AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion</p>
        <p class="hint">Lädt …</p>
      </template>
      <template v-else-if="regionError">
        <p class="weather-section-label"><AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion</p>
        <p class="hint error">{{ regionError }}</p>
      </template>
      <template v-else-if="regionInfo && (regionInfo.languages.length || regionInfo.currency || regionInfo.advisory)">
        <p class="weather-section-label"><AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion</p>
        <p v-if="regionInfo.languages.length" class="detail-row">
          <span class="detail-label">Sprache</span>{{ regionInfo.languages.join(', ') }}
        </p>
        <p v-if="regionInfo.currency" class="detail-row">
          <span class="detail-label">Währung</span>
          <AppIcon :icon="ACTION_ICONS.currency" :size="14" group="actions" /> {{ regionInfo.currency.name }} ({{ regionInfo.currency.code }})
          <span v-if="regionInfo.exchangeRate != null">
            · 1 {{ regionInfo.currency.code }} ≈ {{ regionInfo.exchangeRate.toFixed(2) }} {{ homeCurrency.currency }}
          </span>
        </p>
        <p v-if="regionInfo.advisory" class="detail-row">
          <span class="detail-label">Sicherheit</span>
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> {{ regionInfo.advisory.message }}
          <span class="region-advisory-score">({{ regionInfo.advisory.score.toFixed(1) }}/5)</span>
        </p>
        <!-- Nennt nur Quellen, die tatsächlich zu einer der Zeilen oben beigetragen haben (siehe
             regionSourceParts) - und verlinkt nur zur Heimatwährungs-Auswahl, wenn ein Wechselkurs
             auch wirklich mit dabei ist (analog zum "Quelle: Open-Meteo"-Hinweis beim Wetter oben). -->
        <router-link v-if="regionShowsExchange" to="/profile?tab=trip#home-currency-settings" class="weather-source">
          Quelle: {{ regionSourceParts.join(' · ') }} · Anbieter wechseln
        </router-link>
        <p v-else class="weather-source static">Quelle: {{ regionSourceParts.join(' · ') }}</p>
      </template>
    </section>

    <!-- Sichtbarkeit + Reihenfolge der Kacheln kommen aus dashboardConfig.ts (ProfileView.vue's
         "🧩 Dashboard-Kacheln"-Einstellung, 1:1 nach dem Muster der NavBar-Konfiguration/
         navConfig.ts) - jede Kachel behält ihre bisherige, unveränderte Markup/Logik, nur die
         Reihenfolge/Sichtbarkeit ist jetzt datengetrieben statt fest im Template verdrahtet. */-->
    <div class="grid cards">
      <template v-for="key in visibleTileKeys" :key="key">
        <!-- Kalender: Desktop-Schublade bzw. Mobil-Seite /calendar (siehe drawers.openCalendar()),
             kein eigener router-link nötig, da die Kachel je nach Breite unterschiedlich navigieren muss -->
        <button
          v-if="key === 'calendar'"
          type="button"
          class="card tile tile-btn"
          :style="{ background: `${WIDGET_COLORS.get('schedule')}0d` }"
          @click="drawers.openCalendar()"
        >
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('schedule')}26`, borderColor: WIDGET_COLORS.get('schedule') }"
            :icon="SECTION_ICON_DEFS.calendar"
            group="navigation"
            :color="WIDGET_COLORS.get('schedule')"
          />
          <h3>Kalender</h3>
          <ul v-if="upcomingEntries.length" class="mini-list">
            <li v-for="entry in upcomingEntries" :key="entry.key">
              <span class="mini-dot" :style="{ background: SCHEDULE_CATEGORY_META[entry.category].color }"></span>
              <span class="entry-text"
                >{{ formatDate(entry.date) }}<span v-if="entry.time"> · {{ entry.time }}</span> — {{ entry.title }}</span
              >
            </li>
          </ul>
          <p v-else>Noch nichts geplant</p>
        </button>

        <!-- Packliste (zusammengefasst) -->
        <router-link
          v-else-if="key === 'packing'"
          to="/listen?tab=packing"
          class="card tile"
          :style="{ background: `${WIDGET_COLORS.get('packing')}0d` }"
        >
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('packing')}26`, borderColor: WIDGET_COLORS.get('packing') }"
            :icon="SECTION_ICON_DEFS.packing"
            group="navigation"
            :color="WIDGET_COLORS.get('packing')"
          />
          <h3>Packliste</h3>
          <BudgetMeter
            label="Gepackt"
            format="count"
            :spent="packingTotal.checked"
            :target="packingTotal.total"
            :color="WIDGET_COLORS.get('packing')!"
          />
          <ul class="mini-list breakdown">
            <li v-for="list in packingLists" :key="list.key">{{ list.avatar }} {{ list.title }}: {{ list.checked }}/{{ list.total }}</li>
          </ul>
        </router-link>

        <!-- Budget -->
        <router-link v-else-if="key === 'budget'" to="/budget" class="card tile" :style="{ background: `${WIDGET_COLORS.get('budget')}0d` }">
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('budget')}26`, borderColor: WIDGET_COLORS.get('budget') }"
            :icon="SECTION_ICON_DEFS.budget"
            group="navigation"
            :color="WIDGET_COLORS.get('budget')"
          />
          <h3>Budget</h3>
          <BudgetMeter
            label="Ausgegeben"
            :spent="budgetStore.totalSpent"
            :target="budgetStore.grandTotal"
            :color="WIDGET_COLORS.get('budget')!"
          />
        </router-link>

        <!-- Einkaufsliste -->
        <router-link
          v-else-if="key === 'shopping'"
          to="/listen?tab=shopping"
          class="card tile"
          :style="{ background: `${WIDGET_COLORS.get('shopping')}0d` }"
        >
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('shopping')}26`, borderColor: WIDGET_COLORS.get('shopping') }"
            :icon="SECTION_ICON_DEFS.shopping"
            group="navigation"
            :color="WIDGET_COLORS.get('shopping')"
          />
          <h3>Einkaufsliste</h3>
          <BudgetMeter
            label="Gekauft"
            format="count"
            :spent="shoppingProgress.checked"
            :target="shoppingProgress.total"
            :color="WIDGET_COLORS.get('shopping')!"
          />
        </router-link>

        <!-- ToDo -->
        <router-link v-else-if="key === 'todo'" to="/listen?tab=todo" class="card tile" :style="{ background: `${WIDGET_COLORS.get('todo')}0d` }">
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('todo')}26`, borderColor: WIDGET_COLORS.get('todo') }"
            :icon="SECTION_ICON_DEFS.todo"
            group="navigation"
            :color="WIDGET_COLORS.get('todo')"
          />
          <h3>ToDo</h3>
          <BudgetMeter
            label="Erledigt"
            format="count"
            :spent="todoProgress.done"
            :target="todoProgress.total"
            :color="WIDGET_COLORS.get('todo')!"
          />
        </router-link>

        <!-- Reise (Fahrten/Flüge) -->
        <router-link v-else-if="key === 'travel'" to="/travel" class="card tile" :style="{ background: `${WIDGET_COLORS.get('travel')}0d` }">
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('travel')}26`, borderColor: WIDGET_COLORS.get('travel') }"
            :icon="SECTION_ICON_DEFS.travel"
            group="navigation"
            :color="WIDGET_COLORS.get('travel')"
          />
          <h3>Reise</h3>
          <p v-if="nextTravelItem">{{ formatDate(nextTravelItem.date!) }} — {{ nextTravelItem.title }}</p>
          <p v-else-if="travelItems.length">{{ travelItems.length }} Einträge</p>
          <p v-else>Noch nichts eingetragen</p>
        </router-link>

        <!-- Unterkunft: seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts)
             kein eigener Bereich mehr - Sprung zur Spots-Sicht (/excursions), bei bekannter aktueller/
             nächster Unterkunft direkt mit Hash-Hervorhebung des jeweiligen Spots (siehe
             ExcursionsView.vue's hashHighlightId-Verdrahtung). -->
        <router-link
          v-else-if="key === 'accommodation'"
          :to="currentOrNextAccommodation ? `/excursions#spot-${currentOrNextAccommodation.id}` : '/excursions'"
          class="card tile"
          :style="{ background: `${WIDGET_COLORS.get('accommodation')}0d` }"
        >
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('accommodation')}26`, borderColor: WIDGET_COLORS.get('accommodation') }"
            :icon="ACCOMMODATION_ICON"
            group="navigation"
            :color="WIDGET_COLORS.get('accommodation')"
          />
          <h3>Unterkunft</h3>
          <p v-if="currentOrNextAccommodation">
            {{ currentOrNextAccommodation.title }}<span v-if="currentOrNextAccommodation.start_date">
              · {{ formatDate(currentOrNextAccommodation.start_date) }}</span
            >
          </p>
          <p v-else-if="accommodations.length">{{ accommodations.length }} Einträge</p>
          <p v-else>Noch nichts eingetragen</p>
        </router-link>

        <!-- Tagebuch -->
        <router-link v-else-if="key === 'diary'" to="/diary" class="card tile" :style="{ background: `${WIDGET_COLORS.get('diary')}0d` }">
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('diary')}26`, borderColor: WIDGET_COLORS.get('diary') }"
            :icon="SECTION_ICON_DEFS.diary"
            group="navigation"
            :color="WIDGET_COLORS.get('diary')"
          />
          <h3>Tagebuch</h3>
          <p v-if="diaryEntries.length">{{ diaryEntries.length }} {{ diaryEntries.length === 1 ? 'Eintrag' : 'Einträge' }}<span v-if="latestDiaryEntry"> · zuletzt {{ formatDate(latestDiaryEntry.date) }}</span></p>
          <p v-else>Noch nichts geschrieben</p>
        </router-link>

        <!-- Notizen -->
        <router-link v-else-if="key === 'notes'" to="/notes" class="card tile" :style="{ background: `${WIDGET_COLORS.get('notes')}0d` }">
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${WIDGET_COLORS.get('notes')}26`, borderColor: WIDGET_COLORS.get('notes') }"
            :icon="SECTION_ICON_DEFS.notes"
            group="navigation"
            :color="WIDGET_COLORS.get('notes')"
          />
          <h3>Notizen</h3>
          <p v-if="notes.length">{{ notes.length }} {{ notes.length === 1 ? 'Notiz' : 'Notizen' }}</p>
          <p v-else>Noch nichts notiert</p>
        </router-link>

        <!-- Sicherheits-Check: reines Spaß-Gimmick ohne echte Funktion, siehe SecurityCheckView.vue -->
        <router-link
          v-else-if="key === 'securityCheck'"
          to="/security-check"
          class="card tile"
          :style="{ background: `${SECURITY_TILE_COLOR}0d` }"
        >
          <AppIcon
            class="tile-icon"
            :size="18"
            :style="{ background: `${SECURITY_TILE_COLOR}26`, borderColor: SECURITY_TILE_COLOR }"
            :icon="SECURITY_CHECK_ICON"
            group="navigation"
            :color="SECURITY_TILE_COLOR"
          />
          <h3>Sicherheits-Check</h3>
          <p>Der Reisotor scannt eure Reiseregion 🤖🔍</p>
        </router-link>
      </template>
    </div>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.hero {
  position: relative;
  margin-bottom: var(--space-4);
  background: linear-gradient(135deg, var(--color-primary-tint), var(--color-surface));
  background-size: cover;
  background-position: center;
}

.hero.has-image {
  color: #fff;
}

.hero.has-image h1,
.hero.has-image p,
.hero.has-image .countdown {
  /* Die globale p { color: var(--color-text-muted) }-Regel (style.css) setzt die Farbe direkt auf
     jedes <p> selbst – ein per Vererbung von .hero.has-image kommendes color:#fff greift dadurch
     NICHT (eine eigene Deklaration am Element schlägt Vererbung immer, unabhängig von der
     Spezifität des Vorfahren). Ort- und Datumszeile (reine <p> ohne eigene Klasse) waren deshalb
     bei hinterlegtem Bild weiterhin kontrastarm grau statt weiß. */
  color: #fff;
}

.banner-edit-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  font-size: 0.8rem;
  padding: 4px 10px;
  /* Bei stark eingeschränktem .app-main (z. B. beide Schubladen gleichzeitig offen auf einem nur
     mäßig breiten Desktop-Viewport, siehe narrowDesktop-Fall in layout-overlap.spec.ts) schrumpft
     die Hero-Card teils auf eine Breite unter der intrinsischen Button-Breite – ohne max-width ragt
     der (per position:absolute von der Kartenbreite unabhängige) Button dann links aus der Card. */
  max-width: calc(100% - 2 * var(--space-3));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* .secondary ist transparent mit --color-primary-Schrift – über einem Foto (statt dem sonst
   einfarbigen Verlaufs-Hintergrund) oft zu wenig Kontrast, je nach Bildmotiv. Bei hinterlegtem
   Bild deshalb ein fester halbtransparenter dunkler Chip mit weißer Schrift, unabhängig vom
   jeweiligen Bildmotiv immer gut lesbar (gleiches Muster wie die schwebenden Bearbeiten-/
   Löschen-Buttons auf Karten-Vorschaubildern). */
.hero.has-image .banner-edit-btn {
  background: rgba(20, 20, 18, 0.55);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.hero.has-image .banner-edit-btn:hover {
  background: rgba(20, 20, 18, 0.75);
}

.hero h1 {
  color: var(--color-primary-dark);
}

.countdown {
  color: var(--color-accent);
  font-weight: 600;
}

.weather-card {
  margin-bottom: var(--space-4);
}

.weather-card h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
  margin-bottom: var(--space-2);
}

.weather-today {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
}

.weather-today-label {
  flex: 1;
  min-width: 0;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9rem;
}

.weather-section-label {
  margin: 0 0 6px;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.weather-card .hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.weather-card .hint.error {
  color: var(--color-danger);
}

.weather-days {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: 4px;
}

.weather-day {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 68px;
  padding: var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-hover);
}

/* Bereits vergangene Urlaubstage (Rückblick-Modus, siehe vacationPhase 'over') optisch abgesetzt -
   gleiches Muster wie .hint (gedämpfte Textfarbe) statt eines neuen Farb-Tokens. */
.weather-day.past {
  color: var(--color-text-muted);
  opacity: 0.75;
}

.weather-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.weather-icon {
  font-size: 1.4rem;
}

.weather-temp {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.weather-rain {
  font-size: 0.72rem;
  color: var(--color-accent-secondary);
}

.weather-source {
  display: inline-block;
  margin: var(--space-2) 0 0;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-decoration-style: dotted;
}

.weather-source:hover {
  color: var(--color-primary-dark);
}

/* Reine Text-Variante (kein <router-link>) für den Fall, dass keine der genannten Quellen zur
   Heimatwährungs-Einstellung verlinkt werden soll (kein Wechselkurs unter den gezeigten Zeilen). */
.weather-source.static {
  text-decoration: none;
  cursor: default;
}

.weather-source.static:hover {
  color: var(--color-text-muted);
}

.region-advisory-score {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.cards {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding-top: 22px;
  /* Zeilenabstand größer als der globale .grid-Standard (--space-3, 16px): .tile-icon (unten) ragt
     22px über den oberen Rand seiner eigenen Kachel hinaus (abgerundetes "Badge"-Icon, halb auf/
     halb über der Kachel) - bei nur 16px Zeilenabstand überdeckt es damit die Kachel der Zeile
     darüber. --space-4 (24px) lässt 2px Luft; Spaltenabstand bleibt beim schmaleren Standardwert,
     da dort kein Icon hineinragt. */
  row-gap: var(--space-4);
  column-gap: var(--space-3);
}

.tile {
  position: relative;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.tile-btn {
  width: 100%;
}

.tile-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  padding: .5rem;
}

.tile h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
  margin-top: var(--space-2);
  text-align: center;
}

.tile > p {
  text-align: center;
  font-size: 0.88rem;
}

.mini-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Block als Ganzes bleibt mittig in der Kachel (wie h3/p daneben), schrumpft dabei aber auf
     die tatsächlich benötigte Breite – sonst würde .entry-text (flex:1, s.u.) über die volle
     Kachelbreite gestreckt und sein Text (per :left ausdrücklich statt vom <button>-Element der
     Kalender-Kachel geerbtem text-align:center) inhaltsabhängig unterschiedlich weit eingerückt
     wirken statt sauber untereinander auf einer Fluchtlinie zu stehen. */
  align-self: center;
  width: fit-content;
  max-width: 100%;
  text-align: left;
}

.mini-list li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.entry-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mini-list.breakdown {
  color: var(--color-text-muted);
  flex-wrap: wrap;
  flex-direction: row;
  gap: 4px 10px;
  /* Diese Variante (Zeilen-Umbruch statt vertikaler Liste) soll weiterhin die volle Kachelbreite
     nutzen können, nicht auf den engeren Fluchtlinien-Look der Kalender-Liste schrumpfen. */
  align-self: stretch;
  width: auto;
  max-width: none;
}

.mini-list.breakdown li {
  gap: 0;
}
</style>
