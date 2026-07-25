<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { TodoItem, TodoPriority, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const items = ref<TodoItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const filterAssignee = ref('all');

const PRIORITY_META: Record<TodoPriority, { label: string; icon: string }> = {
  low: { label: 'Niedrig', icon: '🟢' },
  medium: { label: 'Mittel', icon: '🟡' },
  high: { label: 'Hoch', icon: '🔴' },
};
const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

const emptyForm = () => ({
  title: '',
  assigned_to_user_id: '',
  due_date: '',
  priority: 'medium' as TodoPriority,
  note: '',
});
const newForm = ref(emptyForm());

const editingItem = ref<TodoItem | null>(null);
const editForm = ref(emptyForm());

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  loading.value = false;
});

const filteredItems = computed(() => {
  const base =
    filterAssignee.value === 'all'
      ? items.value
      : filterAssignee.value === 'unassigned'
        ? items.value.filter((i) => i.assigned_to_user_id == null)
        : items.value.filter((i) => i.assigned_to_user_id === Number(filterAssignee.value));
  return [...base].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
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

async function remove(id: number) {
  await api.delete(`/todos/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

function userLabel(id: number | null) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : null;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(item: TodoItem) {
  if (!item.due_date || item.done) return false;
  return item.due_date < new Date().toISOString().slice(0, 10);
}
</script>

<template>
  <div class="page" v-if="!loading">
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
      <label>Filtern nach Zuweisung:</label>
      <select v-model="filterAssignee">
        <option value="all">Alle</option>
        <option value="unassigned">Nicht zugewiesen</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
    </div>

    <div class="card">
      <TransitionGroup tag="ul" name="list" class="list">
        <li v-for="item in filteredItems" :key="item.id" class="row" :class="{ done: item.done }">
          <label class="check">
            <input type="checkbox" :checked="!!item.done" @change="toggleDone(item)" />
            <span class="title" :class="{ struck: item.done }">{{ item.title }}</span>
          </label>
          <span class="priority" :title="PRIORITY_META[item.priority].label">{{ PRIORITY_META[item.priority].icon }}</span>
          <span v-if="item.due_date" class="due" :class="{ overdue: isOverdue(item) }">
            📅 {{ formatDate(item.due_date) }}
          </span>
          <span v-if="userLabel(item.assigned_to_user_id)" class="assignee">{{ userLabel(item.assigned_to_user_id) }}</span>
          <span v-if="item.note" class="note">{{ item.note }}</span>
          <div class="row-actions">
            <EditButton small @click="startEdit(item)" />
            <DeleteButton small @click="remove(item.id)" />
          </div>
        </li>
        <li v-if="!filteredItems.length" key="empty" class="empty">Keine Aufgaben.</li>
      </TransitionGroup>
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
</template>

<style scoped>
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
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
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

.row.done {
  opacity: 0.6;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1;
  min-width: 140px;
}

.struck {
  text-decoration: line-through;
  color: var(--color-text-muted);
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
  color: var(--color-text-muted);
  padding: var(--space-2) 0;
}
</style>
