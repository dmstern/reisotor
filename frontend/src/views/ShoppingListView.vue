<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { ShoppingItem, User } from '../api/types';

const items = ref<ShoppingItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const filterBuyer = ref('all');

const newLabel = ref('');
const newBuyer = ref('');
const newNote = ref('');

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<ShoppingItem[]>('/shopping'),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  loading.value = false;
});

function buyerName(id: number | null) {
  if (id == null) return 'Nicht zugewiesen';
  return users.value.find((u) => u.id === id)?.username ?? '?';
}
function buyerAvatar(id: number | null) {
  if (id == null) return '❔';
  return users.value.find((u) => u.id === id)?.avatar ?? '❓';
}

const filteredItems = computed(() => {
  if (filterBuyer.value === 'all') return items.value;
  if (filterBuyer.value === 'unassigned') return items.value.filter((i) => i.assigned_to_user_id == null);
  return items.value.filter((i) => i.assigned_to_user_id === Number(filterBuyer.value));
});

const progress = computed(() => {
  const total = items.value.length;
  const checked = items.value.filter((i) => i.checked).length;
  return { total, checked };
});

async function toggle(item: ShoppingItem) {
  const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
    label: item.label,
    assigned_to_user_id: item.assigned_to_user_id,
    checked: !item.checked,
    note: item.note ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function reassign(item: ShoppingItem, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const assigned_to_user_id = value ? Number(value) : null;
  const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
    label: item.label,
    assigned_to_user_id,
    checked: !!item.checked,
    note: item.note ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function remove(id: number) {
  await api.delete(`/shopping/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

async function addItem() {
  if (!newLabel.value.trim()) return;
  const created = await api.post<ShoppingItem>('/shopping', {
    label: newLabel.value.trim(),
    assigned_to_user_id: newBuyer.value ? Number(newBuyer.value) : undefined,
    note: newNote.value || undefined,
  });
  items.value.push(created);
  newLabel.value = '';
  newNote.value = '';
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Einkaufsliste</h1>
    <p>{{ progress.checked }}/{{ progress.total }} gekauft</p>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
      <select v-model="newBuyer">
        <option value="">Kein:e Einkäufer:in</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
      <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
      <button type="submit">Hinzufügen</button>
    </form>

    <div class="filter-row">
      <label>Filtern nach Einkäufer:in:</label>
      <select v-model="filterBuyer">
        <option value="all">Alle</option>
        <option value="unassigned">Nicht zugewiesen</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
    </div>

    <div class="card">
      <ul class="list">
        <li v-for="item in filteredItems" :key="item.id" class="row">
          <label class="check">
            <input type="checkbox" :checked="!!item.checked" @change="toggle(item)" />
            <span :class="{ done: item.checked }">{{ item.label }}</span>
          </label>
          <span v-if="item.note" class="note">{{ item.note }}</span>
          <select class="buyer-select" :value="item.assigned_to_user_id ?? ''" @change="reassign(item, $event)">
            <option value="">Nicht zugewiesen</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
          <button class="secondary" @click="remove(item.id)">✕</button>
        </li>
        <li v-if="!filteredItems.length" class="empty">Keine Einträge.</li>
      </ul>
    </div>
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

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1;
  min-width: 120px;
}

.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.buyer-select {
  font-size: 0.82rem;
  padding: 4px 6px;
}

.empty {
  color: var(--color-text-muted);
  padding: var(--space-2) 0;
}
</style>
