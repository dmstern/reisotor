<script setup lang="ts">
import { computed } from 'vue';
import type { DailyWeather, WeatherAlert } from '../../utils/weather';
import { weatherCodeMeta, getWeatherUnknownReason, isWeatherUnknown } from '../../utils/weather';
import AppIcon from '../AppIcon.vue';
import WeatherIcon from '../WeatherIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const props = defineProps<{
  day: DailyWeather;
  dateLabel: string;
  isPast?: boolean;
  alert?: WeatherAlert;
}>();

defineEmits<{
  (e: 'click'): void;
}>();

const itemTitle = computed(() => {
  if (isWeatherUnknown(props.day)) {
    return `${props.dateLabel}: ${getWeatherUnknownReason(props.day.date)}`;
  }
  return `${props.dateLabel}: ${weatherCodeMeta(props.day.weatherCode).label}`;
});
</script>

<template>
  <div
    class="weather-day clickable"
    :class="{ past: isPast, unknown: isWeatherUnknown(day) }"
    role="button"
    tabindex="0"
    :title="itemTitle"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <span class="weather-date">{{ dateLabel }}</span>
    <div class="weather-icon-wrapper">
      <WeatherIcon class="weather-icon" :size="22" :code="day.weatherCode" :title="itemTitle" />
      <span v-if="alert" class="weather-alert-badge" :class="alert.severity" :title="alert.title">
        <AppIcon :icon="ACTION_ICONS.warning" :size="10" group="actions" />
      </span>
    </div>
    <span class="weather-temp">
      <template v-if="day.tempMax != null && day.tempMin != null">
        {{ Math.round(day.tempMax) }}° / {{ Math.round(day.tempMin) }}°
      </template>
      <template v-else-if="day.tempMax != null"> {{ Math.round(day.tempMax) }}° </template>
      <template v-else-if="day.tempMin != null"> {{ Math.round(day.tempMin) }}° </template>
      <template v-else> – </template>
    </span>
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
    transform var(--transition-fast),
    background var(--transition-fast);
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
  font-size: var(--font-size-xs);
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
  font-size: var(--font-size-xl);
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
  font-size: var(--font-size-sm);
  font-weight: 600;
  white-space: nowrap;
}

.weather-rain {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-accent-secondary);
}
</style>
