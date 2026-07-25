<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Period, ShoppingItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { PERIOD_META } from '../utils/period';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const items = ref<ShoppingItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

type GroupBy = 'buyer' | 'shop' | 'period';
const groupBy = ref<GroupBy>('buyer');

const newLabel = ref('');
const newBuyer = ref('');
const newLink = ref('');
const newNote = ref('');
const newShop = ref('');
const newPeriod = ref<Period | ''>('');

const editingItem = ref<ShoppingItem | null>(null);
const editForm = ref({ label: '', link: '', note: '', shop: '', period: '' as Period | '' });

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  loading.value = false;
});

const UNASSIGNED_SHOP = 'Ohne Shop';

interface Group {
  key: string;
  label: string;
  items: ShoppingItem[];
}

const groupedItems = computed<Group[]>(() => {
  if (groupBy.value === 'shop') {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of items.value) {
      const key = item.shop?.trim() || UNASSIGNED_SHOP;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === UNASSIGNED_SHOP ? 1 : b === UNASSIGNED_SHOP ? -1 : a.localeCompare(b, 'de')))
      .map(([shop, shopItems]) => ({ key: shop, label: `🏬 ${shop}`, items: shopItems }));
  }
  if (groupBy.value === 'period') {
    const groups: Group[] = [
      { key: 'before', label: PERIOD_META.before, items: items.value.filter((i) => i.period === 'before') },
      { key: 'during', label: PERIOD_META.during, items: items.value.filter((i) => i.period === 'during') },
      { key: 'none', label: 'Ohne Zeitraum', items: items.value.filter((i) => !i.period) },
    ];
    return groups;
  }
  // buyer
  const perUser: Group[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    label: `${u.avatar} ${u.username}`,
    items: items.value.filter((i) => i.assigned_to_user_id === u.id),
  }));
  const unassigned: Group = {
    key: 'unassigned',
    label: 'Nicht zugewiesen',
    items: items.value.filter((i) => i.assigned_to_user_id == null),
  };
  return [...perUser, unassigned];
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
    period: item.period ?? undefined,
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
    period: item.period ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: ShoppingItem) {
  editingItem.value = item;
  editForm.value = {
    label: item.label,
    link: item.link ?? '',
    note: item.note ?? '',
    shop: item.shop ?? '',
    period: item.period ?? '',
  };
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
    period: editForm.value.period || undefined,
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
    period: newPeriod.value || undefined,
  });
  items.value.push(created);
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  newShop.value = '';
  newPeriod.value = '';
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
      <select v-model="newPeriod">
        <option value="">Kein Zeitraum</option>
        <option value="before">{{ PERIOD_META.before }}</option>
        <option value="during">{{ PERIOD_META.during }}</option>
      </select>
      <input v-model="newLink" type="url" placeholder="Link (optional, z. B. Amazon)" />
      <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
      <button type="submit">Hinzufügen</button>
    </form>

    <div class="filter-row">
      <label>
        Gruppieren:
        <select v-model="groupBy">
          <option value="buyer">nach Einkäufer:in</option>
          <option value="shop">nach Shop</option>
          <option value="period">nach Zeitraum</option>
        </select>
      </label>
    </div>

    <section class="group-section" v-for="group in groupedItems" :key="group.key">
      <h2>{{ group.label }}</h2>
      <div class="card">
        <TransitionGroup tag="ul" name="list" class="list">
          <li v-for="item in group.items" :key="item.id" class="row">
            <label class="check">
              <input type="checkbox" :checked="!!item.checked" @change="toggle(item)" />
              <span :class="{ done: item.checked }">{{ item.label }}</span>
            </label>
            <span v-if="groupBy !== 'shop' && item.shop" class="tag">🏬 {{ item.shop }}</span>
            <span v-if="groupBy !== 'period' && item.period" class="tag">🗓️ {{ PERIOD_META[item.period] }}</span>
            <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">🔗 Link</a>
            <span v-if="item.note" class="note">{{ item.note }}</span>
            <select
              v-if="groupBy !== 'buyer'"
              class="buyer-select"
              :value="item.assigned_to_user_id ?? ''"
              @change="reassign(item, $event)"
            >
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
            <div class="row-actions">
              <EditButton small @click="startEdit(item)" />
              <DeleteButton small @click="remove(item.id)" />
            </div>
          </li>
          <li v-if="!group.items.length" :key="`${group.key}-empty`" class="empty">Keine Einträge.</li>
        </TransitionGroup>
      </div>
    </section>

    <Modal
      :model-value="editingItem !== null"
      title="Artikel bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.label" type="text" placeholder="Artikel" required />
        <input v-model="editForm.shop" type="text" list="shopping-shops" placeholder="Shop/Laden (optional)" />
        <select v-model="editForm.period">
          <option value="">Kein Zeitraum</option>
          <option value="before">{{ PERIOD_META.before }}</option>
          <option value="during">{{ PERIOD_META.during }}</option>
        </select>
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

.filter-row label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.group-section {
  margin-bottom: var(--space-3);
}

.group-section h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.tag {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  background: var(--color-hover);
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
