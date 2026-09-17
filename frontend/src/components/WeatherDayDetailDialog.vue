<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTripStore } from '../stores/trip';
import Modal from './Modal.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import WeatherAlertCard from './WeatherAlertCard.vue';
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

const tripStore = useTripStore();
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
  tripStore.requestEditTrip('settings');
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
        <WeatherAlertCard
          v-for="alert in dayAlerts"
          :key="alert.id"
          :severity="alert.severity"
          :title="alert.title"
          :description="alert.description"
        />
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
      <div class="hourly-section" :class="{ 'is-loading': loading }">
        <div class="hourly-header">
          <h3>Tagesverlauf</h3>
          <Transition name="badge-fade">
            <Badge
              v-if="loading"
              variant="primary"
              class="hourly-loading-badge"
              role="status"
              aria-live="polite"
            >
              <span class="pulse-indicator" aria-hidden="true">
                <span class="pulse-ring"></span>
                <span class="pulse-dot"></span>
              </span>
              <span>Lade Verlauf…</span>
            </Badge>
          </Transition>
        </div>

        <div class="hourly-stage">
          <Transition name="hourly-swap" mode="out-in">
            <!-- Loading Skeleton Grid (6 Kacheln wie die Zielansicht) -->
            <div
              v-if="loading"
              key="skeleton"
              class="hourly-grid skeleton-grid"
              aria-busy="true"
              aria-label="Lade stündlichen Wetterverlauf"
            >
              <div
                v-for="idx in 6"
                :key="idx"
                class="hourly-item skeleton-item"
                :style="{ '--index': idx - 1 }"
              >
                <div class="skeleton-shimmer"></div>
                <div class="skeleton-bar skeleton-time"></div>
                <div class="skeleton-icon-placeholder"></div>
                <div class="skeleton-bar skeleton-temp"></div>
                <div class="skeleton-bar skeleton-rain"></div>
              </div>
            </div>

            <!-- Geladene Kacheln mit sanft-schlangigem Hereingleiten -->
            <div
              v-else-if="hourlyList.length"
              key="list"
              class="hourly-grid"
              role="region"
              aria-label="Stündlicher Wetterverlauf"
            >
              <div
                v-for="(h, idx) in hourlyList"
                :key="h.time"
                class="hourly-item loaded-item"
                :style="{
                  '--index': idx,
                  '--dir': idx % 2 === 0 ? -1 : 1,
                }"
              >
                <span class="time">{{ h.time }}</span>
                <WeatherIcon :code="h.weatherCode" :size="20" />
                <span class="temp">{{ h.temp }}°</span>
                <span
                  v-if="h.precipitationProbability != null && h.precipitationProbability > 0"
                  class="rain"
                  title="Regenwahrscheinlichkeit"
                  >{{ h.precipitationProbability }}%</span
                >
                <span v-else class="rain rain-placeholder" aria-hidden="true">&nbsp;</span>
              </div>
            </div>

            <!-- Leerer Zustand -->
            <div v-else key="empty" class="hourly-empty">Kein stündlicher Verlauf verfügbar.</div>
          </Transition>
        </div>
      </div>

      <!-- Modell-Hinweis & Einstellungen (Issue #133) -->
      <div class="model-info-box">
        <div class="model-text">
          <span class="model-title">Wettermodell: {{ weatherModelLabel }}</span>
          <span class="model-sub">Wetterdaten können je nach Modell abweichen.</span>
        </div>
        <Button variant="secondary" size="sm" class="model-btn" @click="goToSettings">
          <AppIcon :icon="ACTION_ICONS.filterSettings" :size="14" group="actions" /> Modell in
          Urlaubs-Einstellungen ändern
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

.weather-dialog-alerts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

.hourly-section {
  display: flex;
  flex-direction: column;
  transition: min-height 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
  min-height: 110px;
}

@media (max-width: 480px) {
  .hourly-section {
    min-height: 190px;
  }
}

.hourly-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.hourly-header h3 {
  font-size: 0.95rem;
  margin-bottom: 0;
}

.hourly-loading-badge {
}

.pulse-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8px;
  height: 8px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.pulse-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: var(--color-primary);
  opacity: 0.75;
  animation: radar-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes radar-ping {
  75%,
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}

.badge-fade-enter-active,
.badge-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.badge-fade-enter-from,
.badge-fade-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.hourly-stage {
  position: relative;
  width: 100%;
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
  min-height: 76px;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1),
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.hourly-item.loaded-item {
  animation: hourly-snake-in 0.52s cubic-bezier(0.34, 1.35, 0.64, 1) both;
  animation-delay: calc(var(--index, 0) * 55ms);
}

.hourly-item.loaded-item:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: var(--shadow-sm);
  border-color: var(--color-primary-light, var(--color-border));
}

@keyframes hourly-snake-in {
  0% {
    opacity: 0;
    transform: translateY(20px) translateX(calc(var(--dir, 1) * 7px))
      rotate(calc(var(--dir, 1) * 2.8deg)) scale(0.92);
  }
  65% {
    opacity: 1;
    transform: translateY(-2px) translateX(calc(var(--dir, 1) * -1px))
      rotate(calc(var(--dir, 1) * -0.5deg)) scale(1.015);
  }
  100% {
    opacity: 1;
    transform: translateY(0) translateX(0) rotate(0deg) scale(1);
  }
}

/* Skeleton Kacheln während des Ladens */
.skeleton-item {
  position: relative;
  overflow: hidden;
  border-style: dashed;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.skeleton-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 35%,
    rgba(255, 255, 255, 0.35) 50%,
    rgba(255, 255, 255, 0.15) 65%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer-sweep 1.8s infinite;
  animation-delay: calc(var(--index, 0) * 110ms);
  pointer-events: none;
}

[data-theme='dark'] .skeleton-shimmer,
:root:not([data-theme='light']) .skeleton-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.03) 35%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 65%,
    transparent 100%
  );
}

@keyframes shimmer-sweep {
  100% {
    transform: translateX(100%);
  }
}

.skeleton-bar {
  background: var(--color-hover);
  border-radius: var(--radius-sm);
}

.skeleton-time {
  width: 28px;
  height: 10px;
}

.skeleton-icon-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-hover);
}

.skeleton-temp {
  width: 22px;
  height: 12px;
}

.skeleton-rain {
  width: 24px;
  height: 8px;
  opacity: 0.5;
}

.hourly-swap-enter-active,
.hourly-swap-leave-active {
  transition: opacity 0.18s ease;
}

.hourly-swap-enter-from,
.hourly-swap-leave-to {
  opacity: 0;
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
  min-height: 14px;
  line-height: 14px;
  white-space: nowrap;
}

.rain.rain-placeholder {
  visibility: hidden;
  user-select: none;
}

.hourly-empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-3);
}

@media (prefers-reduced-motion: reduce) {
  .pulse-ring,
  .skeleton-shimmer,
  .hourly-item.loaded-item {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
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
