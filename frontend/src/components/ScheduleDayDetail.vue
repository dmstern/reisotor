<script setup lang="ts">
import type { CalendarEntry } from '../api/types';
import type { DayWeatherEntry } from '../utils/dayWeather';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import EmptyState from './primitives/EmptyState.vue';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';
import ScheduleEntryItem from './ScheduleEntryItem.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { weatherCodeMeta } from '../utils/weather';

defineProps<{
  selectedDate: string;
  entries: CalendarEntry[];
  accommodations: Array<{ id: number; title: string }>;
  weatherEntries: DayWeatherEntry[];
  isToday: boolean;
  isTripDate: boolean;
  formatDay: string;
  entryDone: (entry: CalendarEntry) => boolean;
}>();

defineEmits<{
  (e: 'showOnMap'): void;
  (e: 'openAccommodation', id: number): void;
  (e: 'openEntry', entry: CalendarEntry): void;
  (e: 'toggleTodoDone', todoId: number): void;
}>();
</script>

<template>
  <Card class="day-detail">
    <div class="day-detail-head">
      <div class="day-detail-title-group">
        <h3>{{ formatDay }}</h3>
        <Badge v-if="isToday" variant="accent" size="sm">Heute</Badge>
        <Badge v-else-if="isTripDate" variant="primary" size="sm">Urlaubstag</Badge>
      </div>
      <div class="day-detail-actions">
        <Button variant="card-action" size="sm" @click="$emit('showOnMap')">
          <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
          anzeigen
        </Button>
      </div>
    </div>

    <div class="day-meta-bar" v-if="weatherEntries.length || accommodations.length">
      <div
        v-for="entry in weatherEntries"
        :key="entry.key"
        class="day-meta-pill weather-pill"
        :title="`${entry.label}: ${weatherCodeMeta(entry.weather.weatherCode).label}`"
      >
        <WeatherIcon :code="entry.weather.weatherCode" :size="16" />
        <span class="meta-label">{{ entry.label }}:</span>
        <span class="temp-range">
          <strong>{{ Math.round(entry.weather.tempMax) }}°</strong>
          <span class="temp-min"> / {{ Math.round(entry.weather.tempMin) }}°</span>
        </span>
        <span v-if="entry.weather.precipitationProbability != null" class="rain-prob">
          · <AppIcon :icon="ACTION_ICONS.rain" :size="12" group="actions" />
          {{ entry.weather.precipitationProbability }}%
        </span>
      </div>

      <button
        type="button"
        v-for="acc in accommodations"
        :key="acc.id"
        class="day-meta-pill acc-pill is-clickable"
        :title="`Unterkunft: ${acc.title} auf Karte anzeigen`"
        @click="$emit('openAccommodation', acc.id)"
      >
        <AppIcon :icon="spotCategoryMeta('Unterkunft').tabler" :size="14" group="categories" />
        <span class="meta-label">Unterkunft:</span>
        <strong>{{ acc.title }}</strong>
      </button>
    </div>

    <TransitionGroup tag="ul" name="list" class="items">
      <ScheduleEntryItem
        v-for="(entry, index) in entries"
        :key="entry.key"
        :entry="entry"
        :index="index"
        :is-done="entryDone(entry)"
        @click="$emit('openEntry', entry)"
        @toggle-todo="entry.todoId != null && $emit('toggleTodoDone', entry.todoId)"
      />
      <EmptyState v-if="!entries.length" key="empty" tag="li">
        Noch keine Termine an diesem Tag.
      </EmptyState>
    </TransitionGroup>
  </Card>
</template>

<style scoped>
.day-detail {
  container-type: inline-size;
  container-name: day-detail;
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.day-detail-title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.day-detail-title-group h3 {
  color: var(--color-primary-dark);
  margin: 0;
  font-size: 1.15rem;
}

.day-detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.day-meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.day-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 0.82rem;
  border: 1px solid var(--color-border);
  background: var(--color-hover);
  color: var(--color-text);
}

.day-meta-pill.weather-pill {
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.day-meta-pill.acc-pill {
  background: var(--color-accent-secondary-bg);
  border-color: color-mix(in srgb, var(--color-accent-secondary) 25%, transparent);
  color: var(--color-accent-secondary);
}

.day-meta-pill.acc-pill.is-clickable {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.day-meta-pill.acc-pill.is-clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.meta-label {
  font-weight: 500;
  color: var(--color-text-muted);
}

.day-meta-pill.acc-pill .meta-label {
  color: var(--color-accent-secondary);
  opacity: 0.85;
}

.temp-range {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.temp-min {
  color: var(--color-text-muted);
  font-weight: normal;
}

.rain-prob {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
