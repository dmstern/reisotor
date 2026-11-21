<script setup lang="ts">
import { computed } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionStations } from '../composables/useExcursionStations';
import type { CommentItem } from './Comments.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import Card from './primitives/Card.vue';
import TourRoleBadge from './TourRoleBadge.vue';
import ExcursionCoverStack from './ExcursionCoverStack.vue';
import ExcursionDoneStatus from './ExcursionDoneStatus.vue';
import ExcursionRouteMeta from './ExcursionRouteMeta.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    excursion: Excursion;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
    highlighted?: boolean;
    focused?: boolean;
    /** Semantisches HTML-Überschriften-Tag für den Card-Titel (Standard: 'h3') */
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }>(),
  {
    highlighted: false,
    focused: false,
    headingTag: 'h3',
  }
);

const emit = defineEmits<{
  (e: 'open', excursion: Excursion): void;
}>();

const drawers = useDrawersStore();

const isMapFocused = computed(() => drawers.mapFocusExcursionId === props.excursion.id);

const {
  resolvedStations,
  routeLabel,
  effectiveDepartureTime,
  effectiveArrivalTime,
  travelDuration,
  stationsSummaryText,
} = useExcursionStations({
  excursion: () => props.excursion,
  stations: () => props.stations,
  travelItems: () => props.travelItems,
});

function onCardKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (
    target &&
    target !== event.currentTarget &&
    target.closest('button, a, input, textarea, select, [role="button"]')
  ) {
    return;
  }

  event.preventDefault();
  emit('open', props.excursion);
}
</script>

<template>
  <Card
    class="excursion-card"
    :class="{
      'new-highlight': highlighted,
      'has-role': !!excursion.role,
      'is-travel': !!excursion.role,
    }"
    interactive
    :highlight="highlighted"
    :map-focused="isMapFocused"
    :focused="focused"
    @click="emit('open', excursion)"
    @keydown="onCardKeydown"
  >
    <div class="tour-card-main">
      <!-- Linke visuelle Spalte: Polaroid-Stapel (Stationen) -->
      <ExcursionCoverStack :excursion="excursion" :resolved-stations="resolvedStations" />

      <div class="body">
        <div class="card-header-row" title="Tour-Details öffnen">
          <div class="card-header-top">
            <div class="card-title-block card-title-row">
              <component :is="headingTag" class="card-title" :title="excursion.title">
                {{ excursion.title }}
              </component>
            </div>

            <div class="card-badge-group">
              <TourRoleBadge :role="excursion.role" />
              <PendingSyncBadge v-if="excursion._pending" />
              <AppIcon
                :icon="ACTION_ICONS.scrollRight"
                :size="16"
                group="actions"
                class="tour-detail-chevron"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <!-- Strecken- und Zeit-Info -->
        <ExcursionRouteMeta
          v-if="routeLabel || stationsSummaryText || effectiveDepartureTime || effectiveArrivalTime"
          :route-label="routeLabel"
          :stations-summary-text="stationsSummaryText"
          :effective-departure-time="effectiveDepartureTime"
          :effective-arrival-time="effectiveArrivalTime"
          :travel-duration="travelDuration"
        />

        <div
          v-if="excursion.done || excursion.date || likeCount > 0 || comments.length > 0"
          class="card-actions-wrapper"
        >
          <div class="card-actions">
            <ExcursionDoneStatus
              :excursion="excursion"
              :expanded="false"
              :resolved-stations="resolvedStations"
            />
          </div>

          <SocialRow
            :readonly="true"
            :like-count="likeCount"
            :liked="liked"
            :comment-count="comments.length"
            :comments-open="false"
          />
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
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
  z-index: var(--z-card, 1);
  isolation: isolate;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 5rem;
  border: none !important;
  border-radius: 0 !important;
  corner-shape: auto !important;
  box-shadow: none !important;
  background: transparent !important;
  cursor: pointer;
  overflow: visible;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance, var(--space-6)));
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.excursion-card.is-travel,
.excursion-card.has-role {
  --excursion-theme-color: var(--color-travel);
  --excursion-theme-dark: var(--color-travel-dark);
  --excursion-theme-tint: var(--color-travel-tint);
  --excursion-theme-border: var(--color-travel-border);
}

.excursion-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: var(--space-2);
  bottom: var(--space-2);
  width: 3px;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  background: var(--excursion-theme-color);
  opacity: 0;
  transform: scaleY(0.4);
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  z-index: 3;
}

@include can-hover {
  .card.card--interactive.excursion-card:hover,
  .excursion-card:hover {
    transform: none;
    background: var(--color-hover) !important;
    box-shadow: none !important;
  }

  .excursion-card:hover::before {
    opacity: 1;
    transform: scaleY(1);
  }

  .excursion-card:hover .card-title {
    color: var(--excursion-theme-dark);
  }

  .excursion-card:hover .tour-detail-chevron {
    color: var(--excursion-theme-dark);
    transform: translateX(2px);
  }

  .card.card--interactive.excursion-card:active,
  .excursion-card:active {
    transform: none;
    background: color-mix(in srgb, var(--color-hover) 80%, var(--color-border)) !important;
  }

  .excursion-card:hover :deep(.tour-polaroid-stack .polaroid-tile) {
    transform: var(--tile-fanned-transform);
  }

  .excursion-card:hover :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
    box-shadow: var(--shadow-md);
  }
}

.tour-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  position: relative;
  padding: calc(var(--space-2) + var(--space-1)) var(--space-3);
  gap: calc(var(--space-2) + var(--space-1));
}

.body {
  position: relative;
  z-index: 2;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.card-header-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  box-sizing: border-box;
}

.card-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
}

.card-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: var(--font-size-md);
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
  transition: color 0.2s ease;
}

.card-badge-group {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: 1px;
}

.tour-detail-chevron {
  color: var(--color-text-muted);
  transition:
    color 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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
  gap: var(--space-1);
  min-width: 0;
  flex: 0 1 auto;
}

@include container-down('excursion-card', 'mobile-compact') {
  .card-badge-group :deep(.category-chip-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .card-badge-group :deep(.category-chip) {
    padding: 3px var(--space-1);
    gap: 0;
    max-width: none;
  }
}

@include container-down('spots-col', 'mobile-compact') {
  .tour-card-main {
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
  }

  .card-title {
    font-size: var(--font-size-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .excursion-card,
  .excursion-card::before,
  .tour-detail-chevron {
    transform: none !important;
    transition: opacity 0.15s ease !important;
  }
}
</style>
