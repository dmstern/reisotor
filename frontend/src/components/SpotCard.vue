<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
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

// Spontanes Einplanen direkt auf einen Kalendertag, ohne vorher einen Ausflug anzulegen (das
// Backend legt dafür im Hintergrund einen Ein-Spot-Ausflug an, siehe
// excursionsStore.planSpotOnDate) – 1:1 nach dem Muster von ExcursionCard.vue's
// 📅-Einplanen-Anfasser (eigener Pointer-Events-Drag statt nativem HTML5-DnD, da Letzteres auf
// Touch-Geräten unzuverlässig ist). Eigenständig neben dem bestehenden nativen
// draggable/dragstart oben (Zuordnen zu einem Ausflug) – kein Ersatz dafür.
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();
const { dragging, ghostStyle, onPointerDown } = usePointerDrag({
  onStart: () => {
    drawers.calendarOpen = true;
  },
  onDrop: (targetEl) => {
    const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
    if (!dayEl?.dataset.date) return;
    excursionsStore.planSpotOnDate(props.spot.id, dayEl.dataset.date);
  },
});

// Öffnen des Detail-Dialogs koppelt die (direkt danebenliegende) Karte: drawers.openMapAt zoomt/
// zentriert auf diesen Spot und lässt TripMap.vue seinen Pin dezent vergrößert darstellen. Schließen
// via Modal (✕/Backdrop/Escape) hebt die Hervorhebung wieder auf – bewusst nicht als pauschaler
// watch(detailOpen)-Handler, da @show-on-map unten detailOpen ebenfalls auf false setzt, dort aber
// der Fokus (auf denselben Punkt) bestehen bleiben soll (kein Wettlauf zwischen "schließen löscht
// Fokus" und "Auf-Karte-anzeigen setzt ihn").
function openDetail() {
  detailOpen.value = true;
  drawers.openMapAt(`spot-${props.spot.id}`);
}
function onDetailDialogUpdate(v: boolean) {
  detailOpen.value = v;
  if (!v && drawers.mapFocusKey === `spot-${props.spot.id}`) drawers.mapFocusKey = null;
}
function onEdit() {
  detailOpen.value = false;
  if (drawers.mapFocusKey === `spot-${props.spot.id}`) drawers.mapFocusKey = null;
  emit('edit', props.spot);
}
function onShowOnMap() {
  detailOpen.value = false;
  emit('show-on-map', props.spot);
}
</script>

<template>
  <div class="card spot-card" draggable="true" @dragstart="onDragStart" @click="openDetail">
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
      <div class="links" v-if="spot.lat != null && spot.lng != null">
        <button type="button" class="card-action-btn" @click.stop="emit('show-on-map', spot)">🗺️ Auf Karte anzeigen</button>
      </div>
      <span class="drag-hint">↕ auf einen Ausflug ziehen, um ihn dort als Station hinzuzufügen</span>
      <button
        type="button"
        class="calendar-drag-handle"
        aria-label="Auf Kalender ziehen zum spontanen Einplanen"
        title="Auf Kalender ziehen zum spontanen Einplanen"
        @pointerdown="onPointerDown"
        @click.stop
      >
        📅 Einplanen
      </button>
      <Teleport to="body">
        <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">📅 {{ spot.title }}</div>
      </Teleport>
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
      :model-value="detailOpen"
      @update:model-value="onDetailDialogUpdate"
      :spot="spot"
      :creator-label="creatorLabel"
      :like-count="likeCount"
      :liked="liked"
      :comments="comments"
      @edit="onEdit"
      @toggle-like="emit('toggle-like')"
      @submit-comment="(content) => emit('submit-comment', content)"
      @remove-comment="(id) => emit('remove-comment', id)"
      @show-on-map="onShowOnMap"
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

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.social-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* Eigener Anfasser statt des gesamten Card-Roots als Drag-Quelle (siehe usePointerDrag-Wiring im
   Script) – touch-action:none verhindert, dass der Browser das Ziehen als Seiten-Scroll
   interpretiert. */
.calendar-drag-handle {
  align-self: flex-start;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.calendar-drag-handle:active {
  cursor: grabbing;
}

/* Schwebt während des Drags am Zeiger, per Teleport außerhalb der Karte (sonst würde sie beim
   Öffnen der Kalender-Schublade durch deren Backdrop/Panel überlagert). z-index 60: über dem
   Drawer-Overlay (11/12), unter Modal.vue (100, wird während eines Drags nie gleichzeitig
   gebraucht). Fester dunkler Chip statt Dark-Mode-Override, da sie über beliebigem Seiteninhalt
   schwebt statt über einem Foto. */
.drag-ghost {
  position: fixed;
  z-index: 60;
  transform: translate(-50%, -130%);
  pointer-events: none;
  background: rgba(35, 34, 32, 0.92);
  color: #f2efe9;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}
</style>
