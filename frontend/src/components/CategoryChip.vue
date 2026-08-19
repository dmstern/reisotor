<script setup lang="ts">
import { spotCategoryMeta } from '../utils/spotCategory';
import { useIconStyleStore } from '../stores/iconStyle';
import AppIcon from './AppIcon.vue';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta) – bisher an
// mehreren Stellen (Mini-Karte, Detail-Dialog, Karten-Gruppen-Überschriften) leicht unterschiedlich
// dupliziert. Zentral, damit die Optik langfristig konsistent bleibt. Rendert das Icon über
// AppIcon.vue statt fest per spotCategoryMeta().icon (#94) - respektiert damit denselben
// Emoji/Symbole-Umschalter wie der Rest der App, statt hier fest an Emoji hängenzubleiben.
defineProps<{ category: string | null | undefined }>();
const iconStyle = useIconStyleStore();
</script>

<template>
  <span
    v-if="category"
    class="category-chip"
    :style="{ background: `${spotCategoryMeta(category).color}26`, color: spotCategoryMeta(category).color }"
  >
    <!-- Ohne explizite Farbe würde das Icon über currentColor automatisch dieselbe Tönung wie das
         Label-Chip selbst erben (:style oben) - das Einfärben-Setting wäre dadurch wirkungslos.
         Standard (aus) deshalb ein neutraler Ton, unabhängig von der Chip-Akzentfarbe - am ehesten
         vergleichbar mit dem bisherigen Emoji-Glyphen, dessen Eigenfarben ebenfalls nicht an die
         Kategorie-Akzentfarbe gebunden waren. -->
    <AppIcon
      :icon="spotCategoryMeta(category).tabler"
      group="categories"
      :size="14"
      :color="iconStyle.colorizeCategories ? spotCategoryMeta(category).color : 'var(--color-text-muted)'"
    />
    {{ category }}
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
