<script setup lang="ts">
import type { DailyWeather, WeatherAlert } from '../../utils/weather';
import { weatherCodeMeta } from '../../utils/weather';
import AppIcon from '../AppIcon.vue';
import WeatherIcon from '../WeatherIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

defineProps<{
  day: DailyWeather;
  dateLabel: string;
  isPast?: boolean;
  alert?: WeatherAlert;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div
    class="weather-day clickable"
    :class="{ past: isPast }"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <span class="weather-date">{{ dateLabel }}</span>
    <div class="weather-icon-wrapper">
      <WeatherIcon
        class="weather-icon"
        :size="22"
        :code="day.weatherCode"
        :title="weatherCodeMeta(day.weatherCode).label"
      />
      <span v-if="alert" class="weather-alert-badge" :class="alert.severity" :title="alert.title">
        <AppIcon :icon="ACTION_ICONS.warning" :size="10" group="actions" />
      </span>
    </div>
    <span class="weather-temp"
      >{{ Math.round(day.tempMax) }}° / {{ Math.round(day.tempMin) }}°</span
    >
    <span v-if="day.precipitationProbability != null" class="weather-rain">
      <AppIcon :icon="ACTION_ICONS.rain" :size="13" group="actions" />{{
        day.precipitationProbability
      }}%
    </span>
  </div>
</template>

<style scoped>
.weather-day {
  position: relative;
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

.weather-day.clickable {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.weather-day.clickable:hover {
  transform: translateY(-2px);
}

/* Bereits vergangene Urlaubstage (Rückblick-Modus) optisch abgesetzt */
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

.weather-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.weather-icon {
  font-size: 1.4rem;
}

.weather-alert-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: var(--shadow-sm);
}

.weather-alert-badge.warning {
  background: var(--color-warning);
}

.weather-alert-badge.danger {
  background: var(--color-danger);
}

.weather-temp {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.weather-rain {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: var(--color-accent-secondary);
}
</style>
