<script setup lang="ts">
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';

// Ganz bewusst ohne Like/Kommentar/Edit/Löschen/Drag – dient im Ausflug-Detail-Dialog nur der
// Übersicht "welche Stationen in welcher Reihenfolge", nicht der Interaktion (die passiert weiter
// über die eigentliche Spot-Karte in der Spots-Übersicht).
defineProps<{ spot: Spot }>();
</script>

<template>
  <div class="mini-spot-card">
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <span v-if="!spot.image_url" class="placeholder">{{ spotCategoryMeta(spot.category).icon }}</span>
    </div>
    <div class="body">
      <span class="title">{{ spot.title }}</span>
      <span v-if="spot.category" class="category">{{ spotCategoryMeta(spot.category).icon }} {{ spot.category }}</span>
    </div>
  </div>
</template>

<style scoped>
.mini-spot-card {
  width: 96px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image {
  height: 64px;
  border-radius: var(--radius-sm);
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
}

.title {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.category {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
