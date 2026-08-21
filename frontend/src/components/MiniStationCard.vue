<script setup lang="ts">
import type { ExcursionStation } from '../utils/excursionStations';

// Ganz bewusst ohne Like/Kommentar/Edit/Löschen/Drag – dient in der Ausflug-Stationsliste
// (TripMap.vue's Ausflug-Fokus-Stationsliste) nur der Übersicht "welche Stationen in welcher
// Reihenfolge", nicht der Interaktion. Eine Station ist nicht zwingend ein echter Spot (kann auch
// die Unterkunft oder ein Anreise-/Abreise-Ort sein, siehe utils/excursionStations.ts) – Icon/
// Kategorie/Bild kommen deshalb bereits fertig aufgelöst vom ExcursionStation-Objekt statt hier
// erneut per spotCategoryMeta() bestimmt zu werden.
defineProps<{ station: ExcursionStation }>();
</script>

<template>
  <div class="mini-station-card">
    <div class="image" :style="station.imageUrl ? { backgroundImage: `url(${station.imageUrl})` } : {}">
      <span v-if="!station.imageUrl" class="placeholder">{{ station.icon }}</span>
    </div>
    <div class="body">
      <span class="title">{{ station.title }}</span>
      <span class="category">{{ station.icon }} {{ station.category }}</span>
    </div>
  </div>
</template>

<style scoped>
.mini-station-card {
  width: 96px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.image {
  height: 64px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  font-size: 1.4rem;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Ringsherum derselbe Abstand (oben/rechts/unten/links) - der Abstand zum Vorschaubild kommt
     dadurch automatisch aus diesem Padding statt aus einem zusätzlichen, separaten Gap auf
     .mini-station-card (das addierte sich vorher ungewollt zum Padding, siehe PR #173). */
  padding: 0.6em;
}

.title {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
