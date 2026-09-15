<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarEntry } from '../../api/types';

const props = defineProps<{
  upcoming: CalendarEntry[];
}>();

const nextEntry = computed(() => {
  if (!props.upcoming.length) return null;
  return props.upcoming[0];
});

// Datum ermitteln (entweder nächster Termin oder heute)
const displayDate = computed(() => {
  const d = nextEntry.value ? new Date(`${nextEntry.value.date}T00:00:00`) : new Date();
  return {
    dayNum: d.getDate(),
    weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
    month: d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase(),
  };
});
</script>

<template>
  <div class="calendar-preview-stage" aria-hidden="true">
    <!-- Tischkalender mit 3D-Aufsteller -->
    <div class="desk-calendar">
      <!-- Spiralbindung oben (Wire Rings) -->
      <div class="spiral-rings">
        <span class="spiral-ring" />
        <span class="spiral-ring" />
        <span class="spiral-ring" />
        <span class="spiral-ring" />
        <span class="spiral-ring" />
      </div>

      <!-- Kalenderblatt -->
      <div class="calendar-sheet">
        <!-- Rotes Monats-Banner -->
        <div class="month-header">
          <span class="month-text">{{ displayDate.month }}</span>
        </div>

        <!-- Große Tageszahl & Wochentag -->
        <div class="sheet-body">
          <span class="day-number">{{ displayDate.dayNum }}</span>
          <span class="weekday-text">{{ displayDate.weekday }}</span>

          <!-- Termin-Hinweis-Punkt -->
          <div v-if="nextEntry" class="event-indicator">
            <span class="event-dot" />
            <span class="event-title">{{ nextEntry.title }}</span>
          </div>
          <div v-else class="event-empty">
            <span class="empty-hint">Freier Tag</span>
          </div>
        </div>

        <!-- Abreißkante / Schatten unten -->
        <div class="sheet-curl" />
      </div>

      <!-- Standfuß-Schatten hinten -->
      <div class="calendar-stand" />
    </div>
  </div>
</template>

<style scoped>
.calendar-preview-stage {
  position: relative;
  width: 90px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.desk-calendar {
  position: relative;
  width: 66px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Spiralringe */
.spiral-rings {
  position: relative;
  width: 52px;
  height: 8px;
  display: flex;
  justify-content: space-between;
  margin-bottom: -4px;
  z-index: 5;
}

.spiral-ring {
  width: 4px;
  height: 8px;
  background: linear-gradient(180deg, #94a3b8 0%, #ffffff 40%, #64748b 100%);
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

/* Kalenderblatt */
.calendar-sheet {
  position: relative;
  width: 66px;
  height: 64px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2;
  transform-origin: center top;
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.22s ease;
}

:root[data-theme='dark'] .calendar-sheet {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .calendar-sheet {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

.month-header {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-text {
  font-size: 0.44rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.8px;
  line-height: 1;
}

.sheet-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 3px;
  box-sizing: border-box;
}

.day-number {
  font-size: 1.25rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -0.5px;
}

:root[data-theme='dark'] .day-number {
  color: #f8fafc;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .day-number {
    color: #f8fafc;
  }
}

.weekday-text {
  font-size: 0.42rem;
  font-weight: 700;
  color: #64748b;
  line-height: 1;
  margin-top: 1px;
}

:root[data-theme='dark'] .weekday-text {
  color: #94a3b8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .weekday-text {
    color: #94a3b8;
  }
}

.event-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
  max-width: 100%;
}

.event-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
}

.event-title {
  font-size: 0.38rem;
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 46px;
}

:root[data-theme='dark'] .event-title {
  color: #cbd5e1;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .event-title {
    color: #cbd5e1;
  }
}

.event-empty {
  margin-top: 2px;
}

.empty-hint {
  font-size: 0.36rem;
  color: #94a3b8;
  font-style: italic;
}

/* Standfuß-Dreieck */
.calendar-stand {
  position: absolute;
  bottom: -3px;
  width: 58px;
  height: 6px;
  background: #cbd5e1;
  border-radius: 0 0 4px 4px;
  z-index: 1;
}

:root[data-theme='dark'] .calendar-stand {
  background: #0f172a;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .calendar-stand {
    background: #0f172a;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .calendar-sheet,
.calendar-preview-stage:hover .calendar-sheet {
  transform: translateY(-2px) rotateX(-8deg);
  box-shadow:
    0 10px 20px rgba(0, 0, 0, 0.2),
    0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
