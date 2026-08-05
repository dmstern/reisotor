<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import { parseContact } from '../utils/contact';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useTourSettingsStore } from '../stores/tourSettings';
import CategoryChip from './CategoryChip.vue';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import SocialRow from './SocialRow.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import FileAttachments from './FileAttachments.vue';
import { formatDate as formatDateShared } from '../utils/dateFormat';

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
  // Frühestes Datum, an dem dieser Spot über einen Kalender-Termin (schedule_items.spot_id)
  // eingeplant ist, oder null falls (noch) nicht geplant – vom Elternteil aus dem scheduleStore
  // abgeleitet (analog zu Excursion.date), da mehrere Karten sich denselben Stand teilen müssen.
  scheduledDate: string | null;
  highlighted?: boolean;
  /** Nur für Kategorie "Unterkunft" mit gesetztem paid_by_user_id relevant (siehe
   *  Migrationskommentar in db/index.ts). */
  payerLabel?: string | null;
}>();

const isAccommodation = computed(() => props.spot.category === 'Unterkunft');

function formatAccommodationDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}
const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'remove', id: number): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'open', spot: Spot): void;
  (e: 'close'): void;
}>();

const showComments = ref(false);

function formatDate(d: string) {
  return formatDateShared(d, { includeYear: false });
}

// Natives Drag (Zuordnen zu einer Tour) startet über einen dedizierten Anfasser (.excursion-drag-
// handle, siehe Template) statt über die ganze Karte – @click.stop dort verhindert, dass ein reiner
// (Nicht-Drag-)Klick auf den Anfasser zusätzlich die Detail-Ansicht öffnet. Öffnet nebenbei die
// Touren-Schublade: die ist auf Mobil standardmäßig zu (drawers.ts loadOpen), ein Drop auf eine
// ExcursionCard darin wäre sonst gar nicht erreichbar.
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/spot-id', String(props.spot.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  drawers.excursionsOpen = true;
}

// Klick-Alternative zum nativen Drag oben: natives HTML5-DnD ist auf Touch-Geräten unzuverlässig
// (siehe usePointerDrag-Kommentar unten), ein reiner Tap auf den Anfasser öffnet deshalb ebenfalls
// direkt die Touren-Schublade (Desktop) bzw. navigiert zur Touren-Seite (Mobil, siehe
// drawers.openExcursions()) – exakt dasselbe Muster wie der 📅-Einplanen-Anfasser (dort via
// usePointerDrag's onTap statt eines eigenen Klick-Handlers, weil er zusätzlich ein echtes
// Pointer-Drag unterstützt).
function onExcursionHandleClick() {
  drawers.openExcursions();
}

// Spontanes Einplanen direkt auf einen Kalendertag, ohne vorher einen Ausflug anzulegen: legt
// einen mit diesem Spot verknüpften Termin an (siehe stores/schedule.ts) statt (wie früher) im
// Hintergrund einen unsichtbaren Ein-Spot-Ausflug – 1:1 nach dem Muster von ExcursionCard.vue's
// 📅-Einplanen-Anfasser (eigener Pointer-Events-Drag statt nativem HTML5-DnD, da Letzteres auf
// Touch-Geräten unzuverlässig ist). Eigenständig neben dem bestehenden nativen
// draggable/dragstart oben (Zuordnen zu einem Ausflug) – kein Ersatz dafür.
const excursionsStore = useExcursionsStore();
const scheduleStore = useScheduleStore();
const tripStore = useTripStore();
const drawers = useDrawersStore();
const tourSettings = useTourSettingsStore();
const { dragging, ghostStyle, onPointerDown } = usePointerDrag({
  onStart: () => {
    drawers.calendarOpen = true;
  },
  onDrop: (targetEl) => {
    const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
    if (!dayEl?.dataset.date || tripStore.currentTripId == null) return;
    scheduleStore.create({
      trip_id: tripStore.currentTripId,
      date: dayEl.dataset.date,
      title: props.spot.title,
      spot_id: props.spot.id,
    });
  },
  // Klick-Alternative zum Drag: öffnet die Kalender-Schublade und merkt sich den Spot, der beim
  // nächsten Tages-Klick eingeplant werden soll (siehe drawers.startPendingSchedule/
  // ScheduleView.vue's selectDay()).
  onTap: () => {
    drawers.startPendingSchedule('spot', props.spot.id);
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
  <div class="card spot-card" :class="{ expanded, 'new-highlight': highlighted }" @click="onCardClick">
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <span v-if="!spot.image_url" class="placeholder">{{ spotCategoryMeta(spot.category).icon }}</span>
      <!-- Nur in der aufgeklappten Karte - in der kompakten Mini-Card (v. a. auf mobile knapper
           Platz) reichen Bild/Titel/Kategorie zur Orientierung, Bearbeiten/Löschen sind erst nach
           dem Aufklappen erreichbar. -->
      <template v-if="expanded">
        <EditButton floating @click="emit('edit', spot)" />
        <DeleteButton floating @click="emit('remove', spot.id)" />
      </template>
      <span v-if="scheduledDate" class="status planned">📅 {{ formatDate(scheduledDate) }}</span>
    </div>
    <div class="body">
      <div class="head">
        <h3>{{ spot.title }}</h3>
        <CategoryChip :category="spot.category" />
      </div>
      <p v-if="expanded && creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
      <template v-if="expanded && isAccommodation">
        <p v-if="spot.start_date || spot.end_date" class="detail-row">
          <span class="detail-label">Zeitraum</span>
          🗓️ {{ formatAccommodationDate(spot.start_date) || '?' }} – {{ formatAccommodationDate(spot.end_date) || '?' }}
        </p>
        <p v-if="spot.address" class="detail-row"><span class="detail-label">Adresse</span>{{ spot.address }}</p>
        <p v-if="spot.checkin || spot.checkout" class="detail-row">
          <span class="detail-label">Check-in/-out</span>
          {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
        </p>
        <p v-if="spot.contact && parseContact(spot.contact).kind === 'phone'" class="detail-row">
          <span class="detail-label">Kontakt</span>
          📞 <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
        </p>
        <p v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'" class="detail-row">
          <span class="detail-label">Kontakt</span>
          📧 <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
        </p>
        <p v-else-if="spot.contact" class="detail-row">
          <span class="detail-label">Kontakt</span>
          <span class="contact-text richtext" v-html="renderRichText(spot.contact)"></span>
        </p>
        <p v-if="spot.amount != null" class="detail-row">
          <span class="detail-label">Kosten</span>
          💶 {{ spot.amount.toFixed(2) }} €
          <span v-if="spot.paid_by_user_id"> · bezahlt von {{ payerLabel }}</span>
        </p>
      </template>
      <div v-if="spot.note" class="note richtext" v-html="renderRichText(spot.note)"></div>
      <button
        v-if="tourSettings.advancedEditing"
        type="button"
        class="excursion-drag-handle"
        draggable="true"
        aria-label="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        title="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        @dragstart="onDragStart"
        @click.stop="onExcursionHandleClick"
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
      <MapsAppPicker
        v-if="spot.lat != null && spot.lng != null"
        :lat="spot.lat"
        :lng="spot.lng"
        :title="spot.title"
        :maps-link="spot.maps_link"
        @click.stop
      />
      <Teleport to="body">
        <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">📅 {{ spot.title }}</div>
      </Teleport>
      <SocialRow
        class="social-row"
        :like-count="likeCount"
        :liked="liked"
        :comment-count="comments.length"
        @toggle-like="emit('toggle-like')"
        @toggle-comments="showComments = !showComments"
      />
      <Comments
        v-if="showComments"
        :comments="comments"
        @click.stop
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
      />
      <div v-if="expanded" @click.stop>
        <FileAttachments domain="spots" :entity-id="spot.id" />
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
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

/* Ersetzt den früheren Modal-Dialog: die aktive Karte klappt an Ort und Stelle auf (mehr Zeilen,
   größeres Bild) statt einen Dialog über die Karte zu legen, die dadurch immer interaktiv bleibt
   (siehe onCardClick im Script). Bleibt bewusst in der bestehenden Grid-Spalte (kein grid-column:
   span 2 mehr) – die Karte soll sich nur durch Rahmen/Hintergrund als fokussiert zeigen, nicht die
   volle Breite einnehmen. */
.spot-card.expanded {
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

/* Status-Chip "geplant" (im Kalender eingeplant) mit Datum – dasselbe Muster wie
   ExcursionCard.vue's .status/.status.planned (inkl. Dark-Mode-Override unten), damit beide
   Karten-Typen optisch konsistent bleiben. Unten statt oben rechts positioniert: oben rechts
   sitzt hier bereits der schwebende Löschen-Button (EditButton/DeleteButton floating landen beide
   im selben .image-Container), anders als bei ExcursionCard.vue, wo der Löschen-Button außerhalb
   von .image auf Höhe der ganzen (breiteren) Card schwebt. Nur im geplanten Fall sichtbar (siehe
   v-if im Template) statt immer einen "Nicht geplant"-Chip zu zeigen – ein Spot muss (anders als
   ein Ausflug) nicht zwangsläufig einmal eingeplant werden. */
.status {
  position: absolute;
  bottom: 8px;
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

:root[data-theme='dark'] .status {
  background: rgba(35, 34, 32, 0.85);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .status {
    background: rgba(35, 34, 32, 0.85);
  }
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

.contact-text :deep(br:last-child) {
  display: none;
}

.social-row {
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
  corner-shape: round;
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

/* Kompakte Listen-Zeile statt Miniatur-Card auf schmalen .spots-col-Breiten – zeigt nur die
   wichtigsten Infos (Bild, Titel, Kategorie), sekundäre Aktionen (Notiz, Anfasser,
   Auf-Karte-Button) erst nach dem Aufklappen (:not(.expanded)). Grob nach demselben Zeilen-Muster
   wie ExcursionCard.vue (festes Vorschaubild links, Rest daneben). Container-Query statt @media:
   reagiert auf die tatsächliche Breite von .spots-col (container-type dort in ExcursionsView.vue),
   nicht auf die Fenster-/Viewport-Breite – greift dadurch auch, wenn man auf Desktop den Anfasser
   zwischen Spots-Liste und Karte weit zur Karte hin zieht, nicht nur auf echtem Mobil. */
@container spots-col (max-width: 480px) {
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
  .spot-card:not(.expanded) .calendar-drag-handle,
  .spot-card:not(.expanded) .maps-picker {
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
