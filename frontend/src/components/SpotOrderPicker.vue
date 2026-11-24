<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ExcursionLeg, Spot, User } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import Divider from './primitives/Divider.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import LegTransportModal from './LegTransportModal.vue';

const SEARCH_THRESHOLD = 8;
const ICON_SIZE_SM = 14;
const ICON_SIZE_XS = 12;
const GRIP_ICON_SIZE = 15;

// Reihenfolge-Editor fürs Touren-Formular (ExcursionFormModal.vue) – TourAssignDropdown.vue
// bietet daneben im Spot-Formular einen schnelleren Weg, einen Spot ohne Reihenfolge einer Tour
// zuzuordnen. Eine Tour-Station ist seit der Verschmelzung von Unterkunft/Reise-Orten in Spots
// (siehe Migrationskommentar in db/index.ts) immer ein echter Spot.
// Issue #361: Unterstützt zusätzlich Teilstrecken (legs) zwischen je zwei aufeinanderfolgenden
// Stationen mit individuellen Verkehrsmitteln, Zeiten, Sitzplatz, Kosten und Umsteigedauer.
const props = withDefaults(
  defineProps<{
    modelValue: number[];
    spots: Spot[];
    legs?: ExcursionLeg[];
    users?: User[];
  }>(),
  {
    legs: () => [],
    users: () => [],
  }
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: number[]): void;
  (e: 'update:legs', value: ExcursionLeg[]): void;
  (e: 'create-spot'): void;
}>();

const searchQuery = ref('');

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
    .map((spotId) => {
      const spot = props.spots.find((candidate) => candidate.id === spotId);
      return spot
        ? {
            id: spotId,
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
      ): station is { id: number; spot: Spot; title: string; icon: string; tabler: IconDef } =>
        !!station
    )
);

const spotUsageCounts = computed(() => {
  const counts = new Map<number, number>();

  for (const spotId of props.modelValue) {
    counts.set(spotId, (counts.get(spotId) ?? 0) + 1);
  }

  return counts;
});

// Bewusst NICHT gefiltert auf "noch nicht eingeplant" – für einen Rundgang muss derselbe Spot
// mehrfach in der Reihenfolge stehen können (z. B. Start UND Ende an der Unterkunft), Klick fügt
// deshalb immer eine weitere Station hinzu statt nur ein einziges Mal umschaltbar zu sein.
const sortedSpots = computed(() =>
  [...props.spots].sort((spotA, spotB) =>
    spotA.title.localeCompare(spotB.title, 'de', { sensitivity: 'base' })
  )
);

const filteredSpots = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();

  if (!query) {
    return sortedSpots.value;
  }

  return sortedSpots.value.filter((spot) => spot.title.toLocaleLowerCase().includes(query));
});

function addSpot(id: number) {
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
// Index in plannedSpots, VOR dem die Drop-Line gerade eingezeichnet wird (index === Länge des
// Arrays => Line nach dem letzten Eintrag) – wird bei jedem dragover anhand der Cursor-Position
// relativ zur Mitte der jeweiligen Zeile neu bestimmt, damit man sichtbar zwischen zwei Zeilen
// (statt nur "auf" einer Zeile) ablegen kann.
const dropIndicatorIndex = ref<number | null>(null);

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index;
  event.dataTransfer?.setData('text/plain', '');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onRowDragOver(event: DragEvent, index: number) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  dropIndicatorIndex.value = before ? index : index + 1;
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

// --- Teilstrecken-Verkehrsmittel Modal-Verwaltung (Issue #361) ---
const editingLegFromIndex = ref<number | null>(null);
const showLegModal = ref(false);

function getLegBetween(fromId: number, toId: number): ExcursionLeg | undefined {
  return props.legs.find((leg) => leg.from_spot_id === fromId && leg.to_spot_id === toId);
}

function getLegDuration(fromId: number, toId: number): string | null {
  const leg = getLegBetween(fromId, toId);

  if (!leg?.departure_time || !leg?.arrival_time) {
    return null;
  }

  const mins = travelDurationMinutes(leg.departure_time, leg.arrival_time);
  return mins != null ? formatTravelDuration(mins) : null;
}

function getLayover(index: number): number | null {
  if (index <= 0 || index >= plannedStations.value.length - 1) {
    return null;
  }

  const prevSpotId = plannedStations.value[index - 1].id;
  const currSpotId = plannedStations.value[index].id;
  const nextSpotId = plannedStations.value[index + 1].id;
  const inLeg = getLegBetween(prevSpotId, currSpotId);
  const outLeg = getLegBetween(currSpotId, nextSpotId);

  if (!inLeg?.arrival_time || !outLeg?.departure_time) {
    return null;
  }

  return travelDurationMinutes(inLeg.arrival_time, outLeg.departure_time);
}

const currentModalFromSpot = computed(() => {
  if (editingLegFromIndex.value == null) {
    return null;
  }

  return plannedStations.value[editingLegFromIndex.value]?.spot ?? null;
});

const currentModalToSpot = computed(() => {
  if (editingLegFromIndex.value == null) {
    return null;
  }

  return plannedStations.value[editingLegFromIndex.value + 1]?.spot ?? null;
});

const currentModalLeg = computed(() => {
  if (!currentModalFromSpot.value || !currentModalToSpot.value) {
    return null;
  }

  return getLegBetween(currentModalFromSpot.value.id, currentModalToSpot.value.id) ?? null;
});

function openLegModal(index: number) {
  editingLegFromIndex.value = index;
  showLegModal.value = true;
}

function onSaveLeg(savedLeg: ExcursionLeg) {
  const nextLegs = [...props.legs];
  const idx = nextLegs.findIndex(
    (leg) => leg.from_spot_id === savedLeg.from_spot_id && leg.to_spot_id === savedLeg.to_spot_id
  );

  if (idx !== -1) {
    nextLegs[idx] = savedLeg;
  } else {
    nextLegs.push(savedLeg);
  }

  emit('update:legs', nextLegs);
}

function removeLegBetween(fromSpotId: number, toSpotId: number) {
  const nextLegs = props.legs.filter(
    (leg) => !(leg.from_spot_id === fromSpotId && leg.to_spot_id === toSpotId)
  );
  emit('update:legs', nextLegs);
}

function onDeleteLeg() {
  if (!currentModalFromSpot.value || !currentModalToSpot.value) {
    return;
  }

  removeLegBetween(currentModalFromSpot.value.id, currentModalToSpot.value.id);
}
</script>

<template>
  <div class="spot-order-picker">
    <section v-if="plannedStations.length" class="planned-section">
      <h4 class="picker-section-title">
        <AppIcon :icon="ACTION_ICONS.order" :size="ICON_SIZE_SM" group="actions" />
        <span>Tourreihenfolge</span>
      </h4>
      <p class="order-hint">
        Reihenfolge der Stationen auf Tour &amp; Karte – per Buttons oder Ziehen sortieren.
      </p>
      <div class="planned-list">
        <template v-for="(station, index) in plannedStations" :key="`${station.id}-${index}`">
          <div class="drop-line" v-if="draggedIndex !== null && dropIndicatorIndex === index"></div>
          <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
          <div
            class="planned-row"
            :class="{ dragging: draggedIndex === index }"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onRowDragOver($event, index)"
            @drop.prevent="onDrop"
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
            <Badge
              v-if="getLayover(index) != null"
              size="sm"
              class="layover-badge"
              title="Aufenthalts-/Umsteigezeit"
            >
              <AppIcon :icon="ACTION_ICONS.duration" :size="ICON_SIZE_XS" group="actions" />
              {{ formatTravelDuration(getLayover(index)!) }} Umstiegszeit
            </Badge>
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

          <!-- Teilstrecken-Verbinder zwischen zwei Stationen (Issue #361) -->
          <div v-if="index < plannedStations.length - 1" class="leg-connector">
            <div class="leg-connector-line"></div>
            <div class="leg-item-wrap">
              <Button
                type="button"
                variant="secondary"
                :dashed="!getLegBetween(station.id, plannedStations[index + 1].id)"
                size="xs"
                shape="squircle"
                class="leg-btn"
                :class="{
                  'has-data': !!getLegBetween(station.id, plannedStations[index + 1].id),
                }"
                @click="openLegModal(index)"
              >
                <template v-if="getLegBetween(station.id, plannedStations[index + 1].id)">
                  <span class="leg-pill">
                    <AppIcon
                      :icon="
                        travelTypeIconDef(
                          getLegBetween(station.id, plannedStations[index + 1].id)!
                            .transport_type ?? null
                        )
                      "
                      :size="13"
                      group="actions"
                      force-style="icons"
                    />
                    <span class="leg-type">
                      {{
                        getLegBetween(station.id, plannedStations[index + 1].id)!.transport_type ||
                        'Verkehrsmittel'
                      }}
                    </span>
                    <span
                      v-if="
                        getLegBetween(station.id, plannedStations[index + 1].id)!.departure_time ||
                        getLegBetween(station.id, plannedStations[index + 1].id)!.arrival_time
                      "
                      class="leg-times"
                    >
                      {{
                        getLegBetween(station.id, plannedStations[index + 1].id)!.departure_time ||
                        '?'
                      }}–{{
                        getLegBetween(station.id, plannedStations[index + 1].id)!.arrival_time ||
                        '?'
                      }}
                      <span
                        v-if="getLegDuration(station.id, plannedStations[index + 1].id)"
                        class="leg-duration"
                      >
                        ({{ getLegDuration(station.id, plannedStations[index + 1].id) }})
                      </span>
                    </span>
                    <span
                      v-if="getLegBetween(station.id, plannedStations[index + 1].id)!.amount"
                      class="leg-cost"
                    >
                      ·
                      {{
                        getLegBetween(station.id, plannedStations[index + 1].id)!
                          .amount!.toFixed(2)
                          .replace('.', ',')
                      }}&nbsp;€
                    </span>
                  </span>
                </template>
                <template v-else>
                  <span class="leg-empty">
                    <AppIcon
                      :icon="ACTION_ICONS.recordStart"
                      :size="ICON_SIZE_XS"
                      group="actions"
                    />
                    + Verkehrsmittel
                  </span>
                </template>
              </Button>
              <IconButton
                v-if="getLegBetween(station.id, plannedStations[index + 1].id)"
                variant="ghost"
                size="xs"
                :icon="ACTION_ICONS.close"
                class="remove-btn leg-remove-btn"
                title="Weg-Details entfernen"
                aria-label="Weg-Details entfernen"
                @click.stop="removeLegBetween(station.id, plannedStations[index + 1].id)"
              />
            </div>
            <div class="leg-connector-line"></div>
          </div>
        </template>
        <div
          class="drop-line"
          v-if="draggedIndex !== null && dropIndicatorIndex === plannedStations.length"
        ></div>
      </div>
    </section>

    <Divider v-if="plannedStations.length" />

    <section class="spot-picker-section">
      <div class="spot-picker-header">
        <h4 class="picker-section-title">Spots hinzufügen</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="spot-picker-create-btn"
          @click="emit('create-spot')"
        >
          <AppIcon :icon="ACTION_ICONS.mapPinPlus" :size="ICON_SIZE_SM" group="actions" />
          <span>Neuen Spot erstellen</span>
        </Button>
      </div>

      <Input
        v-if="spots.length >= SEARCH_THRESHOLD"
        v-model="searchQuery"
        type="search"
        size="sm"
        shape="pill"
        placeholder="Spots filtern..."
        aria-label="Spots filtern"
        class="spot-picker-search"
      />

      <p v-if="!spots.length" class="spot-picker-empty">Noch keine Spots angelegt.</p>
      <p v-else-if="!filteredSpots.length" class="spot-picker-empty">
        Keine passenden Spots gefunden.
      </p>
      <div v-else class="spot-picker-list">
        <DropdownMenuItem
          v-for="spot in filteredSpots"
          :key="spot.id"
          :icon="spotCategoryMeta(spot.category).tabler"
          icon-group="categories"
          :icon-size="ICON_SIZE_SM"
          class="spot-picker-option"
          @click="addSpot(spot.id)"
        >
          {{ spot.title }}
          <template #trailing>
            <span class="spot-option-trailing">
              <Badge
                v-if="spotUsageCounts.get(spot.id)"
                variant="primary"
                size="sm"
                class="spot-usage-badge"
              >
                {{ spotUsageCounts.get(spot.id) }}×
              </Badge>
              <AppIcon
                :icon="ACTION_ICONS.add"
                :size="ICON_SIZE_SM"
                group="actions"
                class="spot-option-add"
                aria-hidden="true"
              />
            </span>
          </template>
        </DropdownMenuItem>
      </div>
    </section>

    <LegTransportModal
      v-model="showLegModal"
      :from-spot="currentModalFromSpot"
      :to-spot="currentModalToSpot"
      :leg="currentModalLeg"
      :users="props.users"
      @save="onSaveLeg"
      @delete="onDeleteLeg"
    />
  </div>
</template>

<style scoped lang="scss">
.spot-order-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.planned-section,
.spot-picker-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.picker-section-title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.order-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.planned-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.planned-row {
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

.drop-line {
  height: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  margin: 0 var(--space-2);
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

.layover-badge {
  flex-shrink: 0;
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

.leg-connector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2xs) 0 var(--space-2xs) var(--space-3);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.leg-connector-line {
  flex: 0 0 12px;
  height: 1px;
  background: var(--color-primary-dark, #ccc);
  opacity: 0.3;
}

.leg-item-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}

.leg-btn {
  min-width: 0;
  max-width: 100%;
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-align: left;
}

.leg-btn.has-data {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.leg-pill {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-weight: 500;
  min-width: 0;
  max-width: 100%;
}

.leg-type {
  font-weight: 600;
}

.leg-times {
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.leg-duration {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.leg-cost {
  font-weight: 600;
  color: var(--color-scheduled-dark, var(--color-scheduled));
  white-space: nowrap;
}

.leg-empty {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.spot-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.spot-picker-search {
  width: 100%;
}

.spot-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}

.spot-option-trailing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  margin-left: auto;
  flex-shrink: 0;
}

.spot-option-add {
  color: var(--color-primary);
  flex-shrink: 0;
}

.spot-picker-empty {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
