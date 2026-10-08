<script setup lang="ts">
import type { DailyWeather, WeatherAlert } from '../../utils/weather';
import { weatherCodeMeta } from '../../utils/weather';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import WeatherIcon from '../WeatherIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

defineProps<{
  weather: DailyWeather;
  label: string;
  icon?: IconDef;
  alert?: WeatherAlert;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div
    class="weather-today clickable"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <span class="weather-today-label">
      <AppIcon v-if="icon" :icon="icon" :size="14" group="actions" />
      <span class="weather-today-text">{{ label }}</span>
    </span>
    <div class="weather-icon-wrapper">
      <WeatherIcon
        class="weather-icon"
        :size="22"
        :code="weather.weatherCode"
        :title="weatherCodeMeta(weather.weatherCode).label"
      />
      <span v-if="alert" class="weather-alert-badge" :class="alert.severity" :title="alert.title">
        <AppIcon :icon="ACTION_ICONS.warning" :size="10" group="actions" />
      </span>
    </div>
    <span class="weather-temp"
      >{{ Math.round(weather.tempMax) }}° / {{ Math.round(weather.tempMin) }}°</span
    >
    <span v-if="weather.precipitationProbability != null" class="weather-rain">
      <AppIcon :icon="ACTION_ICONS.rain" :size="13" group="actions" />{{
        weather.precipitationProbability
      }}%
    </span>
  </div>
</template>

<style scoped>
.weather-today {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
}

.weather-today.clickable {
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast);
}

.weather-today.clickable:hover {
  transform: translateY(-2px);
}

.weather-today-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.weather-today-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  flex-shrink: 0;
}

.weather-rain {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-accent-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
