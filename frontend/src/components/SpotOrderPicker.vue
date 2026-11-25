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
const DRAG_OVERSHOOT_PX = 20;
const DEFAULT_ROW_GAP_PX = 6;
const DOWNWARD_CROSS_RATIO = 0.42;
const UPWARD_CROSS_RATIO = 0.58;
const SEAM_EDGE_OFFSET_PX = 8;
const INDICATOR_HALF_HEIGHT_PX = 2;
const JUST_MOVED_FLASH_MS = 520;
const NUDGE_MAX_PX = 12;
const NUDGE_DECAY_PX = 3;

let nextRowKeyId = 1;

interface RowMetric {
  top: number;
  height: number;
}

interface ActiveDragState {
  fromIndex: number;
  targetIndex: number;
  seamIndex: number | null;
  originTop: number;
  originHeight: number;
  indicatorTop: number | null;
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
// dasselbe Popover (TourSpotAssignDropdown.vue) wie die Tour-Detailansicht. Beim Ziehen weichen
// benachbarte Karten sanft auseinander ("Curtain Parting"), beim Loslassen gleiten alle Karten
// per TransitionGroup (FLIP) ruhig in ihre neue Position.
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
const justMovedKey = ref<string | null>(null);
const activeDrag = ref<ActiveDragState | null>(null);
const leavingCount = ref(0);

let pointerSession: PointerSession | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

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

function computeSeamAndTarget(
  metrics: RowMetric[],
  fromIndex: number,
  rawDeltaY: number
): { seamIndex: number | null; targetIndex: number } {
  const draggedCenter = metrics[fromIndex].top + metrics[fromIndex].height / 2 + rawDeltaY;

  if (rawDeltaY > 0) {
    let seam = fromIndex + 1;

    for (let i = fromIndex + 1; i < metrics.length; i++) {
      if (draggedCenter > metrics[i].top + metrics[i].height * DOWNWARD_CROSS_RATIO) {
        seam = i + 1;
      }
    }

    if (seam === fromIndex + 1) {
      return { seamIndex: null, targetIndex: fromIndex };
    }

    return { seamIndex: seam, targetIndex: seam - 1 };
  }

  if (rawDeltaY < 0) {
    let seam = fromIndex;

    for (let i = fromIndex - 1; i >= 0; i--) {
      if (draggedCenter < metrics[i].top + metrics[i].height * UPWARD_CROSS_RATIO) {
        seam = i;
      }
    }

    if (seam === fromIndex) {
      return { seamIndex: null, targetIndex: fromIndex };
    }

    return { seamIndex: seam, targetIndex: seam };
  }

  return { seamIndex: null, targetIndex: fromIndex };
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

function computePartedRowOffsets(options: {
  count: number;
  fromIndex: number;
  seamIndex: number | null;
  draggedDeltaY: number;
}): number[] {
  const { count, fromIndex, seamIndex, draggedDeltaY } = options;
  const offsets = new Array<number>(count).fill(0);
  offsets[fromIndex] = draggedDeltaY;

  if (seamIndex === null) {
    return offsets;
  }

  let distAbove = 0;

  for (let i = seamIndex - 1; i >= 0; i--) {
    if (i !== fromIndex) {
      offsets[i] = -Math.max(0, NUDGE_MAX_PX - distAbove * NUDGE_DECAY_PX);
      distAbove++;
    }
  }

  let distBelow = 0;

  for (let i = seamIndex; i < count; i++) {
    if (i !== fromIndex) {
      offsets[i] = Math.max(0, NUDGE_MAX_PX - distBelow * NUDGE_DECAY_PX);
      distBelow++;
    }
  }

  return offsets;
}

function findNeighborIndex(options: {
  start: number;
  step: -1 | 1;
  limit: number;
  skipIndex: number;
}): number {
  const { start, step, limit, skipIndex } = options;

  for (let i = start; step > 0 ? i <= limit : i >= limit; i += step) {
    if (i !== skipIndex) {
      return i;
    }
  }

  return -1;
}

function computeIndicatorTop(options: {
  metrics: RowMetric[];
  offsets: number[];
  fromIndex: number;
  seamIndex: number | null;
}): number | null {
  const { metrics, offsets, fromIndex, seamIndex } = options;

  if (seamIndex === null) {
    return null;
  }

  const prevIdx = findNeighborIndex({
    start: seamIndex - 1,
    step: -1,
    limit: 0,
    skipIndex: fromIndex,
  });
  const nextIdx = findNeighborIndex({
    start: seamIndex,
    step: 1,
    limit: metrics.length - 1,
    skipIndex: fromIndex,
  });

  if (prevIdx !== -1 && nextIdx !== -1) {
    const prevBottom = metrics[prevIdx].top + offsets[prevIdx] + metrics[prevIdx].height;
    const nextTop = metrics[nextIdx].top + offsets[nextIdx];
    return (prevBottom + nextTop) / 2 - INDICATOR_HALF_HEIGHT_PX;
  }

  if (nextIdx !== -1) {
    return metrics[nextIdx].top + offsets[nextIdx] - SEAM_EDGE_OFFSET_PX;
  }

  if (prevIdx !== -1) {
    return (
      metrics[prevIdx].top +
      offsets[prevIdx] +
      metrics[prevIdx].height +
      SEAM_EDGE_OFFSET_PX -
      INDICATOR_HALF_HEIGHT_PX * 2
    );
  }

  return null;
}

function detachWindowPointerListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove);
  window.removeEventListener('pointerup', onWindowPointerUp);
  window.removeEventListener('pointercancel', onWindowPointerCancel);
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
  const { seamIndex, targetIndex } = computeSeamAndTarget(metrics, fromIndex, rawDeltaY);
  const rowOffsets = computePartedRowOffsets({
    count: metrics.length,
    fromIndex,
    seamIndex,
    draggedDeltaY: clampedDeltaY,
  });
  const indicatorTop = computeIndicatorTop({
    metrics,
    offsets: rowOffsets,
    fromIndex,
    seamIndex,
  });

  activeDrag.value = {
    fromIndex,
    targetIndex,
    seamIndex,
    originTop: metrics[fromIndex].top,
    originHeight: metrics[fromIndex].height,
    indicatorTop,
    rowOffsets,
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
  activeDrag.value = null;

  if (fromIndex !== targetIndex) {
    moveStationTo(fromIndex, targetIndex);
  }
}

function onWindowPointerCancel(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return;
  }

  pointerSession.rowEl.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
  detachWindowPointerListeners();
  activeDrag.value = null;
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
  const isActivelyDragged = index === activeDrag.value.fromIndex;
  const scaleSuffix = isActivelyDragged ? ' scale(1.015)' : '';

  return {
    transform: `translate3d(0, ${offset}px, 0)${scaleSuffix}`,
  };
}

function onBeforeLeave(el: Element) {
  leavingCount.value++;

  const wrapEl = listWrapRef.value;
  const listEl = wrapEl?.querySelector<HTMLElement>('.planned-list');
  const extraWrapHeight = wrapEl && listEl ? wrapEl.offsetHeight - listEl.offsetHeight : 0;

  if (wrapEl) {
    wrapEl.style.height = `${wrapEl.offsetHeight}px`;
  }

  const htmlEl = el as HTMLElement;
  htmlEl.style.top = `${htmlEl.offsetTop}px`;
  htmlEl.style.left = `${htmlEl.offsetLeft}px`;
  htmlEl.style.width = `${htmlEl.offsetWidth}px`;

  void nextTick(() => {
    const currentWrap = listWrapRef.value;
    const currentList = currentWrap?.querySelector<HTMLElement>('.planned-list');

    if (!currentWrap || !currentList) {
      return;
    }

    void currentWrap.offsetHeight;
    const nextHeight =
      plannedStations.value.length > 0 ? currentList.offsetHeight + extraWrapHeight : 0;
    currentWrap.style.height = `${nextHeight}px`;
  });
}

function onAfterLeave() {
  leavingCount.value = Math.max(0, leavingCount.value - 1);

  if (leavingCount.value === 0 && listWrapRef.value) {
    listWrapRef.value.style.height = '';
  }
}

onUnmounted(() => {
  detachWindowPointerListeners();

  if (flashTimer !== null) {
    clearTimeout(flashTimer);
  }
});
</script>

<template>
  <div class="spot-order-picker">
    <p v-if="plannedStations.length" class="order-hint">
      Reihenfolge der Stationen auf Tour &amp; Karte – per Buttons oder Ziehen sortieren.
    </p>
    <p v-else class="spot-picker-empty">Noch keine Stationen zugeordnet.</p>

    <div
      v-show="plannedStations.length > 0 || leavingCount > 0"
      ref="listWrapRef"
      class="planned-list-wrap"
      :class="{ 'is-dragging-list': !!activeDrag }"
    >
      <div
        v-if="activeDrag"
        class="planned-origin-footprint"
        :style="{
          height: `${activeDrag.originHeight}px`,
          transform: `translate3d(0, ${activeDrag.originTop}px, 0)`,
        }"
        aria-hidden="true"
      />
      <div
        v-if="activeDrag && activeDrag.indicatorTop !== null"
        class="planned-drop-indicator"
        :style="{
          transform: `translate3d(0, ${activeDrag.indicatorTop}px, 0)`,
        }"
        aria-hidden="true"
      />
      <TransitionGroup
        tag="div"
        name="list"
        class="planned-list"
        @before-leave="onBeforeLeave"
        @after-leave="onAfterLeave"
        @leave-cancelled="onAfterLeave"
      >
        <div
          v-for="(station, index) in plannedStations"
          :key="station.entryKey"
          class="planned-row"
          :class="{
            'is-dragging': activeDrag?.fromIndex === index,
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
  transition: height 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

.planned-origin-footprint {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px dashed var(--color-border-strong);
  background: color-mix(in srgb, var(--color-hover) 55%, transparent);
  opacity: 0.6;
  pointer-events: none;
  box-sizing: border-box;
}

.planned-drop-indicator {
  position: absolute;
  top: 0;
  left: var(--space-2);
  right: var(--space-2);
  height: 4px;
  z-index: 15;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-primary) 55%, transparent);
  pointer-events: none;
  transition:
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
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
    background-color 0.2s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
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
  background: color-mix(in srgb, var(--color-surface) 84%, transparent);
  backdrop-filter: blur(6px);
  opacity: 0.94;
  box-shadow:
    var(--shadow-lg),
    0 0 0 2px var(--color-primary-tint);
  transition:
    box-shadow 0.24s ease,
    border-color 0.24s ease,
    background-color 0.24s ease !important;
}

.planned-row.is-shifting {
  z-index: 1;
  transition:
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.planned-row.is-just-moved {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface));
}

.planned-row.list-move {
  z-index: 5;
  transition:
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease;
}

.planned-row.list-enter-active {
  transition:
    opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.planned-row.list-leave-active {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  transition:
    opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.planned-row.list-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

.planned-row.list-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.96);
}

.drag-handle {
  color: var(--color-text-muted);
  flex-shrink: 0;
  touch-action: none;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
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
  .planned-list-wrap,
  .planned-drop-indicator,
  .planned-row,
  .planned-row.is-shifting,
  .planned-row.list-move,
  .planned-row.list-enter-active,
  .planned-row.list-leave-active,
  .drag-handle {
    transition: none !important;
  }
}
</style>
