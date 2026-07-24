<script setup lang="ts">
import type { PackingItem } from '../api/types';
import DeleteButton from './DeleteButton.vue';
import EditButton from './EditButton.vue';

defineProps<{ item: PackingItem }>();
const emit = defineEmits<{
  (e: 'toggle', item: PackingItem): void;
  (e: 'remove', id: number): void;
  (e: 'edit', item: PackingItem): void;
}>();
</script>

<template>
  <li class="row">
    <label class="check">
      <input type="checkbox" :checked="!!item.checked" @change="emit('toggle', item)" />
      <span :class="{ done: item.checked }">{{ item.label }}</span>
    </label>
    <div class="row-actions">
      <EditButton small @click="emit('edit', item)" />
      <DeleteButton small @click="emit('remove', item.id)" />
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
</style>
