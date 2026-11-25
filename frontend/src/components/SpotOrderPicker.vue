<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import type { ExcursionLeg, Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import TourSpotAssignDropdown from './TourSpotAssignDropdown.vue';

const ICON_SIZE_SM = 14;
const GRIP_ICON_SIZE = 15;
const DRAG_THRESHOLD_PX = 4;
const DRAG_OVERSHOOT_PX = 16;
const DEFAULT_ROW_GAP_PX = 6;
const DOWNWARD_CROSS_RATIO = 0.4;
const UPWARD_CROSS_RATIO = 0.6;
const SETTLE_DURATION_MS = 160;
const JUST_MOVED_FLASH_MS = 420;

let nextRowKeyId = 1;

interface RowMetric {
  top: number;
  height: number;
}

interface ActiveDragState {
  fromIndex: number;
  targetIndex: number;
  settling: boolean;
  slotTop: number;
  slotHeight: number;
  rowOffsets: number[];
}

interface PointerSession {
  pointerId: number;
  fromIndex: number;
  startClientY: number;
  rowEl: HTMLElement;
  scrollEl: HTMLElement | null;
  initialScrollTop: number;
  metrics: RowMetric[];
  gap: number;
}

// Reihenfolge-Editor fürs Touren-Formular (ExcursionFormModal.vue) – nutzt für die Spot-Auswahl
// dasselbe Popover (TourSpotAssignDropdown.vue) wie die Tour-Detailansicht und animiert
// Umsortierungen per Pointer-Live-Shift beim Ziehen sowie per TransitionGroup (FLIP) bei Button-Klicks.
const props = withDefaults(
  defineProps<{
    modelValue: number[];
    spots: Spot[];
    legs?: ExcursionLeg[];
  }>(),
  {
    legs: () => [],
  }
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: number[]): void;
  (e: 'update:legs', value: ExcursionLeg[]): void;
  (e: 'create-spot'): void;
}>();

const rowKeys = ref<string[]>([]);
const listWrapRef = ref<HTMLElement | null>(null);
const suppressListTransition = ref(false);
const justMovedKey = ref<string | null>(null);
const activeDrag = ref<ActiveDragState | null>(null);

let pointerSession: PointerSession | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettleCommit: { fromIndex: number; targetIndex: number } | null = null;

function syncRowKeys(ids: number[]) {
  if (
    rowKeys.value.length === ids.length &&
    ids.every((id, index) => rowKeys.value[index]?.startsWith(`${id}-`))
  ) {
    return;
  }

  const availableBySpotId = new Map<number, string[]>();

  for (const key of rowKeys.value) {
    const spotId = Number(key.split('-')[0]);
    const queue = availableBySpotId.get(spotId) ?? [];
    queue.push(key);
    availableBySpotId.set(spotId, queue);
  }

  rowKeys.value = ids.map((id) => {
    const queue = availableBySpotId.get(id);

    if (queue && queue.length > 0) {
      return queue.shift()!;
    }

    return `${id}-${nextRowKeyId++}`;
  });
}

watch(
  () => props.modelValue,
  (ids) => syncRowKeys(ids),
  { immediate: true, deep: true }
);

// Schreibbarer Computed statt einzelner add/remove-Emits: die Spot-Liste nutzt dadurch dasselbe
// v-model-Array-Muster, ohne dass die Elternkomponente eigene add/remove-Handler bräuchte.
const selected = computed<number[]>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Reihenfolge der geplanten Stationen entspricht der Abklapper-Reihenfolge während des Ausflugs
// (und bestimmt auch die auf der Karte gezeichnete Route, siehe TripMap.vue).
const plannedStations = computed(() =>
  props.modelValue
    .map((spotId, index) => {
      const spot = props.spots.find((candidate) => candidate.id === spotId);
      return spot
        ? {
            id: spotId,
            modelIndex: index,
            entryKey: rowKeys.value[index] ?? `${spotId}-${index}`,
            spot,
            title: spot.title,
            icon: spotCategoryMeta(spot.category).icon,
            tabler: spotCategoryMeta(spot.category).tabler,
          }
        : null;
    })
    .filter(
      (
        station
      ): station is {
        id: number;
        modelIndex: number;
        entryKey: string;
        spot: Spot;
        title: string;
        icon: string;
        tabler: IconDef;
      } => !!station
    )
);

function triggerMovedFlash(entryKey: string) {
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
  }

  justMovedKey.value = entryKey;
  flashTimer = setTimeout(() => {
    justMovedKey.value = null;
    flashTimer = null;
  }, JUST_MOVED_FLASH_MS);
}

function addSpot(id: number) {
  rowKeys.value = [...rowKeys.value, `${id}-${nextRowKeyId++}`];
  selected.value = [...selected.value, id];
}

function cleanupLegsForSpots(newSpotIds: number[]) {
  const adjacentPairs = new Set<string>();

  for (let i = 0; i < newSpotIds.length - 1; i++) {
    adjacentPairs.add(`${newSpotIds[i]}-${newSpotIds[i + 1]}`);
  }

  const updated = (props.legs || [])
    .filter((leg) => adjacentPairs.has(`${leg.from_spot_id}-${leg.to_spot_id}`))
    .map((leg, idx) => ({ ...leg, position: idx }));
  emit('update:legs', updated);
}

function removeSpotAt(stationIndex: number) {
  const station = plannedStations.value[stationIndex];

  if (!station) {
    return;
  }

  const nextKeys = [...rowKeys.value];
  nextKeys.splice(station.modelIndex, 1);
  rowKeys.value = nextKeys;

  const next = [...selected.value];
  next.splice(station.modelIndex, 1);
  selected.value = next;
  cleanupLegsForSpots(next);
}

function moveStationTo(fromStationIndex: number, toStationIndex: number) {
  const fromStation = plannedStations.value[fromStationIndex];
  const toStation = plannedStations.value[toStationIndex];

  if (!fromStation || !toStation || fromStationIndex === toStationIndex) {
    return;
  }

  const nextKeys = [...rowKeys.value];
  const [movedKey] = nextKeys.splice(fromStation.modelIndex, 1);
  nextKeys.splice(toStation.modelIndex, 0, movedKey);
  rowKeys.value = nextKeys;

  const next = [...selected.value];
  const [moved] = next.splice(fromStation.modelIndex, 1);
  next.splice(toStation.modelIndex, 0, moved);
  selected.value = next;
  cleanupLegsForSpots(next);
  triggerMovedFlash(movedKey);
}

function moveSpot(stationIndex: number, delta: -1 | 1) {
  moveStationTo(stationIndex, stationIndex + delta);
}

function computeTargetIndex(metrics: RowMetric[], fromIndex: number, rawDeltaY: number): number {
  const draggedCenter = metrics[fromIndex].top + metrics[fromIndex].height / 2 + rawDeltaY;
  let targetIndex = fromIndex;

  if (rawDeltaY > 0) {
    for (let i = fromIndex + 1; i < metrics.length; i++) {
      if (draggedCenter > metrics[i].top + metrics[i].height * DOWNWARD_CROSS_RATIO) {
        targetIndex = i;
      }
    }

    return targetIndex;
  }

  if (rawDeltaY < 0) {
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (draggedCenter < metrics[i].top + metrics[i].height * UPWARD_CROSS_RATIO) {
        targetIndex = i;
      }
    }
  }

  return targetIndex;
}

function computeExactTargetOffset(
  metrics: RowMetric[],
  gap: number,
  fromIndex: number,
  targetIndex: number
): number {
  if (targetIndex === fromIndex) {
    return 0;
  }

  let offset = 0;

  if (targetIndex > fromIndex) {
    for (let i = fromIndex + 1; i <= targetIndex; i++) {
      offset += metrics[i].height + gap;
    }

    return offset;
  }

  for (let i = targetIndex; i < fromIndex; i++) {
    offset -= metrics[i].height + gap;
  }

  return offset;
}

function computeRowOffsets(options: {
  metrics: RowMetric[];
  gap: number;
  fromIndex: number;
  targetIndex: number;
  draggedDeltaY: number;
}): number[] {
  const { metrics, gap, fromIndex, targetIndex, draggedDeltaY } = options;
  const shiftSize = metrics[fromIndex].height + gap;

  return metrics.map((_, idx) => {
    if (idx === fromIndex) {
      return draggedDeltaY;
    }

    if (targetIndex > fromIndex && idx > fromIndex && idx <= targetIndex) {
      return -shiftSize;
    }

    if (targetIndex < fromIndex && idx >= targetIndex && idx < fromIndex) {
      return shiftSize;
    }

    return 0;
  });
}

function detachWindowPointerListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove);
  window.removeEventListener('pointerup', onWindowPointerUp);
  window.removeEventListener('pointercancel', onWindowPointerCancel);
}

function flushPendingSettle() {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }

  const commit = pendingSettleCommit;
  pendingSettleCommit = null;

  if (!commit && !activeDrag.value) {
    return;
  }

  suppressListTransition.value = true;
  activeDrag.value = null;

  if (commit && commit.fromIndex !== commit.targetIndex) {
    moveStationTo(commit.fromIndex, commit.targetIndex);
  }

  void nextTick(() => {
    suppressListTransition.value = false;
  });
}

function onRowPointerDown(event: PointerEvent, index: number) {
  if (event.button !== 0 || plannedStations.value.length < 2) {
    return;
  }

  if (event.target instanceof Element && event.target.closest('button, a, input')) {
    return;
  }

  if (
    event.pointerType &&
    event.pointerType !== 'mouse' &&
    !(event.target instanceof Element && event.target.closest('.drag-handle'))
  ) {
    return;
  }

  flushPendingSettle();

  if (!listWrapRef.value) {
    return;
  }

  const rowElements = Array.from(
    listWrapRef.value.querySelectorAll<HTMLElement>('.planned-row:not(.list-leave-active)')
  );
  const metrics = rowElements.map((el) => ({
    top: el.offsetTop,
    height: el.offsetHeight,
  }));

  if (!metrics[index]) {
    return;
  }

  const gap =
    metrics.length > 1
      ? Math.max(0, metrics[1].top - (metrics[0].top + metrics[0].height))
      : DEFAULT_ROW_GAP_PX;
  const rowEl = event.currentTarget as HTMLElement;
  const scrollEl = rowEl.closest('.modal-body') as HTMLElement | null;

  pointerSession = {
    pointerId: event.pointerId,
    fromIndex: index,
    startClientY: event.clientY,
    rowEl,
    scrollEl,
    initialScrollTop: scrollEl?.scrollTop ?? 0,
    metrics,
    gap,
  };

  window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerCancel);
}

function onWindowPointerMove(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return;
  }

  const scrollDelta = (pointerSession.scrollEl?.scrollTop ?? 0) - pointerSession.initialScrollTop;
  const rawDeltaY = event.clientY - pointerSession.startClientY + scrollDelta;

  if (!activeDrag.value) {
    if (Math.abs(rawDeltaY) < DRAG_THRESHOLD_PX) {
      return;
    }

    pointerSession.rowEl.setPointerCapture?.(event.pointerId);
    window.getSelection?.()?.removeAllRanges?.();
  }

  event.preventDefault();

  const { metrics, gap, fromIndex } = pointerSession;
  const minDelta = computeExactTargetOffset(metrics, gap, fromIndex, 0) - DRAG_OVERSHOOT_PX;
  const maxDelta =
    computeExactTargetOffset(metrics, gap, fromIndex, metrics.length - 1) + DRAG_OVERSHOOT_PX;
  const clampedDeltaY = Math.max(minDelta, Math.min(maxDelta, rawDeltaY));
  const targetIndex = computeTargetIndex(metrics, fromIndex, rawDeltaY);
  const slotTop =
    metrics[fromIndex].top + computeExactTargetOffset(metrics, gap, fromIndex, targetIndex);

  activeDrag.value = {
    fromIndex,
    targetIndex,
    settling: false,
    slotTop,
    slotHeight: metrics[fromIndex].height,
    rowOffsets: computeRowOffsets({
      metrics,
      gap,
      fromIndex,
      targetIndex,
      draggedDeltaY: clampedDeltaY,
    }),
  };
}

function onWindowPointerUp(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return;
  }

  const session = pointerSession;
  pointerSession = null;
  detachWindowPointerListeners();
  session.rowEl.releasePointerCapture?.(event.pointerId);

  if (!activeDrag.value) {
    return;
  }

  const { fromIndex, targetIndex } = activeDrag.value;
  pendingSettleCommit = { fromIndex, targetIndex };

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    flushPendingSettle();
    return;
  }

  const exactOffset = computeExactTargetOffset(
    session.metrics,
    session.gap,
    fromIndex,
    targetIndex
  );
  activeDrag.value = {
    ...activeDrag.value,
    settling: true,
    rowOffsets: activeDrag.value.rowOffsets.map((val, idx) =>
      idx === fromIndex ? exactOffset : val
    ),
  };

  settleTimer = setTimeout(flushPendingSettle, SETTLE_DURATION_MS);
}

function onWindowPointerCancel(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return;
  }

  pointerSession.rowEl.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
  detachWindowPointerListeners();
  activeDrag.value = null;
  pendingSettleCommit = null;
}

function displayOrderNumber(index: number): number {
  if (!activeDrag.value) {
    return index + 1;
  }

  const { fromIndex, targetIndex } = activeDrag.value;

  if (index === fromIndex) {
    return targetIndex + 1;
  }

  if (targetIndex > fromIndex && index > fromIndex && index <= targetIndex) {
    return index;
  }

  if (targetIndex < fromIndex && index >= targetIndex && index < fromIndex) {
    return index + 2;
  }

  return index + 1;
}

function rowDynamicStyle(index: number): { transform: string } | undefined {
  if (!activeDrag.value) {
    return undefined;
  }

  const offset = activeDrag.value.rowOffsets[index] ?? 0;
  const isActivelyDragged = index === activeDrag.value.fromIndex && !activeDrag.value.settling;
  const scaleSuffix = isActivelyDragged ? ' scale(1.02)' : '';

  return {
    transform: `translate3d(0, ${offset}px, 0)${scaleSuffix}`,
  };
}

onUnmounted(() => {
  detachWindowPointerListeners();

  if (settleTimer !== null) {
    clearTimeout(settleTimer);
  }

  if (flashTimer !== null) {
    clearTimeout(flashTimer);
  }
});
</script>

<template>
  <div class="spot-order-picker">
    <template v-if="plannedStations.length">
      <p class="order-hint">
        Reihenfolge der Stationen auf Tour &amp; Karte – per Buttons oder Ziehen sortieren.
      </p>
      <div
        ref="listWrapRef"
        class="planned-list-wrap"
        :class="{ 'is-dragging-list': !!activeDrag }"
      >
        <div
          v-if="activeDrag"
          class="planned-drop-slot"
          :style="{
            height: `${activeDrag.slotHeight}px`,
            transform: `translate3d(0, ${activeDrag.slotTop}px, 0)`,
          }"
          aria-hidden="true"
        />
        <TransitionGroup
          tag="div"
          :name="suppressListTransition ? undefined : 'list'"
          class="planned-list"
        >
          <div
            v-for="(station, index) in plannedStations"
            :key="station.entryKey"
            class="planned-row"
            :class="{
              'is-dragging': activeDrag?.fromIndex === index && !activeDrag.settling,
              'is-settling': activeDrag?.fromIndex === index && activeDrag.settling,
              'is-shifting': !!activeDrag && activeDrag.fromIndex !== index,
              'is-just-moved': justMovedKey === station.entryKey,
            }"
            :style="rowDynamicStyle(index)"
            @pointerdown="onRowPointerDown($event, index)"
          >
            <AppIcon
              :icon="ACTION_ICONS.dragHandle"
              :size="GRIP_ICON_SIZE"
              group="actions"
              class="drag-handle"
              aria-hidden="true"
            />
            <span class="order-num">{{ displayOrderNumber(index) }}.</span>
            <span class="spot-title">
              <AppIcon :icon="station.tabler" :size="ICON_SIZE_SM" group="categories" />
              <span class="spot-title-text">{{ station.title }}</span>
            </span>
            <div class="planned-row-actions">
              <IconButton
                variant="ghost"
                size="sm"
                :icon="ACTION_ICONS.chevronUp"
                :disabled="index === 0"
                class="move-up-btn"
                aria-label="Station nach oben verschieben"
                title="Nach oben"
                @click="moveSpot(index, -1)"
              />
              <IconButton
                variant="ghost"
                size="sm"
                :icon="ACTION_ICONS.chevronDown"
                :disabled="index === plannedStations.length - 1"
                class="move-down-btn"
                aria-label="Station nach unten verschieben"
                title="Nach unten"
                @click="moveSpot(index, 1)"
              />
              <IconButton
                variant="ghost"
                size="sm"
                :icon="ACTION_ICONS.close"
                class="remove-btn"
                aria-label="Aus Tour entfernen"
                title="Aus Tour entfernen"
                @click="removeSpotAt(index)"
              />
            </div>
          </div>
        </TransitionGroup>
      </div>
    </template>
    <p v-else class="spot-picker-empty">Noch keine Stationen zugeordnet.</p>

    <div class="spot-picker-actions">
      <TourSpotAssignDropdown
        :spots="spots"
        :selected-spot-ids="modelValue"
        :close-on-select="false"
        @select-spot="addSpot"
        @create-spot="emit('create-spot')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.spot-order-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.order-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.planned-list-wrap {
  position: relative;
  padding: var(--space-2xs) 0;
}

.planned-drop-slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1.5px dashed var(--color-primary);
  background: var(--color-primary-tint);
  opacity: 0.55;
  pointer-events: none;
  box-sizing: border-box;
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.18s ease;
}

.planned-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  min-width: 0;
  position: relative;
}

.planned-row {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  min-height: 44px;
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-divider);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: grab;
  min-width: 0;
  box-sizing: border-box;
  user-select: none;
  transition:
    background-color 0.18s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

@include can-hover {
  .planned-list-wrap:not(.is-dragging-list) .planned-row:hover {
    border-color: var(--color-border-strong);
    background: var(--color-hover);
  }

  .planned-list-wrap:not(.is-dragging-list) .planned-row:hover .drag-handle {
    color: var(--color-primary);
    transform: scale(1.08);
  }
}

.planned-row.is-dragging {
  z-index: 20;
  cursor: grabbing;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow:
    var(--shadow-lg),
    0 0 0 2px var(--color-primary-tint);
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease !important;
}

.planned-row.is-settling {
  z-index: 20;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.16s ease,
    border-color 0.16s ease !important;
}

.planned-row.is-shifting {
  z-index: 1;
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1) !important;
}

.planned-row.is-just-moved {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface));
}

.planned-row.list-move {
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.drag-handle {
  color: var(--color-text-muted);
  flex-shrink: 0;
  touch-action: none;
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}

.order-num {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-primary-dark);
  flex-shrink: 0;
  min-width: 1.5ch;
}

.spot-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  flex: 1 1 120px;
  min-width: 0;
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.spot-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.planned-row-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  margin-left: auto;
  flex-shrink: 0;
}

.remove-btn {
  color: var(--color-text-muted);
}

@include can-hover {
  .remove-btn:hover:not(:disabled) {
    color: var(--color-danger);
  }
}

.spot-picker-empty {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.spot-picker-actions {
  display: flex;
  align-items: center;
}

@media (prefers-reduced-motion: reduce) {
  .planned-drop-slot,
  .planned-row,
  .planned-row.is-settling,
  .planned-row.is-shifting,
  .planned-row.list-move,
  .drag-handle {
    transition: none !important;
  }
}
</style>
