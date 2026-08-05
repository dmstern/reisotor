<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';

// Einfacher Tagging-Modus fürs Touren-Formular (Standard, siehe stores/tourSettings.ts): welche
// Spots gehören zu dieser Tour, ohne Reihenfolge/Mehrfachbesuch-Pflege (dafür SpotOrderPicker.vue
// im "Erweiterte Touren-Bearbeitung"-Modus). Ein Spot ist entweder dabei oder nicht - reines
// Umschalten statt eines eigenen "Hinzufügen"-Klicks pro Zeile.
const props = defineProps<{
  modelValue: number[];
  spots: Spot[];
  likeCount: (spotId: number) => number;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: number[]): void;
}>();

const sortedSpots = computed(() =>
  [...props.spots].sort((a, b) => props.likeCount(b.id) - props.likeCount(a.id) || a.title.localeCompare(b.title)),
);

function isSelected(id: number) {
  return props.modelValue.includes(id);
}

function toggle(id: number) {
  emit('update:modelValue', isSelected(id) ? props.modelValue.filter((s) => s !== id) : [...props.modelValue, id]);
}
</script>

<template>
  <fieldset v-if="sortedSpots.length" class="spot-toggle-picker">
    <legend>Spots dieser Tour</legend>
    <label v-for="spot in sortedSpots" :key="spot.id" class="spot-toggle-row">
      <input type="checkbox" :checked="isSelected(spot.id)" @change="toggle(spot.id)" />
      <span class="spot-toggle-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
      <span class="spot-toggle-likes">❤️ {{ likeCount(spot.id) }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.spot-toggle-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.spot-toggle-picker legend {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0 4px;
}

.spot-toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  padding: 4px 2px;
  cursor: pointer;
}

.spot-toggle-title {
  flex: 1;
}

.spot-toggle-likes {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
