<script setup lang="ts">
import { spotCategoryMeta } from '../utils/spotCategory';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta) – nutzt das
// primitive Badge.vue für konsistente Chip-/Badge-Darstellung.
defineProps<{ category: string | null | undefined }>();
</script>

<template>
  <Badge
    v-if="category"
    class="category-chip"
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
    {{ category }}
  </Badge>
</template>

<style scoped>
.category-chip {
  font-size: 0.72rem;
}
</style>
