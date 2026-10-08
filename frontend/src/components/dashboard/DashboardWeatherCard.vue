<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { Trip } from '../../api/types';
import { useTripStore } from '../../stores/trip';
import { useHomeCurrencyStore } from '../../stores/homeCurrency';
import { useUiSettingsStore } from '../../stores/uiSettings';
import { useDashboardWeather } from '../../composables/useDashboardWeather';
import { useRegionInfo } from '../../composables/useRegionInfo';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { DEMO_MODE } from '../../demo/isDemoMode';
import AppIcon from '../AppIcon.vue';
import DetailRow from '../primitives/DetailRow.vue';
import WeatherDayDetailDialog from '../WeatherDayDetailDialog.vue';
import DashboardWeatherTodayRow from './DashboardWeatherTodayRow.vue';
import DashboardWeatherDayItem from './DashboardWeatherDayItem.vue';

const props = defineProps<{
  trip: Trip;
  isTripOver?: boolean;
}>();

const tripStore = useTripStore();
const homeCurrency = useHomeCurrencyStore();
const uiSettings = useUiSettingsStore();

const tripRef = computed(() => props.trip);
const isTripOverRef = computed(() => !!props.isTripOver);

const {
  weatherDays,
  weatherError,
  weatherLoading,
  home,
  homeSpot,
  homeWeatherDays,
  homeWeatherError,
  homeWeatherLoading,
  destinationName,
  destinationLocationLabel,
  homeLocationLabel,
  overDestinationLabel,
  weatherModelLabel,
  vacationForecastDays,
  homeForecastDays,
  todayWeather,
  todayHomeWeather,
  selectedWeatherDay,
  selectedWeatherLocation,
  weatherDayDialogOpen,
  openWeatherDayDialog,
  getDayAlert,
  loadWeather,
  formatWeekdayDate,
} = useDashboardWeather({ trip: tripRef, isTripOver: isTripOverRef });

const {
  regionInfo,
  regionError,
  regionLoading,
  regionSourceParts,
  regionShowsExchange,
  loadRegionInfo,
} = useRegionInfo(tripRef);

const todayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

onMounted(() => {
  loadWeather();
  loadRegionInfo();
});
</script>

<template>
  <section class="card weather-card">
    <h3><AppIcon :icon="ACTION_ICONS.sun" :size="16" group="actions" /> Wetter</h3>
    <template v-if="trip.lat != null && trip.lng != null">
      <p v-if="weatherLoading && !weatherDays" class="hint">Lädt …</p>
      <p v-else-if="weatherError" class="hint error">{{ weatherError }}</p>
      <template v-else>
        <!-- Nach Urlaubsende (isTripOver): Falls ein Heimatort mit Koordinaten
             hinterlegt ist, wird das heutige Wetter zuhause angezeigt (Nutzer:innen sind wieder
             daheim), und das Reiseziel-Wetter transparent als "Heute am Reiseziel" ausgewiesen.
             Vor/während des Urlaubs wird nur das Reiseziel transparent benannt. -->
        <DashboardWeatherTodayRow
          v-if="isTripOver && home && todayHomeWeather"
          :weather="todayHomeWeather"
          :label="`Heute ${homeLocationLabel}`"
          :icon="ACTION_ICONS.home"
          :alert="getDayAlert(todayHomeWeather)"
          @click="
            openWeatherDayDialog(todayHomeWeather, {
              lat: home.lat,
              lng: home.lng,
              label: homeSpot?.title || 'Zuhause',
            })
          "
        />

        <DashboardWeatherTodayRow
          v-if="todayWeather"
          :weather="todayWeather"
          :label="`Heute ${isTripOver ? overDestinationLabel : destinationLocationLabel}`"
          :icon="isTripOver ? ACTION_ICONS.vacation : undefined"
          :alert="getDayAlert(todayWeather)"
          @click="openWeatherDayDialog(todayWeather)"
        />

        <p class="weather-section-label">
          <AppIcon
            :icon="isTripOver ? ACTION_ICONS.sun : ACTION_ICONS.vacation"
            :size="14"
            group="actions"
          />
          {{ isTripOver ? 'Rückblick: Wetter im Urlaub' : 'Wetter im Urlaub' }}
        </p>
        <p v-if="!trip.start_date" class="hint">
          Hinterlege einen Reisezeitraum beim Urlaub, um hier die Wettervorhersage für die
          Urlaubstage zu sehen.
        </p>
        <p v-else-if="!vacationForecastDays.length && !isTripOver" class="hint">
          Für die Urlaubstage liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden
          ~16 Tage ab, schau kurz vorher nochmal vorbei.
        </p>
        <p v-else-if="!vacationForecastDays.length" class="hint">
          Für diesen Zeitraum sind keine Wetterdaten gespeichert.
        </p>
        <div v-else class="weather-days">
          <DashboardWeatherDayItem
            v-for="day in vacationForecastDays"
            :key="day.date"
            :day="day"
            :date-label="formatWeekdayDate(day.date)"
            :is-past="day.date < todayStr()"
            :alert="getDayAlert(day)"
            @click="openWeatherDayDialog(day)"
          />
        </div>

        <p v-if="DEMO_MODE" class="weather-source static">
          Demo-Wetterdaten (keine echte Vorhersage)
        </p>
        <button
          v-else
          type="button"
          class="weather-source"
          @click="tripStore.requestEditTrip('settings')"
        >
          Quelle: Open-Meteo ({{ weatherModelLabel }}) · Anbieter wechseln
        </button>
      </template>
    </template>
    <p v-else class="hint">
      Hinterlege beim Urlaub einen Maps-Link, um hier die Wettervorhersage für die Urlaubstage zu
      sehen.
    </p>

    <template v-if="home && !isTripOver">
      <p class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.home" :size="14" group="actions" /> Wetter zuhause
      </p>
      <p v-if="homeWeatherLoading && !homeWeatherDays" class="hint">Lädt …</p>
      <p v-else-if="homeWeatherError" class="hint error">{{ homeWeatherError }}</p>
      <p v-else-if="!homeForecastDays.length" class="hint">
        Für
        {{ uiSettings.showHomeWeatherFullTrip ? 'den Urlaubszeitraum' : 'die letzten Urlaubstage' }}
        liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden ~16 Tage ab, schau kurz
        vorher nochmal vorbei.
      </p>
      <div v-else class="weather-days">
        <DashboardWeatherDayItem
          v-for="day in homeForecastDays"
          :key="day.date"
          :day="day"
          :date-label="formatWeekdayDate(day.date)"
          :alert="getDayAlert(day)"
          @click="
            openWeatherDayDialog(day, {
              lat: home.lat,
              lng: home.lng,
              label: homeSpot?.title || 'Zuhause',
            })
          "
        />
      </div>
    </template>
    <p v-else-if="!home && !isTripOver" class="hint">
      Markiere in der Karte unter Spots einen Spot mit
      <AppIcon :icon="ACTION_ICONS.home" :size="13" group="actions" /> „Zuhause“, um hier zusätzlich
      das Wetter zuhause gegen Ende des Urlaubs zu sehen.
    </p>

    <template v-if="regionLoading && !regionInfo">
      <p class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion
      </p>
      <p class="hint">Lädt …</p>
    </template>
    <template v-else-if="regionError">
      <p class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion
      </p>
      <p class="hint error">{{ regionError }}</p>
    </template>
    <template
      v-else-if="
        regionInfo && (regionInfo.languages.length || regionInfo.currency || regionInfo.advisory)
      "
    >
      <p class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion
      </p>
      <DetailRow v-if="regionInfo.languages.length" label="Sprache">
        {{ regionInfo.languages.join(', ') }}
      </DetailRow>
      <DetailRow v-if="regionInfo.currency" label="Währung">
        <AppIcon :icon="ACTION_ICONS.currency" :size="14" group="actions" />
        {{ regionInfo.currency.name }} ({{ regionInfo.currency.code }})
        <span v-if="regionInfo.exchangeRate != null">
          · <span class="nobr">1&nbsp;{{ regionInfo.currency.code }}</span> ≈
          <span class="nobr"
            >{{ regionInfo.exchangeRate.toFixed(2) }}&nbsp;{{ homeCurrency.currency }}</span
          >
        </span>
      </DetailRow>
      <DetailRow v-if="regionInfo.advisory" label="Sicherheit">
        <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
        {{ regionInfo.advisory.message }}
        <span class="region-advisory-score">({{ regionInfo.advisory.score.toFixed(1) }}/5)</span>
      </DetailRow>
      <router-link
        v-if="regionShowsExchange"
        to="/settings?tab=trip#home-currency-settings"
        class="weather-source"
      >
        Quelle: {{ regionSourceParts.join(' · ') }} · Anbieter wechseln
      </router-link>
      <p v-else class="weather-source static">Quelle: {{ regionSourceParts.join(' · ') }}</p>
    </template>
  </section>

  <WeatherDayDetailDialog
    v-model="weatherDayDialogOpen"
    :day="selectedWeatherDay"
    :lat="selectedWeatherLocation?.lat ?? trip.lat"
    :lng="selectedWeatherLocation?.lng ?? trip.lng"
    :location-label="selectedWeatherLocation?.label || destinationName || 'Reiseziel'"
  />
</template>

<style scoped>
.weather-card {
  margin-bottom: var(--space-4);
}

.weather-card h3 {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-primary-dark);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-2);
}

.weather-section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.weather-card .hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.weather-card .hint.error {
  color: var(--color-danger);
}

.weather-days {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

.weather-source {
  display: inline-block;
  margin: var(--space-2) 0 var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-decoration: underline;
  text-decoration-style: dotted;
  background: none;
  border: none;
  padding: var(--space-1) 0;
  cursor: pointer;
  font-family: inherit;
  word-break: break-word;
}

.weather-source:hover {
  color: var(--color-primary-dark);
}

.weather-source.static {
  text-decoration: none;
  cursor: default;
}

.weather-source.static:hover {
  color: var(--color-text-muted);
}

.region-advisory-score {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
