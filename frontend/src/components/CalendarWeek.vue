<script setup lang="ts">
import type { Accommodation, ScheduleItem } from '../api/types';

interface Day {
  date: string;
  items: ScheduleItem[];
  accommodations: Accommodation[];
}

defineProps<{ days: Day[]; selectedDate: string | null }>();
const emit = defineEmits<{
  (e: 'select', date: string): void;
  (e: 'drop-idea', date: string, ideaId: number): void;
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

function onDrop(event: DragEvent, date: string) {
  const raw = event.dataTransfer?.getData('text/idea-id');
  if (!raw) return;
  emit('drop-idea', date, Number(raw));
}
</script>

<template>
  <div class="week">
    <div
      v-for="day in days"
      :key="day.date"
      class="day"
      :class="{ active: day.date === selectedDate, today: isToday(day.date) }"
      @click="emit('select', day.date)"
      @dragover.prevent
      @drop.prevent="onDrop($event, day.date)"
    >
      <div class="day-head">
        <span class="weekday">{{ weekday(day.date) }}</span>
        <span class="num">{{ dayNumber(day.date) }}</span>
      </div>

      <div class="acc-bar" v-for="acc in day.accommodations" :key="acc.id" :title="acc.name">
        🛏️ {{ acc.name }}
      </div>

      <div class="items">
        <div class="item-line" v-for="item in day.items.slice(0, 3)" :key="item.id" :title="item.title">
          <span v-if="item.time" class="time">{{ item.time }}</span>{{ item.title }}
        </div>
        <div class="more" v-if="day.items.length > 3">+{{ day.items.length - 3 }} mehr</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
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
}

.day:hover {
  background: #f4f1ec;
}

.day.today .num {
  color: var(--color-accent);
}

.day.active {
  background: #eaf3f1;
  border-color: var(--color-primary);
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

.acc-bar {
  background: #eef0fd;
  color: #5b6ee1;
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
  background: #f4f1ec;
  border-radius: 4px;
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
