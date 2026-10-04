<script setup lang="ts">
import { computed, nextTick, ref, toRef, useSlots } from 'vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { buildGoogleMapsLink, buildOsmLink } from '../utils/googleMaps';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import LocationSearchBar from './LocationSearchBar.vue';
import LocationPolaroidCard from './LocationPolaroidCard.vue';
import type { IconDef } from '../utils/icon';
import { usePlaceSearch, type PlaceSearchResult } from '../composables/usePlaceSearch';
import { useLocationDetails } from '../composables/useLocationDetails';
import { useLocationSuggestions } from '../composables/useLocationSuggestions';
import { useLocationPickerMap, OWN_LOCATION_ICON } from '../composables/useLocationPickerMap';

export type { PlaceSearchResult } from '../composables/usePlaceSearch';

const props = withDefaults(
  defineProps<{
    /** Aktuell ausgewählte Koordinaten (v-model). */
    modelValue: { lat: number; lng: number } | null;
    /** Spot-Titel (v-model:title) – falls angebunden, wird der Titel in der Status-Übersicht angezeigt und editierbar. */
    title?: string;
    /** Adresse oder Ortsbezeichnung (v-model:address). */
    address?: string;
    /** Maps-Link (v-model:mapsLink). */
    mapsLink?: string;
    /** Proximity-Bias-Koordinaten für die POI-/Adress-Suche (z. B. Urlaubsziel). */
    proximityBias?: { lat: number; lng: number } | null;
    /** Platzhaltertext für das kombinierte Suchfeld. */
    placeholder?: string;
    /** Ob der Titel ein Pflichtfeld ist. */
    titleRequired?: boolean;
    /** Ob der Titel ungültig/leer ist (Fehlerhervorhebung). */
    titleInvalid?: boolean;
    /** Rückwärtskompatibilität: Initiale Zentrierung der Mini-Karte falls modelValue noch null. */
    center?: { lat: number; lng: number };
    /** Zoom-Stufe. */
    zoom?: number;
    /** Zusätzliche Orientierungspunkte im Umkreis. */
    referencePoints?: { lat: number; lng: number; icon?: IconDef }[];
    /** Spot-Kategorie (v-model:category). */
    category?: string;
    /** Verfügbare Kategorie-Optionen für die Combobox. */
    categoryOptions?: string[];
    /** Ob der Status-Header (Haken & Entfernen) ausgeblendet werden soll (z. B. wenn im Fieldset-Legend platziert). */
    hideStatusHeader?: boolean;
    /** Ob der Standort gegenüber dem gespeicherten Zustand geändert wurde (orange Hervorhebung). */
    modified?: boolean;
  }>(),
  {
    title: undefined,
    category: undefined,
    categoryOptions: undefined,
    address: '',
    mapsLink: '',
    proximityBias: null,
    placeholder: undefined,
    titleRequired: false,
    titleInvalid: false,
    zoom: undefined,
    center: undefined,
    referencePoints: () => [],
    hideStatusHeader: false,
    modified: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: { lat: number; lng: number } | null): void;
  (e: 'update:title', value: string): void;
  (e: 'update:category', value: string): void;
  (e: 'update:address', value: string): void;
  (e: 'update:mapsLink', value: string): void;
  (e: 'select', place: PlaceSearchResult): void;
  (e: 'clear'): void;
  (e: 'reset'): void;
  (e: 'blur', event: FocusEvent): void;
}>();

const slots = useSlots();

const mapEl = ref<HTMLDivElement | null>(null);
const polaroidCardEl = ref<HTMLDivElement | null>(null);

function setPolaroidCardRef(inst: unknown) {
  const component = inst as { cardEl?: HTMLDivElement | null; $el?: HTMLDivElement | null } | null;
  polaroidCardEl.value = component?.cardEl ?? component?.$el ?? null;
}

const modelValueRef = toRef(props, 'modelValue');
const titleRef = toRef(props, 'title');
const addressRef = toRef(props, 'address');
const categoryRef = toRef(props, 'category');
const mapsLinkRef = toRef(props, 'mapsLink');
const proximityBiasRef = toRef(props, 'proximityBias');
const centerRef = toRef(props, 'center');
const zoomRef = toRef(props, 'zoom');
const referencePointsRef = toRef(props, 'referencePoints');

function onManualCoordsSet(coords: { lat: number; lng: number }) {
  details.cardClosed.value = false;
  map.placeMarker(coords.lat, coords.lng);
  search.selectedPlace.value = null;
  details.manualDetailsOpen.value = true;
  map.markInternalCoordChange();
  emit('update:modelValue', coords);
  emit('update:mapsLink', buildOsmLink(coords.lat, coords.lng));
  details.reverseGeocodeCoords(coords.lat, coords.lng);
}

function onSelectPlace(place: PlaceSearchResult) {
  details.cardClosed.value = false;
  search.selectedPlace.value = place;
  details.manualDetailsOpen.value = true;
  details.isEditingTitle.value = false;
  details.isEditingAddress.value = false;
  details.isEditingCategory.value = false;
  details.editTitleInput.value = place.name;
  details.editAddressInput.value = place.formatted_address || place.address || place.name;

  const coords = { lat: place.lat, lng: place.lng };
  map.placeMarker(coords.lat, coords.lng);
  nextTick(() => {
    map.centerOnPoint([coords.lat, coords.lng], 16);
  });

  if (props.title !== undefined) {
    emit('update:title', place.name);
  }
  if (place.category && props.category !== undefined) {
    emit('update:category', place.category);
  }
  emit('update:modelValue', coords);
  emit('update:address', place.formatted_address || place.address || place.name);
  emit('update:mapsLink', buildGoogleMapsLink(coords.lat, coords.lng));
  emit('select', place);
}

function onMapsLinkResolved(coords: { lat: number; lng: number }) {
  map.placeMarker(coords.lat, coords.lng);
  details.manualDetailsOpen.value = true;
  emit('update:modelValue', coords);
  nextTick(() => {
    map.centerOnPoint([coords.lat, coords.lng], 16);
  });
}

const search = usePlaceSearch({
  modelValue: modelValueRef,
  title: titleRef,
  address: addressRef,
  mapsLink: mapsLinkRef,
  proximityBias: proximityBiasRef,
  center: centerRef,
  onSelectPlace,
  onMapsLinkResolved,
  onMapsLinkInput: (url) => emit('update:mapsLink', url),
});

const details = useLocationDetails({
  modelValue: modelValueRef,
  title: titleRef,
  address: addressRef,
  category: categoryRef,
  mapsLink: mapsLinkRef,
  selectedPlace: search.selectedPlace,
  onUpdateTitle: (val) => emit('update:title', val),
  onUpdateAddress: (val) => emit('update:address', val),
  onUpdateCategory: (val) => emit('update:category', val),
  onManualDetailsOpened: () => {
    if (props.modelValue) {
      map.centerOnPoint([props.modelValue.lat, props.modelValue.lng]);
    }
  },
  onManualDetailsClosed: () => {
    nextTick(() => {
      if (props.modelValue) {
        map.centerOnPoint([props.modelValue.lat, props.modelValue.lng]);
      }
    });
  },
});

const suggestions = useLocationSuggestions({
  title: titleRef,
  editTitleInput: details.editTitleInput,
  address: addressRef,
  editAddressInput: details.editAddressInput,
  category: categoryRef,
  editCategoryInput: details.editCategoryInput,
  modelValue: modelValueRef,
  proximityBias: proximityBiasRef,
  center: centerRef,
  isEditingAddress: details.isEditingAddress,
  isEditingCategory: details.isEditingCategory,
  onApplyAddress: (val) => emit('update:address', val),
  onApplyCategory: (val) => emit('update:category', val),
  onSearchCandidate: (query) => search.handleInput(query, true),
});

const map = useLocationPickerMap({
  mapEl,
  polaroidCardEl,
  modelValue: modelValueRef,
  proximityBias: proximityBiasRef,
  center: centerRef,
  zoom: zoomRef,
  referencePoints: referencePointsRef,
  isDetailsVisible: details.isDetailsVisible,
  hasMediaSlot: computed(() => Boolean(slots.media)),
  onManualCoordsSet,
});

const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return details.hasLocation.value
    ? 'Anderen Ort oder Adresse suchen...'
    : 'Ort, Café, Sehenswürdigkeit, Adresse oder Maps-Link suchen...';
});

function clear() {
  search.clearSearch();
  details.resetDetailsState();
  suggestions.resetSuggestions();
  map.removeMarker();

  emit('update:modelValue', null);
  emit('update:address', '');
  emit('update:mapsLink', '');
  emit('clear');
}

function reset() {
  details.cardClosed.value = false;
  search.resetSearch();
  details.resetDetailsState();
  suggestions.resetSuggestions();
}

function onResetClick() {
  reset();
  emit('reset');
}

function clearCoords() {
  search.inputText.value = '';
  map.removeMarker();
  details.cardClosed.value = false;
  details.manualDetailsOpen.value = true;
  emit('update:modelValue', null);
  emit('update:mapsLink', '');
  emit('clear');
}

function onBlur(e: FocusEvent) {
  search.onBlur(e, (event) => {
    emit('blur', event);
  });
}

// Template-Bindings:
const {
  inputText,
  isSearching,
  isOpen,
  results,
  activeIndex,
  shortlinkDetected,
  handleInput,
  selectPlace,
  onKeydown,
  onFocus,
} = search;

const {
  isEditingTitle,
  editTitleInput,
  isEditingAddress,
  editAddressInput,
  isEditingCategory,
  editCategoryInput,
  hasLocation,
  isDetailsVisible,
  openManualDetails,
  closeManualDetails,
  startEditTitle,
  onTitleInput,
  saveTitle,
  cancelTitle,
  startEditAddress,
  onAddressInput,
  saveAddress,
  cancelAddress,
  startEditCategory,
  saveCategory,
  cancelCategory,
  handleCategoryBlur,
} = details;

const {
  showAddressSparkle,
  addressSparkleTitle,
  cycleAddressSuggestion,
  isFetchingAddressSuggestion,
  showCategorySparkle,
  categorySparkleTitle,
  cycleCategorySuggestion,
  isFetchingCategorySuggestion,
  showLocationSparkle,
  locationSparkleTitle,
  cycleLocationSearch,
} = suggestions;

const { locatingSelf, locateError, useOwnLocation, centerOnPoint } = map;

defineExpose({
  clear,
  clearCoords,
  reset,
  hasLocation,
  openManualDetails,
  closeManualDetails,
  isDetailsVisible,
  centerOnPoint,
});
</script>

<template>
  <div class="location-picker">
    <!-- Mini-Karte mit schwebender Suche und Polaroid-Card-Overlay -->
    <div
      class="map-wrap"
      :class="{
        'has-polaroid': isDetailsVisible,
        'has-polaroid-media': isDetailsVisible && Boolean($slots.media),
      }"
    >
      <div ref="mapEl" class="location-picker-map"></div>

      <!-- 1. Schwebende Suchleiste direkt über der Karte -->
      <LocationSearchBar
        :model-value="inputText"
        :is-searching="isSearching"
        :is-open="isOpen"
        :results="results"
        :active-index="activeIndex"
        :placeholder="computedPlaceholder"
        :is-details-visible="isDetailsVisible"
        @update:model-value="handleInput"
        @select="selectPlace"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
        @open-manual-details="openManualDetails"
      />

      <!-- 2. Polaroid-Card: schwebt links unterhalb des Suchfelds auf der Karte -->
      <Transition name="polaroid-slide">
        <LocationPolaroidCard
          v-if="isDetailsVisible"
          :ref="setPolaroidCardRef"
          :model-value="modelValue"
          :modified="modified"
          :has-location="hasLocation"
          :title="title"
          :title-required="titleRequired"
          :title-invalid="titleInvalid"
          :category="category"
          :category-options="categoryOptions"
          :address="address"
          :is-editing-title="isEditingTitle"
          v-model:edit-title-input="editTitleInput"
          :is-editing-category="isEditingCategory"
          v-model:edit-category-input="editCategoryInput"
          :is-editing-address="isEditingAddress"
          v-model:edit-address-input="editAddressInput"
          :show-category-sparkle="showCategorySparkle"
          :category-sparkle-title="categorySparkleTitle"
          :is-fetching-category-suggestion="isFetchingCategorySuggestion"
          :show-address-sparkle="showAddressSparkle"
          :address-sparkle-title="addressSparkleTitle"
          :is-fetching-address-suggestion="isFetchingAddressSuggestion"
          :show-location-sparkle="showLocationSparkle"
          :location-sparkle-title="locationSparkleTitle"
          :is-searching="isSearching"
          @reset="onResetClick"
          @clear-coords="clearCoords"
          @start-edit-title="startEditTitle"
          @title-input="onTitleInput"
          @save-title="saveTitle"
          @cancel-title="cancelTitle"
          @start-edit-category="startEditCategory"
          @save-category="saveCategory"
          @cancel-category="cancelCategory"
          @category-blur="handleCategoryBlur"
          @cycle-category-suggestion="cycleCategorySuggestion"
          @start-edit-address="startEditAddress"
          @address-input="onAddressInput"
          @save-address="saveAddress"
          @cancel-address="cancelAddress"
          @cycle-address-suggestion="cycleAddressSuggestion"
          @cycle-location-search="cycleLocationSearch"
        >
          <template #media v-if="$slots.media">
            <slot name="media" />
          </template>
        </LocationPolaroidCard>
      </Transition>

      <!-- Floating Map Hint when no location set -->
      <div v-if="!modelValue" class="map-tap-hint">
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="13" group="formFields" />
        <span>Tippe auf die Karte, um den Standort zu setzen</span>
      </div>

      <!-- Locate Button (bottom-right) -->
      <IconButton
        variant="floating"
        shape="circle"
        size="lg"
        class="locate-btn"
        :class="{ locating: locatingSelf }"
        :disabled="locatingSelf"
        title="Meinen aktuellen Standort verwenden"
        aria-label="Meinen aktuellen Standort verwenden"
        :icon="OWN_LOCATION_ICON"
        type="button"
        @click="useOwnLocation"
      />
    </div>

    <!-- Kurzlink-Hinweis -->
    <p v-if="shortlinkDetected" class="hint info">
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
      Maps-Kurzlink erkannt. Die genauen Koordinaten werden serverseitig aufgelöst.
    </p>

    <!-- Standort-Ermittlungsfehler -->
    <p v-if="locateError" class="hint error">
      <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
      Standort konnte nicht ermittelt werden.
    </p>
  </div>
</template>

<style scoped>
.location-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  container-name: location-picker;
  container-type: inline-size;
}

/* Map wrap & Mini map */
.map-wrap {
  position: relative;
  width: 100%;
  container-type: inline-size;
}

.map-wrap:focus-within,
.map-wrap:has(:deep(.open)),
.map-wrap:has(:deep(.location-dropdown)) {
  z-index: var(--z-popover, 1100);
}

/* Polaroid Card Slide Transition (sanftes Hineingleiten von oben nach unten) */
.polaroid-slide-enter-active {
  transform-origin: top center;
  transition:
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.polaroid-slide-leave-active {
  transform-origin: top center;
  transition:
    opacity 0.18s ease-in,
    transform 0.18s ease-in;
}

.polaroid-slide-enter-from,
.polaroid-slide-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .polaroid-slide-enter-active,
  .polaroid-slide-leave-active {
    transition: opacity 0.1s ease;
    transform: none;
  }
}

.location-picker-map {
  position: relative;
  isolation: isolate;
  z-index: var(--z-canvas, 0);
  height: 380px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition:
    height 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    min-height 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .location-picker-map {
    transition: none;
  }
}

.has-polaroid .location-picker-map {
  height: 440px;
  min-height: 440px;
}

@container (max-width: 580px) {
  .has-polaroid .location-picker-map {
    height: 560px;
    min-height: 560px;
  }

  .has-polaroid.has-polaroid-media .location-picker-map,
  .has-polaroid:has(:deep(.polaroid-media)) .location-picker-map {
    height: 680px;
    min-height: 680px;
  }
}

.map-tap-hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: var(--z-card-elevated, 5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
  max-width: calc(100% - 68px);
}

.map-tap-hint span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locate-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: var(--z-fab, 120);
}

.locate-btn.locating {
  animation: locate-pulse 1s ease-in-out infinite;
}

@keyframes locate-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.hint.info {
  color: var(--color-primary-dark);
}

.hint.error {
  color: var(--color-danger);
}

:root[data-theme='dark'] .location-picker-map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .location-picker-map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}
</style>
