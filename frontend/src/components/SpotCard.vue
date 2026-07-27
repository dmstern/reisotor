<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import CategoryChip from './CategoryChip.vue';
import SpotDetailDialog from './SpotDetailDialog.vue';
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

// Natives Drag (Zuordnen zu einem Ausflug) und der Klick-zum-Öffnen-Handler vertragen sich auf
// Desktop ohne Sonderbehandlung: der Browser unterdrückt den synthetischen Klick nach einem echten
// Drag-Vorgang von selbst (anders als bei ExcursionCard.vue's Touch-Anfasser, wo kein natives DnD
// mehr im Spiel ist und deshalb explizit @click.stop nötig ist).
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
        <CategoryChip :category="spot.category" />
      </div>
      <div v-if="spot.note" class="note" v-html="renderRichText(spot.note)"></div>
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

    <SpotDetailDialog
      v-model="detailOpen"
      :spot="spot"
      :creator-label="creatorLabel"
      :like-count="likeCount"
      :liked="liked"
      :comments="comments"
      @edit="detailOpen = false; emit('edit', spot)"
      @toggle-like="emit('toggle-like')"
      @submit-comment="(content) => emit('submit-comment', content)"
      @remove-comment="(id) => emit('remove-comment', id)"
      @show-on-map="detailOpen = false; emit('show-on-map', spot)"
    />
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
