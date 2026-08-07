<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import type { TodoItem, TodoPriority, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { PERIOD_META, computePeriod } from '../utils/period';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { hashHighlightId } from '../utils/hashHighlight';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';

const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const route = useRoute();
const tripId = tripStore.currentTripId as number;
const items = ref<TodoItem[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const users = ref<User[]>([]);
const loading = ref(true);
// Von anderen Mitgliedern seit dem letzten Besuch geänderte ToDos (siehe stores/liveSync.ts) –
// einmalig beim Mounten eingefroren, damit die Hervorhebung nicht sofort wieder verschwindet.
const highlightedIds = ref<Set<number>>(new Set());

type GroupBy = 'assignee' | 'period';
type SortBy = 'due_date' | 'priority' | 'assignee';
const groupBy = ref<GroupBy>('assignee');
const sortBy = ref<SortBy>('priority');

const PRIORITY_META: Record<TodoPriority, { label: string; icon: string }> = {
  low: { label: 'Niedrig', icon: '🟢' },
  medium: { label: 'Mittel', icon: '🟡' },
  high: { label: 'Hoch', icon: '🔴' },
};
const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

// Merkt sich die zuletzt für ein neues ToDo gewählte Bearbeiter:in (z. B. wenn mehrere Aufgaben
// hintereinander für dieselbe Person angelegt werden) und schlägt sie beim nächsten neuen Eintrag
// direkt vor, statt jedes Mal wieder "Nicht zugewiesen" zu zeigen. Persistiert über localStorage,
// damit die Vorauswahl auch nach einem Reload erhalten bleibt (gleiches Muster wie andere
// UI-Präferenzen der App, z. B. SPOTS_COL_WIDTH_KEY).
const LAST_ASSIGNEE_KEY = 'reisotor-todo-last-assignee';

const emptyForm = () => ({
  title: '',
  assigned_to_user_id: localStorage.getItem(LAST_ASSIGNEE_KEY) ?? '',
  due_date: '',
  priority: 'medium' as TodoPriority,
  note: '',
});

// Zeitraum (vor/während des Urlaubs) wird aus dem Fälligkeitsdatum + den Urlaubs-Eckdaten
// hergeleitet statt manuell abgefragt – ToDo-Einträge haben dafür (anders als die Einkaufsliste)
// immer ein Datum.
function periodFor(item: TodoItem) {
  return computePeriod(item.due_date, tripStore.currentTrip);
}
const newForm = ref(emptyForm());

const editingItem = ref<TodoItem | null>(null);
const editForm = ref(emptyForm());

async function load() {
  try {
    const [itemsRes, usersRes] = await Promise.all([
      api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
      api.get<User[]>('/users'),
    ]);
    items.value = itemsRes;
    users.value = usersRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  highlightedIds.value = liveSync.markSeen('todos');
  // Querverweis-Sprung (z. B. aus dem Kalender, siehe ScheduleView.vue's openEntry()) – dieselbe
  // highlightedIds-Menge wie oben, kein zweites Hervorhebungs-System (siehe hashHighlight.ts).
  const hashId = hashHighlightId(route.hash, 'todo');
  if (hashId != null) highlightedIds.value.add(hashId);
  load();
});

// Aktualisiert die Liste automatisch, wenn ein anderes Mitglied etwas an den ToDos ändert (siehe
// stores/liveSync.ts) – analog zum bestehenden drawers.locationsVersion-Muster in ScheduleView.vue.
watch(() => liveSync.domainVersion.todos, load);

function userLabel(id: number | null) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : null;
}

function sortItems(list: TodoItem[]) {
  return [...list].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (sortBy.value === 'due_date') {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    if (sortBy.value === 'assignee') {
      return (userLabel(a.assigned_to_user_id) ?? '').localeCompare(userLabel(b.assigned_to_user_id) ?? '', 'de');
    }
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

interface Group {
  key: string;
  label: string;
  items: TodoItem[];
}

const groupedItems = computed<Group[]>(() => {
  if (groupBy.value === 'period') {
    return [
      { key: 'before', label: PERIOD_META.before, items: sortItems(items.value.filter((i) => periodFor(i) === 'before')) },
      { key: 'during', label: PERIOD_META.during, items: sortItems(items.value.filter((i) => periodFor(i) === 'during')) },
      { key: 'none', label: 'Ohne Zeitraum', items: sortItems(items.value.filter((i) => !periodFor(i))) },
    ];
  }
  const perUser: Group[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    label: `${u.avatar} ${u.username}`,
    items: sortItems(items.value.filter((i) => i.assigned_to_user_id === u.id)),
  }));
  const unassigned: Group = {
    key: 'unassigned',
    label: 'Nicht zugewiesen',
    items: sortItems(items.value.filter((i) => i.assigned_to_user_id == null)),
  };
  return [...perUser, unassigned];
});

const progress = computed(() => {
  const total = items.value.length;
  const done = items.value.filter((i) => i.done).length;
  return { total, done };
});

function toBody(f: ReturnType<typeof emptyForm>) {
  return {
    trip_id: tripId,
    title: f.title.trim(),
    assigned_to_user_id: f.assigned_to_user_id ? Number(f.assigned_to_user_id) : undefined,
    due_date: f.due_date || undefined,
    priority: f.priority,
    note: f.note || undefined,
  };
}

async function addItem() {
  if (!newForm.value.title.trim()) return;
  const created = await api.post<TodoItem>('/todos', toBody(newForm.value));
  items.value.push(created);
  if (newForm.value.assigned_to_user_id) {
    localStorage.setItem(LAST_ASSIGNEE_KEY, newForm.value.assigned_to_user_id);
  } else {
    localStorage.removeItem(LAST_ASSIGNEE_KEY);
  }
  newForm.value = emptyForm();
}

async function toggleDone(item: TodoItem) {
  const updated = await api.put<TodoItem>(`/todos/${item.id}`, {
    trip_id: tripId,
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id,
    due_date: item.due_date ?? undefined,
    priority: item.priority,
    note: item.note ?? undefined,
    done: !item.done,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: TodoItem) {
  editingItem.value = item;
  editForm.value = {
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id != null ? String(item.assigned_to_user_id) : '',
    due_date: item.due_date ?? '',
    priority: item.priority,
    note: item.note ?? '',
  };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim()) return;
  const updated = await api.put<TodoItem>(`/todos/${editingItem.value.id}`, {
    ...toBody(editForm.value),
    done: !!editingItem.value.done,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
}

// Weicher Löschvorgang serverseitig (siehe routes/todos.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts).
async function remove(id: number) {
  await api.delete(`/todos/${id}`);
  markPendingDelete(id, () => {
    items.value = items.value.filter((i) => i.id !== id);
  });
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/todo/${id}/restore`);
}

function formatDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}

function isOverdue(item: TodoItem) {
  if (!item.due_date || item.done) return false;
  return item.due_date < new Date().toISOString().slice(0, 10);
}
</script>

<template>
  <div class="page todo-page" v-if="!loading">
    <h1>ToDo</h1>
    <p>{{ progress.done }}/{{ progress.total }} erledigt</p>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newForm.title" type="text" placeholder="Neue Aufgabe" required />
      <select v-model="newForm.assigned_to_user_id">
        <option value="">Nicht zugewiesen</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
      <input v-model="newForm.due_date" type="date" />
      <select v-model="newForm.priority">
        <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">{{ meta.icon }} {{ meta.label }}</option>
      </select>
      <input v-model="newForm.note" type="text" placeholder="Notiz (optional)" />
      <button type="submit">Hinzufügen</button>
    </form>

    <div class="filter-row">
      <label>
        Gruppieren:
        <select v-model="groupBy">
          <option value="assignee">nach Bearbeiter:in</option>
          <option value="period">nach Zeitraum</option>
        </select>
      </label>
      <label>
        Sortieren:
        <select v-model="sortBy">
          <option value="due_date">nach Datum</option>
          <option value="priority">nach Priorität</option>
          <option value="assignee">nach Bearbeiter:in</option>
        </select>
      </label>
    </div>

    <div class="groups-grid">
      <section class="group-section" v-for="group in groupedItems" :key="group.key">
        <h2>{{ group.label }}</h2>
        <div class="card">
          <TransitionGroup tag="ul" name="list" class="list">
            <template v-for="item in group.items" :key="item.id">
              <li v-if="isPending(item.id)" class="row">
                <UndoDeleteRow :label="item.title" @undo="restore(item.id)" />
              </li>
              <li
                v-else
                :id="`todo-${item.id}`"
                class="row"
                :class="{ 'row-done': item.done, 'new-highlight': highlightedIds.has(item.id) }"
              >
                <label class="check">
                  <input type="checkbox" :checked="!!item.done" @change="toggleDone(item)" />
                  <span class="title" :class="{ 'text-done': item.done }">{{ item.title }}</span>
                </label>
                <span class="priority" :title="PRIORITY_META[item.priority].label">{{ PRIORITY_META[item.priority].icon }}</span>
                <span v-if="item.due_date" class="due" :class="{ overdue: isOverdue(item) }">
                  📅 {{ formatDate(item.due_date) }}
                </span>
                <span v-if="groupBy !== 'assignee' && userLabel(item.assigned_to_user_id)" class="assignee">{{
                  userLabel(item.assigned_to_user_id)
                }}</span>
                <span v-if="groupBy !== 'period' && periodFor(item)" class="assignee">🗓️ {{ PERIOD_META[periodFor(item)!] }}</span>
                <span v-if="item.note" class="note">{{ item.note }}</span>
                <div class="row-actions">
                  <EditButton small @click="startEdit(item)" />
                  <DeleteButton small @click="remove(item.id)" />
                </div>
              </li>
            </template>
            <li v-if="!group.items.length" :key="`${group.key}-empty`" class="empty">Noch keine Aufgaben.</li>
          </TransitionGroup>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Aufgabe bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.title" type="text" placeholder="Titel" required />
        <select v-model="editForm.assigned_to_user_id">
          <option value="">Nicht zugewiesen</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <input v-model="editForm.due_date" type="date" />
        <select v-model="editForm.priority">
          <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">{{ meta.icon }} {{ meta.label }}</option>
        </select>
        <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
/* Mehr Breite als der globale .page-Rahmen (960px), damit die Gruppen auf Desktop tatsächlich
   nebeneinander Platz haben (siehe .groups-grid unten) – exakt dasselbe Muster wie
   PackingListView.vue's .packing-page/.lists-grid. */
.todo-page {
  max-width: 1400px;
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.add-form input,
.add-form select {
  flex: 1;
  min-width: 140px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

.filter-row label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-section {
  min-width: 0;
}

.group-section h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.row:last-child {
  border-bottom: none;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1;
  min-width: 140px;
}

.priority {
  font-size: 0.9rem;
}

.due {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.due.overdue {
  color: var(--color-danger);
  font-weight: 600;
}

.assignee {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty {
  padding: var(--space-2) 0;
}

/* Desktop: Gruppen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen –
   auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der tatsächlichen
   Fensterbreite und Anzahl an Gruppen anpasst. Exakt dasselbe Muster wie PackingListView.vue. */
@media (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>
