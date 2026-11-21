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
import Alert from '../primitives/Alert.vue';
import DetailRow from '../primitives/DetailRow.vue';
import HorizontalScroller from '../primitives/HorizontalScroller.vue';
import LoadingSpinner from '../primitives/LoadingSpinner.vue';
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
  allWeatherDays,
  todayWeather,
  todayHomeWeather,
  selectedWeatherDay,
  selectedWeatherLocationType,
  selectedWeatherLocation,
  selectedVacationDay,
  selectedHomeDay,
  weatherDayDialogOpen,
  openWeatherDayDialog,
  getDayAlert,
  loadWeather,
  loadHomeWeather,
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

onMounted(() => {
  loadWeather();
  loadHomeWeather();
  loadRegionInfo();
});
</script>

<template>
  <section class="card weather-card">
    <div class="weather-header">
      <h3><AppIcon :icon="ACTION_ICONS.sun" :size="16" group="actions" /> Wetter</h3>
      <template v-if="trip.lat != null && trip.lng != null">
        <p
          v-if="weatherLoading && !weatherDays"
          class="hint weather-loading-hint"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner variant="radar" size="sm" decorative />
          <span>Lädt …</span>
        </p>
        <Alert
          v-else-if="weatherError"
          variant="danger"
          size="sm"
          reportable
          :description="weatherError"
          error-context="Wetterdaten laden"
        />
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
                type: 'home',
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
        </template>
      </template>
      <p v-else class="hint">
        Hinterlege beim Urlaub einen Maps-Link, um hier die Wettervorhersage für die Urlaubstage zu
        sehen.
      </p>
    </div>

    <div
      v-if="
        trip.lat != null && trip.lng != null && !(weatherLoading && !weatherDays) && !weatherError
      "
      class="weather-section"
    >
      <h4 class="weather-section-label">
        <AppIcon
          :icon="isTripOver ? ACTION_ICONS.sun : ACTION_ICONS.vacation"
          :size="14"
          group="actions"
        />
        {{ isTripOver ? 'Rückblick: Wetter im Urlaub' : 'Wetter im Urlaub' }}
      </h4>
      <p v-if="!trip.start_date" class="hint">
        Hinterlege einen Reisezeitraum beim Urlaub, um hier die Wettervorhersage für die Urlaubstage
        zu sehen.
      </p>
      <p v-else-if="!vacationForecastDays.length && !isTripOver" class="hint">
        Für die Urlaubstage liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden ~16
        Tage ab, schau kurz vorher nochmal vorbei.
      </p>
      <p v-else-if="!vacationForecastDays.length" class="hint">
        Für diesen Zeitraum sind keine Wetterdaten gespeichert.
      </p>
      <HorizontalScroller
        v-else
        class="weather-days"
        prev-label="Urlaubswetter nach links scrollen"
        next-label="Urlaubswetter nach rechts scrollen"
      >
        <DashboardWeatherDayItem
          v-for="day in vacationForecastDays"
          :key="day.date"
          :day="day"
          :date-label="formatWeekdayDate(day.date)"
          :is-past="day.date < todayStr()"
          :alert="getDayAlert(day)"
          @click="openWeatherDayDialog(day)"
        />
      </HorizontalScroller>

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
    </div>

    <div v-if="!isTripOver" class="weather-section">
      <h4 class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.home" :size="14" group="actions" /> Wetter zuhause
      </h4>
      <template v-if="home">
        <p v-if="homeWeatherLoading && !homeWeatherDays" class="hint">Lädt …</p>
        <Alert
          v-else-if="homeWeatherError"
          variant="danger"
          size="sm"
          reportable
          :description="homeWeatherError"
          error-context="Wetterdaten (Zuhause) laden"
        />
        <p v-else-if="!homeForecastDays.length" class="hint">
          Für
          {{
            uiSettings.showHomeWeatherFullTrip ? 'den Urlaubszeitraum' : 'die letzten Urlaubstage'
          }}
          liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden ~16 Tage ab, schau
          kurz vorher nochmal vorbei.
        </p>
        <HorizontalScroller
          v-else
          class="weather-days"
          prev-label="Wetter zuhause nach links scrollen"
          next-label="Wetter zuhause nach rechts scrollen"
        >
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
                type: 'home',
              })
            "
          />
        </HorizontalScroller>
      </template>
      <p v-else class="hint">
        Markiere in der Karte unter Spots einen Spot mit
        <AppIcon :icon="ACTION_ICONS.home" :size="13" group="actions" /> „Zuhause“, um hier
        zusätzlich das Wetter zuhause gegen Ende des Urlaubs zu sehen.
      </p>
    </div>

    <div
      v-if="
        (regionLoading && !regionInfo) ||
        regionError ||
        (regionInfo && (regionInfo.languages.length || regionInfo.currency || regionInfo.advisory))
      "
      class="weather-section"
    >
      <h4 class="weather-section-label">
        <AppIcon :icon="ACTION_ICONS.region" :size="14" group="actions" /> Reiseregion
      </h4>
      <p v-if="regionLoading && !regionInfo" class="hint">Lädt …</p>
      <Alert
        v-else-if="regionError"
        variant="danger"
        size="sm"
        reportable
        :description="regionError"
        error-context="Regionsinfos laden"
      />
      <template v-else-if="regionInfo">
        <div class="region-details">
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
            <AppIcon
              :icon="
                regionInfo.advisory.score > 2.0 ? ACTION_ICONS.warning : ACTION_ICONS.shieldCheck
              "
              :size="14"
              group="actions"
            />
            {{ regionInfo.advisory.message }}
            <span class="region-advisory-score"
              >({{ regionInfo.advisory.score.toFixed(1) }}/5)</span
            >
          </DetailRow>
        </div>
        <router-link
          v-if="regionShowsExchange"
          to="/settings?tab=trip#home-currency-settings"
          class="weather-source"
        >
          Quelle: {{ regionSourceParts.join(' · ') }} · Anbieter wechseln
        </router-link>
        <p v-else class="weather-source static">Quelle: {{ regionSourceParts.join(' · ') }}</p>
      </template>
    </div>
  </section>

  <WeatherDayDetailDialog
    v-model="weatherDayDialogOpen"
    :date="selectedWeatherDay?.date"
    :day="selectedWeatherDay"
    :lat="selectedWeatherLocation?.lat ?? trip.lat"
    :lng="selectedWeatherLocation?.lng ?? trip.lng"
    :location-label="selectedWeatherLocation?.label || destinationName || 'Reiseziel'"
    :vacation-day="selectedVacationDay"
    :vacation-lat="trip.lat"
    :vacation-lng="trip.lng"
    :vacation-location-label="destinationName || 'Reiseziel'"
    :vacation-days="allWeatherDays"
    :home-day="selectedHomeDay"
    :home-lat="home?.lat"
    :home-lng="home?.lng"
    :home-location-label="homeSpot?.title || 'Zuhause'"
    :home-days="homeWeatherDays || undefined"
    :initial-location="selectedWeatherLocationType"
    @navigate-day="(d) => (selectedWeatherDay = d)"
  />
</template>

<style lang="scss" scoped>
.weather-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.weather-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.weather-card h3 {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin: 0;
  color: var(--color-primary-dark);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-tight);
}

.weather-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  @include divider-engraved('top');
}

.weather-section-label {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: var(--line-height-snug);
}

.weather-section-label :deep(.app-icon) {
  color: var(--color-primary-dark);
}

.region-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.region-details :deep(.detail-row) {
  margin: 0;
}

.weather-card .hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.weather-days {
  --horizontal-scroller-gap: var(--space-sm);
  --horizontal-scroller-padding: var(--space-1-5);
  margin: calc(-1 * var(--space-1-5));
}

.weather-source {
  align-self: flex-start;
  margin: 0;
  padding: 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-snug);
  color: var(--color-text-muted);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  word-break: break-word;
}

a.weather-source {
  @include touch-target($expand: true);
}

.weather-source:hover {
  color: var(--color-primary-dark);
}

.weather-source:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
  border-radius: var(--radius-xs-squircle);
}

.weather-source.static {
  text-decoration: none;
  cursor: default;
}

.weather-source.static:hover {
  color: var(--color-text-muted);
}

.weather-loading-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.region-advisory-score {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
