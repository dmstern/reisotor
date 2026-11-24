<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ExcursionLeg, Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import TourSpotAssignDropdown from './TourSpotAssignDropdown.vue';

const ICON_SIZE_SM = 14;
const GRIP_ICON_SIZE = 15;

let nextRowKeyId = 1;

// Reihenfolge-Editor fürs Touren-Formular (ExcursionFormModal.vue) – nutzt für die Spot-Auswahl
// dasselbe Popover (TourSpotAssignDropdown.vue) wie die Tour-Detailansicht und animiert
// Umsortierungen per TransitionGroup (FLIP). Verwaiste Teilstrecken (legs) werden beim
// Umsortieren oder Entfernen im Hintergrund weiterhin bereinigt.
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
        entryKey: string;
        spot: Spot;
        title: string;
        icon: string;
        tabler: IconDef;
      } => !!station
    )
);

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

function removeSpotAt(index: number) {
  const nextKeys = [...rowKeys.value];
  nextKeys.splice(index, 1);
  rowKeys.value = nextKeys;

  const next = [...selected.value];
  next.splice(index, 1);
  selected.value = next;
  cleanupLegsForSpots(next);
}

function moveSpot(index: number, delta: -1 | 1) {
  const targetIndex = index + delta;

  if (targetIndex < 0 || targetIndex >= selected.value.length) {
    return;
  }

  const nextKeys = [...rowKeys.value];
  const [movedKey] = nextKeys.splice(index, 1);
  nextKeys.splice(targetIndex, 0, movedKey);
  rowKeys.value = nextKeys;

  const next = [...selected.value];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  selected.value = next;
  cleanupLegsForSpots(next);
}

// Drag&Drop-Umsortierung innerhalb der geplanten Liste – rein lokal (kein Component-übergreifendes
// dataTransfer-Format nötig, anders als beim Ziehen von SpotCard auf ExcursionCard). setData mit
// leerem Wert ist trotzdem nötig, manche Browser starten sonst gar keinen Drag.
const draggedIndex = ref<number | null>(null);
// Index in plannedStations, VOR dem die Drop-Line gerade eingezeichnet wird (index === Länge des
// Arrays => Line nach dem letzten Eintrag) – wird bei jedem dragover anhand der Cursor-Position
// relativ zur Mitte der jeweiligen Zeile neu bestimmt, damit man sichtbar zwischen zwei Zeilen
// (statt nur "auf" einer Zeile) ablegen kann.
const dropIndicatorIndex = ref<number | null>(null);

const visibleDropIndicatorIndex = computed(() => {
  if (draggedIndex.value === null || dropIndicatorIndex.value === null) {
    return null;
  }

  if (
    dropIndicatorIndex.value === draggedIndex.value ||
    dropIndicatorIndex.value === draggedIndex.value + 1
  ) {
    return null;
  }

  return dropIndicatorIndex.value;
});

function onDragStart(event: DragEvent, index: number) {
  if ((event.target as HTMLElement | null)?.closest('button')) {
    event.preventDefault();
    return;
  }

  draggedIndex.value = index;
  event.dataTransfer?.setData('text/plain', '');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onListDragOver(event: DragEvent) {
  if (draggedIndex.value === null) {
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  const dropzone = event.currentTarget as HTMLElement;
  const rows = Array.from(dropzone.querySelectorAll('.planned-row'));
  let nextIndex = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();

    if (event.clientY < rect.top + rect.height / 2) {
      nextIndex = i;
      break;
    }
  }

  dropIndicatorIndex.value = nextIndex;
}

function onDrop() {
  if (draggedIndex.value === null || dropIndicatorIndex.value === null) {
    return;
  }

  let targetIndex = dropIndicatorIndex.value;

  // Ziel-Index bezieht sich auf das Array VOR dem Entfernen des gezogenen Eintrags – liegt die
  // Zeile davor, verschiebt das Herausnehmen alle nachfolgenden Indizes um eins nach vorn.
  if (draggedIndex.value < targetIndex) {
    targetIndex--;
  }

  if (targetIndex !== draggedIndex.value) {
    const nextKeys = [...rowKeys.value];
    const [movedKey] = nextKeys.splice(draggedIndex.value, 1);
    nextKeys.splice(targetIndex, 0, movedKey);
    rowKeys.value = nextKeys;

    const next = [...selected.value];
    const [moved] = next.splice(draggedIndex.value, 1);
    next.splice(targetIndex, 0, moved);
    selected.value = next;
    cleanupLegsForSpots(next);
  }

  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}
</script>

<template>
  <div class="spot-order-picker">
    <template v-if="plannedStations.length">
      <p class="order-hint">
        Reihenfolge der Stationen auf Tour &amp; Karte – per Buttons oder Ziehen sortieren.
      </p>
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div class="planned-list-dropzone" @dragover.prevent="onListDragOver" @drop.prevent="onDrop">
        <TransitionGroup tag="div" name="list" class="planned-list">
          <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
          <div
            v-for="(station, index) in plannedStations"
            :key="station.entryKey"
            class="planned-row"
            :class="{
              dragging: draggedIndex === index,
              'drop-before': visibleDropIndicatorIndex === index,
              'drop-after':
                index === plannedStations.length - 1 &&
                visibleDropIndicatorIndex === plannedStations.length,
            }"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragend="onDragEnd"
          >
            <AppIcon
              :icon="ACTION_ICONS.dragHandle"
              :size="GRIP_ICON_SIZE"
              group="actions"
              class="drag-handle"
              aria-hidden="true"
            />
            <span class="order-num">{{ index + 1 }}.</span>
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

.planned-list-dropzone {
  padding: var(--space-2xs) 0;
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
}

.planned-row:active {
  cursor: grabbing;
}

.planned-row.dragging {
  opacity: 0.4;
}

.planned-row.drop-before::before,
.planned-row.drop-after::after {
  content: '';
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  height: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  pointer-events: none;
}

.planned-row.drop-before::before {
  top: -4px;
}

.planned-row.drop-after::after {
  bottom: -4px;
}

.drag-handle {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.order-num {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-primary-dark);
  flex-shrink: 0;
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
</style>
