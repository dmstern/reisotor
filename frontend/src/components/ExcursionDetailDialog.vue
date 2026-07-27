<script setup lang="ts">
import { computed } from 'vue';
import type { Excursion, Spot } from '../api/types';
import { renderRichText } from '../utils/richText';
import DetailModal from './DetailModal.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MiniSpotCard from './MiniSpotCard.vue';
import ExcursionMiniMap from './ExcursionMiniMap.vue';

const props = defineProps<{
  modelValue: boolean;
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  stations: Spot[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'show-on-map'): void;
}>();

// Stationen in der definierten Ausflugsreihenfolge (spot_ids), nicht in der Reihenfolge von
// props.stations (kommt vom Spots-Store und kann anders sortiert sein) – bestimmt sowohl die
// Mini-Karten-Reihenfolge als auch die auf der Mini-Karte gezeichnete Route.
const orderedStations = computed(() =>
  props.excursion.spot_ids.map((id) => props.stations.find((s) => s.id === id)).filter((s): s is Spot => !!s),
);
const mappedStations = computed(() => orderedStations.value.filter((s) => s.lat != null && s.lng != null));

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="excursion.title"
    :image-url="excursion.image_url"
    placeholder-icon="🎒"
  >
    <p v-if="creatorLabel" class="detail-row">
      <span class="detail-label">Von</span>{{ creatorLabel }}
    </p>
    <p class="detail-row">
      <span class="detail-label">Status</span>
      {{ excursion.date ? `📅 ${formatDate(excursion.date)}` : 'In Planung' }}
    </p>
    <div v-if="excursion.note" class="detail-row note" v-html="renderRichText(excursion.note)"></div>

    <template v-if="mappedStations.length">
      <span class="detail-label">Route</span>
      <ExcursionMiniMap :spots="mappedStations" />
    </template>
    <p v-else class="hint">Noch keine Station mit Standort hinterlegt.</p>

    <template v-if="orderedStations.length">
      <span class="detail-label">Stationen</span>
      <div class="mini-spot-row">
        <MiniSpotCard v-for="spot in orderedStations" :key="spot.id" :spot="spot" />
      </div>
    </template>

    <div class="social-row">
      <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    </div>
    <Comments
      :comments="comments"
      @submit="(content) => emit('submit-comment', content)"
      @remove="(id) => emit('remove-comment', id)"
    />

    <div class="detail-actions">
      <button type="button" class="card-action-btn" @click="emit('edit')">✎ Bearbeiten</button>
      <button v-if="mappedStations.length" type="button" class="card-action-btn" @click="emit('show-on-map')">
        🗺️ Auf Karte anzeigen
      </button>
    </div>
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}

.hint {
  margin: 0 0 var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.mini-spot-row {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: 4px;
  margin: 4px 0 var(--space-2);
}

.social-row {
  margin-top: var(--space-2);
}
</style>
