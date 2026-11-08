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
import {
  DEFAULT_SPOT_PLACEHOLDER_PHRASES,
  DEFAULT_TRIP_PLACEHOLDER_PHRASES,
} from '../composables/useAnimatedPlaceholder';

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
    /** Verwendungskontext des Pickers: 'spot' (Default) oder 'trip'. */
    context?: 'spot' | 'trip';
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
    context: 'spot',
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
const contextRef = toRef(props, 'context');

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

function onSelectTitlePlace(place: PlaceSearchResult) {
  details.editTitleInput.value = place.name;
  emit('update:title', place.name);

  const formattedAddr = place.formatted_address || place.address || place.name;
  details.editAddressInput.value = formattedAddr;
  emit('update:address', formattedAddr);

  if (props.category !== undefined && !props.category.trim() && place.category) {
    details.editCategoryInput.value = place.category;
    emit('update:category', place.category);
  }

  const coords = { lat: place.lat, lng: place.lng };
  map.placeMarker(coords.lat, coords.lng);
  nextTick(() => {
    map.centerOnPoint([coords.lat, coords.lng], 16);
  });

  emit('update:modelValue', coords);
  emit('update:mapsLink', buildGoogleMapsLink(coords.lat, coords.lng));
  emit('select', place);
}

function onSelectAddressPlace(place: PlaceSearchResult) {
  const formattedAddr = place.formatted_address || place.address || place.name;
  details.editAddressInput.value = formattedAddr;
  emit('update:address', formattedAddr);

  const coords = { lat: place.lat, lng: place.lng };
  map.placeMarker(coords.lat, coords.lng);
  nextTick(() => {
    map.centerOnPoint([coords.lat, coords.lng], 16);
  });

  emit('update:modelValue', coords);
  emit('update:mapsLink', buildGoogleMapsLink(coords.lat, coords.lng));

  if (props.title !== undefined && !props.title.trim() && place.name) {
    emit('update:title', place.name);
  }

  if (props.category !== undefined && !props.category.trim() && place.category) {
    emit('update:category', place.category);
  }

  emit('select', place);
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

const titleSearch = usePlaceSearch({
  proximityBias: proximityBiasRef,
  center: centerRef,
  onSelectPlace: onSelectTitlePlace,
  onMapsLinkResolved: (coords) => {
    map.placeMarker(coords.lat, coords.lng);
    emit('update:modelValue', coords);
    nextTick(() => {
      map.centerOnPoint([coords.lat, coords.lng], 16);
    });
  },
  onMapsLinkInput: (url) => emit('update:mapsLink', url),
});

const addressSearch = usePlaceSearch({
  proximityBias: proximityBiasRef,
  center: centerRef,
  onSelectPlace: onSelectAddressPlace,
  onMapsLinkResolved: (coords) => {
    map.placeMarker(coords.lat, coords.lng);
    emit('update:modelValue', coords);
    nextTick(() => {
      map.centerOnPoint([coords.lat, coords.lng], 16);
    });
  },
  onMapsLinkInput: (url) => emit('update:mapsLink', url),
});

const details = useLocationDetails({
  modelValue: modelValueRef,
  title: titleRef,
  address: addressRef,
  category: categoryRef,
  mapsLink: mapsLinkRef,
  selectedPlace: search.selectedPlace,
  context: contextRef,
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
  if (props.placeholder) {
    return props.placeholder;
  }

  if (props.context === 'trip') {
    return 'Reiseziel, Stadt oder Maps-Link eingeben...';
  }

  return details.hasLocation.value
    ? 'Anderen Ort oder Adresse suchen...'
    : 'Ort, Café, Sehenswürdigkeit, Adresse oder Maps-Link suchen...';
});

const computedPlaceholderPhrases = computed(() => {
  if (props.placeholder) {return [props.placeholder];}

  if (props.context === 'trip') {
    return DEFAULT_TRIP_PLACEHOLDER_PHRASES;
  }

  if (details.hasLocation.value) {
    return [
      'Anderen Ort oder Adresse suchen...',
      'Anderen Maps-Link einfügen...',
      'Anderen Booking- oder Airbnb-Link einfügen...',
    ];
  }

  return DEFAULT_SPOT_PLACEHOLDER_PHRASES;
});

function clear() {
  search.clearSearch();
  titleSearch.clearSearch();
  addressSearch.clearSearch();
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
  titleSearch.resetSearch();
  addressSearch.resetSearch();
  details.resetDetailsState();
  suggestions.resetSuggestions();
}

function onResetClick() {
  reset();
  emit('reset');
}

function clearCoords() {
  search.inputText.value = '';
  titleSearch.clearSearch();
  addressSearch.clearSearch();
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

function onTitleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  details.editTitleInput.value = val;
  details.onTitleInput();
  titleSearch.handleInput(val);
}

function onTitleFocus() {
  titleSearch.onFocus();
}

function onTitleBlur(e: FocusEvent) {
  titleSearch.onBlur(e);
  details.saveTitle();
}

function onTitleKeydown(e: KeyboardEvent) {
  const wasOpen = titleSearch.isOpen.value;
  titleSearch.onKeydown(e);

  if (e.key === 'Enter') {
    if (!wasOpen || titleSearch.activeIndex.value < 0) {
      details.saveTitle();
    }
  } else if (e.key === 'Escape') {
    if (!wasOpen) {
      details.cancelTitle();
    }
  }
}

function onAddressInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  details.editAddressInput.value = val;
  details.onAddressInput();
  addressSearch.handleInput(val);
}

function onAddressFocus() {
  addressSearch.onFocus();
}

function onAddressBlur(e: FocusEvent) {
  addressSearch.onBlur(e);
  details.saveAddress();
}

function onAddressKeydown(e: KeyboardEvent) {
  const wasOpen = addressSearch.isOpen.value;
  addressSearch.onKeydown(e);

  if (e.key === 'Enter') {
    if (!wasOpen || addressSearch.activeIndex.value < 0) {
      details.saveAddress();
    }
  } else if (e.key === 'Escape') {
    if (!wasOpen) {
      details.cancelAddress();
    }
  }
}

// Template-Bindings:
const {
  inputText,
  isSearching,
  isLoadingMore,
  hasMore,
  isOpen,
  results,
  activeIndex,
  shortlinkDetected,
  bookingLinkDetected,
  handleInput,
  loadMore,
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
  saveTitle,
  cancelTitle,
  startEditAddress,
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

const {
  locatingSelf,
  locateError,
  isMobileMapExpanded,
  toggleMobileMapExpanded,
  useOwnLocation,
  centerOnPoint,
} = map;

defineExpose({
  clear,
  clearCoords,
  reset,
  hasLocation,
  openManualDetails,
  closeManualDetails,
  isDetailsVisible,
  isMobileMapExpanded,
  toggleMobileMapExpanded,
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
        'is-map-expanded': isMobileMapExpanded,
      }"
    >
      <!-- 1. Schwebende Suchleiste direkt über der Karte -->
      <LocationSearchBar
        :model-value="inputText"
        :is-searching="isSearching"
        :is-loading-more="isLoadingMore"
        :has-more="hasMore"
        :is-open="isOpen"
        :results="results"
        :active-index="activeIndex"
        :placeholder="computedPlaceholder"
        :placeholder-phrases="computedPlaceholderPhrases"
        :is-details-visible="isDetailsVisible"
        @update:model-value="handleInput"
        @select="selectPlace"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
        @load-more="loadMore"
        @open-manual-details="openManualDetails"
      />

      <!-- 2. Polaroid-Card: schwebt links unterhalb des Suchfelds auf der Karte (Desktop) bzw. steht im Fluss (Mobile) -->
      <Transition name="polaroid-slide">
        <LocationPolaroidCard
          v-if="isDetailsVisible"
          :ref="setPolaroidCardRef"
          :context="context"
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
          :title-search-results="titleSearch.results.value"
          :title-search-open="titleSearch.isOpen.value"
          :title-search-active-index="titleSearch.activeIndex.value"
          :is-searching-title="titleSearch.isSearching.value"
          :address-search-results="addressSearch.results.value"
          :address-search-open="addressSearch.isOpen.value"
          :address-search-active-index="addressSearch.activeIndex.value"
          :is-searching-address="addressSearch.isSearching.value"
          @reset="onResetClick"
          @clear-coords="clearCoords"
          @start-edit-title="startEditTitle"
          @title-input="onTitleInput"
          @title-focus="onTitleFocus"
          @title-blur="onTitleBlur"
          @title-keydown="onTitleKeydown"
          @select-title-place="titleSearch.selectPlace"
          @save-title="saveTitle"
          @cancel-title="cancelTitle"
          @start-edit-category="startEditCategory"
          @save-category="saveCategory"
          @cancel-category="cancelCategory"
          @category-blur="handleCategoryBlur"
          @cycle-category-suggestion="cycleCategorySuggestion"
          @start-edit-address="startEditAddress"
          @address-input="onAddressInput"
          @address-focus="onAddressFocus"
          @address-blur="onAddressBlur"
          @address-keydown="onAddressKeydown"
          @select-address-place="addressSearch.selectPlace"
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

      <!-- 3. Kartenfläche & Steuerelemente -->
      <div class="map-canvas-wrap">
        <div ref="mapEl" class="location-picker-map"></div>

        <!-- Floating Map Hint when no location set -->
        <div v-if="!modelValue && (!isDetailsVisible || isMobileMapExpanded)" class="map-tap-hint">
          <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="13" group="formFields" />
          <span>Tippe auf die Karte, um den Standort zu setzen</span>
        </div>

        <!-- Mobile Expand / Collapse Button -->
        <button
          type="button"
          class="mobile-map-expand-btn"
          :class="{ 'is-expanded': isMobileMapExpanded }"
          :aria-expanded="isMobileMapExpanded"
          data-testid="mobile-map-expand-btn"
          @click.stop="toggleMobileMapExpanded"
        >
          <AppIcon
            :icon="isMobileMapExpanded ? ACTION_ICONS.done : ACTION_ICONS.maximize"
            :size="13"
            group="actions"
          />
          <span>{{ isMobileMapExpanded ? 'Fertig' : 'Position anpassen' }}</span>
        </button>

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
    </div>

    <!-- Kurzlink-Hinweis -->
    <p v-if="shortlinkDetected" class="hint info">
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
      Maps-Kurzlink erkannt. Die genauen Koordinaten werden serverseitig aufgelöst.
    </p>

    <!-- Buchungs-Link-Hinweis -->
    <p v-if="bookingLinkDetected" class="hint info">
      <AppIcon :icon="FORM_FIELD_ICONS.link" :size="14" group="formFields" />
      Buchungs-Link erkannt. Die Unterkunft-Details werden automatisch abgerufen.
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
  pointer-events: none;
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

.map-canvas-wrap {
  position: relative;
  width: 100%;
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

.has-polaroid-media .location-picker-map {
  height: 475px;
  min-height: 475px;
}

.mobile-map-expand-btn {
  display: none;
}

@container (max-width: 580px) {
  .map-wrap:not(.has-polaroid) .location-picker-map {
    height: 180px;
    min-height: 180px;
    touch-action: pan-y;
    cursor: pointer;
  }

  .map-wrap.has-polaroid {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .map-wrap.has-polaroid :deep(.location-search-floating) {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    width: 100%;
  }

  .map-wrap.has-polaroid :deep(.location-picker-input) {
    box-shadow: none;
    border: 1px solid var(--color-border);
  }

  .has-polaroid .location-picker-map {
    height: 135px;
    min-height: 135px;
    touch-action: pan-y;
    cursor: pointer;
  }

  .is-map-expanded .location-picker-map,
  .has-polaroid.is-map-expanded .location-picker-map {
    height: 320px;
    min-height: 320px;
    touch-action: auto;
    cursor: default;
  }

  .mobile-map-expand-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    position: absolute;
    bottom: 12px;
    left: 12px;
    z-index: var(--z-fab, 120);
    padding: 5px 12px;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-xs);
    font-weight: 600;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .mobile-map-expand-btn:hover {
    background: var(--color-hover);
  }

  .mobile-map-expand-btn.is-expanded {
    background: var(--color-primary);
    color: var(--color-on-primary, #ffffff);
    border-color: var(--color-primary);
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
