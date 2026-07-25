<script setup lang="ts">
import { ref } from 'vue';
import type { Excursion, Spot } from '../api/types';
import { renderRichText } from '../utils/richText';
import { spotCategoryMeta } from '../utils/spotCategory';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';

const props = defineProps<{
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  stations: Spot[];
}>();
const emit = defineEmits<{
  (e: 'remove', id: number): void;
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
}>();

const showComments = ref(false);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// Drag-Quelle fürs Einplanen: der Ausflug wird direkt aus dieser Karte in die Kalender-Schublade
// gezogen (ersetzt den alten Pool auf der Kalender-Seite).
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/excursion-id', String(props.excursion.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card excursion-card" draggable="true" @dragstart="onDragStart">
    <div class="image" :style="excursion.image_url ? { backgroundImage: `url(${excursion.image_url})` } : {}">
      <span v-if="!excursion.image_url" class="placeholder">🎒</span>
      <EditButton floating @click="emit('edit', excursion)" />
      <span class="status" :class="{ planned: excursion.date }">
        {{ excursion.date ? `📅 ${formatDate(excursion.date)}` : 'In Planung' }}
      </span>
    </div>
    <div class="body">
      <h3>{{ excursion.title }}</h3>
      <p v-if="creatorLabel" class="creator">von {{ creatorLabel }}</p>
      <div v-if="excursion.note" class="note" v-html="renderRichText(excursion.note)"></div>
      <div class="stations" v-if="stations.length">
        <span v-for="spot in stations" :key="spot.id" class="station-chip">
          {{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}
        </span>
      </div>
      <div class="actions">
        <span class="drag-hint">↕ auf Kalender-Schublade ziehen zum Einplanen</span>
        <DeleteButton small @click="emit('remove', excursion.id)" />
      </div>
      <div class="social-row">
        <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
        <button class="secondary" @click="showComments = !showComments">💬 {{ comments.length || '' }}</button>
      </div>
      <Comments
        v-if="showComments"
        :comments="comments"
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.excursion-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: grab;
}

.excursion-card:active {
  cursor: grabbing;
}

.image {
  height: 160px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.placeholder {
  font-size: 2.5rem;
}

.status {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.status.planned {
  color: var(--color-success);
}

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.body h3 {
  font-size: 1rem;
  margin-bottom: 0;
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

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.drag-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.social-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.stations {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.station-chip {
  background: var(--color-hover);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
</style>
