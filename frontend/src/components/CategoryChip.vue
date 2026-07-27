<script setup lang="ts">
import { spotCategoryMeta } from '../utils/spotCategory';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta) – bisher an
// mehreren Stellen (Mini-Karte, Detail-Dialog, Karten-Gruppen-Überschriften) leicht unterschiedlich
// dupliziert. Zentral, damit die Optik langfristig konsistent bleibt.
defineProps<{ category: string | null | undefined }>();
</script>

<template>
  <span
    v-if="category"
    class="category-chip"
    :style="{ background: `${spotCategoryMeta(category).color}26`, color: spotCategoryMeta(category).color }"
  >
    {{ spotCategoryMeta(category).icon }} {{ category }}
  </span>
</template>

<style scoped>
.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
</style>
