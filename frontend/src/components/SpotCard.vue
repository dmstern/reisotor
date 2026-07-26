<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';

const props = defineProps<{
  spot: Spot;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
}>();
const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'remove', id: number): void;
  (e: 'show-on-map', spot: Spot): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
}>();

const showComments = ref(false);

// Drag-Quelle fürs Zuordnen zu einem Ausflug: der Spot wird direkt aus dieser Karte auf eine
// Ausflug-Karte gezogen (ExcursionCard.vue ist die Drop-Zone).
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/spot-id', String(props.spot.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card spot-card" draggable="true" @dragstart="onDragStart">
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <span v-if="!spot.image_url" class="placeholder">{{ spotCategoryMeta(spot.category).icon }}</span>
      <EditButton floating @click="emit('edit', spot)" />
      <DeleteButton floating @click="emit('remove', spot.id)" />
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
        <button v-if="spot.lat != null && spot.lng != null" type="button" class="card-action-btn" @click="emit('show-on-map', spot)">
          🗺️ Auf Karte anzeigen
        </button>
      </div>
      <span class="drag-hint">↕ auf einen Ausflug ziehen, um ihn dort als Station hinzuzufügen</span>
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
.spot-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: grab;
}

.spot-card:active {
  cursor: grabbing;
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

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.drag-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.social-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
