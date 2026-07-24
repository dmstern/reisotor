<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { PackingItem } from '../api/types';
import PackingItemRow from '../components/PackingItem.vue';

const items = ref<PackingItem[]>([]);
const loading = ref(true);

const newLabel = ref('');
const newCategory = ref('');

onMounted(async () => {
  items.value = await api.get<PackingItem[]>('/packing');
  loading.value = false;
});

const groups = computed(() => {
  const map = new Map<string, PackingItem[]>();
  for (const item of items.value) {
    const key = item.category?.trim() || 'Sonstiges';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
});

const progress = computed(() => {
  const total = items.value.length;
  const checked = items.value.filter((i) => i.checked).length;
  return { total, checked };
});

async function toggle(item: PackingItem) {
  const updated = await api.put<PackingItem>(`/packing/${item.id}`, {
    category: item.category,
    label: item.label,
    checked: !item.checked,
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
  const created = await api.post<PackingItem>('/packing', {
    label: newLabel.value.trim(),
    category: newCategory.value.trim() || undefined,
  });
  items.value.push(created);
  newLabel.value = '';
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Packliste</h1>
    <p>{{ progress.checked }}/{{ progress.total }} gepackt</p>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newLabel" type="text" placeholder="Neuer Gegenstand" required />
      <input v-model="newCategory" type="text" placeholder="Kategorie (optional)" />
      <button type="submit">Hinzufügen</button>
    </form>

    <div class="card group" v-for="[category, groupItems] in groups" :key="category">
      <h2>{{ category }}</h2>
      <ul class="list">
        <PackingItemRow
          v-for="item in groupItems"
          :key="item.id"
          :item="item"
          @toggle="toggle"
          @remove="remove"
        />
      </ul>
    </div>
  </div>
</template>

<style scoped>
.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.add-form input {
  flex: 1;
  min-width: 140px;
}

.group {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
}

.group h2 {
  font-size: 1rem;
  color: var(--color-primary-dark);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
