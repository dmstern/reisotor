<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type { TodoItem, TodoPriority, User, Period } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { PERIOD_META, computePeriod } from '../utils/period';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { hashHighlightId } from '../utils/hashHighlight';
import { sortWithDoneLast } from '../composables/useCheckedSort';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import FormField from '../components/FormField.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useUiSettingsStore } from '../stores/uiSettings';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CheckableListItem from '../components/primitives/CheckableListItem.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Badge from '../components/primitives/Badge.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const uiSettings = useUiSettingsStore();
const route = useRoute();
const router = useRouter();
const tripId = tripStore.currentTripId as number;
const items = ref<TodoItem[]>([]);
const { showToast } = useToast();
const users = ref<User[]>([]);
const loading = ref(true);
// Von anderen Mitgliedern seit dem letzten Besuch geänderte ToDos (siehe stores/liveSync.ts) –
// einmalig beim Mounten eingefroren, damit die Hervorhebung nicht sofort wieder verschwindet (grün).
const highlightedIds = ref<Set<number>>(new Set());
// Durch Kalender-/Hash-Sprung gezielt fokussiertes ToDo (in Brand-Farbe hervorgehoben).
const focusedTodoId = ref<number | null>(null);

function clearFocusedTodo() {
  if (focusedTodoId.value != null) {
    focusedTodoId.value = null;
    if (route.hash.startsWith('#todo-')) {
      router.replace({ path: route.path, query: route.query, hash: '' });
    }
  }
}

type GroupBy = 'assignee' | 'period';
type SortBy = 'due_date' | 'priority' | 'assignee';
const groupBy = usePersistedRef<GroupBy>('reisotor-todo-group-by', 'assignee');
const sortBy = usePersistedRef<SortBy>('reisotor-todo-sort-by', 'priority');

const defaultGroupBy = computed<GroupBy>(() => (users.value.length > 1 ? 'assignee' : 'period'));
const defaultSortBy: SortBy = 'priority';

const groupByOptions = computed(() => {
  const opts = [];
  if (users.value.length > 1) {
    opts.push({ value: 'assignee', label: 'nach Bearbeiter:in', icon: FORM_FIELD_ICONS.person });
  }
  opts.push({ value: 'period', label: 'nach Zeitraum', icon: FORM_FIELD_ICONS.period });
  return opts;
});

const sortByOptions = computed(() => {
  const opts = [
    { value: 'priority', label: 'nach Priorität', icon: FORM_FIELD_ICONS.priority },
    { value: 'due_date', label: 'nach Datum', icon: FORM_FIELD_ICONS.date },
  ];
  if (users.value.length > 1) {
    opts.push({ value: 'assignee', label: 'nach Bearbeiter:in', icon: FORM_FIELD_ICONS.person });
  }
  return opts;
});

const PRIORITY_META: Record<TodoPriority, { label: string; icon: string; color: string }> = {
  low: { label: 'Niedrig', icon: '🟢', color: 'var(--color-success)' },
  medium: { label: 'Mittel', icon: '🟡', color: 'var(--color-accent)' },
  high: { label: 'Hoch', icon: '🔴', color: 'var(--color-danger)' },
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
  period: '' as Period | '',
  priority: 'medium' as TodoPriority,
  note: '',
});

// Zeitraum (vor/während des Urlaubs) wird aus dem Fälligkeitsdatum + den Urlaubs-Eckdaten
// hergeleitet statt manuell abgefragt – ToDo-Einträge haben dafür (anders als die Einkaufsliste)
// immer ein Datum.
function periodFor(item: TodoItem) {
  if (item.due_date) {
    return computePeriod(item.due_date, tripStore.currentTrip);
  }
  return item.period || null;
}
const newForm = ref(emptyForm());

const editingItem = ref<TodoItem | null>(null);
const editForm = ref(emptyForm());

watch(
  () => newForm.value.due_date,
  (newVal, oldVal) => {
    if (newVal && !oldVal && newForm.value.period) {
      showToast({ message: 'Das genaue Datum ersetzt den groben Zeitraum.', type: 'info' });
      newForm.value.period = '';
    }
  }
);
watch(
  () => editForm.value.due_date,
  (newVal, oldVal) => {
    if (newVal && !oldVal && editForm.value.period) {
      showToast({ message: 'Das genaue Datum ersetzt den groben Zeitraum.', type: 'info' });
      editForm.value.period = '';
    }
  }
);

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts) - das Create-Formular ist
// hier (anders als bei den meisten anderen Domänen) immer sichtbar statt in einem Modal, daher
// `active` konstant true: die Wiederherstellung läuft einmalig beim Mounten der View.
const newDraft = useDraftAutosave('todos:new', newForm, ref(true));
const editDraft = useDraftAutosave(
  () => `todos:edit:${editingItem.value?.id}`,
  editForm,
  computed(() => editingItem.value !== null)
);

const showNewDetails = usePersistedRef('reisotor-todo-show-details', false);

watch(
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newForm.value.due_date || newForm.value.note)) {
      showNewDetails.value = true;
    }
  }
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
  // Querverweis-Sprung (z. B. aus dem Kalender, siehe ScheduleView.vue's openEntry()) – gezielter
  // Fokus in Brand-Farbe statt des grünen LiveSync-Neu-Highlights.
  const hashId = hashHighlightId(route.hash, 'todo');
  if (hashId != null) focusedTodoId.value = hashId;
  load();
});

watch(
  () => route.hash,
  (newHash) => {
    if (!newHash) {
      focusedTodoId.value = null;
      return;
    }
    const hashId = hashHighlightId(newHash, 'todo');
    if (hashId != null) focusedTodoId.value = hashId;
  }
);

// Aktualisiert die Liste automatisch, wenn ein anderes Mitglied etwas an den ToDos ändert (siehe
// stores/liveSync.ts) – analog zum bestehenden drawers.locationsVersion-Muster in ScheduleView.vue.
watch(() => liveSync.domainVersion.todos, load);

watch(
  () => users.value.length,
  (len) => {
    if (len <= 1) {
      if (groupBy.value === 'assignee') groupBy.value = 'period';
      if (sortBy.value === 'assignee') sortBy.value = 'priority';
    }
  },
  { immediate: true }
);

function userLabel(id: number | null) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '👤 Ehemaliges Mitglied';
}

function userAvatar(id: number | null | undefined) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? u.avatar : '👤';
}

function userName(id: number | null | undefined) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? u.username : 'Ehemaliges Mitglied';
}

function sortItems(list: TodoItem[]) {
  const visible = uiSettings.hideCompletedTodos ? list.filter((i) => !i.done) : list;
  return sortWithDoneLast(
    visible,
    (i) => !!i.done,
    (a, b) => {
      if (sortBy.value === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy.value === 'assignee') {
        return (userLabel(a.assigned_to_user_id) ?? '').localeCompare(
          userLabel(b.assigned_to_user_id) ?? '',
          'de'
        );
      }
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
  );
}

interface Group {
  key: string;
  label: string;
  items: TodoItem[];
}

const groupedItems = computed<Group[]>(() => {
  if (groupBy.value === 'period') {
    return [
      {
        key: 'before',
        label: `⏳ ${PERIOD_META.before}`,
        items: sortItems(items.value.filter((i) => periodFor(i) === 'before')),
      },
      {
        key: 'during',
        label: `🌴 ${PERIOD_META.during}`,
        items: sortItems(items.value.filter((i) => periodFor(i) === 'during')),
      },
      {
        key: 'none',
        label: '📋 Ohne Zeitraum',
        items: sortItems(items.value.filter((i) => !periodFor(i))),
      },
    ];
  }
  const memberIds = new Set(users.value.map((u) => u.id));
  const perUser: Group[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    label: `${u.avatar} ${u.username}`,
    items: sortItems(items.value.filter((i) => i.assigned_to_user_id === u.id)),
  }));
  const unassigned: Group = {
    key: 'unassigned',
    label: 'Nicht zugewiesen',
    items: sortItems(
      items.value.filter(
        (i) => i.assigned_to_user_id == null || !memberIds.has(i.assigned_to_user_id)
      )
    ),
  };
  return [...perUser, unassigned];
});

const progress = computed(() => {
  const total = items.value.length;
  const done = items.value.filter((i) => i.done).length;
  return { total, done };
});

function toBody(f: ReturnType<typeof emptyForm>) {
  // Wenn ein Fälligkeitsdatum explizit gesetzt ist, hat es immer Vorrang und
  // der manuell ausgewählte grobe Zeitraum wird verworfen, um Inkonsistenzen zu vermeiden.
  const isPeriodValid = !f.due_date;
  return {
    trip_id: tripId,
    title: f.title.trim(),
    assigned_to_user_id: f.assigned_to_user_id ? Number(f.assigned_to_user_id) : undefined,
    due_date: f.due_date || undefined,
    period: isPeriodValid && f.period ? f.period : undefined,
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
  // Details bleiben bewusst im aktuellen Zustand (geöffnet oder geschlossen) erhalten.
  newDraft.clear();
}

function discardNewDraft() {
  newForm.value = emptyForm();
  showNewDetails.value = false;
  newDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}

// Inline-Quick-Add direkt in einer Gruppen-Kopfzeile (siehe QuickAddRow.vue) - die aktuell
// gruppierte Dimension (Bearbeiter:in oder Zeitraum) ergibt sich aus der Gruppe selbst.
// Die jeweils andere Dimension (Zuweisung bei Zeitraum-Gruppierung, Zeitraum bei Bearbeiter:innen-Gruppierung)
// sowie die Priorität stehen als kompakte Zusatzfelder bereit.
const quickAddPriority = ref<TodoPriority>('medium');
const quickAddPeriod = ref<Period | ''>('');

async function quickAddToGroup(group: Group, label: string) {
  if (!label.trim()) return;
  const assigned_to_user_id =
    groupBy.value === 'assignee'
      ? group.key.startsWith('user-')
        ? Number(group.key.slice(5))
        : undefined
      : lastAssignee.value
        ? Number(lastAssignee.value)
        : undefined;

  const period =
    groupBy.value === 'period'
      ? group.key === 'before' || group.key === 'during'
        ? (group.key as Period)
        : undefined
      : quickAddPeriod.value || undefined;

  const created = await api.post<TodoItem>('/todos', {
    trip_id: tripId,
    title: label.trim(),
    assigned_to_user_id,
    period,
    priority: quickAddPriority.value,
  });
  items.value.push(created);
}

async function toggleDone(item: TodoItem) {
  clearFocusedTodo();
  const updated = await api.put<TodoItem>(`/todos/${item.id}`, {
    trip_id: tripId,
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id,
    due_date: item.due_date ?? undefined,
    period: item.period ?? undefined,
    priority: item.priority,
    note: item.note ?? undefined,
    done: !item.done,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: TodoItem) {
  clearFocusedTodo();
  editingItem.value = item;
  editForm.value = {
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id != null ? String(item.assigned_to_user_id) : '',
    due_date: item.due_date ?? '',
    period: (item.period as Period | '') ?? '',
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

function discardEditDraft() {
  if (!editingItem.value) return;
  startEdit(editingItem.value);
  editDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}

async function deleteEditingItem() {
  if (!editingItem.value) return;
  const id = editingItem.value.id;
  closeEditForm();
  await remove(id);
}

async function remove(id: number) {
  await api.delete(`/todos/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
  showToast({ message: 'Aufgabe gelöscht. Sie befindet sich nun im Papierkorb.', type: 'info' });
}

function formatDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}

function isOverdue(item: TodoItem) {
  if (!item.due_date || item.done) return false;
  return item.due_date < toLocalDateString(new Date());
}

function hasTodoMeta(item: TodoItem): boolean {
  return Boolean(
    item._pending || item.due_date || (groupBy.value !== 'period' && periodFor(item)) || item.note
  );
}
</script>

<template>
  <div class="page todo-page" v-if="!loading">
    <div class="page-header-row">
      <div class="page-header-top">
        <div class="page-title-group">
          <div class="title-with-pill">
            <h1>ToDo</h1>
            <div class="progress-pill-group">
              <Badge
                :variant="
                  progress.done === progress.total && progress.total > 0 ? 'success' : 'primary'
                "
                size="sm"
              >
                {{ progress.done }}/{{ progress.total }} erledigt
              </Badge>
              <span v-if="progress.total > 0" class="progress-percentage">
                {{ Math.round((progress.done / progress.total) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="progress.total > 0" class="header-progress-track" aria-hidden="true">
            <div
              class="header-progress-bar"
              :style="{ width: `${Math.round((progress.done / progress.total) * 100)}%` }"
            ></div>
          </div>
        </div>
        <ListSettingsMenu
          v-model:group-by="groupBy"
          :group-by-options="groupByOptions"
          :default-group-by="defaultGroupBy"
          v-model:sort-by="sortBy"
          :sort-by-options="sortByOptions"
          :default-sort-by="defaultSortBy"
          v-model:hide-completed="uiSettings.hideCompletedTodos"
          hide-completed-label="Erledigte ausblenden"
        />
      </div>
    </div>

    <!-- Progressives Schnelleingabe-Formular -->
    <form class="add-form card" @submit.prevent="addItem">
      <div class="quick-input-row">
        <div class="main-input-wrap">
          <FormField icon="title" label="Aufgabe" required v-slot="{ id }">
            <div class="input-inline-action-wrap">
              <Input
                :id="id"
                v-model="newForm.title"
                type="text"
                placeholder="Neue Aufgabe"
                required
              />
              <Button
                type="submit"
                class="inline-submit-btn"
                variant="primary"
                size="sm"
                :icon="ACTION_ICONS.send"
                :disabled="!newForm.title.trim()"
                aria-label="Hinzufügen"
                title="Hinzufügen"
              />
            </div>
          </FormField>
        </div>

        <div class="quick-input-actions">
          <Button
            type="button"
            variant="ghost"
            class="details-toggle-btn"
            :aria-expanded="showNewDetails"
            @click="showNewDetails = !showNewDetails"
          >
            <AppIcon
              :icon="showNewDetails ? ACTION_ICONS.chevronUp : ACTION_ICONS.chevronDown"
              :size="14"
              group="actions"
            />
            <span>Details</span>
          </Button>
        </div>
      </div>

      <!-- Sanft ausklappbare Detail-Felder -->
      <Accordion :expanded="showNewDetails" :inert-when-closed="false">
        <div class="form-details-grid">
          <FormField v-if="users.length > 1" icon="person" label="Bearbeiter:in" v-slot="{ id }">
            <Select :id="id" v-model="newForm.assigned_to_user_id">
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>

          <FormField icon="date" label="Fällig" v-slot="{ id }">
            <Input :id="id" v-model="newForm.due_date" type="date" />
          </FormField>

          <FormField icon="period" label="Zeitraum" v-slot="{ id }">
            <Select :id="id" v-model="newForm.period" :disabled="!!newForm.due_date">
              <option value="">(Nach Datum / Ohne)</option>
              <option v-for="(label, key) in PERIOD_META" :key="key" :value="key">
                {{ label }}
              </option>
            </Select>
          </FormField>

          <FormField icon="priority" label="Priorität" v-slot="{ id }">
            <Select :id="id" v-model="newForm.priority">
              <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
                {{ meta.icon }} {{ meta.label }}
              </option>
            </Select>
          </FormField>

          <FormField icon="note" label="Notiz" v-slot="{ id }">
            <Input :id="id" v-model="newForm.note" type="text" placeholder="Notiz" />
          </FormField>
        </div>
      </Accordion>

      <DraftStatusBar
        :status="newDraft.status.value"
        :restored="newDraft.restored.value"
        :can-discard="true"
        @discard="discardNewDraft"
      />
    </form>

    <div class="groups-grid">
      <section
        class="group-section animate-cascade"
        v-for="(group, index) in groupedItems"
        :key="group.key"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <h2>{{ group.label }}</h2>
        <div class="card group-card">
          <TransitionGroup tag="ul" name="list" class="list">
            <CheckableListItem
              v-for="item in group.items"
              :key="item.id"
              :id="`todo-${item.id}`"
              :done="!!item.done"
              :highlighted="highlightedIds.has(item.id)"
              :focused="focusedTodoId === item.id"
              @click="clearFocusedTodo"
            >
              <div class="item-main">
                <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                <label :for="'todo-item-' + item.id" class="check">
                  <Checkbox
                    :id="'todo-item-' + item.id"
                    :checked="!!item.done"
                    @change="toggleDone(item)"
                  />
                  <span
                    v-if="item.priority"
                    class="priority"
                    :title="`Priorität: ${PRIORITY_META[item.priority].label}`"
                    :aria-label="`Priorität: ${PRIORITY_META[item.priority].label}`"
                  >
                    <AppIcon
                      :icon="ACTION_ICONS.priorityDot"
                      :size="10"
                      :color="PRIORITY_META[item.priority].color"
                      group="actions"
                    />
                  </span>
                  <span
                    class="item-title title"
                    :class="{ 'row__text--done': item.done, 'text-done': item.done }"
                  >
                    {{ item.title }}
                  </span>
                </label>

                <div v-if="hasTodoMeta(item)" class="item-meta">
                  <PendingSyncBadge v-if="item._pending" />
                  <Badge
                    v-if="item.due_date"
                    :variant="isOverdue(item) ? 'danger' : 'default'"
                    size="sm"
                    class="due-badge"
                  >
                    <AppIcon :icon="FORM_FIELD_ICONS.date" :size="11" group="formFields" />
                    <span>{{ formatDate(item.due_date) }}</span>
                  </Badge>
                  <Badge
                    v-if="groupBy !== 'period' && periodFor(item)"
                    size="sm"
                    class="period-badge"
                  >
                    <AppIcon :icon="FORM_FIELD_ICONS.period" :size="11" group="formFields" />
                    <span>{{ PERIOD_META[periodFor(item)!] }}</span>
                  </Badge>
                  <span v-if="item.note" class="note" :title="item.note">
                    <AppIcon :icon="FORM_FIELD_ICONS.note" :size="11" group="formFields" />
                    <span class="note-text">{{ item.note }}</span>
                  </span>
                </div>
              </div>

              <template #actions>
                <span
                  v-if="
                    users.length > 1 &&
                    groupBy !== 'assignee' &&
                    userAvatar(item.assigned_to_user_id)
                  "
                  class="assignee-avatar-pill"
                  :title="`Zugewiesen an: ${userName(item.assigned_to_user_id)}`"
                >
                  {{ userAvatar(item.assigned_to_user_id) }}
                </span>
                <EditButton small @click="startEdit(item)" />
              </template>
            </CheckableListItem>
            <EmptyState v-if="!group.items.length" :key="`${group.key}-empty`" tag="li">
              {{
                uiSettings.hideCompletedTodos ? 'Keine offenen Aufgaben.' : 'Noch keine Aufgaben.'
              }}
            </EmptyState>
          </TransitionGroup>

          <QuickAddRow
            class="group-quick-add"
            placeholder="Aufgabe hinzufügen…"
            @submit="(label) => quickAddToGroup(group, label)"
          >
            <template #extra>
              <Select
                v-if="users.length > 1 && groupBy !== 'assignee'"
                v-model="lastAssignee"
                aria-label="Zuweisung"
                size="sm"
              >
                <option value="">Nicht zugewiesen</option>
                <option v-for="u in users" :key="u.id" :value="String(u.id)">
                  {{ u.avatar }} {{ u.username }}
                </option>
              </Select>
              <Select
                v-if="groupBy !== 'period'"
                v-model="quickAddPeriod"
                aria-label="Zeitraum"
                size="sm"
              >
                <option value="">Zeitraum</option>
                <option value="before">{{ PERIOD_META.before }}</option>
                <option value="during">{{ PERIOD_META.during }}</option>
              </Select>
              <Select v-model="quickAddPriority" aria-label="Priorität" size="sm">
                <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
                  {{ meta.icon }} {{ meta.label }}
                </option>
              </Select>
            </template>
          </QuickAddRow>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Aufgabe bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Titel" required v-slot="{ id }">
          <Input :id="id" v-model="editForm.title" type="text" placeholder="Titel" required />
        </FormField>
        <FormField v-if="users.length > 1" icon="person" label="Bearbeiter:in" v-slot="{ id }">
          <Select :id="id" v-model="editForm.assigned_to_user_id">
            <option value="">Nicht zugewiesen</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField icon="date" label="Fällig" v-slot="{ id }">
          <Input :id="id" v-model="editForm.due_date" type="date" />
        </FormField>
        <FormField icon="period" label="Zeitraum" v-slot="{ id }">
          <Select :id="id" v-model="editForm.period" :disabled="!!editForm.due_date">
            <option value="">(Nach Datum / Ohne)</option>
            <option v-for="(label, key) in PERIOD_META" :key="key" :value="key">
              {{ label }}
            </option>
          </Select>
        </FormField>
        <FormField icon="priority" label="Priorität" v-slot="{ id }">
          <Select :id="id" v-model="editForm.priority">
            <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
              {{ meta.icon }} {{ meta.label }}
            </option>
          </Select>
        </FormField>
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="editForm.note" type="text" placeholder="Notiz" />
        </FormField>
        <DraftStatusBar
          :status="editDraft.status.value"
          :restored="editDraft.restored.value"
          :can-discard="true"
          @discard="discardEditDraft"
        />
        <div class="actions-row">
          <Button
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            @click="deleteEditingItem"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.page-header-row {
  margin-bottom: var(--space-3);
}

.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.page-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.title-with-pill {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.progress-pill-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-percentage {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.header-progress-track {
  width: 100%;
  max-width: 320px;
  height: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.header-progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Progressives Schnelleingabe-Formular */
.add-form {
  position: relative;
  z-index: 1;
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-form:focus-within {
  z-index: 5;
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1;
  min-width: 160px;
}

.main-input-wrap :deep(.form-field) {
  margin-bottom: 0;
}

.input-inline-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-inline-action-wrap :deep(.input) {
  width: 100%;
  padding-right: 44px;
}

.inline-submit-btn {
  position: absolute;
  right: 6px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    scale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.inline-submit-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.inline-submit-btn:hover:not(:disabled) {
  translate: none;
  scale: 1.05;
}

.inline-submit-btn:active:not(:disabled) {
  translate: none;
  transform: none;
  scale: 0.95;
}

.quick-input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.details-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.form-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

@container app-main (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-section {
  min-width: 0;
}

.group-section:focus-within {
  position: relative;
  z-index: 5;
}

.group-section h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.group-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
}

.group-quick-add,
.group-quick-add.expanded {
  padding: var(--space-3) 0 0 0;
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  border-radius: 0;
  box-shadow: none;
}

.group-quick-add :deep(select) {
  width: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  min-width: 0;
  width: 100%;
}

.check :deep(.checkbox) {
  flex-shrink: 0;
  margin-top: 1.5px;
}

.priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 3px;
}

.item-title {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: pretty;
  hyphens: auto;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 4px 8px;
  flex-wrap: wrap;
  margin-left: 28px;
  min-width: 0;
}

.due-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.due-badge span,
.period-badge span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee-avatar-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
  line-height: 1;
  flex-shrink: 0;
}

.note {
  display: inline-flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  max-width: 100%;
  min-width: 0;
  line-height: 1.35;
}

.note :deep(.app-icon),
.note svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.note-text {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: normal;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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
