<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Accommodation, CalendarEntry, ScheduleItem, TodoItem, TravelItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import CalendarWeek from '../components/CalendarWeek.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { buildAllEntries } from '../utils/calendarEntries';
import { calendarEventFromEntry, googleCalendarHref, outlookCalendarHref, triggerIcsDownload } from '../utils/calendarExport';

const tripStore = useTripStore();
const trip = computed(() => tripStore.currentTrip);
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const drawers = useDrawersStore();
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

// "Zum eigenen Kalender hinzufügen"-Menü: welcher Eintrag (per key) hat sein Menü gerade offen –
// gilt für ALLE Eintrags-Arten (echte wie automatisch erzeugte), nicht nur editierbare Termine.
const calendarPickerKey = ref<string | null>(null);
function toggleCalendarPicker(key: string) {
  calendarPickerKey.value = calendarPickerKey.value === key ? null : key;
}
function downloadIcsForEntry(entry: CalendarEntry) {
  triggerIcsDownload(calendarEventFromEntry(entry));
  calendarPickerKey.value = null;
}

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [scheduleRes, accommodationRes, todosRes, travelRes] = await Promise.all([
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    spotsStore.load(),
  ]);
  items.value = scheduleRes;
  accommodations.value = accommodationRes;
  todos.value = todosRes;
  travelItems.value = travelRes;
}

onMounted(async () => {
  await loadAll();
  selectedDate.value = new Date().toISOString().slice(0, 10);
  // Beim ersten Laden direkt zur Woche mit dem heutigen Tag blättern statt bei der (ggf. Monate
  // zurückliegenden) ersten Woche zu starten; liegt heute außerhalb des Kalenderbereichs (z. B.
  // Urlaub komplett in der Vergangenheit/Zukunft ohne nahe ToDo-Fälligkeiten), zum Urlaubsstart.
  if (!goToDate(new Date().toISOString().slice(0, 10)) && trip.value) {
    goToDate(trip.value.start_date);
  }
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
  buildAllEntries(
    items.value,
    trip.value,
    todos.value,
    travelItems.value,
    excursionsStore.excursions,
    spotsStore.spots,
    accommodations.value,
  ),
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

// Bei langen Zeitspannen (z. B. ein ToDo mit Fälligkeitsdatum Monate vor dem Urlaub) würde die
// Schublade sonst eine sehr lange Liste an Wochen rendern – stattdessen wird nur ein Fenster
// angezeigt, durch das man blättert. Die Fenster-/Schrittgröße ist wählbar: wochenweise,
// zweiwochenweise oder "monatsweise" (gleitend – ein festes 4-Wochen-Fenster, nicht an
// Kalendermonats-Grenzen ausgerichtet).
type PageGranularity = 'week' | 'twoWeeks' | 'month';
const WEEKS_PER_PAGE_BY_GRANULARITY: Record<PageGranularity, number> = { week: 1, twoWeeks: 2, month: 4 };
const granularity = ref<PageGranularity>('month');
const weeksPerPage = computed(() => WEEKS_PER_PAGE_BY_GRANULARITY[granularity.value]);
const pageOffset = ref(0);

const visibleWeeks = computed(() => weeks.value.slice(pageOffset.value, pageOffset.value + weeksPerPage.value));
const canGoPrev = computed(() => pageOffset.value > 0);
const canGoNext = computed(() => pageOffset.value + weeksPerPage.value < weeks.value.length);

const visibleRangeLabel = computed(() => {
  if (!visibleWeeks.value.length) return '';
  const first = visibleWeeks.value[0][0]?.date;
  const lastWeek = visibleWeeks.value[visibleWeeks.value.length - 1];
  const last = lastWeek[lastWeek.length - 1]?.date;
  if (!first || !last) return '';
  const fmt = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt(first)} – ${fmt(last)}`;
});

function clampOffset(idx: number) {
  return Math.min(Math.max(0, weeks.value.length - weeksPerPage.value), Math.max(0, idx));
}

function prevPage() {
  pageOffset.value = clampOffset(pageOffset.value - weeksPerPage.value);
}
function nextPage() {
  pageOffset.value = clampOffset(pageOffset.value + weeksPerPage.value);
}

// Beim Wechsel der Blätter-Granularität bleibt die erste sichtbare Woche als Anker erhalten,
// nur die Fenstergröße ändert sich – muss aber ggf. neu geklemmt werden, falls das größere
// Fenster sonst über das Ende des Kalenderbereichs hinausragen würde.
watch(weeksPerPage, () => {
  pageOffset.value = clampOffset(pageOffset.value);
});

// Springt so, dass die Woche mit dem übergebenen Datum als erste Woche der Seite sichtbar wird.
// Gibt zurück, ob das Datum im aktuellen Kalenderbereich gefunden wurde.
function goToDate(dateIso: string): boolean {
  const idx = weeks.value.findIndex((week) => week.some((day) => day.date === dateIso));
  if (idx === -1) return false;
  pageOffset.value = clampOffset(idx);
  return true;
}

function jumpToToday() {
  goToDate(new Date().toISOString().slice(0, 10));
}

function goToTripDates() {
  if (trip.value) goToDate(trip.value.start_date);
}

const dayEntries = computed(() => (selectedDate.value ? entriesForDate(selectedDate.value) : []));

// "Tag auf Karte anzeigen" nur sinnvoll, wenn an diesem Tag mindestens ein Ausflug geplant ist
// (sonst gäbe es nichts, das die Karte fokussieren könnte).
const selectedDateHasExcursion = computed(
  () => !!selectedDate.value && excursionsStore.excursions.some((e) => e.date === selectedDate.value),
);
function showDayOnMap() {
  if (selectedDate.value) drawers.focusMapOnDate(selectedDate.value);
}

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

    <div class="calendar-toolbar">
      <div class="granularity-row">
        <button
          type="button"
          class="secondary gran-btn"
          :class="{ active: granularity === 'week' }"
          @click="granularity = 'week'"
        >
          Woche
        </button>
        <button
          type="button"
          class="secondary gran-btn"
          :class="{ active: granularity === 'twoWeeks' }"
          @click="granularity = 'twoWeeks'"
        >
          2 Wochen
        </button>
        <button
          type="button"
          class="secondary gran-btn"
          :class="{ active: granularity === 'month' }"
          @click="granularity = 'month'"
        >
          Monat
        </button>
      </div>
      <div class="pager">
        <button type="button" class="secondary page-btn" :disabled="!canGoPrev" @click="prevPage" aria-label="Vorherige Wochen">
          ‹
        </button>
        <span class="range-label">{{ visibleRangeLabel }}</span>
        <button type="button" class="secondary page-btn" :disabled="!canGoNext" @click="nextPage" aria-label="Nächste Wochen">
          ›
        </button>
      </div>
      <div class="jump-row">
        <button type="button" class="card-action-btn" @click="jumpToToday">📍 Heute</button>
        <button type="button" class="card-action-btn" v-if="trip" @click="goToTripDates">🏖️ Urlaub</button>
      </div>
    </div>

    <div class="card weeks">
      <CalendarWeek
        v-for="week in visibleWeeks"
        :key="week[0]?.date"
        :days="week"
        :selected-date="selectedDate"
        @select="selectDay"
        @drop-excursion="onDropExcursion"
      />
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <div class="day-detail-head">
        <h3>{{ formatDay(selectedDate) }}</h3>
        <div class="day-detail-actions">
          <button v-if="selectedDateHasExcursion" type="button" class="card-action-btn" @click="showDayOnMap">
            🗺️ Tag auf Karte anzeigen
          </button>
          <button type="button" @click="showAddForm = true">+ Neu</button>
        </div>
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
              entry.icon ?? SCHEDULE_CATEGORY_META[entry.category].icon
            }}</span>
            <strong v-if="entry.time">{{ entry.time }}</strong>
            <span class="title">{{ entry.title }}</span>
            <p v-if="entry.location" class="location">📍 {{ entry.location }}</p>
            <p v-if="entry.note" class="note">{{ entry.note }}</p>
          </div>
          <div class="item-actions">
            <div class="calendar-export">
              <button
                type="button"
                class="secondary calendar-btn"
                title="Zum eigenen Kalender hinzufügen"
                aria-label="Zum eigenen Kalender hinzufügen"
                @click="toggleCalendarPicker(entry.key)"
              >
                📅
              </button>
              <template v-if="calendarPickerKey === entry.key">
                <div class="picker-backdrop" @click="calendarPickerKey = null"></div>
                <div class="picker-menu">
                  <button type="button" @click="downloadIcsForEntry(entry)">🍎 Apple/iPhone</button>
                  <a
                    :href="googleCalendarHref(calendarEventFromEntry(entry))"
                    target="_blank"
                    rel="noopener"
                    @click="calendarPickerKey = null"
                  >
                    📆 Google Kalender
                  </a>
                  <a
                    :href="outlookCalendarHref(calendarEventFromEntry(entry))"
                    target="_blank"
                    rel="noopener"
                    @click="calendarPickerKey = null"
                  >
                    📧 Outlook
                  </a>
                  <button type="button" @click="downloadIcsForEntry(entry)">🤖 Android</button>
                </div>
              </template>
            </div>
            <!-- Architekturregel: Fremdobjekte (Urlaub-Stammdaten, ToDos, Ausflüge, Reise-Einträge)
                 sind hier nur lesend/verknüpfend darstellbar – Bearbeitung passiert in der Ursprungssicht. -->
            <template v-if="entry.kind === 'trip'">
              <button type="button" class="card-action-btn" @click="jumpToTrip">Zum Urlaub</button>
            </template>
            <template v-else-if="entry.kind === 'todo'">
              <router-link to="/todo" class="card-action-btn">Zum ToDo</router-link>
            </template>
            <template v-else-if="entry.kind === 'travel'">
              <router-link to="/travel" class="card-action-btn">Zur Reise</router-link>
            </template>
            <template v-else-if="entry.kind === 'excursion'">
              <router-link to="/excursions" class="card-action-btn">Zum Ausflug</router-link>
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

.calendar-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.granularity-row {
  display: flex;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

.gran-btn {
  padding: 4px 10px;
  font-size: 0.78rem;
}

.gran-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.page-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  border-radius: 50%;
  flex-shrink: 0;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.range-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 100px;
  text-align: center;
}

.jump-row {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.day-detail-actions {
  display: flex;
  flex-wrap: wrap;
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

.unplan-btn {
  padding: 4px 8px;
  font-size: 0.8rem;
  line-height: 1;
}

.calendar-export {
  position: relative;
}

.calendar-btn {
  padding: 4px 8px;
  font-size: 0.9rem;
  line-height: 1;
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a,
.picker-menu button {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
}

.picker-menu a:hover,
.picker-menu button:hover {
  background: var(--color-hover);
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
