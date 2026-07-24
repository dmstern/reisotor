<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { ScheduleItem, Trip } from '../api/types';
import CalendarWeek from '../components/CalendarWeek.vue';

const trip = ref<Trip | null>(null);
const items = ref<ScheduleItem[]>([]);
const selectedDate = ref<string | null>(null);
const loading = ref(true);

const newTime = ref('');
const newTitle = ref('');
const newNote = ref('');

onMounted(async () => {
  const [tripRes, scheduleRes] = await Promise.all([
    api.get<Trip>('/trip'),
    api.get<ScheduleItem[]>('/schedule'),
  ]);
  trip.value = tripRes;
  items.value = scheduleRes;
  selectedDate.value = new Date().toISOString().slice(0, 10);
  loading.value = false;
});

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const weeks = computed(() => {
  if (!trip.value) return [];
  const start = new Date(trip.value.start_date);
  const end = new Date(trip.value.end_date);

  // Woche beginnt am Montag
  const firstMonday = new Date(start);
  const offset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - offset);

  const result: { date: string; items: ScheduleItem[] }[][] = [];
  let cursor = new Date(firstMonday);
  let week: { date: string; items: ScheduleItem[] }[] = [];

  while (cursor <= end || week.length % 7 !== 0) {
    const iso = toIso(cursor);
    week.push({ date: iso, items: items.value.filter((i) => i.date === iso) });
    if (week.length === 7) {
      result.push(week);
      week = [];
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > end && week.length === 0) break;
  }
  return result;
});

const dayItems = computed(() =>
  items.value
    .filter((i) => i.date === selectedDate.value)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
);

function selectDay(date: string) {
  selectedDate.value = date;
}

async function addItem() {
  if (!selectedDate.value || !newTitle.value.trim()) return;
  const created = await api.post<ScheduleItem>('/schedule', {
    date: selectedDate.value,
    time: newTime.value || undefined,
    title: newTitle.value.trim(),
    note: newNote.value || undefined,
  });
  items.value.push(created);
  newTime.value = '';
  newTitle.value = '';
  newNote.value = '';
}

async function removeItem(id: number) {
  await api.delete(`/schedule/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Ablauf</h1>

    <div class="card weeks">
      <CalendarWeek
        v-for="(week, idx) in weeks"
        :key="idx"
        :days="week"
        :selected-date="selectedDate"
        @select="selectDay"
      />
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <h2>{{ formatDay(selectedDate) }}</h2>

      <ul class="items">
        <li v-for="item in dayItems" :key="item.id" class="item">
          <div>
            <strong v-if="item.time">{{ item.time }}</strong>
            <span class="title">{{ item.title }}</span>
            <p v-if="item.note" class="note">{{ item.note }}</p>
          </div>
          <button class="secondary" @click="removeItem(item.id)">Löschen</button>
        </li>
        <li v-if="!dayItems.length" class="empty">Noch keine Termine an diesem Tag.</li>
      </ul>

      <form class="add-form" @submit.prevent="addItem">
        <input v-model="newTime" type="time" />
        <input v-model="newTitle" type="text" placeholder="Titel" required />
        <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Hinzufügen</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.weeks {
  margin-bottom: var(--space-4);
}

.day-detail h2 {
  color: var(--color-primary-dark);
}

.items {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.title {
  margin-left: var(--space-2);
}

.note {
  margin: 4px 0 0;
  font-size: 0.9rem;
}

.empty {
  color: var(--color-text-muted);
  padding: var(--space-2);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.add-form input[type='text'] {
  flex: 1;
  min-width: 140px;
}
</style>
