<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import type { TodoItem, TodoPriority, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { PERIOD_META, computePeriod } from '../utils/period';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { hashHighlightId } from '../utils/hashHighlight';
import { sortWithDoneLast } from '../composables/useCheckedSort';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import FormField from '../components/FormField.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import AppIcon from '../components/AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

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
// Gruppierung/Sortierung bleiben über localStorage auch nach einem Reload/erneuten Besuch erhalten
// (siehe usePersistedRef.ts).
const groupBy = usePersistedRef<GroupBy>('reisotor-todo-group-by', 'assignee');
const sortBy = usePersistedRef<SortBy>('reisotor-todo-sort-by', 'priority');

const PRIORITY_META: Record<TodoPriority, { label: string; icon: string; color: string }> = {
  low: { label: 'Niedrig', icon: '🟢', color: '#2f9e44' },
  medium: { label: 'Mittel', icon: '🟡', color: '#e8a30c' },
  high: { label: 'Hoch', icon: '🔴', color: '#d6336c' },
};
const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

// Merkt sich die zuletzt für ein neues ToDo gewählte Bearbeiter:in (z. B. wenn mehrere Aufgaben
// hintereinander für dieselbe Person angelegt werden) und schlägt sie beim nächsten neuen Eintrag
// direkt vor, statt jedes Mal wieder "Nicht zugewiesen" zu zeigen.
const lastAssignee = usePersistedRef('reisotor-todo-last-assignee', '');

const emptyForm = () => ({
  title: '',
  assigned_to_user_id: lastAssignee.value,
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

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts) - das Create-Formular ist
// hier (anders als bei den meisten anderen Domänen) immer sichtbar statt in einem Modal, daher
// `active` konstant true: die Wiederherstellung läuft einmalig beim Mounten der View.
const newDraft = useDraftAutosave('todos:new', newForm, ref(true));
const editDraft = useDraftAutosave(
  () => `todos:edit:${editingItem.value?.id}`,
  editForm,
  computed(() => editingItem.value !== null),
);

async function load() {
  try {
    const [itemsRes, usersRes] = await Promise.all([
      api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
      api.get<User[]>(`/trips/${tripId}/members`),
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
  return sortWithDoneLast(list, (i) => !!i.done, (a, b) => {
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
  lastAssignee.value = newForm.value.assigned_to_user_id;
  newForm.value = emptyForm();
  newDraft.clear();
}

// Inline-Quick-Add direkt in einer Gruppen-Kopfzeile (siehe QuickAddRow.vue) - die aktuell
// gruppierte Dimension (Bearbeiter:in oder Zeitraum) ergibt sich aus der Gruppe selbst; Priorität
// bleibt als kompaktes Zusatzfeld übrig (Fälligkeitsdatum ist bei Zeitraum-Gruppierung nicht sinnvoll
// frei wählbar, da der Zeitraum selbst daraus abgeleitet wird - siehe periodFor() oben).
const quickAddPriority = ref<TodoPriority>('medium');

async function quickAddToGroup(group: Group, label: string) {
  if (!label.trim()) return;
  const assigned_to_user_id =
    groupBy.value === 'assignee' ? (group.key.startsWith('user-') ? Number(group.key.slice(5)) : undefined) : lastAssignee.value ? Number(lastAssignee.value) : undefined;
  const created = await api.post<TodoItem>('/todos', {
    trip_id: tripId,
    title: label.trim(),
    assigned_to_user_id,
    priority: quickAddPriority.value,
  });
  items.value.push(created);
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
  editDraft.clear();
  editingItem.value = null;
}

function closeEditForm() {
  editDraft.clear();
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
  return item.due_date < toLocalDateString(new Date());
}
</script>

<template>
  <div class="page todo-page" v-if="!loading">
    <h1>ToDo</h1>
    <p>{{ progress.done }}/{{ progress.total }} erledigt</p>

    <form class="add-form card" @submit.prevent="addItem">
      <FormField icon="title" label="Aufgabe">
        <input v-model="newForm.title" type="text" placeholder="Neue Aufgabe" required />
      </FormField>
      <FormField icon="person" label="Bearbeiter:in">
        <select v-model="newForm.assigned_to_user_id">
          <option value="">Nicht zugewiesen</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
      </FormField>
      <FormField icon="date" label="Fällig">
        <input v-model="newForm.due_date" type="date" />
      </FormField>
      <FormField icon="priority" label="Priorität">
        <select v-model="newForm.priority">
          <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">{{ meta.icon }} {{ meta.label }}</option>
        </select>
      </FormField>
      <FormField icon="note" label="Notiz">
        <input v-model="newForm.note" type="text" placeholder="Notiz (optional)" />
      </FormField>
      <button type="submit">Hinzufügen</button>
      <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
    </form>

    <div class="filter-row">
      <div class="tool-row">
        <span class="tool-label"><AppIcon :icon="ACTION_ICONS.group" :size="14" group="actions" /> Gruppieren</span>
        <select v-model="groupBy">
          <option value="assignee">nach Bearbeiter:in</option>
          <option value="period">nach Zeitraum</option>
        </select>
      </div>
      <div class="tool-row">
        <span class="tool-label"><AppIcon :icon="ACTION_ICONS.sort" :size="14" group="actions" /> Sortieren</span>
        <select v-model="sortBy">
          <option value="due_date">nach Datum</option>
          <option value="priority">nach Priorität</option>
          <option value="assignee">nach Bearbeiter:in</option>
        </select>
      </div>
    </div>

    <div class="groups-grid">
      <section class="group-section" v-for="group in groupedItems" :key="group.key">
        <h2>{{ group.label }}</h2>
        <QuickAddRow class="card group-quick-add" placeholder="Aufgabe hinzufügen…" @submit="(label) => quickAddToGroup(group, label)">
          <template #extra>
            <select v-if="groupBy !== 'assignee'" v-model="lastAssignee">
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
            <select v-model="quickAddPriority">
              <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">{{ meta.icon }} {{ meta.label }}</option>
            </select>
          </template>
        </QuickAddRow>
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
                <PendingSyncBadge v-if="item._pending" />
                <span class="priority" :title="PRIORITY_META[item.priority].label">
                  <AppIcon :icon="ACTION_ICONS.priorityDot" :size="10" :color="PRIORITY_META[item.priority].color" group="actions" />
                </span>
                <span v-if="item.due_date" class="due" :class="{ overdue: isOverdue(item) }">
                  <AppIcon :icon="FORM_FIELD_ICONS.date" :size="13" group="formFields" /> {{ formatDate(item.due_date) }}
                </span>
                <span v-if="groupBy !== 'assignee' && userLabel(item.assigned_to_user_id)" class="assignee">{{
                  userLabel(item.assigned_to_user_id)
                }}</span>
                <span v-if="groupBy !== 'period' && periodFor(item)" class="assignee">
                  <AppIcon :icon="FORM_FIELD_ICONS.period" :size="13" group="formFields" /> {{ PERIOD_META[periodFor(item)!] }}
                </span>
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

    <Modal :model-value="editingItem !== null" title="Aufgabe bearbeiten" @update:model-value="(v) => !v && closeEditForm()">
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Titel">
          <input v-model="editForm.title" type="text" placeholder="Titel" required />
        </FormField>
        <FormField icon="person" label="Bearbeiter:in">
          <select v-model="editForm.assigned_to_user_id">
            <option value="">Nicht zugewiesen</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
        </FormField>
        <FormField icon="date" label="Fällig">
          <input v-model="editForm.due_date" type="date" />
        </FormField>
        <FormField icon="priority" label="Priorität">
          <select v-model="editForm.priority">
            <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">{{ meta.icon }} {{ meta.label }}</option>
          </select>
        </FormField>
        <FormField icon="note" label="Notiz">
          <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        </FormField>
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
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

.add-form .form-field {
  flex: 1;
  min-width: 140px;
}

/* Ohne eigenes FormField-Label würde der Absenden-Button, sobald er in derselben umgebrochenen
   Flex-Zeile wie ein FormField landet, vom Flex-Default align-items:stretch auf dessen (größere)
   Höhe gezogen (Konsistenz-Prinzip, siehe DESIGN.md). flex-basis:100% erzwingt stattdessen immer
   eine eigene, volle Zeile - Absenden-Button bekommt so app-weit dieselbe, natürliche Höhe. Auf Mobil
   ist eine volle Zeile für den primären Absenden-Button zudem ohnehin der übliche, gut antippbare
   Standard (großer Touch-Target). */
.add-form button[type='submit'] {
  flex: 1 1 100%;
}

/* Auf Desktop wirkte derselbe volle-Breite-Button auf der (bis zu 1400px breiten, siehe .todo-page
   oben) Karte überdimensioniert - hier stattdessen normal breit wie jeder andere Button, am Ende der
   letzten Feld-Zeile ausgerichtet statt in voller Kartenbreite gestreckt. Gleiche Lösung wie
   ShoppingListView.vue (dortiger Kommentar für die Begründung von align-self:flex-end). */
@media (min-width: 800px) {
  .add-form button[type='submit'] {
    flex: 0 0 auto;
    align-self: flex-end;
  }
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

/* Gleiches Muster wie ExcursionsView.vue's Gruppieren/Sortieren/Filtern-Zeile (dort .tool-row/
   .tool-label) - für Konsistenz app-weit hier 1:1 übernommen statt einer eigenen Variante. */
.tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.tool-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
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

.group-quick-add {
  margin-bottom: var(--space-2);
  padding: var(--space-1) var(--space-2);
}

.group-quick-add :deep(select) {
  width: auto;
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

/* .row selbst hat (anders als .card) keinen border-radius - die globale .new-highlight-Regel
   (style.css, --new-highlight-radius) würde hier sonst mit ihrem für Karten gedachten Radius
   overrulen bzw. eckig wirken. Kleinerer, zur schmalen Listen-Zeile passender Wert. */
.row.new-highlight {
  --new-highlight-radius: var(--radius-sm-squircle);
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
