<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation, CalendarEntry, Excursion, ScheduleItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import CalendarWeek from '../components/CalendarWeek.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);
const items = ref<ScheduleItem[]>([]);
const excursions = ref<Excursion[]>([]);
const accommodations = ref<Accommodation[]>([]);
const selectedDate = ref<string | null>(null);
const loading = ref(true);

const newTime = ref('');
const newTitle = ref('');
const newNote = ref('');
const newEndDate = ref('');
const newLocation = ref('');
const newMapsLink = ref('');

const formExcursionId = ref('');
const formDate = ref('');

const editingItem = ref<ScheduleItem | null>(null);
const editForm = ref({ time: '', title: '', note: '', endDate: '', location: '', mapsLink: '' });

onMounted(async () => {
  const [scheduleRes, excursionsRes, accommodationRes] = await Promise.all([
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    api.get<Excursion[]>(`/ideas?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
  ]);
  items.value = scheduleRes;
  excursions.value = excursionsRes;
  accommodations.value = accommodationRes;
  selectedDate.value = new Date().toISOString().slice(0, 10);
  formDate.value = selectedDate.value;
  loading.value = false;
});

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const scheduledExcursionIds = computed(() => new Set(items.value.map((i) => i.idea_id).filter(Boolean)));

const unscheduledPlannedExcursions = computed(() =>
  excursions.value.filter((i) => i.status !== 'discarded' && !scheduledExcursionIds.value.has(i.id)),
);

function accommodationsForDate(date: string) {
  return accommodations.value.filter(
    (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date,
  );
}

function itemToEntry(item: ScheduleItem): CalendarEntry {
  return {
    key: `s-${item.id}`,
    date: item.date,
    endDate: item.end_date ?? item.date,
    time: item.time,
    title: item.title,
    note: item.note,
    location: item.location,
    category: item.category,
    ideaId: item.idea_id,
    scheduleItem: item,
  };
}

// Urlaub-Stammdaten erscheinen automatisch als (nicht editierbare) Kalender-Items der Kategorie
// "Urlaub" – synthetisch aus den Trip-Stammdaten erzeugt, nicht in schedule_items gespeichert.
const tripEntries = computed<CalendarEntry[]>(() => {
  if (!trip.value) return [];
  const entries: CalendarEntry[] = [
    {
      key: 'trip-start',
      date: trip.value.start_date,
      endDate: trip.value.start_date,
      time: null,
      title: `Urlaub-Start: ${trip.value.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      scheduleItem: null,
    },
  ];
  if (trip.value.end_date !== trip.value.start_date) {
    entries.push({
      key: 'trip-end',
      date: trip.value.end_date,
      endDate: trip.value.end_date,
      time: null,
      title: `Urlaub-Ende: ${trip.value.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      scheduleItem: null,
    });
  }
  return entries;
});

const allEntries = computed(() => [...items.value.map(itemToEntry), ...tripEntries.value]);

function entriesForDate(date: string) {
  return allEntries.value
    .filter((e) => e.date <= date && date <= e.endDate)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}

const weeks = computed(() => {
  if (!trip.value) return [];
  const start = new Date(trip.value.start_date);
  const end = new Date(trip.value.end_date);

  // Woche beginnt am Montag
  const firstMonday = new Date(start);
  const offset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - offset);

  const result: { date: string; entries: CalendarEntry[]; accommodations: Accommodation[] }[][] = [];
  let cursor = new Date(firstMonday);
  let week: { date: string; entries: CalendarEntry[]; accommodations: Accommodation[] }[] = [];

  while (cursor <= end || week.length % 7 !== 0) {
    const iso = toIso(cursor);
    week.push({
      date: iso,
      entries: entriesForDate(iso),
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

const dayEntries = computed(() => (selectedDate.value ? entriesForDate(selectedDate.value) : []));

const dayAccommodations = computed(() =>
  selectedDate.value ? accommodationsForDate(selectedDate.value) : [],
);

function selectDay(date: string) {
  selectedDate.value = date;
}

async function scheduleExcursion(excursionId: number, date: string) {
  const excursion = excursions.value.find((i) => i.id === excursionId);
  if (!excursion) return;
  const created = await api.post<ScheduleItem>('/schedule', {
    trip_id: tripId,
    date,
    title: excursion.title,
    note: excursion.note ?? undefined,
    idea_id: excursion.id,
  });
  items.value.push(created);
}

function onDropExcursion(date: string, excursionId: number) {
  scheduleExcursion(excursionId, date);
}

async function onScheduleFromForm() {
  if (!formExcursionId.value || !formDate.value) return;
  await scheduleExcursion(Number(formExcursionId.value), formDate.value);
  formExcursionId.value = '';
}

function onDragStart(event: DragEvent, excursionId: number) {
  event.dataTransfer?.setData('text/excursion-id', String(excursionId));
  event.dataTransfer!.effectAllowed = 'move';
}

async function addItem() {
  if (!selectedDate.value || !newTitle.value.trim()) return;
  const parsed = parseLatLngFromMapsLink(newMapsLink.value);
  const created = await api.post<ScheduleItem>('/schedule', {
    trip_id: tripId,
    date: selectedDate.value,
    end_date: newEndDate.value || undefined,
    time: newTime.value || undefined,
    title: newTitle.value.trim(),
    note: newNote.value || undefined,
    location: newLocation.value || undefined,
    maps_link: newMapsLink.value || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  });
  items.value.push(created);
  newTime.value = '';
  newTitle.value = '';
  newNote.value = '';
  newEndDate.value = '';
  newLocation.value = '';
  newMapsLink.value = '';
}

async function removeItem(id: number) {
  await api.delete(`/schedule/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

function startEdit(item: ScheduleItem) {
  editingItem.value = item;
  editForm.value = {
    time: item.time ?? '',
    title: item.title,
    note: item.note ?? '',
    endDate: item.end_date ?? '',
    location: item.location ?? '',
    mapsLink: item.maps_link ?? '',
  };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim()) return;
  const parsed = parseLatLngFromMapsLink(editForm.value.mapsLink);
  const updated = await api.put<ScheduleItem>(`/schedule/${editingItem.value.id}`, {
    date: editingItem.value.date,
    end_date: editForm.value.endDate || undefined,
    time: editForm.value.time || undefined,
    title: editForm.value.title.trim(),
    note: editForm.value.note || undefined,
    idea_id: editingItem.value.idea_id,
    location: editForm.value.location || undefined,
    maps_link: editForm.value.mapsLink || undefined,
    lat: parsed?.lat ?? editingItem.value.lat ?? undefined,
    lng: parsed?.lng ?? editingItem.value.lng ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
}

function jumpToTrip() {
  tripStore.requestEditTrip();
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
    <h1>Kalender</h1>

    <div class="card excursions-pool" v-if="unscheduledPlannedExcursions.length">
      <h2>Ausflüge einplanen</h2>
      <p class="hint">
        💡 Diese <strong>gelb hinterlegten Ausflüge</strong> kannst du direkt auf einen Tag im Kalender
        ziehen, um sie einzuplanen. Alternativ geht es auch über das Dropdown-Menü unten.
      </p>
      <TransitionGroup tag="div" name="list" class="pool-items">
        <div
          v-for="excursion in unscheduledPlannedExcursions"
          :key="excursion.id"
          class="pool-item"
          draggable="true"
          @dragstart="onDragStart($event, excursion.id)"
        >
          🎒 {{ excursion.title }}
        </div>
      </TransitionGroup>
      <form class="schedule-form" @submit.prevent="onScheduleFromForm">
        <select v-model="formExcursionId" required>
          <option value="" disabled>Ausflug wählen…</option>
          <option v-for="excursion in unscheduledPlannedExcursions" :key="excursion.id" :value="excursion.id">
            {{ excursion.title }}
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
        @drop-excursion="onDropExcursion"
      />
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <h2>{{ formatDay(selectedDate) }}</h2>

      <p v-for="acc in dayAccommodations" :key="acc.id" class="acc-note">🛏️ Unterkunft: {{ acc.name }}</p>

      <TransitionGroup tag="ul" name="list" class="items">
        <li
          v-for="entry in dayEntries"
          :key="entry.key"
          class="item"
          :style="{ borderLeftColor: SCHEDULE_CATEGORY_META[entry.category].color }"
        >
          <div>
            <span class="category-icon" :title="SCHEDULE_CATEGORY_META[entry.category].label">{{
              SCHEDULE_CATEGORY_META[entry.category].icon
            }}</span>
            <strong v-if="entry.time">{{ entry.time }}</strong>
            <span class="title">{{ entry.title }}</span>
            <p v-if="entry.location" class="location">📍 {{ entry.location }}</p>
            <p v-if="entry.note" class="note">{{ entry.note }}</p>
          </div>
          <div class="item-actions">
            <!-- Architekturregel: Fremdobjekte (Urlaub-Stammdaten, verknüpfte Ausflüge) sind hier
                 nur lesend/verknüpfend darstellbar – Bearbeitung passiert in der Ursprungssicht. -->
            <template v-if="entry.scheduleItem === null">
              <button type="button" class="secondary jump-btn" @click="jumpToTrip">Zum Urlaub</button>
            </template>
            <template v-else-if="entry.ideaId">
              <router-link to="/excursions" class="secondary jump-btn">Zum Ausflug</router-link>
              <DeleteButton small @click="removeItem(entry.scheduleItem!.id)" />
            </template>
            <template v-else>
              <EditButton small @click="startEdit(entry.scheduleItem!)" />
              <DeleteButton small @click="removeItem(entry.scheduleItem!.id)" />
            </template>
          </div>
        </li>
        <li v-if="!dayEntries.length" key="empty" class="empty">Noch keine Termine an diesem Tag.</li>
      </TransitionGroup>

      <form class="add-form" @submit.prevent="addItem">
        <input v-model="newTime" type="time" />
        <input v-model="newTitle" type="text" placeholder="Titel" required />
        <input v-model="newEndDate" type="date" :min="selectedDate" placeholder="Enddatum (optional)" title="Enddatum (optional)" />
        <input v-model="newLocation" type="text" placeholder="Ort (optional)" />
        <input v-model="newMapsLink" type="url" placeholder="Google-Maps-Link (optional)" />
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
        <input v-model="editForm.endDate" type="date" :min="editingItem?.date" placeholder="Enddatum (optional)" title="Enddatum (optional)" />
        <input v-model="editForm.location" type="text" placeholder="Ort (optional)" />
        <input v-model="editForm.mapsLink" type="url" placeholder="Google-Maps-Link (optional)" />
        <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.excursions-pool {
  margin-bottom: var(--space-3);
}

.excursions-pool h2 {
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
  border-left: 3px solid transparent;
  border-radius: var(--radius-sm);
}

.category-icon {
  margin-right: 4px;
}

.title {
  margin-left: var(--space-2);
}

.location {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
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
  align-items: center;
}

.jump-btn {
  padding: 4px 10px;
  font-size: 0.8rem;
  white-space: nowrap;
  text-decoration: none;
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
