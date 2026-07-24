<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation, Idea, ScheduleItem, Trip } from '../api/types';
import CalendarWeek from '../components/CalendarWeek.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const trip = ref<Trip | null>(null);
const items = ref<ScheduleItem[]>([]);
const ideas = ref<Idea[]>([]);
const accommodations = ref<Accommodation[]>([]);
const selectedDate = ref<string | null>(null);
const loading = ref(true);

const newTime = ref('');
const newTitle = ref('');
const newNote = ref('');

const formIdeaId = ref('');
const formDate = ref('');

const editingItem = ref<ScheduleItem | null>(null);
const editForm = ref({ time: '', title: '', note: '' });

onMounted(async () => {
  const [tripRes, scheduleRes, ideasRes, accommodationRes] = await Promise.all([
    api.get<Trip>('/trip'),
    api.get<ScheduleItem[]>('/schedule'),
    api.get<Idea[]>('/ideas'),
    api.get<Accommodation[]>('/accommodation'),
  ]);
  trip.value = tripRes;
  items.value = scheduleRes;
  ideas.value = ideasRes;
  accommodations.value = accommodationRes;
  selectedDate.value = new Date().toISOString().slice(0, 10);
  formDate.value = selectedDate.value;
  loading.value = false;
});

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const scheduledIdeaIds = computed(() => new Set(items.value.map((i) => i.idea_id).filter(Boolean)));

const unscheduledPlannedIdeas = computed(() =>
  ideas.value.filter((i) => i.status === 'planned' && !scheduledIdeaIds.value.has(i.id)),
);

function accommodationsForDate(date: string) {
  return accommodations.value.filter(
    (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date,
  );
}

const weeks = computed(() => {
  if (!trip.value) return [];
  const start = new Date(trip.value.start_date);
  const end = new Date(trip.value.end_date);

  // Woche beginnt am Montag
  const firstMonday = new Date(start);
  const offset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - offset);

  const result: { date: string; items: ScheduleItem[]; accommodations: Accommodation[] }[][] = [];
  let cursor = new Date(firstMonday);
  let week: { date: string; items: ScheduleItem[]; accommodations: Accommodation[] }[] = [];

  while (cursor <= end || week.length % 7 !== 0) {
    const iso = toIso(cursor);
    week.push({
      date: iso,
      items: items.value.filter((i) => i.date === iso).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
      accommodations: accommodationsForDate(iso),
    });
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

const dayAccommodations = computed(() =>
  selectedDate.value ? accommodationsForDate(selectedDate.value) : [],
);

function ideaTitle(ideaId: number | null) {
  if (!ideaId) return null;
  return ideas.value.find((i) => i.id === ideaId)?.title ?? null;
}

function selectDay(date: string) {
  selectedDate.value = date;
}

async function scheduleIdea(ideaId: number, date: string) {
  const idea = ideas.value.find((i) => i.id === ideaId);
  if (!idea) return;
  const created = await api.post<ScheduleItem>('/schedule', {
    date,
    title: idea.title,
    note: idea.note ?? undefined,
    idea_id: idea.id,
  });
  items.value.push(created);
}

function onDropIdea(date: string, ideaId: number) {
  scheduleIdea(ideaId, date);
}

async function onScheduleFromForm() {
  if (!formIdeaId.value || !formDate.value) return;
  await scheduleIdea(Number(formIdeaId.value), formDate.value);
  formIdeaId.value = '';
}

function onDragStart(event: DragEvent, ideaId: number) {
  event.dataTransfer?.setData('text/idea-id', String(ideaId));
  event.dataTransfer!.effectAllowed = 'move';
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

function startEdit(item: ScheduleItem) {
  editingItem.value = item;
  editForm.value = { time: item.time ?? '', title: item.title, note: item.note ?? '' };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim()) return;
  const updated = await api.put<ScheduleItem>(`/schedule/${editingItem.value.id}`, {
    date: editingItem.value.date,
    time: editForm.value.time || undefined,
    title: editForm.value.title.trim(),
    note: editForm.value.note || undefined,
    idea_id: editingItem.value.idea_id,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
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

    <div class="card ideas-pool" v-if="unscheduledPlannedIdeas.length">
      <h2>Geplante Ideen einplanen</h2>
      <p class="hint">Auf einen Tag ziehen oder unten per Formular einplanen.</p>
      <div class="pool-items">
        <div
          v-for="idea in unscheduledPlannedIdeas"
          :key="idea.id"
          class="pool-item"
          draggable="true"
          @dragstart="onDragStart($event, idea.id)"
        >
          💡 {{ idea.title }}
        </div>
      </div>
      <form class="schedule-form" @submit.prevent="onScheduleFromForm">
        <select v-model="formIdeaId" required>
          <option value="" disabled>Idee wählen…</option>
          <option v-for="idea in unscheduledPlannedIdeas" :key="idea.id" :value="idea.id">
            {{ idea.title }}
          </option>
        </select>
        <input v-model="formDate" type="date" required />
        <button type="submit">Einplanen</button>
      </form>
    </div>

    <div class="card weeks">
      <CalendarWeek
        v-for="(week, idx) in weeks"
        :key="idx"
        :days="week"
        :selected-date="selectedDate"
        @select="selectDay"
        @drop-idea="onDropIdea"
      />
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <h2>{{ formatDay(selectedDate) }}</h2>

      <p v-for="acc in dayAccommodations" :key="acc.id" class="acc-note">🛏️ Unterkunft: {{ acc.name }}</p>

      <ul class="items">
        <li v-for="item in dayItems" :key="item.id" class="item">
          <div>
            <strong v-if="item.time">{{ item.time }}</strong>
            <span class="title">{{ item.title }}</span>
            <span v-if="item.idea_id" class="idea-tag">💡 {{ ideaTitle(item.idea_id) }}</span>
            <p v-if="item.note" class="note">{{ item.note }}</p>
          </div>
          <div class="item-actions">
            <EditButton small @click="startEdit(item)" />
            <DeleteButton small @click="removeItem(item.id)" />
          </div>
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

    <Modal
      :model-value="editingItem !== null"
      title="Termin bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.time" type="time" />
        <input v-model="editForm.title" type="text" placeholder="Titel" required />
        <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.ideas-pool {
  margin-bottom: var(--space-3);
}

.ideas-pool h2 {
  font-size: 1rem;
  color: var(--color-primary-dark);
}

.hint {
  font-size: 0.85rem;
  margin-top: -6px;
}

.pool-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.pool-item {
  background: #fff4e8;
  border: 1px solid #f0d3ac;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 0.85rem;
  cursor: grab;
}

.pool-item:active {
  cursor: grabbing;
}

.schedule-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.schedule-form select {
  flex: 1;
  min-width: 160px;
}

.weeks {
  margin-bottom: var(--space-4);
}

.day-detail h2 {
  color: var(--color-primary-dark);
}

.acc-note {
  color: #5b6ee1;
  font-weight: 600;
  margin: 0 0 var(--space-2);
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

.idea-tag {
  margin-left: var(--space-2);
  font-size: 0.75rem;
  color: var(--color-accent);
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

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.edit-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form input[type='text'] {
  flex: 1;
  min-width: 140px;
}
</style>
