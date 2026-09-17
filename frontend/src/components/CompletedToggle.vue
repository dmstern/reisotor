<script setup lang="ts">
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{
  // true: erledigte Einträge ausblenden, false: erledigte Einträge anzeigen (Standard)
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const OPTIONS = [
  { value: 'show', label: 'anzeigen' },
  { value: 'hide', label: 'ausblenden' },
];
</script>

<template>
  <div class="tool-row completed-toggle">
    <span class="tool-label">
      <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
      Erledigte
    </span>
    <SegmentedToggle
      :model-value="modelValue ? 'hide' : 'show'"
      :options="OPTIONS"
      @update:model-value="(v) => emit('update:modelValue', v === 'hide')"
    />
  </div>
</template>

<style scoped>
.tool-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
  margin-left: auto;
}

.tool-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
