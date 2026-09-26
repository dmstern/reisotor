<script setup lang="ts">
import { computed } from 'vue';
import type { IconDef } from '../utils/icon';
import { useTripCategoriesStore } from '../stores/tripCategories';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta oder expenseCategoryMeta)
// – nutzt das primitive Badge.vue für konsistente Chip-/Badge-Darstellung und berücksichtigt Custom-Kategorien.
const props = withDefaults(
  defineProps<{
    category: string | null | undefined;
    type?: 'spot' | 'expense';
    iconOnly?: boolean;
    customMeta?: { label: string; icon: string; color: string; tabler: IconDef };
  }>(),
  {
    type: 'spot',
    iconOnly: false,
  }
);

const tripCategoriesStore = useTripCategoriesStore();

const meta = computed(() => {
  if (props.customMeta) return props.customMeta;
  if (!props.category) return null;
  return tripCategoriesStore.categoryMeta(props.category, props.type);
});
</script>

<template>
  <Badge
    v-if="category && meta"
    class="category-chip"
    :class="{ 'is-icon-only': iconOnly }"
    :title="category"
    :style="{
      '--category-color': meta.color,
    }"
  >
    <!-- Das Icon im bunten Badge übernimmt die kontrastoptimierte Textfarbe (#142, #audit) -->
    <AppIcon :icon="meta.tabler" group="categories" :size="14" color="currentColor" />
    <span class="category-chip-label" :class="{ 'sr-only': iconOnly }">{{ category }}</span>
  </Badge>
</template>

<style scoped>
.category-chip {
  --chip-bg: color-mix(in srgb, var(--category-color) 12%, var(--color-surface, #ffffff));
  --chip-text: color-mix(in srgb, var(--category-color) 78%, #0f172a);
  --chip-border: color-mix(in srgb, var(--category-color) 30%, transparent);

  font-size: 0.72rem;
  max-width: 120px;
  font-weight: 650;
  background: var(--chip-bg);
  color: var(--chip-text);
  border: 1px solid var(--chip-border);
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

/* Dunkel-Modus: Strahlend helle Textfarbe (80% weiß gemischt) und satterer Tint-Hintergrund für hohe Leuchtkraft */
:root[data-theme='dark'] .category-chip {
  --chip-bg: color-mix(in srgb, var(--category-color) 22%, var(--color-surface, #1e1e24));
  --chip-text: color-mix(in srgb, var(--category-color) 20%, #ffffff);
  --chip-border: color-mix(in srgb, var(--category-color) 38%, transparent);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .category-chip {
    --chip-bg: color-mix(in srgb, var(--category-color) 22%, var(--color-surface, #1e1e24));
    --chip-text: color-mix(in srgb, var(--category-color) 20%, #ffffff);
    --chip-border: color-mix(in srgb, var(--category-color) 38%, transparent);
  }
}

.category-chip.is-icon-only {
  padding: 3px 6px;
  gap: 0;
  max-width: none;
}

.category-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
