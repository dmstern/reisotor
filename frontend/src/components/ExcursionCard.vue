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
  (e: 'drop-spot', spotId: number): void;
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

// Drop-Zone fürs Zuordnen: ein Spot kann direkt aus der Spots-Sicht auf diese Karte gezogen
// werden, um ihn als Station hinzuzufügen (SpotCard.vue ist die Drag-Quelle). Zähler statt
// Boolean, da dragenter/dragleave beim Überqueren von Kind-Elementen mehrfach feuern. Der
// types-Check ist nötig, weil beim Ziehen eines ANDEREN Ausflugs (text/excursion-id) über diese
// Karte hinweg sonst ebenfalls dragenter/dragleave feuern würde – Ausflüge sollen nur auf den
// Status-Bereichen (In Planung/Geplant) landen, nicht auf einzelnen Ausflug-Karten.
const spotDragOverCount = ref(0);
function isSpotDrag(event: DragEvent) {
  return !!event.dataTransfer?.types.includes('text/spot-id');
}
function onSpotDragEnter(event: DragEvent) {
  if (!isSpotDrag(event)) return;
  spotDragOverCount.value++;
}
function onSpotDragLeave(event: DragEvent) {
  if (!isSpotDrag(event)) return;
  spotDragOverCount.value = Math.max(0, spotDragOverCount.value - 1);
}
function onSpotDrop(event: DragEvent) {
  spotDragOverCount.value = 0;
  const raw = event.dataTransfer?.getData('text/spot-id');
  if (!raw) return;
  emit('drop-spot', Number(raw));
}
</script>

<template>
  <div
    class="card excursion-card"
    :class="{ 'drop-target': spotDragOverCount > 0 }"
    draggable="true"
    @dragstart="onDragStart"
    @dragover.prevent
    @dragenter.prevent="onSpotDragEnter"
    @dragleave="onSpotDragLeave"
    @drop.prevent="onSpotDrop"
  >
    <DeleteButton floating class="card-delete" @click="emit('remove', excursion.id)" />
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
      <span class="drag-hint">↕ auf Kalender-Schublade ziehen zum Einplanen</span>
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
/* Volle Breite statt kleiner Grid-Card (wie Tagebucheinträge) – macht Ausflüge auf einen Blick von
   den (weiterhin als Grid angezeigten) Spots unterscheidbar. Bild als schmale, feste Miniatur
   links statt großem Banner oben, damit es bei voller Breite nicht unnötig gestreckt wirkt. */
.excursion-card {
  position: relative;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 120px;
  cursor: grab;
  border: 2px dashed transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

/* Löschen-Button schwebt in der oberen rechten Ecke der ganzen Card (nicht des Vorschaubilds) –
   .excursion-card ist dafür position:relative. */
.card-delete {
  z-index: 1;
}

.excursion-card:active {
  cursor: grabbing;
}

/* Spot per Drag&Drop aus der Spots-Sicht darauf ablegen (SpotCard.vue ist die Drag-Quelle). */
.excursion-card.drop-target {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.image {
  width: 140px;
  flex-shrink: 0;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

@media (max-width: 480px) {
  .excursion-card {
    flex-direction: column;
  }

  .image {
    width: auto;
    height: 140px;
  }
}

.placeholder {
  font-size: 2.5rem;
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

.creator {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0;
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
