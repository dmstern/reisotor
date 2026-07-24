<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { PackingItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import PackingItemRow from '../components/PackingItem.vue';

const auth = useAuthStore();
const items = ref<PackingItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

const newLabel = ref('');
const newCategory = ref('');
const newOwner = ref<string>('me');

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<PackingItem[]>('/packing'),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  newOwner.value = auth.user ? String(auth.user.id) : 'me';
  loading.value = false;
});

const categories = computed(() => {
  const set = new Set(items.value.map((i) => i.category?.trim()).filter((c): c is string => !!c));
  return [...set].sort();
});

interface ListGroup {
  key: string;
  title: string;
  ownerId: number | null;
  items: PackingItem[];
}

const lists = computed<ListGroup[]>(() => {
  const shared: ListGroup = {
    key: 'shared',
    title: 'Gemeinsame Packliste',
    ownerId: null,
    items: items.value.filter((i) => i.owner_id == null),
  };
  const perUser: ListGroup[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    title: u.id === auth.user?.id ? `Meine Packliste (${u.avatar})` : `Packliste von ${u.username} (${u.avatar})`,
    ownerId: u.id,
    items: items.value.filter((i) => i.owner_id === u.id),
  }));

  const mine = perUser.filter((l) => l.ownerId === auth.user?.id);
  const others = perUser.filter((l) => l.ownerId !== auth.user?.id);
  return [...mine, shared, ...others];
});

function groupByCategory(listItems: PackingItem[]) {
  const map = new Map<string, PackingItem[]>();
  for (const item of listItems) {
    const key = item.category?.trim() || 'Sonstiges';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function progress(listItems: PackingItem[]) {
  const total = listItems.length;
  const checked = listItems.filter((i) => i.checked).length;
  return { total, checked };
}

async function toggle(item: PackingItem) {
  const updated = await api.put<PackingItem>(`/packing/${item.id}`, {
    category: item.category,
    label: item.label,
    checked: !item.checked,
    owner_id: item.owner_id,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function update(item: PackingItem, changes: { label: string; category: string }) {
  const updated = await api.put<PackingItem>(`/packing/${item.id}`, {
    label: changes.label,
    category: changes.category || undefined,
    checked: !!item.checked,
    owner_id: item.owner_id,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function remove(id: number) {
  await api.delete(`/packing/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

async function addItem() {
  if (!newLabel.value.trim()) return;
  const owner_id = newOwner.value === 'shared' ? null : Number(newOwner.value);
  const created = await api.post<PackingItem>('/packing', {
    label: newLabel.value.trim(),
    category: newCategory.value.trim() || undefined,
    owner_id,
  });
  items.value.push(created);
  newLabel.value = '';
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Packliste</h1>

    <datalist id="packing-categories">
      <option v-for="c in categories" :key="c" :value="c" />
    </datalist>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newLabel" type="text" placeholder="Neuer Gegenstand" required />
      <input v-model="newCategory" type="text" list="packing-categories" placeholder="Kategorie (optional)" />
      <select v-model="newOwner">
        <option value="shared">Gemeinsam</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">
          {{ u.id === auth.user?.id ? 'Meine Liste' : u.username }}
        </option>
      </select>
      <button type="submit">Hinzufügen</button>
    </form>

    <section class="list-section" v-for="list in lists" :key="list.key">
      <div class="list-header">
        <h2>{{ list.title }}</h2>
        <span class="progress">{{ progress(list.items).checked }}/{{ progress(list.items).total }} gepackt</span>
      </div>

      <div class="card group" v-for="[category, groupItems] in groupByCategory(list.items)" :key="category">
        <h3>{{ category }}</h3>
        <ul class="list">
          <PackingItemRow
            v-for="item in groupItems"
            :key="item.id"
            :item="item"
            @toggle="toggle"
            @remove="remove"
            @update="update"
          />
        </ul>
      </div>
      <p v-if="!list.items.length" class="empty">Noch nichts auf dieser Liste.</p>
    </section>
  </div>
</template>

<style scoped>
.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.add-form input[type='text'] {
  flex: 1;
  min-width: 140px;
}

.list-section {
  margin-bottom: var(--space-5);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-2);
}

.list-header h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  margin: 0;
}

.progress {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.group {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
}

.group h3 {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>
