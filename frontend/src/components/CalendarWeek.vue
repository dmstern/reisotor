<script setup lang="ts">
import type { ScheduleItem } from '../api/types';

interface Day {
  date: string;
  items: ScheduleItem[];
}

defineProps<{ days: Day[]; selectedDate: string | null }>();
const emit = defineEmits<{ (e: 'select', date: string): void }>();

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
</script>

<template>
  <div class="week">
    <button
      v-for="day in days"
      :key="day.date"
      class="day"
      :class="{ active: day.date === selectedDate, today: isToday(day.date) }"
      @click="emit('select', day.date)"
    >
      <span class="weekday">{{ weekday(day.date) }}</span>
      <span class="num">{{ dayNumber(day.date) }}</span>
      <span class="dot" v-if="day.items.length">{{ day.items.length }}</span>
    </button>
  </div>
</template>

<style scoped>
.week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.day {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--color-text);
  font-weight: 500;
  position: relative;
}

.day:hover {
  background: #f4f1ec;
}

.day.today .num {
  color: var(--color-accent);
}

.day.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.day.active .num {
  color: white;
}

.weekday {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.day.active .weekday {
  color: rgba(255, 255, 255, 0.8);
}

.num {
  font-size: 1.1rem;
}

.dot {
  position: absolute;
  top: 2px;
  right: 4px;
  background: var(--color-accent);
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
