<script setup lang="ts">
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import DetailModal from './DetailModal.vue';
import CategoryChip from './CategoryChip.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';

// Eigenständige Komponente statt inline in SpotCard.vue, da dieser Dialog auch von anderer Stelle
// geöffnet werden muss (MapView.vue's Stationsliste, ExcursionDetailDialog.vue's Stationen) – nicht
// nur aus der Spots-Übersicht heraus.
defineProps<{
  modelValue: boolean;
  spot: Spot;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'show-on-map'): void;
}>();
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="spot.title"
    :image-url="spot.image_url"
    :placeholder-icon="spotCategoryMeta(spot.category).icon"
    @edit="emit('edit')"
  >
    <p v-if="creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
    <p v-if="spot.category" class="detail-row"><CategoryChip :category="spot.category" /></p>
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
      <button
        v-if="spot.lat != null && spot.lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map')"
      >
        🗺️ Auf Karte anzeigen
      </button>
    </div>
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}

.social-row {
  margin-top: var(--space-2);
}
</style>
