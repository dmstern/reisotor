<script setup lang="ts">
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';

defineProps<{ spot: Spot; creatorLabel: string | null }>();
const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'remove', id: number): void;
  (e: 'toggle-discarded', spot: Spot): void;
  (e: 'show-on-map', spot: Spot): void;
}>();
</script>

<template>
  <div class="card spot-card" :class="{ discarded: spot.discarded }">
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <span v-if="!spot.image_url" class="placeholder">{{ spotCategoryMeta(spot.category).icon }}</span>
      <EditButton floating @click="emit('edit', spot)" />
    </div>
    <div class="body">
      <div class="head">
        <h3>{{ spot.title }}</h3>
        <span v-if="spot.category" class="category" :style="{ background: `${spotCategoryMeta(spot.category).color}26`, color: spotCategoryMeta(spot.category).color }">
          {{ spotCategoryMeta(spot.category).icon }} {{ spot.category }}
        </span>
      </div>
      <p v-if="creatorLabel" class="creator">von {{ creatorLabel }}</p>
      <div v-if="spot.note" class="note" v-html="renderRichText(spot.note)"></div>
      <div class="links">
        <a v-if="spot.maps_link" :href="spot.maps_link" target="_blank" rel="noopener" class="external-link-btn"
          >📍 Extern öffnen ↗</a
        >
        <button v-if="spot.lat != null && spot.lng != null" type="button" class="secondary map-btn" @click="emit('show-on-map', spot)">
          🗺️ Auf Karte anzeigen
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary discard-btn" @click="emit('toggle-discarded', spot)">
          {{ spot.discarded ? '↩️ Wieder aktivieren' : '❌ Verwerfen' }}
        </button>
        <DeleteButton small @click="emit('remove', spot.id)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.spot-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.spot-card.discarded {
  opacity: 0.6;
}

.image {
  height: 120px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.placeholder {
  font-size: 2.2rem;
}

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.head h3 {
  margin: 0;
  font-size: 1rem;
}

.category {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.creator {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0;
}

.note {
  overflow-wrap: anywhere;
}

.note :deep(a) {
  color: var(--color-primary);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.external-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(42, 127, 116, 0.08);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-primary);
}

.external-link-btn:hover {
  background: var(--color-primary-tint);
}

.map-btn {
  font-size: 0.85rem;
  padding: 4px 10px;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.discard-btn {
  font-size: 0.8rem;
  padding: 4px 10px;
}
</style>
