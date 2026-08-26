<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Modal from './Modal.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import {
  detectWeatherAlerts,
  fetchHourlyForecast,
  weatherCodeMeta,
  type DailyWeather,
  type HourlyWeather,
} from '../utils/weather';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { useWeatherProviderStore, WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  modelValue: boolean;
  day: DailyWeather | null;
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const router = useRouter();
const weatherProvider = useWeatherProviderStore();
const hourlyList = ref<HourlyWeather[]>([]);
const loading = ref(false);

const dayAlerts = computed(() => (props.day ? detectWeatherAlerts([props.day]) : []));

const weatherModelLabel = computed(
  () =>
    WEATHER_MODEL_OPTIONS.find((o) => o.value === weatherProvider.model)?.label ??
    weatherProvider.model
);

watch(
  () => [props.modelValue, props.day, props.lat, props.lng, weatherProvider.model] as const,
  async ([open, day, lat, lng, model]) => {
    if (!open || !day || lat == null || lng == null) {
      hourlyList.value = [];
      return;
    }
    loading.value = true;
    try {
      hourlyList.value = await fetchHourlyForecast(lat, lng, day.date, model);
    } catch {
      hourlyList.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

function close() {
  emit('update:modelValue', false);
}

function goToSettings() {
  close();
  router.push('/settings');
}

function formatDate(dateStr: string) {
  return formatDateShared(dateStr, { includeYear: false });
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="day ? `Wetter am ${formatDate(day.date)}` : 'Wetter-Details'"
    @update:model-value="close"
  >
    <div v-if="day" class="weather-detail-body">
      <!-- Standort-Information -->
      <div v-if="locationLabel" class="location-badge">
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> {{ locationLabel }}
      </div>

      <!-- Unwetter- / Wetter-Warnungen für diesen Tag (Issue #296) -->
      <div v-if="dayAlerts.length" class="weather-dialog-alerts">
        <div
          v-for="alert in dayAlerts"
          :key="alert.id"
          class="weather-alert-card"
          :class="alert.severity"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="18" group="actions" />
          <div class="alert-content">
            <strong>{{ alert.title }}</strong>
            <span>{{ alert.description }}</span>
          </div>
        </div>
      </div>

      <!-- Haupt-Zusammenfassung -->
      <div class="summary-card">
        <div class="main-weather">
          <WeatherIcon :code="day.weatherCode" :size="42" />
          <div class="meta">
            <span class="label">{{ weatherCodeMeta(day.weatherCode).label }}</span>
            <div class="temps">
              <span class="temp-max">{{ Math.round(day.tempMax) }}°</span>
              <span class="temp-min">{{ Math.round(day.tempMin) }}°</span>
            </div>
          </div>
        </div>
        <div v-if="day.precipitationProbability != null" class="rain-meta">
          <span class="rain-label">Regenwahrscheinlichkeit</span>
          <span class="rain-val">💧 {{ day.precipitationProbability }}%</span>
        </div>
      </div>

      <!-- Stündlicher Verlauf -->
      <div class="hourly-section">
        <h3>Tagesverlauf</h3>
        <div v-if="loading" class="hourly-loading">Lade Verlauf...</div>
        <div v-else-if="hourlyList.length" class="hourly-grid">
          <div v-for="h in hourlyList" :key="h.time" class="hourly-item">
            <span class="time">{{ h.time }}</span>
            <WeatherIcon :code="h.weatherCode" :size="20" />
            <span class="temp">{{ h.temp }}°</span>
            <span
              v-if="h.precipitationProbability != null && h.precipitationProbability > 0"
              class="rain"
              >{{ h.precipitationProbability }}%</span
            >
          </div>
        </div>
        <div v-else class="hourly-empty">Kein stündlicher Verlauf verfügbar.</div>
      </div>

      <!-- Modell-Hinweis & Einstellungen (Issue #133) -->
      <div class="model-info-box">
        <div class="model-text">
          <span class="model-title">Wettermodell: {{ weatherModelLabel }}</span>
          <span class="model-sub">Wetterdaten können je nach Modell abweichen.</span>
        </div>
        <Button variant="secondary" size="sm" class="model-btn" @click="goToSettings">
          <AppIcon :icon="ACTION_ICONS.filterSettings" :size="14" group="actions" /> Modell in
          Einstellungen ändern
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.weather-detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.location-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.summary-card {
  background: var(--color-hover);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.main-weather {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.meta {
  display: flex;
  flex-direction: column;
}

.label {
  font-weight: 600;
  font-size: 1.05rem;
}

.temps {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
}

.temp-max {
  font-size: 1.4rem;
  font-weight: 700;
}

.temp-min {
  font-size: 1rem;
  color: var(--color-text-muted);
}

.rain-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  padding-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.rain-val {
  font-weight: 600;
  color: var(--color-primary-dark);
}

.hourly-section h3 {
  font-size: 0.95rem;
  margin-bottom: var(--space-2);
}

.hourly-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-2);
}

@media (max-width: 480px) {
  .hourly-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.hourly-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 4px;
}

.time {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.temp {
  font-weight: 600;
  font-size: 0.88rem;
}

.rain {
  font-size: 0.7rem;
  color: #3b82f6;
}

.hourly-loading,
.hourly-empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-3);
}

.model-info-box {
  margin-top: var(--space-1);
  padding: var(--space-3);
  background: var(--color-primary-tint);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.model-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-primary-dark);
}

.model-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.model-btn {
  align-self: flex-start;
}
</style>
