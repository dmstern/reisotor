<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { ShoppingItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const items = ref<ShoppingItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const filterBuyer = ref('all');
const groupByShop = ref(false);

const newLabel = ref('');
const newBuyer = ref('');
const newLink = ref('');
const newNote = ref('');
const newShop = ref('');

const editingItem = ref<ShoppingItem | null>(null);
const editForm = ref({ label: '', link: '', note: '', shop: '' });

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  loading.value = false;
});

const filteredItems = computed(() => {
  if (filterBuyer.value === 'all') return items.value;
  if (filterBuyer.value === 'unassigned') return items.value.filter((i) => i.assigned_to_user_id == null);
  return items.value.filter((i) => i.assigned_to_user_id === Number(filterBuyer.value));
});

const UNASSIGNED_SHOP = 'Ohne Shop';

const groupedItems = computed(() => {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of filteredItems.value) {
    const key = item.shop?.trim() || UNASSIGNED_SHOP;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNASSIGNED_SHOP ? 1 : b === UNASSIGNED_SHOP ? -1 : a.localeCompare(b, 'de')))
    .map(([shop, shopItems]) => ({ shop, items: shopItems }));
});

const knownShops = computed(() => {
  const set = new Set<string>();
  items.value.forEach((i) => i.shop && set.add(i.shop));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
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
    link: item.link ?? undefined,
    note: item.note ?? undefined,
    shop: item.shop ?? undefined,
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
    link: item.link ?? undefined,
    note: item.note ?? undefined,
    shop: item.shop ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: ShoppingItem) {
  editingItem.value = item;
  editForm.value = { label: item.label, link: item.link ?? '', note: item.note ?? '', shop: item.shop ?? '' };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.label.trim()) return;
  const updated = await api.put<ShoppingItem>(`/shopping/${editingItem.value.id}`, {
    label: editForm.value.label.trim(),
    assigned_to_user_id: editingItem.value.assigned_to_user_id,
    checked: !!editingItem.value.checked,
    link: editForm.value.link || undefined,
    note: editForm.value.note || undefined,
    shop: editForm.value.shop || undefined,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
}

async function remove(id: number) {
  await api.delete(`/shopping/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

async function addItem() {
  if (!newLabel.value.trim()) return;
  const created = await api.post<ShoppingItem>('/shopping', {
    trip_id: tripId,
    label: newLabel.value.trim(),
    assigned_to_user_id: newBuyer.value ? Number(newBuyer.value) : undefined,
    link: newLink.value || undefined,
    note: newNote.value || undefined,
    shop: newShop.value || undefined,
  });
  items.value.push(created);
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  newShop.value = '';
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Einkaufsliste</h1>
    <p>{{ progress.checked }}/{{ progress.total }} gekauft</p>

    <datalist id="shopping-shops">
      <option v-for="s in knownShops" :key="s" :value="s" />
    </datalist>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
      <input v-model="newShop" type="text" list="shopping-shops" placeholder="Shop/Laden (optional)" />
      <select v-model="newBuyer">
        <option value="">Kein:e Einkäufer:in</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
      <input v-model="newLink" type="url" placeholder="Link (optional, z. B. Amazon)" />
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
      <label class="group-toggle">
        <input type="checkbox" v-model="groupByShop" />
        Nach Shop gruppieren
      </label>
    </div>

    <template v-if="groupByShop">
      <div class="card shop-group" v-for="group in groupedItems" :key="group.shop">
        <h2>🏬 {{ group.shop }}</h2>
        <ul class="list">
          <li v-for="item in group.items" :key="item.id" class="row">
            <label class="check">
              <input type="checkbox" :checked="!!item.checked" @change="toggle(item)" />
              <span :class="{ done: item.checked }">{{ item.label }}</span>
            </label>
            <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">🔗 Link</a>
            <span v-if="item.note" class="note">{{ item.note }}</span>
            <select class="buyer-select" :value="item.assigned_to_user_id ?? ''" @change="reassign(item, $event)">
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
            <div class="row-actions">
              <EditButton small @click="startEdit(item)" />
              <DeleteButton small @click="remove(item.id)" />
            </div>
          </li>
        </ul>
      </div>
      <p v-if="!groupedItems.length" class="empty">Keine Einträge.</p>
    </template>

    <div class="card" v-else>
      <ul class="list">
        <li v-for="item in filteredItems" :key="item.id" class="row">
          <label class="check">
            <input type="checkbox" :checked="!!item.checked" @change="toggle(item)" />
            <span :class="{ done: item.checked }">{{ item.label }}</span>
          </label>
          <span v-if="item.shop" class="shop-tag">🏬 {{ item.shop }}</span>
          <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">🔗 Link</a>
          <span v-if="item.note" class="note">{{ item.note }}</span>
          <select class="buyer-select" :value="item.assigned_to_user_id ?? ''" @change="reassign(item, $event)">
            <option value="">Nicht zugewiesen</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
          <div class="row-actions">
            <EditButton small @click="startEdit(item)" />
            <DeleteButton small @click="remove(item.id)" />
          </div>
        </li>
        <li v-if="!filteredItems.length" class="empty">Keine Einträge.</li>
      </ul>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Artikel bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.label" type="text" placeholder="Artikel" required />
        <input v-model="editForm.shop" type="text" list="shopping-shops" placeholder="Shop/Laden (optional)" />
        <input v-model="editForm.link" type="url" placeholder="Link (optional)" />
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
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.shop-group {
  margin-bottom: var(--space-3);
}

.shop-group h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.shop-tag {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  background: #f4f1ec;
  border-radius: 999px;
  padding: 2px 8px;
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

.link {
  font-size: 0.82rem;
}

.note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.buyer-select {
  font-size: 0.82rem;
  padding: 4px 6px;
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
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
