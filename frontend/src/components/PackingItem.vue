<script setup lang="ts">
import type { PackingItem } from '../api/types';

defineProps<{ item: PackingItem }>();
const emit = defineEmits<{
  (e: 'toggle', item: PackingItem): void;
  (e: 'remove', id: number): void;
}>();
</script>

<template>
  <li class="row">
    <label class="check">
      <input type="checkbox" :checked="!!item.checked" @change="emit('toggle', item)" />
      <span :class="{ done: item.checked }">{{ item.label }}</span>
    </label>
    <button class="secondary" @click="emit('remove', item.id)">✕</button>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

button {
  padding: 4px 10px;
}
</style>
