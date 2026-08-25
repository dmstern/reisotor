<script setup lang="ts">
import { spotCategoryMeta } from '../utils/spotCategory';
import AppIcon from './AppIcon.vue';

// Wiederverwendbarer Kategorie-Chip (Icon + Label, eingefärbt nach spotCategoryMeta) – bisher an
// mehreren Stellen (Mini-Karte, Detail-Dialog, Karten-Gruppen-Überschriften) leicht unterschiedlich
// dupliziert. Zentral, damit die Optik langfristig konsistent bleibt. Rendert das Icon über
// AppIcon.vue statt fest per spotCategoryMeta().icon (#94) - respektiert damit denselben
// Emoji/Symbole-Umschalter wie der Rest der App, statt hier fest an Emoji hängenzubleiben.
defineProps<{ category: string | null | undefined }>();
</script>

<template>
  <span
    v-if="category"
    class="category-chip"
    :style="{
      background: `${spotCategoryMeta(category).color}26`,
      color: spotCategoryMeta(category).color,
    }"
  >
    <!-- Das Icon im bunten Badge ist immer eingefärbt (#142) - das "Kategorie-Icons einfärben"-
         Setting (iconStyle.colorizeCategories) steuert nur noch die Kategorie-Überschriften/die
         Kategorie-Navigation (siehe ExcursionsView.vue), nicht mehr die Badges selbst. -->
    <AppIcon
      :icon="spotCategoryMeta(category).tabler"
      group="categories"
      :size="14"
      :color="spotCategoryMeta(category).color"
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
