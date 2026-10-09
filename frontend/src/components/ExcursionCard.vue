<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionStations } from '../composables/useExcursionStations';
import { useExcursionSpotDrop } from '../composables/useExcursionSpotDrop';
import EditButton from './EditButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import Card from './primitives/Card.vue';
import Accordion from './primitives/Accordion.vue';
import FileAttachments from './FileAttachments.vue';
import TourRoleBadge from './TourRoleBadge.vue';
import CalendarDragHandle from './CalendarDragHandle.vue';
import ExcursionCoverStack from './ExcursionCoverStack.vue';
import ExcursionDoneStatus from './ExcursionDoneStatus.vue';
import ExcursionRouteMeta from './ExcursionRouteMeta.vue';
import ExcursionMapLinks from './ExcursionMapLinks.vue';

const props = withDefaults(
  defineProps<{
    excursion: Excursion;
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
    highlighted?: boolean;
    expanded: boolean;
    /** Semantisches HTML-Überschriften-Tag für den Card-Titel (Standard: 'h3') */
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }>(),
  {
    headingTag: 'h3',
  }
);
const emit = defineEmits<{
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'update-comment', id: number, content: string): void;
  (e: 'toggle-comment-like', id: number): void;
  (e: 'drop-spot', spotId: number): void;
  (e: 'show-on-map'): void;
  (e: 'open', excursion: Excursion): void;
  (e: 'close'): void;
}>();

const drawers = useDrawersStore();

function onCardClick() {
  if (props.expanded) {
    emit('close');
    if (drawers.mapFocusExcursionId === props.excursion.id) {
      drawers.mapFocusExcursionId = null;
    }
  } else {
    emit('open', props.excursion);
  }
}

const isMapFocused = computed(() => drawers.mapFocusExcursionId === props.excursion.id);
const showComments = ref(false);

const {
  resolvedStations,
  hasMappedStations,
  routeLabel,
  effectiveDepartureTime,
  effectiveArrivalTime,
  travelDuration,
  stationsSummaryText,
  linkedTracks,
} = useExcursionStations({
  excursion: () => props.excursion,
  stations: () => props.stations,
  travelItems: () => props.travelItems,
});

const {
  spotDragOverCount,
  isDropCandidate,
  isDropDisabled,
  onSpotDragEnter,
  onSpotDragLeave,
  onSpotDrop,
} = useExcursionSpotDrop({
  excursion: () => props.excursion,
  onDropSpot: (spotId) => emit('drop-spot', spotId),
});
</script>

<template>
  <Card
    class="excursion-card"
    :class="{
      'drop-candidate': isDropCandidate,
      'drop-target': spotDragOverCount > 0 && !isDropDisabled,
      'drop-disabled': isDropDisabled,
      'new-highlight': highlighted,
      expanded,
      'has-role': !!excursion.role,
      'is-travel': !!excursion.role,
    }"
    :highlight="highlighted"
    :map-focused="isMapFocused"
    @click="onCardClick"
    @dragover.prevent
    @dragenter.prevent="onSpotDragEnter"
    @dragleave="onSpotDragLeave"
    @drop.prevent="onSpotDrop"
  >
    <div class="tour-card-main">
      <!-- Linke visuelle Spalte: Polaroid-Stapel (Stationen) im eingeklappten Zustand (#layout) -->
      <ExcursionCoverStack
        v-if="!expanded"
        :excursion="excursion"
        :resolved-stations="resolvedStations"
      />

      <div class="body">
        <div class="card-header-row">
          <div class="card-title-block">
            <component :is="headingTag" class="card-title" :title="excursion.title">
              {{ excursion.title }}
            </component>
            <Transition name="fade">
              <div
                v-if="
                  expanded &&
                  (creatorLabel ||
                    routeLabel ||
                    resolvedStations.length ||
                    travelDuration ||
                    linkedTracks.length)
                "
                class="card-title-meta"
              >
                <span v-if="creatorLabel" class="overlay-author">Von {{ creatorLabel }}</span>
                <span v-if="routeLabel" class="overlay-submeta">
                  <template v-if="creatorLabel">· </template>{{ routeLabel }}
                </span>
                <span v-else-if="resolvedStations.length" class="overlay-submeta">
                  <template v-if="creatorLabel">· </template>{{ resolvedStations.length }}
                  {{ resolvedStations.length === 1 ? 'Station' : 'Stationen' }}
                </span>
                <span v-if="travelDuration" class="overlay-submeta">· {{ travelDuration }}</span>
                <span v-if="linkedTracks.length" class="overlay-submeta">
                  <template
                    v-if="creatorLabel || routeLabel || resolvedStations.length || travelDuration"
                    >·
                  </template>
                  {{ linkedTracks.length }}
                  {{ linkedTracks.length === 1 ? 'Aufzeichnung' : 'Aufzeichnungen' }}
                </span>
              </div>
            </Transition>
          </div>

          <div class="card-badge-group">
            <TourRoleBadge :role="excursion.role" />
            <PendingSyncBadge v-if="excursion._pending" />
            <Transition name="fade">
              <EditButton
                v-if="expanded"
                small
                class="tour-edit-btn"
                @click="emit('edit', excursion)"
              />
            </Transition>
          </div>
        </div>

        <!-- Strecken- und Zeit-Info (nur im eingeklappten Zustand, im aufgeklappten Zustand in der Header-Meta) -->
        <ExcursionRouteMeta
          v-if="
            !expanded &&
            (routeLabel || stationsSummaryText || effectiveDepartureTime || effectiveArrivalTime)
          "
          :route-label="routeLabel"
          :stations-summary-text="stationsSummaryText"
          :effective-departure-time="effectiveDepartureTime"
          :effective-arrival-time="effectiveArrivalTime"
          :travel-duration="travelDuration"
        />

        <!-- Tour-Notiz: Trunkiert mit Ellipsis sowohl im collapsed als auch im expanded Zustand (#235) -->
        <div v-if="excursion.note" class="tour-note-container" :class="{ 'is-expanded': expanded }">
          <RichTextDisplay
            class="note is-clamped"
            :class="{ 'is-expanded': expanded }"
            :content="excursion.note"
            :format="excursion.note_format"
          />
        </div>

        <!-- Tour-Anhänge (Dateien / Tickets / Buchungen) - nur im aufgeklappten Zustand laden -->
        <div v-if="expanded" class="tour-attachments-wrap">
          <FileAttachments domain="ideas" :entity-id="excursion.id" :editable="false" />
        </div>

        <!-- Auf Karte anzeigen & verknüpfte Aufzeichnungen -->
        <ExcursionMapLinks
          v-if="expanded"
          :has-mapped-stations="hasMappedStations"
          :linked-tracks="linkedTracks"
          @show-on-map="emit('show-on-map')"
        />

        <div class="card-actions-wrapper">
          <div class="card-actions">
            <CalendarDragHandle v-if="!excursion.date" :excursion="excursion" />
            <ExcursionDoneStatus
              :excursion="excursion"
              :expanded="expanded"
              :resolved-stations="resolvedStations"
            />
          </div>

          <SocialRow
            :class="{ 'is-expanded': expanded }"
            :like-count="likeCount"
            :liked="liked"
            :comment-count="comments.length"
            :comments-open="showComments"
            :show-comments-button="expanded"
            @toggle-like="emit('toggle-like')"
            @toggle-comments="showComments = !showComments"
          />
        </div>

        <Accordion :expanded="expanded && showComments">
          <Comments
            :comments="comments"
            @click.stop
            @submit="(content) => emit('submit-comment', content)"
            @remove="(id) => emit('remove-comment', id)"
            @update="(id, content) => emit('update-comment', id, content)"
            @toggle-like="(id) => emit('toggle-comment-like', id)"
          />
        </Accordion>
      </div>
    </div>
  </Card>
</template>

<style scoped>
/* Vollflächiger Listeneintrag statt schwebender Karte: fügt sich nahtlos in die Drawer-Breite ein,
   getrennt durch horizontale Trennlinien am umgebenden .category-group. */
.card.excursion-card,
.excursion-card {
  --excursion-theme-color: var(--color-tour);
  --excursion-theme-dark: var(--color-tour-dark);
  --excursion-theme-tint: var(--color-tour-tint);
  --excursion-theme-border: var(--color-tour-border);

  container: excursion-card / inline-size;

  position: relative;
  z-index: 1;
  isolation: isolate;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 80px;
  border: none !important;
  border-radius: 0 !important;
  corner-shape: auto !important;
  box-shadow: none !important;
  background: transparent !important;
  cursor: pointer;
  overflow: visible;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance, 48px));
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
}

/* Leucht-Effekt, wenn der "Tour zuordnen"-Anfasser einer SpotCard gerade gezogen wird (#drag) */
:global(body.is-dragging-tour .excursion-card:not(.drop-disabled)),
.excursion-card.drop-candidate {
  background: color-mix(in srgb, var(--color-tour) 12%, var(--color-surface)) !important;
  box-shadow:
    inset 0 0 0 2px var(--color-tour),
    0 8px 24px -4px color-mix(in srgb, var(--color-tour) 45%, transparent) !important;
  animation: tour-glow-pulse 2.2s ease-in-out infinite alternate;
  position: relative;
  z-index: 4;
}

@keyframes tour-glow-pulse {
  0% {
    box-shadow:
      inset 0 0 0 2px var(--color-tour),
      0 6px 18px -4px color-mix(in srgb, var(--color-tour) 35%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 3px var(--color-tour),
      0 10px 28px -2px color-mix(in srgb, var(--color-tour) 60%, transparent);
  }
}

:global(body.is-dragging-tour .excursion-card:not(.drop-disabled):hover),
:global(body.is-dragging-tour .excursion-card.drop-target),
.excursion-card.drop-candidate:hover,
.excursion-card.drop-target {
  background: color-mix(in srgb, var(--color-tour) 20%, var(--color-surface)) !important;
  transform: none;
  box-shadow:
    inset 0 0 0 3px var(--color-tour),
    0 12px 32px -2px color-mix(in srgb, var(--color-tour) 65%, transparent) !important;
  z-index: 6;
}

:global(body.is-dragging-tour .excursion-card.drop-disabled),
.excursion-card.drop-disabled {
  opacity: 0.5;
}

.excursion-card.is-travel,
.excursion-card.has-role {
  --excursion-theme-color: var(--color-travel);
  --excursion-theme-dark: var(--color-travel-dark);
  --excursion-theme-tint: var(--color-travel-tint);
  --excursion-theme-border: var(--color-travel-border);
}

.excursion-card:not(.expanded):hover {
  transform: none;
  background: var(--color-hover) !important;
  box-shadow: none !important;
}

.excursion-card:not(.expanded):active {
  transform: none;
  background: color-mix(in srgb, var(--color-hover) 80%, var(--color-border)) !important;
}

.excursion-card.expanded {
  transform: none;
  border: none !important;
  border-radius: 0 !important;
  corner-shape: auto !important;
  background: transparent !important;
  box-shadow: none !important;
}

.tour-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  position: relative;
  padding: 12px var(--space-3);
  gap: 12px;
}

.excursion-card.expanded .tour-card-main {
  padding: 14px var(--space-3) 10px var(--space-3);
}

.tour-edit-btn {
  flex-shrink: 0;
}

.body {
  position: relative;
  z-index: 2;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.card-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.card-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  overflow-wrap: break-word;
  transition:
    font-size 0.2s ease,
    color 0.2s ease;
}

.excursion-card.expanded .card-title {
  font-size: 1.125rem;
  line-height: 1.3;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.card-title-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
  margin-top: 3px;
}

.overlay-author {
  font-weight: 600;
}

.overlay-submeta {
  opacity: 0.9;
}

.card-badge-group {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: 1px;
}

.card-actions-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
  position: relative;
  z-index: 2;
}

.card-actions-wrapper > :deep(.social-row) {
  margin-left: auto;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
}

/* Tour-Notiz: Fließender Übergang zwischen 1-2-zeiligem Teaser und voller Höhe (#235) */
.tour-note-container {
  display: block;
  position: relative;
  margin-top: 2px;
  overflow: hidden;
  transition:
    max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.25s ease;
}

.tour-note-container:not(.is-expanded) {
  max-height: 2.8em;
}

.tour-note-container.is-expanded {
  max-height: 500px;
}

.note {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text);
  transition: color 0.2s ease;
}

.note.is-clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--color-text-muted);
}

.note.is-clamped.is-expanded {
  -webkit-line-clamp: unset;
  line-clamp: unset;
  display: block;
  color: var(--color-text);
}

.note.is-clamped :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note.is-clamped.is-expanded :deep(.richtext) {
  -webkit-line-clamp: unset;
  line-clamp: unset;
  display: block;
}

.note.is-clamped :deep(p),
.note.is-clamped :deep(div) {
  display: inline;
  margin: 0;
}

.note.is-clamped :deep(p + p::before),
.note.is-clamped :deep(div + div::before) {
  content: ' ';
}

/* Hover-Effekt auf der Collapsed Card: Sanftes Auffächern der Station-Polaroids (#235) */
.excursion-card:not(.expanded):hover :deep(.tour-polaroid-stack .polaroid-tile) {
  transform: var(--tile-fanned-transform);
}

.excursion-card:not(.expanded):hover :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.2),
    0 2px 5px rgba(0, 0, 0, 0.12);
}

:root[data-theme='dark']
  .excursion-card:not(.expanded):hover
  :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.55),
    0 2px 5px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light'])
    .excursion-card:not(.expanded):hover
    :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.55),
      0 2px 5px rgba(0, 0, 0, 0.3);
  }
}

.tour-attachments-wrap {
  margin-top: var(--space-2);
}

@container spots-col (max-width: 360px) {
  .tour-card-main {
    padding: 8px var(--space-3) 8px var(--space-3);
    gap: 8px;
  }

  .card-title {
    font-size: 0.88rem;
  }

  .excursion-card.expanded .card-title {
    font-size: 1rem;
  }

  .tour-note-container:not(.is-expanded) {
    max-height: 1.35em;
  }

  .tour-note-container.is-expanded {
    max-height: 300px;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    line-clamp: 1;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .note.is-clamped.is-expanded {
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .note.is-clamped.is-expanded :deep(.richtext) {
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .excursion-card,
  .body,
  .tour-note-container {
    transform: none !important;
    transition: opacity 0.15s ease !important;
  }
}
</style>
