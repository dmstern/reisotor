<script setup lang="ts">
import { ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import CategoryChip from './CategoryChip.vue';
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
  // Liegt beim Elternteil (ExcursionsView.vue), nicht lokal hier: dieselbe Information steuert dort
  // gleichzeitig, welcher Pin auf der direkt danebenliegenden Karte vergrößert wird (siehe
  // onCardClick unten) – ein Pin-Klick auf der Karte muss diese Karte hier aufklappen können, ohne
  // dass TripMap.vue direkten Zugriff auf SpotCard-Instanzen bräuchte.
  expanded: boolean;
}>();
const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'remove', id: number): void;
  (e: 'show-on-map', spot: Spot): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'open', spot: Spot): void;
  (e: 'close'): void;
}>();

const showComments = ref(false);

// Natives Drag (Zuordnen zu einer Tour) startet über einen dedizierten Anfasser (.excursion-drag-
// handle, siehe Template) statt über die ganze Karte – @click.stop dort verhindert, dass ein reiner
// (Nicht-Drag-)Klick auf den Anfasser zusätzlich die Detail-Ansicht öffnet.
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

// Klick auf die Karte klappt sie auf-/zu, statt (wie zuvor) einen Modal-Dialog zu öffnen – die
// direkt danebenliegende Karte (TripMap.vue) bleibt dadurch immer interaktiv, auch während man
// sich die Details eines Spots ansieht. Aufklappen zoomt/zentriert zusätzlich über
// drawers.openMapAt auf diesen Spot und lässt TripMap.vue seinen Pin dezent vergrößert darstellen;
// Zuklappen hebt die Hervorhebung wieder auf.
function onCardClick() {
  if (props.expanded) {
    emit('close');
    if (drawers.mapFocusKey === `spot-${props.spot.id}`) drawers.mapFocusKey = null;
  } else {
    emit('open', props.spot);
    drawers.openMapAt(`spot-${props.spot.id}`);
  }
}
</script>

<template>
  <div class="card spot-card" :class="{ expanded }" @click="onCardClick">
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
      <p v-if="expanded && creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
      <div v-if="spot.note" class="note" v-html="renderRichText(spot.note)"></div>
      <div class="links" v-if="spot.lat != null && spot.lng != null">
        <button type="button" class="card-action-btn" @click.stop="emit('show-on-map', spot)">🗺️ Auf Karte anzeigen</button>
      </div>
      <button
        type="button"
        class="excursion-drag-handle"
        draggable="true"
        aria-label="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        title="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        @dragstart="onDragStart"
        @click.stop
      >
        🎒 Auf Tour ziehen
      </button>
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
  </div>
</template>

<style scoped>
.spot-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

/* Ersetzt den früheren Modal-Dialog: die aktive Karte klappt an Ort und Stelle auf (mehr Zeilen,
   größeres Bild) statt einen Dialog über die Karte zu legen, die dadurch immer interaktiv bleibt
   (siehe onCardClick im Script). grid-column: span 2 nutzt das umgebende
   auto-fill-Raster (ExcursionsView.vue's .cards) für mehr Breite – reduziert sich bei nur einer
   verfügbaren Spalte automatisch auf span 1. */
.spot-card.expanded {
  grid-column: span 2;
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.spot-card.expanded .image {
  height: 200px;
}

.image {
  height: 120px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: height 0.15s ease;
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

/* Zwei Anfasser statt des gesamten Card-Roots als Drag-Quelle: .excursion-drag-handle (natives
   HTML5-DnD, siehe onDragStart im Script) und .calendar-drag-handle (Pointer-Events, siehe
   usePointerDrag-Wiring). touch-action:none beim Kalender-Anfasser verhindert, dass der Browser
   das Ziehen als Seiten-Scroll interpretiert (beim nativen DnD-Anfasser übernimmt das der Browser
   selbst). Das ::before-Punkte-Raster macht beide auf einen Blick als Zieh-Griff statt als
   normalen Button erkennbar. */
.calendar-drag-handle,
.excursion-drag-handle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  padding: 3px 10px 3px 8px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}

.calendar-drag-handle {
  touch-action: none;
}

.calendar-drag-handle::before,
.excursion-drag-handle::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 12px;
  background-image: radial-gradient(circle, currentColor 1px, transparent 1.3px),
    radial-gradient(circle, currentColor 1px, transparent 1.3px);
  background-size: 3px 4px, 3px 4px;
  background-position: 0 0, 3px 0;
  background-repeat: repeat-y, repeat-y;
  opacity: 0.6;
}

.calendar-drag-handle:active,
.excursion-drag-handle:active {
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

/* Kompakte Listen-Zeile statt Miniatur-Card auf schmalen Bildschirmen (Bottom-Sheet auf Mobil,
   siehe ExcursionsView.vue) – zeigt nur die wichtigsten Infos (Bild, Titel, Kategorie), sekundäre
   Aktionen (Notiz, Anfasser, Auf-Karte-Button) erst nach dem Aufklappen (:not(.expanded)). Grob
   nach demselben Zeilen-Muster wie ExcursionCard.vue (festes Vorschaubild links, Rest daneben). */
@media (max-width: 899px) {
  .spot-card:not(.expanded) {
    flex-direction: row;
    align-items: stretch;
  }

  .spot-card:not(.expanded) .image {
    width: 64px;
    height: auto;
    flex-shrink: 0;
  }

  .spot-card:not(.expanded) .body {
    padding: var(--space-2);
    gap: 2px;
  }

  .spot-card:not(.expanded) .note,
  .spot-card:not(.expanded) .links,
  .spot-card:not(.expanded) .excursion-drag-handle,
  .spot-card:not(.expanded) .calendar-drag-handle {
    display: none;
  }

  .spot-card:not(.expanded) .social-row {
    margin-top: 0;
  }

  /* Etwas kleiner als der Desktop-Wert (200px) aus der Aufklapp-Ansicht, damit das Bild auf
     schmalen Bildschirmen nicht zu dominant wirkt. */
  .spot-card.expanded .image {
    height: 160px;
  }
}
</style>
