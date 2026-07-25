<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Accommodation, CalendarEntry, ScheduleItem, TodoItem, TravelItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import CalendarWeek from '../components/CalendarWeek.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { buildAllEntries } from '../utils/calendarEntries';

const tripStore = useTripStore();
const trip = computed(() => tripStore.currentTrip);
const excursionsStore = useExcursionsStore();
const items = ref<ScheduleItem[]>([]);
const accommodations = ref<Accommodation[]>([]);
const todos = ref<TodoItem[]>([]);
const travelItems = ref<TravelItem[]>([]);
const selectedDate = ref<string | null>(null);
const loading = ref(true);

const newTime = ref('');
const newTitle = ref('');
const newNote = ref('');
const newEndDate = ref('');
const newLocation = ref('');
const newMapsLink = ref('');

const editingItem = ref<ScheduleItem | null>(null);
const editForm = ref({ time: '', title: '', note: '', endDate: '', location: '', mapsLink: '' });
const showAddForm = ref(false);

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [scheduleRes, accommodationRes, todosRes, travelRes] = await Promise.all([
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
  ]);
  items.value = scheduleRes;
  accommodations.value = accommodationRes;
  todos.value = todosRes;
  travelItems.value = travelRes;
}

onMounted(async () => {
  await loadAll();
  selectedDate.value = new Date().toISOString().slice(0, 10);
  loading.value = false;
});

// ScheduleView ist nicht mehr Teil des per Urlaub-Id gekeyten <router-view> (jetzt global
// gemountete Schublade), muss also selbst auf einen Urlaubswechsel reagieren.
watch(() => tripStore.currentTripId, loadAll);

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function accommodationsForDate(date: string) {
  return accommodations.value.filter(
    (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date,
  );
}

const allEntries = computed(() =>
  buildAllEntries(items.value, trip.value, todos.value, travelItems.value, excursionsStore.excursions),
);

function entriesForDate(date: string) {
  return allEntries.value
    .filter((e) => e.date <= date && date <= e.endDate)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}

// Zeigt nicht nur den Urlaubszeitraum, sondern auch alle Tage, an denen Objekte im Kalender
// hinterlegt sind (z. B. ToDos oder Reise-Einträge mit Fälligkeits-/Termin-Datum vor Urlaubsbeginn).
const calendarRange = computed(() => {
  if (!trip.value) return null;
  const dates = [
    new Date(trip.value.start_date),
    new Date(trip.value.end_date),
    ...allEntries.value.flatMap((e) => [new Date(e.date), new Date(e.endDate)]),
  ];
  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
});

const weeks = computed(() => {
  if (!calendarRange.value) return [];
  const { start, end } = calendarRange.value;

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

// Ausflüge werden direkt aus der Ausflüge-Sicht per Drag&Drop hierher gezogen (ExcursionCard.vue) –
// das Datum wird am Ausflug selbst gesetzt, kein separater schedule_items-Eintrag mehr nötig.
function onDropExcursion(date: string, excursionId: number) {
  excursionsStore.setDate(excursionId, date);
}

// "Aus dem Kalender nehmen": macht die Einplanung rückgängig, Ausflug gilt wieder als
// "in Planung" – Alternative zum Zurückziehen per Drag&Drop in der Ausflüge-Sicht.
function unplanExcursion(excursionId: number) {
  excursionsStore.setDate(excursionId, null);
}

function closeAddForm() {
  showAddForm.value = false;
  newTime.value = '';
  newTitle.value = '';
  newNote.value = '';
  newEndDate.value = '';
  newLocation.value = '';
  newMapsLink.value = '';
}

async function addItem() {
  if (!selectedDate.value || !newTitle.value.trim()) return;
  const parsed = parseLatLngFromMapsLink(newMapsLink.value);
  const created = await api.post<ScheduleItem>('/schedule', {
    trip_id: tripStore.currentTripId,
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
  closeAddForm();
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
  <div class="calendar-drawer-content" v-if="!loading">
    <h2>Kalender</h2>

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
      <div class="day-detail-head">
        <h3>{{ formatDay(selectedDate) }}</h3>
        <button type="button" class="secondary" @click="showAddForm = true">+ Neu</button>
      </div>

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
            <!-- Architekturregel: Fremdobjekte (Urlaub-Stammdaten, ToDos, Ausflüge, Reise-Einträge)
                 sind hier nur lesend/verknüpfend darstellbar – Bearbeitung passiert in der Ursprungssicht. -->
            <template v-if="entry.kind === 'trip'">
              <button type="button" class="secondary jump-btn" @click="jumpToTrip">Zum Urlaub</button>
            </template>
            <template v-else-if="entry.kind === 'todo'">
              <router-link to="/todo" class="secondary jump-btn">Zum ToDo</router-link>
            </template>
            <template v-else-if="entry.kind === 'travel'">
              <router-link to="/travel" class="secondary jump-btn">Zur Reise</router-link>
            </template>
            <template v-else-if="entry.kind === 'excursion'">
              <router-link to="/excursions" class="secondary jump-btn">Zum Ausflug</router-link>
              <button
                type="button"
                class="secondary unplan-btn"
                title="Aus dem Kalender nehmen (zurück zu 'In Planung')"
                aria-label="Aus dem Kalender nehmen"
                @click="unplanExcursion(entry.ideaId!)"
              >
                ✕
              </button>
            </template>
            <template v-else>
              <EditButton small @click="startEdit(entry.scheduleItem!)" />
              <DeleteButton small @click="removeItem(entry.scheduleItem!.id)" />
            </template>
          </div>
        </li>
        <li v-if="!dayEntries.length" key="empty" class="empty">Noch keine Termine an diesem Tag.</li>
      </TransitionGroup>
    </div>

    <Modal
      :model-value="showAddForm"
      title="Termin anlegen"
      @update:model-value="(v) => !v && closeAddForm()"
    >
      <form class="edit-form" @submit.prevent="addItem">
        <input v-model="newTime" type="time" />
        <input v-model="newTitle" type="text" placeholder="Titel" required />
        <input v-model="newEndDate" type="date" :min="selectedDate ?? undefined" placeholder="Enddatum (optional)" title="Enddatum (optional)" />
        <input v-model="newLocation" type="text" placeholder="Ort (optional)" />
        <input v-model="newMapsLink" type="url" placeholder="Maps-Link (Google/Apple) (optional)" />
        <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Hinzufügen</button>
      </form>
    </Modal>

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
        <input v-model="editForm.mapsLink" type="url" placeholder="Maps-Link (Google/Apple) (optional)" />
        <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.calendar-drawer-content {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.calendar-drawer-content h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.weeks {
  padding: var(--space-2);
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.day-detail h3 {
  color: var(--color-primary-dark);
  margin-top: 0;
}

.acc-note {
  color: var(--color-accent-secondary);
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

.unplan-btn {
  padding: 4px 8px;
  font-size: 0.8rem;
  line-height: 1;
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
