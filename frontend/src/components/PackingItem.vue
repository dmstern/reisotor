<script setup lang="ts">
import { ref } from 'vue';
import type { PackingItem } from '../api/types';

const props = defineProps<{ item: PackingItem }>();
const emit = defineEmits<{
  (e: 'toggle', item: PackingItem): void;
  (e: 'remove', id: number): void;
  (e: 'update', item: PackingItem, changes: { label: string; category: string }): void;
}>();

const editing = ref(false);
const editLabel = ref('');
const editCategory = ref('');

function startEdit() {
  editLabel.value = props.item.label;
  editCategory.value = props.item.category ?? '';
  editing.value = true;
}

function save() {
  if (!editLabel.value.trim()) return;
  emit('update', props.item, { label: editLabel.value.trim(), category: editCategory.value.trim() });
  editing.value = false;
}
</script>

<template>
  <li class="row" v-if="!editing">
    <label class="check">
      <input type="checkbox" :checked="!!item.checked" @change="emit('toggle', item)" />
      <span :class="{ done: item.checked }">{{ item.label }}</span>
    </label>
    <div class="row-actions">
      <button class="secondary" @click="startEdit">✎</button>
      <button class="secondary" @click="emit('remove', item.id)">✕</button>
    </div>
  </li>
  <li class="row edit-row" v-else>
    <input v-model="editLabel" type="text" class="edit-label" />
    <input v-model="editCategory" type="text" list="packing-categories" class="edit-category" placeholder="Kategorie" />
    <div class="row-actions">
      <button @click="save">Speichern</button>
      <button class="secondary" @click="editing = false">Abbrechen</button>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: none;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.row-actions button {
  padding: 4px 10px;
}

.edit-row {
  flex-wrap: wrap;
}

.edit-label,
.edit-category {
  flex: 1;
  min-width: 100px;
}
</style>
