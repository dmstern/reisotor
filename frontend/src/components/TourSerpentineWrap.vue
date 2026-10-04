<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import type { Excursion, Spot, User } from '../api/types';
import type { TourLineData } from '../composables/useTourSerpentine';
import type { TourSerpentineRow } from '../utils/tourSerpentine';
import SpotCard from './SpotCard.vue';
import type { CommentItem } from './Comments.vue';
import TourLegConnector from './TourLegConnector.vue';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';

const props = defineProps<{
  excursion: Excursion;
  items: Array<{ spot: Spot }>;
  tourLine?: TourLineData;
  cols: number;
  rows: TourSerpentineRow[];
  expandedSpotId: number | null;
  highlightedIds: Set<number>;
  dayFocusHighlightedIds: Set<number>;
  spotScheduledDates: Map<number, string>;
  users: User[];
  allTourTitles: string[];
  spotCommentItemsFor: (spotId: number) => CommentItem[];
  getTourLayover: (
    excursion: Excursion,
    items: Array<{ spot: Spot }>,
    index: number
  ) => number | null;
  setSpotRef?: (spotId: number, el: Element | ComponentPublicInstance | null) => void;
  setTourWrapRef?: (el: Element | ComponentPublicInstance | null) => void;
}>();

const emit = defineEmits<{
  (e: 'openLegModal', fromSpot: Spot, toSpot: Spot): void;
  (e: 'toggleDestination', spotId: number): void;
  (e: 'editSpot', spot: Spot): void;
  (e: 'toggleSpotLike', spotId: number): void;
  (e: 'submitSpotComment', payload: { spotId: number; content: string }): void;
  (e: 'removeSpotComment', commentId: number): void;
  (e: 'updateSpotComment', payload: { commentId: number; content: string }): void;
  (e: 'toggleSpotCommentLike', commentId: number): void;
  (e: 'openSpot', spot: Spot): void;
  (e: 'closeSpot'): void;
  (e: 'showSpotOnMap', spot: Spot): void;
  (e: 'assignTour', payload: { spotId: number; title: string }): void;
}>();

const auth = useAuthStore();
const spotsStore = useSpotsStore();

function creatorLabel(userId: number | null | undefined): string | null {
  if (userId == null) return null;
  const u = props.users.find((user) => user.id === userId);
  return u?.username ?? null;
}
</script>

<template>
  <div
    class="tour-station-wrap is-tour"
    :class="{ 'single-col': cols === 1 }"
    :style="{
      '--tour-theme-color': excursion.role ? 'var(--color-travel)' : 'var(--color-tour)',
      '--tour-theme-tint': excursion.role ? 'var(--color-travel-tint)' : 'var(--color-tour-tint)',
    }"
    :ref="setTourWrapRef"
  >
    <svg
      v-if="tourLine"
      class="tour-station-line"
      :width="tourLine.width"
      :height="tourLine.height"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          v-if="tourLine.hinwegPath"
          :id="`tour-gradient-hin-${excursion.id}`"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stop-color="var(--tour-theme-color, var(--color-primary))" />
          <stop offset="100%" stop-color="var(--color-primary)" />
        </linearGradient>
        <linearGradient
          v-if="tourLine.rueckwegPath"
          :id="`tour-gradient-rueck-${excursion.id}`"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stop-color="var(--tour-theme-color, var(--color-primary))" />
          <stop offset="100%" stop-color="var(--color-primary)" />
        </linearGradient>
      </defs>

      <path
        v-if="tourLine.hinwegPath"
        :d="tourLine.hinwegPath.d"
        fill="none"
        :style="{ stroke: `url(#tour-gradient-hin-${excursion.id})` }"
        stroke-width="3"
        stroke-dasharray="6,6"
        stroke-linecap="round"
      />
      <path
        v-if="tourLine.rueckwegPath"
        :d="tourLine.rueckwegPath.d"
        fill="none"
        :style="{ stroke: `url(#tour-gradient-rueck-${excursion.id})` }"
        stroke-width="3"
        stroke-dasharray="6,6"
        stroke-linecap="round"
      />

      <circle
        v-for="(dot, i) in tourLine.dots"
        :key="'dot-' + i"
        :cx="dot.x"
        :cy="dot.y"
        r="4.5"
        :style="{
          fill: dot.isEnd
            ? 'var(--color-primary)'
            : 'var(--tour-theme-color, var(--color-primary))',
          stroke: 'var(--color-surface)',
          strokeWidth: '2px',
        }"
      />
    </svg>

    <!-- Touren: Schlangen-Layout (Serpentine / S-Kurve) mit adaptiver Spaltenanzahl -->
    <div
      class="tour-serpentine-wrap"
      :style="{
        '--tour-cols': cols,
        '--tour-conn-width': '76px',
      }"
    >
      <div
        v-for="row in rows"
        :key="`row-${excursion.id}-${row.rowIndex}`"
        class="tour-serpentine-row-wrap"
      >
        <div
          class="tour-serpentine-row"
          :class="{
            'is-rtl': row.isRtl,
            'is-ltr': !row.isRtl,
            'single-col': cols === 1,
          }"
        >
          <template v-for="cell in row.cells" :key="cell.key">
            <!-- Spot-Kachel -->
            <div v-if="cell.type === 'spot'" class="tour-spot-cell">
              <SpotCard
                :ref="(el) => setSpotRef?.(cell.spot.id, el)"
                class="staggered-spot"
                :data-spot-id="cell.spot.id"
                :style="[
                  {
                    '--stagger-idx': cell.globalIndex,
                    '--stagger-total': items.length,
                  },
                ]"
                :spot="cell.spot"
                :excursion-context="{
                  id: excursion.id,
                  isDestination: excursion.destination_spot_id === cell.spot.id,
                  hasDestination: excursion.destination_spot_id != null,
                }"
                @toggle-destination="emit('toggleDestination', cell.spot.id)"
                :highlighted="
                  highlightedIds.has(cell.spot.id) || dayFocusHighlightedIds.has(cell.spot.id)
                "
                :expanded="expandedSpotId === cell.spot.id"
                :scheduled-date="spotScheduledDates.get(cell.spot.id) ?? null"
                :creator-label="creatorLabel(cell.spot.created_by)"
                :payer-label="creatorLabel(cell.spot.paid_by_user_id)"
                :like-count="spotsStore.likeCountFor(cell.spot.id)"
                :liked="spotsStore.likedByMe(cell.spot.id, auth.user?.id)"
                :comments="spotCommentItemsFor(cell.spot.id)"
                group-mode="tours"
                :tour-options="allTourTitles"
                :has-multiple-members="users.length > 1"
                :layover-minutes="
                  cell.globalIndex > 0 && cell.globalIndex < items.length - 1
                    ? getTourLayover(excursion, items, cell.globalIndex)
                    : null
                "
                @edit="emit('editSpot', cell.spot)"
                @toggle-like="emit('toggleSpotLike', cell.spot.id)"
                @submit-comment="
                  (content) => emit('submitSpotComment', { spotId: cell.spot.id, content })
                "
                @remove-comment="(commentId) => emit('removeSpotComment', commentId)"
                @update-comment="
                  (commentId, content) => emit('updateSpotComment', { commentId, content })
                "
                @toggle-comment-like="(commentId) => emit('toggleSpotCommentLike', commentId)"
                @open="emit('openSpot', cell.spot)"
                @close="emit('closeSpot')"
                @show-on-map="emit('showSpotOnMap', cell.spot)"
                @assign-tour="(title) => emit('assignTour', { spotId: cell.spot.id, title })"
              />
            </div>

            <!-- Horizontaler Teilstrecken-Verbinder ("hochkant" zwischen 2 Kacheln) -->
            <TourLegConnector
              v-else-if="cell.type === 'leg-horizontal'"
              variant="horizontal"
              :from-spot="cell.fromSpot"
              :to-spot="cell.toSpot"
              :leg="cell.leg"
              :is-rtl="cell.isRtl"
              @click="emit('openLegModal', cell.fromSpot, cell.toSpot)"
            />
          </template>
        </div>

        <!-- Zeilenumbruch-Verbinder (Zentriert zwischen den Kacheln auf der gestrichelten Linie) -->
        <TourLegConnector
          v-if="row.rowBreak"
          variant="row-break"
          :from-spot="row.rowBreak.fromSpot"
          :to-spot="row.rowBreak.toSpot"
          :leg="row.rowBreak.leg"
          :align-side="row.rowBreak.alignSide"
          :single-col="cols === 1"
          @click="emit('openLegModal', row.rowBreak.fromSpot, row.rowBreak.toSpot)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour-station-wrap.is-tour {
  display: block;
  position: relative;
  margin-left: 0;
  margin-right: 0;
  min-width: 0;
  max-width: 100%;
}

.tour-station-wrap.is-tour.single-col {
  margin-left: 0;
  margin-right: 0;
}

.tour-station-line {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.tour-station-line path {
  fill: none;
  stroke-width: 3;
  stroke-dasharray: 6 6;
  transition: stroke 0.2s ease;
}

.tour-station-line circle {
  transition: fill 0.2s ease;
}

.tour-serpentine-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3) var(--space-4) var(--space-3);
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
}

.tour-serpentine-row-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}

.tour-serpentine-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  min-width: 0;
}

.tour-serpentine-row.is-ltr {
  flex-direction: row;
  justify-content: flex-start;
}

.tour-serpentine-row.is-rtl {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.tour-spot-cell {
  flex: 0 0
    calc((100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1));
  width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  max-width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
}

.tour-spot-cell:hover {
  z-index: 6;
}

.tour-spot-cell .staggered-spot {
  width: 100%;
}

.tour-serpentine-row.single-col .tour-spot-cell {
  flex: 0 0 100%;
  width: 100%;
  max-width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .tour-station-line path,
  .tour-station-line circle {
    transition: none;
  }
}
</style>
