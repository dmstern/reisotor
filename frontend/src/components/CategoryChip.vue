<script setup lang="ts">
import { spotCategoryMeta } from '../utils/spotCategory';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta) – nutzt das
// primitive Badge.vue für konsistente Chip-/Badge-Darstellung.
withDefaults(
  defineProps<{
    category: string | null | undefined;
    iconOnly?: boolean;
  }>(),
  {
    iconOnly: false,
  }
);
</script>

<template>
  <Badge
    v-if="category"
    class="category-chip"
    :class="{ 'is-icon-only': iconOnly }"
    :title="category"
    :style="{
      background: `${spotCategoryMeta(category).color}26`,
      color: spotCategoryMeta(category).color,
      borderColor: 'transparent',
    }"
  >
    <!-- Das Icon im bunten Badge ist immer eingefärbt (#142) -->
    <AppIcon
      :icon="spotCategoryMeta(category).tabler"
      group="categories"
      :size="14"
      :color="spotCategoryMeta(category).color"
    />
    <span class="category-chip-label" :class="{ 'sr-only': iconOnly }">{{ category }}</span>
  </Badge>
</template>

<style scoped>
.category-chip {
  font-size: 0.72rem;
  max-width: 120px;
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
