<script setup lang="ts">
import { ref } from 'vue';
import type { Accommodation, CalendarEntry } from '../api/types';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { weatherCodeMeta } from '../utils/weather';
import type { DayWeatherEntry } from '../utils/dayWeather';

interface Day {
  date: string;
  entries: CalendarEntry[];
  accommodations: Accommodation[];
  weatherEntries: DayWeatherEntry[];
}

defineProps<{ days: Day[]; selectedDate: string | null }>();
const emit = defineEmits<{
  (e: 'select', date: string): void;
  (e: 'drop-excursion', date: string, excursionId: number): void;
}>();

const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

function dayNumber(date: string) {
  return new Date(date).getDate();
}

function weekday(date: string) {
  return weekdayFormatter.format(new Date(date));
}

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}

// Zähler statt Boolean pro Tag: dragenter/dragleave feuern beim Überqueren verschachtelter
// Kind-Elemente (day-head, item-line, …) mehrfach, ein einfacher Boolean würde dabei flackern.
const dragOverCounts = ref<Record<string, number>>({});

function isDragOver(date: string) {
  return (dragOverCounts.value[date] ?? 0) > 0;
}

function onDragEnter(date: string) {
  dragOverCounts.value[date] = (dragOverCounts.value[date] ?? 0) + 1;
}

function onDragLeave(date: string) {
  dragOverCounts.value[date] = Math.max(0, (dragOverCounts.value[date] ?? 0) - 1);
}

function onDrop(event: DragEvent, date: string) {
  dragOverCounts.value[date] = 0;
  const raw = event.dataTransfer?.getData('text/excursion-id');
  if (!raw) return;
  emit('drop-excursion', date, Number(raw));
}
</script>

<template>
  <div class="week">
    <div
      v-for="day in days"
      :key="day.date"
      class="day"
      :data-date="day.date"
      :class="{ active: day.date === selectedDate, today: isToday(day.date), 'drag-over': isDragOver(day.date) }"
      @click="emit('select', day.date)"
      @dragover.prevent
      @dragenter.prevent="onDragEnter(day.date)"
      @dragleave="onDragLeave(day.date)"
      @drop.prevent="onDrop($event, day.date)"
    >
      <div class="day-head">
        <span class="weekday">{{ weekday(day.date) }}</span>
        <span class="num">{{ dayNumber(day.date) }}</span>
        <div class="day-weather-row" v-if="day.weatherEntries.length">
          <span
            v-for="entry in day.weatherEntries"
            :key="entry.key"
            class="day-weather"
            :title="`${entry.label}: ${weatherCodeMeta(entry.weather.weatherCode).label}`"
          >
            {{ entry.icon }} {{ Math.round(entry.weather.tempMax) }}°
          </span>
        </div>
      </div>

      <div class="acc-bar" v-for="acc in day.accommodations" :key="acc.id" :title="acc.name">
        🛏️ {{ acc.name }}
      </div>

      <div class="items">
        <div
          class="item-line"
          v-for="entry in day.entries.slice(0, 3)"
          :key="entry.key"
          :title="entry.title"
          :style="{ borderLeftColor: SCHEDULE_CATEGORY_META[entry.category].color }"
        >
          <span v-if="entry.time" class="time">{{ entry.time }}</span
          >{{ entry.icon ?? SCHEDULE_CATEGORY_META[entry.category].icon }} {{ entry.title }}
        </div>
        <div class="more" v-if="day.entries.length > 3">+{{ day.entries.length - 3 }} mehr</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week {
  display: grid;
  /* minmax(0, 1fr) statt nur 1fr: ohne das explizite Minimum von 0 verhindert die intrinsische
     Mindestbreite von unumbrochenem Text (z. B. langer Termin-Titel) das gleichmäßige
     Zusammenschrumpfen der Spalten – einzelne Tage würden sonst aus dem Raster herausfallen,
     besonders in der schmalen Kalender-Schublade. */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
  margin-bottom: var(--space-1);
}

.day {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--color-text);
  cursor: pointer;
  min-height: 64px;
  min-width: 0;
  overflow: hidden;
}

.day:hover {
  background: var(--color-hover);
}

.day.today .num {
  color: var(--color-accent);
}

.day.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
}

.day.drag-over {
  background: var(--color-primary-tint);
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
}

.day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.weekday {
  font-size: 0.6rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.num {
  font-size: 0.95rem;
  font-weight: 600;
}

.day-weather-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 3px;
}

.day-weather {
  font-size: 0.52rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.acc-bar {
  background: var(--color-accent-secondary-bg);
  color: var(--color-accent-secondary);
  font-size: 0.55rem;
  border-radius: 4px;
  padding: 1px 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-line {
  font-size: 0.6rem;
  background: var(--color-hover);
  border-radius: 4px;
  border-left: 3px solid transparent;
  padding: 1px 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  color: var(--color-primary-dark);
  font-weight: 600;
  margin-right: 2px;
}

.more {
  font-size: 0.55rem;
  color: var(--color-text-muted);
  padding: 0 3px;
}

@media (min-width: 700px) {
  .day {
    min-height: 84px;
    padding: 8px 6px;
  }

  .item-line,
  .acc-bar {
    font-size: 0.68rem;
  }
}
</style>
