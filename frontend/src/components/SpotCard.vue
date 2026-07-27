<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import DetailModal from './DetailModal.vue';
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
const detailOpen = ref(false);

// Natives Drag (Zuordnen zu einem Ausflug) und der neue Klick-zum-Öffnen-Handler vertragen sich
// auf Desktop ohne Sonderbehandlung: der Browser unterdrückt den synthetischen Klick nach einem
// echten Drag-Vorgang von selbst (anders als bei ExcursionCard.vue's neuem Touch-Anfasser, wo kein
// natives DnD mehr im Spiel ist und deshalb explizit @click.stop nötig ist).
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/spot-id', String(props.spot.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card spot-card" draggable="true" @dragstart="onDragStart" @click="detailOpen = true">
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
      <span class="drag-hint">↕ auf einen Ausflug ziehen, um ihn dort als Station hinzuzufügen</span>
      <div class="social-row">
        <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
        <button class="secondary" @click.stop="showComments = !showComments">💬 {{ comments.length || '' }}</button>
      </div>
      <Comments
        v-if="showComments"
        :comments="comments"
        @click.stop
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
      />
    </div>

    <DetailModal
      v-model="detailOpen"
      :title="spot.title"
      :image-url="spot.image_url"
      :placeholder-icon="spotCategoryMeta(spot.category).icon"
    >
      <p v-if="creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
      <p v-if="spot.category" class="detail-row">
        <span class="detail-label">Kategorie</span>{{ spotCategoryMeta(spot.category).icon }} {{ spot.category }}
      </p>
      <div v-if="spot.note" class="detail-row note" v-html="renderRichText(spot.note)"></div>
      <div class="social-row">
        <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
      </div>
      <Comments
        :comments="comments"
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
      />
      <div class="detail-actions">
        <button type="button" class="card-action-btn" @click="detailOpen = false; emit('edit', spot)">✎ Bearbeiten</button>
        <button
          v-if="spot.lat != null && spot.lng != null"
          type="button"
          class="card-action-btn"
          @click="detailOpen = false; emit('show-on-map', spot)"
        >
          🗺️ Auf Karte anzeigen
        </button>
      </div>
    </DetailModal>
  </div>
</template>

<style scoped>
.spot-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
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

.note {
  overflow-wrap: anywhere;
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
