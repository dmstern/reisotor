<script setup lang="ts">
import { ref } from 'vue';
import type { CalendarEntry, Spot } from '../api/types';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { weatherCodeMeta } from '../utils/weather';
import type { DayWeatherEntry } from '../utils/dayWeather';
import { toLocalDateString } from '../utils/dateFormat';
import { ACCOMMODATION_ICON } from '../utils/dashboardTiles';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';

interface Day {
  date: string;
  entries: CalendarEntry[];
  /** Unterkunft-Spots (Kategorie "Unterkunft"), die an diesem Tag aktiv sind – siehe
   *  Migrationskommentar in db/index.ts. */
  accommodations: Spot[];
  weatherEntries: DayWeatherEntry[];
  /** Nur in der echten Monatsansicht gesetzt (ScheduleView.vue's monthWeeks): führende/nachfolgende
   *  Tage aus dem Vor-/Folgemonat, die das Wochen-Raster auffüllen – optisch gedämpft, damit auf
   *  einen Blick klar ist, welche Tage zum aktuell angezeigten Monat gehören. */
  otherMonth?: boolean;
}

const props = defineProps<{
  days: Day[];
  selectedDate: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}>();

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
  return date === toLocalDateString(new Date());
}

function isInTrip(date: string) {
  if (!props.tripStartDate || !props.tripEndDate) return false;
  return date >= props.tripStartDate && date <= props.tripEndDate;
}

function isTripStart(date: string) {
  return props.tripStartDate != null && date === props.tripStartDate;
}

function isTripEnd(date: string) {
  return props.tripEndDate != null && date === props.tripEndDate;
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
      role="button"
      tabindex="0"
      :data-date="day.date"
      :class="{
        active: day.date === selectedDate,
        today: isToday(day.date),
        'in-trip': isInTrip(day.date),
        'trip-start': isTripStart(day.date),
        'trip-end': isTripEnd(day.date),
        'drag-over': isDragOver(day.date),
        'other-month': day.otherMonth,
      }"
      @click="emit('select', day.date)"
      @keydown.enter.prevent="emit('select', day.date)"
      @keydown.space.prevent="emit('select', day.date)"
      @dragover.prevent
      @dragenter.prevent="onDragEnter(day.date)"
      @dragleave="onDragLeave(day.date)"
      @drop.prevent="onDrop($event, day.date)"
    >
      <div class="day-head">
        <!-- Weekday bleibt für Screen-Reader und E2E-Tests vorhanden, wird aber für Sehende
             durch die übergeordnete Wochentagszeile (ScheduleView) ersetzt -->
        <span class="weekday sr-only">{{ weekday(day.date) }}</span>
        <div class="day-badge-wrap">
          <span class="num">{{ dayNumber(day.date) }}</span>
          <div class="day-weather-row" v-if="day.weatherEntries.length">
            <span
              v-for="entry in day.weatherEntries"
              :key="entry.key"
              class="day-weather"
              :title="`${entry.label}: ${weatherCodeMeta(entry.weather.weatherCode).label}`"
            >
              <WeatherIcon :code="entry.weather.weatherCode" :size="11" />
              <span>{{ Math.round(entry.weather.tempMax) }}°</span>
            </span>
          </div>
        </div>
      </div>

      <div class="acc-bar" v-for="acc in day.accommodations" :key="acc.id" :title="acc.title">
        <AppIcon :icon="ACCOMMODATION_ICON" :size="10" group="categories" />
        <span class="acc-bar-title">{{ acc.title }}</span>
      </div>

      <div class="items">
        <div
          class="item-line"
          v-for="entry in day.entries.slice(0, 3)"
          :key="entry.key"
          :title="entry.title"
          :style="{
            '--item-cat-color': SCHEDULE_CATEGORY_META[entry.category].color,
          }"
        >
          <span v-if="entry.time" class="time">{{ entry.time }}</span>
          <!-- Rein visuell (nicht klickbar, pointer-events:none): diese kompakte Zelle ist selbst
               ein großer Klick-Ziel für "Tag auswählen" (@click auf .day oben) – eine hier
               tatsächlich klickbare Checkbox würde bei ungünstiger Cursor-Position versehentlich
               statt der Tagesauswahl das Todo abhaken (siehe day-detail-Liste unten für die echte,
               anklickbare Checkbox mit ausreichend Abstand). -->
          <span
            v-if="entry.kind === 'todo'"
            class="item-checkbox"
            :class="{ checked: entry.done }"
            aria-hidden="true"
          />
          <AppIcon
            v-else
            :icon="entry.iconDef ?? SCHEDULE_CATEGORY_META[entry.category].tabler"
            :size="10"
            group="categories"
          />
          <span class="item-line-title">{{ entry.title }}</span>
        </div>
        <div class="more" v-if="day.entries.length > 3">+{{ day.entries.length - 3 }} mehr</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week {
  container-type: inline-size;
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
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 5px 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--color-text);
  cursor: pointer;
  min-height: 64px;
  min-width: 0;
  overflow: hidden;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.day:hover {
  background: var(--color-hover);
  transform: translateY(-1px);
}

.day.in-trip {
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
}

.day.in-trip:hover {
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-surface));
}

/* Urlaubs-Streifen am unteren Rand der Zelle */
.day.in-trip::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
  opacity: 0.7;
  pointer-events: none;
}

.day.in-trip.trip-start::after {
  left: 3px;
  border-top-left-radius: 3px;
  border-bottom-left-radius: 3px;
}

.day.in-trip.trip-end::after {
  right: 3px;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
}

.day.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.day.drag-over {
  background: var(--color-primary-tint);
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
}

/* Leucht-Effekt, wenn der "Einplanen"-Anfasser einer SpotCard gerade gezogen wird (#drag) */
:global(body.is-dragging-calendar) .day {
  background: var(--color-scheduled-tint);
  border-color: color-mix(in srgb, var(--color-scheduled) 40%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-scheduled) 20%, transparent);
}

:global(body.is-dragging-calendar) .day.in-trip {
  background: color-mix(in srgb, var(--color-scheduled) 12%, var(--color-surface));
}

:global(body.is-dragging-calendar) .day:hover {
  background: color-mix(in srgb, var(--color-scheduled) 20%, var(--color-surface));
  transform: translateY(-1px);
}

/* Führende/nachfolgende Tage aus dem Vor-/Folgemonat in der echten Monatsansicht (siehe otherMonth
   oben) – dezent abgesetzt statt per harter Deckkraft gedämpft, damit Text und Wetterwerte WCAG AA
   Kontrastanforderungen (4.5:1) für interaktive Zellen erfüllen und Termine lesbar bleiben. */
.day.other-month {
  background: color-mix(in srgb, var(--color-surface) 60%, var(--color-hover));
  border-style: dashed;
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.day.other-month .num {
  color: var(--color-text-muted);
}

.day-head {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.weekday.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.day-badge-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  min-height: 22px;
}

@container (max-width: 480px) {
  .day-badge-wrap {
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .day-weather-row {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .day-badge-wrap {
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .day-weather-row {
    justify-content: center;
  }
}

@container (max-width: 360px) {
  .day {
    padding: 4px 2px;
  }
}

@media (max-width: 360px) {
  .day {
    padding: 4px 2px;
  }
}

.num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 3px;
  border-radius: var(--radius-pill);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}

.day.today .num {
  background: var(--color-primary);
  color: var(--color-primary-contrast, #ffffff);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.day-weather-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.day-weather {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  line-height: 1;
}

.acc-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-accent-secondary-bg);
  color: var(--color-accent-secondary);
  font-size: 0.58rem;
  font-weight: 600;
  border-radius: 4px;
  padding: 1px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

.acc-bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-line {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.62rem;
  background: var(--color-hover);
  border-radius: 3px;
  border-left: 2.5px solid var(--item-cat-color, var(--color-primary));
  padding: 1px 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

.item-line-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.item-checkbox {
  appearance: none;
  -webkit-appearance: none;
  display: inline-block;
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  margin: 0 2px 0 0;
  padding: 0;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 2px;
  background: var(--color-surface);
  position: relative;
  vertical-align: -1px;
  /* Rein informativ, siehe Template-Kommentar oben – Klicks fallen durch zum Tages-@click. */
  pointer-events: none;
}

.item-checkbox:checked,
.item-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.item-checkbox:checked::after,
.item-checkbox.checked::after {
  content: '';
  width: 2px;
  height: 5px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  position: absolute;
  left: 2px;
  top: 0px;
  transform: rotate(45deg);
}

.time {
  color: var(--color-primary-dark);
  font-weight: 700;
  margin-right: 2px;
  flex-shrink: 0;
}

.more {
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0 3px;
  text-align: right;
}

@media (min-width: 700px) {
  .day {
    min-height: 84px;
    padding: 7px 6px;
    gap: 4px;
  }

  .item-line,
  .acc-bar {
    font-size: 0.68rem;
  }
}
</style>
