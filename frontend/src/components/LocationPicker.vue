<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IconCompass, IconCompassFilled } from '@tabler/icons-vue';
import { cachedEmojiPin, LEAFLET_ATTRIBUTION_PREFIX, pulsingEmojiPin } from '../utils/mapRoute';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { buildGoogleMapsLink, buildOsmLink } from '../utils/googleMaps';
import { classifyLocationInput } from '../utils/locationInputClassifier';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import CategoryChip from './CategoryChip.vue';
import CategoryCombobox from './CategoryCombobox.vue';
import type { IconDef } from '../utils/icon';

export interface PlaceSearchResult {
  id?: string;
  name: string;
  formatted_address: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

const OWN_LOCATION_ICON: IconDef = {
  id: 'compass',
  emoji: '🧭',
  outline: IconCompass,
  filled: IconCompassFilled,
};

const FALLBACK_CENTER = { lat: 48.5, lng: 10 };
const FALLBACK_ZOOM = 4;

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

// --- Input & Search Autocomplete State ---
const inputText = ref('');
const isSearching = ref(false);
const isOpen = ref(false);
const results = ref<PlaceSearchResult[]>([]);
const activeIndex = ref(-1);
const selectedPlace = ref<PlaceSearchResult | null>(null);
const shortlinkDetected = ref(false);

const hasLocation = computed(() => Boolean(props.modelValue || props.address || props.mapsLink));

const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return hasLocation.value
    ? 'Anderen Ort oder Adresse suchen...'
    : 'Ort, Café, Sehenswürdigkeit, Adresse oder Maps-Link suchen...';
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeAbortController: AbortController | null = null;

// Initialisiere Textfeld mit übergebenem Link oder Adresse nur, wenn noch kein Standort gesetzt ist
// (wenn bereits Koordinaten vorliegen, zeigt die Status-Karte die Daten und das Suchfeld bleibt frei).
watch(
  () => props.mapsLink,
  (link) => {
    if (link && !inputText.value && !props.modelValue && props.title === undefined) {
      inputText.value = link;
    }
  },
  { immediate: true }
);

watch(
  () => props.address,
  (addr) => {
    if (
      addr &&
      !inputText.value &&
      !props.modelValue &&
      !props.mapsLink &&
      props.title === undefined
    ) {
      inputText.value = addr;
    }
  },
  { immediate: true }
);

// --- Map State ---
const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let marker: L.Marker | null = null;
let resizeObserver: ResizeObserver | null = null;
let referenceLayer: L.LayerGroup | null = null;
let ownLocationMarker: L.Marker | null = null;
let geoWatchId: number | null = null;
const locatingSelf = ref(false);
const locateError = ref(false);

// Inline-Edit State für die Status-Details (Titel, Adresse & Kategorie)
const isEditingTitle = ref(false);
const editTitleInput = ref('');
const isEditingAddress = ref(false);
const editAddressInput = ref('');
const isEditingCategory = ref(false);
const editCategoryInput = ref('');

const manualDetailsOpen = ref(false);
const cardClosed = ref(false);

const isDetailsVisible = computed(() => {
  if (cardClosed.value) return false;
  if (manualDetailsOpen.value) return true;
  if (selectedPlace.value !== null) return true;
  if (hasLocation.value) return true;
  if (props.title && props.title.trim().length > 0) return true;
  return false;
});

function openManualDetails() {
  cardClosed.value = false;
  manualDetailsOpen.value = true;
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(
      '.status-title-row .inline-edit-input input, .status-title-row input, .status-address-row .inline-edit-input input, .status-address-row input'
    );
    el?.focus();
  });
}

function closeManualDetails() {
  cardClosed.value = true;
  manualDetailsOpen.value = false;
}

watch(
  () => props.title,
  (newTitle) => {
    if (!isEditingTitle.value || !editTitleInput.value) {
      editTitleInput.value = newTitle || '';
      isEditingTitle.value = !newTitle;
    }
  },
  { immediate: true }
);

watch(
  () => props.address,
  (newAddress) => {
    if (!isEditingAddress.value || !editAddressInput.value) {
      editAddressInput.value = newAddress || '';
      isEditingAddress.value = !newAddress;
    }
  },
  { immediate: true }
);

watch(
  () => props.category,
  (newCategory) => {
    if (!isEditingCategory.value || !editCategoryInput.value) {
      editCategoryInput.value = newCategory || '';
      isEditingCategory.value = !newCategory;
    }
  },
  { immediate: true }
);

function startEditTitle() {
  editTitleInput.value = props.title || '';
  isEditingTitle.value = true;
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(
      '.status-title-row .inline-edit-input input, .status-title-row input'
    );
    el?.focus();
    el?.select();
  });
}

function onTitleInput() {
  emit('update:title', editTitleInput.value);
}

function saveTitle() {
  const trimmed = editTitleInput.value.trim();
  emit('update:title', trimmed);
  if (trimmed) {
    isEditingTitle.value = false;
  }
}

function cancelTitle() {
  if (props.title) {
    editTitleInput.value = props.title;
    isEditingTitle.value = false;
  }
}

function startEditAddress() {
  editAddressInput.value = props.address || '';
  isEditingAddress.value = true;
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(
      '.status-address-row .inline-edit-input input, .status-address-row input'
    );
    el?.focus();
    el?.select();
  });
}

function onAddressInput() {
  emit('update:address', editAddressInput.value);
}

function saveAddress() {
  const trimmed = editAddressInput.value.trim();
  emit('update:address', trimmed);
  if (trimmed) {
    isEditingAddress.value = false;
  }
}

function cancelAddress() {
  if (props.address) {
    editAddressInput.value = props.address;
    isEditingAddress.value = false;
  }
}

function startEditCategory() {
  editCategoryInput.value = props.category || '';
  isEditingCategory.value = true;
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(
      '.status-category-row .inline-category-combobox input, .status-category-row input'
    );
    el?.focus();
    el?.select();
  });
}

function saveCategory(val?: string) {
  const newCat = (typeof val === 'string' ? val : editCategoryInput.value).trim();
  emit('update:category', newCat);
  if (newCat) {
    isEditingCategory.value = false;
  }
}

function cancelCategory() {
  if (props.category) {
    editCategoryInput.value = props.category;
    isEditingCategory.value = false;
  }
}

function handleCategoryBlur() {
  window.setTimeout(() => {
    if (isEditingCategory.value && props.category) {
      saveCategory();
    }
  }, 200);
}

async function reverseGeocodeCoords(lat: number, lng: number) {
  try {
    const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      editAddressInput.value = '';
      emit('update:address', '');
      return;
    }
    const data = (await res.json()) as { formatted_address?: string; address?: string } | null;
    if (data && (data.formatted_address || data.address)) {
      const addr = data.formatted_address || data.address || '';
      editAddressInput.value = addr;
      emit('update:address', addr);
    } else {
      editAddressInput.value = '';
      emit('update:address', '');
    }
  } catch {
    editAddressInput.value = '';
    emit('update:address', '');
  }
}

function onManualCoordsSet(coords: { lat: number; lng: number }) {
  cardClosed.value = false;
  placeMarker(coords.lat, coords.lng);
  selectedPlace.value = null;
  manualDetailsOpen.value = true;
  emit('update:modelValue', coords);
  emit('update:mapsLink', buildOsmLink(coords.lat, coords.lng));
  reverseGeocodeCoords(coords.lat, coords.lng);
}

function placeMarker(lat: number, lng: number) {
  if (!map) return;
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng], {
      icon: cachedEmojiPin(FORM_FIELD_ICONS.location, '#e08e45'),
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      if (!marker) return;
      const latlng = marker.getLatLng();
      onManualCoordsSet({ lat: latlng.lat, lng: latlng.lng });
    });
  }
}

function renderReferencePoints() {
  if (!map) return;
  referenceLayer?.clearLayers();
  if (!props.referencePoints?.length) return;
  if (!referenceLayer) referenceLayer = L.layerGroup().addTo(map);
  for (const point of props.referencePoints) {
    L.marker([point.lat, point.lng], {
      icon: cachedEmojiPin(point.icon ?? FORM_FIELD_ICONS.location, '#8a8a86'),
      interactive: false,
      opacity: 0.7,
    }).addTo(referenceLayer);
  }
}

function startOwnLocation() {
  if (!navigator.geolocation) return;
  geoWatchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!map) return;
      const latlng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude];
      if (ownLocationMarker) {
        ownLocationMarker.setLatLng(latlng);
      } else {
        ownLocationMarker = L.marker(latlng, {
          icon: pulsingEmojiPin(OWN_LOCATION_ICON, '#2f6fed'),
          interactive: false,
        }).addTo(map!);
      }
    },
    () => {
      // Permission denied or unavailable - silently ignore
    },
    { enableHighAccuracy: true, maximumAge: 10_000 }
  );
}

function useOwnLocation() {
  if (!navigator.geolocation) return;
  locatingSelf.value = true;
  locateError.value = false;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locatingSelf.value = false;
      const { latitude, longitude } = position.coords;
      map?.setView([latitude, longitude], 16);
      onManualCoordsSet({ lat: latitude, lng: longitude });
    },
    () => {
      locatingSelf.value = false;
      locateError.value = true;
    },
    { enableHighAccuracy: true, maximumAge: 10_000 }
  );
}

// --- Autocomplete & Search Handling ---
function handleInput(val: string) {
  inputText.value = val;
  shortlinkDetected.value = false;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  const classification = classifyLocationInput(val);

  if (classification.type === 'empty') {
    isSearching.value = false;
    isOpen.value = false;
    results.value = [];
    activeIndex.value = -1;
    return;
  }

  if (classification.type === 'maps_link') {
    isSearching.value = false;
    isOpen.value = false;
    results.value = [];
    activeIndex.value = -1;

    emit('update:mapsLink', classification.url);

    if (classification.coords) {
      const coords = classification.coords;
      placeMarker(coords.lat, coords.lng);
      map?.setView([coords.lat, coords.lng], 16);
      manualDetailsOpen.value = true;
      emit('update:modelValue', coords);
    } else if (classification.isShortlink) {
      shortlinkDetected.value = true;
    }
    return;
  }

  // Free-text search query
  const trimmed = classification.query.trim();
  if (trimmed.length < 2) {
    isSearching.value = false;
    isOpen.value = false;
    results.value = [];
    activeIndex.value = -1;
    return;
  }

  isSearching.value = true;
  activeIndex.value = -1;

  debounceTimer = setTimeout(async () => {
    try {
      activeAbortController = new AbortController();
      const bias = props.proximityBias ?? props.center;
      let url = `/api/places/search?q=${encodeURIComponent(trimmed)}`;
      if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
        url += `&lat=${bias.lat}&lng=${bias.lng}`;
      }

      const res = await fetch(url, { signal: activeAbortController.signal });
      if (!res.ok) {
        results.value = [];
        isOpen.value = true;
        return;
      }
      const data = (await res.json()) as PlaceSearchResult[];
      results.value = Array.isArray(data) ? data : [];
      isOpen.value = results.value.length > 0;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      results.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 300);
}

function selectPlace(place: PlaceSearchResult) {
  cardClosed.value = false;
  selectedPlace.value = place;
  manualDetailsOpen.value = true;
  inputText.value = '';
  isOpen.value = false;
  results.value = [];
  activeIndex.value = -1;
  isEditingTitle.value = false;
  isEditingAddress.value = false;
  isEditingCategory.value = false;
  editTitleInput.value = place.name;
  editAddressInput.value = place.formatted_address || place.address || place.name;

  const coords = { lat: place.lat, lng: place.lng };
  placeMarker(coords.lat, coords.lng);
  map?.setView([coords.lat, coords.lng], 16);

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

function clear() {
  selectedPlace.value = null;
  manualDetailsOpen.value = false;
  isOpen.value = false;
  results.value = [];
  activeIndex.value = -1;
  shortlinkDetected.value = false;
  isEditingAddress.value = false;
  isEditingCategory.value = false;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  if (marker) {
    marker.remove();
    marker = null;
  }

  inputText.value = '';

  emit('update:modelValue', null);
  emit('update:address', '');
  emit('update:mapsLink', '');
  emit('clear');
}

function reset() {
  cardClosed.value = false;
  selectedPlace.value = null;
  isOpen.value = false;
  results.value = [];
  activeIndex.value = -1;
  shortlinkDetected.value = false;
  isEditingAddress.value = false;
  isEditingCategory.value = false;
  isEditingTitle.value = false;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  inputText.value = '';
}

function onResetClick() {
  reset();
  emit('reset');
}

function clearCoords() {
  inputText.value = '';
  if (marker) {
    marker.remove();
    marker = null;
  }
  cardClosed.value = false;
  manualDetailsOpen.value = true;
  emit('update:modelValue', null);
  emit('update:mapsLink', '');
  emit('clear');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    if (!isOpen.value) {
      if (results.value.length > 0) {
        isOpen.value = true;
        activeIndex.value = 0;
      }
    } else {
      e.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % results.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    if (isOpen.value) {
      e.preventDefault();
      activeIndex.value = activeIndex.value <= 0 ? results.value.length - 1 : activeIndex.value - 1;
    }
  } else if (e.key === 'Enter') {
    if (isOpen.value && activeIndex.value >= 0 && activeIndex.value < results.value.length) {
      e.preventDefault();
      selectPlace(results.value[activeIndex.value]);
    }
  } else if (e.key === 'Escape') {
    if (isOpen.value) {
      e.preventDefault();
      isOpen.value = false;
    }
  }
}

function onBlur(e: FocusEvent) {
  window.setTimeout(() => {
    isOpen.value = false;
  }, 200);
  emit('blur', e);
}

function onFocus() {
  if (results.value.length > 0 && inputText.value.trim().length >= 2) {
    isOpen.value = true;
  }
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;

  const initial = props.modelValue ?? props.proximityBias ?? props.center ?? FALLBACK_CENTER;
  const initialZoom = props.modelValue ? 15 : (props.zoom ?? FALLBACK_ZOOM);

  map = L.map(mapEl.value, {
    zoomControl: false,
    rotateControl: false,
  }).setView([initial.lat, initial.lng], initialZoom);
  map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);

  if (props.modelValue) {
    placeMarker(props.modelValue.lat, props.modelValue.lng);
  }
  renderReferencePoints();
  startOwnLocation();

  map.on('click', (e: L.LeafletMouseEvent) => {
    onManualCoordsSet({ lat: e.latlng.lat, lng: e.latlng.lng });
  });

  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      cardClosed.value = false;
      placeMarker(val.lat, val.lng);
      if (map) {
        const curCenter = map.getCenter();
        const dist = Math.hypot(curCenter.lat - val.lat, curCenter.lng - val.lng);
        if (dist > 0.0001) {
          map.setView([val.lat, val.lng], map.getZoom() || 15);
        }
      }
    } else {
      if (marker) {
        marker.remove();
        marker = null;
      }
    }
  },
  { deep: true }
);

watch(() => props.referencePoints, renderReferencePoints, { deep: true });

watch(
  () => props.proximityBias ?? props.center,
  (c) => {
    if (!map || props.modelValue || !c) return;
    map.setView([c.lat, c.lng], props.zoom ?? FALLBACK_ZOOM);
  }
);

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (activeAbortController) activeAbortController.abort();
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (geoWatchId != null) navigator.geolocation.clearWatch(geoWatchId);
  map?.remove();
  map = null;
});

defineExpose({
  clear,
  clearCoords,
  reset,
  hasLocation,
  openManualDetails,
  closeManualDetails,
  isDetailsVisible,
});
</script>

<template>
  <div class="location-picker">
    <!-- Mini-Karte mit schwebender Suche und Polaroid-Card-Overlay -->
    <div class="map-wrap" :class="{ 'has-polaroid': isDetailsVisible }">
      <div ref="mapEl" class="location-picker-map"></div>

      <!-- 1. Schwebende Suchleiste direkt über der Karte -->
      <div class="location-search-row location-search-floating">
        <div
          class="location-search-wrap"
          :class="{ 'is-loading': isSearching, loading: isSearching }"
          :aria-busy="isSearching"
        >
          <AppIcon
            :icon="ACTION_ICONS.search"
            :size="16"
            group="actions"
            class="location-search-icon"
            aria-hidden="true"
          />
          <Input
            :model-value="inputText"
            class="location-picker-input"
            type="text"
            name="location-search"
            data-testid="location-search-input"
            :placeholder="computedPlaceholder"
            aria-label="Ort suchen oder Maps-Link einfügen"
            autocomplete="off"
            @update:model-value="handleInput"
            @keydown="onKeydown"
            @focus="onFocus"
            @blur="onBlur"
          />
          <div class="search-right-actions">
            <div v-if="isSearching" class="input-spinner-wrap" aria-hidden="true">
              <LoadingSpinner size="sm" class="spinner input-spinner" />
            </div>
            <InfoPopover
              title="Suchtipps & Maps-Links"
              aria-label="Suchtipps und Maps-Links anzeigen"
              align="right"
              placement="bottom"
              :menu-width="260"
              class="search-info-popover"
            >
              <p>
                <strong>Ortssuche:</strong> Du kannst nach Adressen, Cafés, Sehenswürdigkeiten oder
                Orten weltweit suchen.
              </p>
              <p>
                <strong>Karten-Links:</strong> Kopiere einfach einen Link von Google Maps, Apple
                Maps oder OpenStreetMap (OSM) hier hinein.
              </p>
              <p class="popover-tip">
                📍 Du kannst auch direkt auf die Karte tippen, um die Stecknadel manuell zu
                platzieren.
              </p>
            </InfoPopover>
          </div>

          <!-- Autocomplete Dropdown List -->
          <Transition name="dropdown-unfold">
            <ul
              v-if="
                isOpen && (results.length > 0 || (!isSearching && inputText.trim().length >= 2))
              "
              class="location-dropdown options"
              role="listbox"
              aria-label="Suchergebnisse"
            >
              <li
                v-if="!isSearching && results.length === 0"
                role="status"
                class="location-result-empty"
              >
                <AppIcon
                  :icon="ACTION_ICONS.warning"
                  :size="16"
                  group="actions"
                  class="item-icon"
                />
                <div class="location-empty-content">
                  <span class="empty-title">Kein passender Ort gefunden</span>
                  <span class="empty-desc">
                    Du kannst die Details manuell ausfüllen oder direkt auf die Karte tippen.
                  </span>
                </div>
              </li>
              <li
                v-for="(place, index) in results"
                :key="place.id || `${place.lat}-${place.lng}-${index}`"
                role="option"
                tabindex="-1"
                class="location-result-item"
                :class="{ 'is-active': index === activeIndex }"
                :aria-selected="index === activeIndex"
                @mousedown.prevent="selectPlace(place)"
                @click="selectPlace(place)"
                @keydown.enter.prevent="selectPlace(place)"
              >
                <AppIcon
                  :icon="FORM_FIELD_ICONS.location"
                  :size="16"
                  group="formFields"
                  class="item-icon"
                />
                <div class="location-item-content">
                  <div class="location-item-title-row">
                    <span class="location-item-name">{{ place.name }}</span>
                    <CategoryChip
                      v-if="place.category"
                      :category="place.category"
                      type="spot"
                      class="location-category-badge"
                    />
                  </div>
                  <span class="location-item-address">{{
                    place.formatted_address || place.address
                  }}</span>
                </div>
              </li>
            </ul>
          </Transition>
        </div>

        <!-- "Details manuell ausfüllen" Action Bar (wenn Details initial verborgen) -->
        <div v-if="!isDetailsVisible" class="manual-details-bar">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            class="manual-details-btn"
            :icon="ACTION_ICONS.edit"
            @click="openManualDetails"
          >
            Details manuell ausfüllen
          </Button>
        </div>
      </div>

      <!-- 2. Polaroid-Card: schwebt links unterhalb des Suchfelds auf der Karte -->
      <div
        v-if="isDetailsVisible"
        class="polaroid-card"
        :class="{ 'is-modified': modified, 'has-location': hasLocation }"
        data-testid="location-status"
      >
        <!-- Header Actions (oben rechts in der Card): Zurücksetzen -->
        <div v-if="modified" class="polaroid-header-actions">
          <IconButton
            type="button"
            size="sm"
            shape="circle"
            variant="secondary"
            class="polaroid-action-btn polaroid-reset-btn"
            :icon="ACTION_ICONS.restore"
            title="Standort zurücksetzen"
            aria-label="Standort zurücksetzen"
            @click="onResetClick"
          />
        </div>

        <!-- Polaroid-Foto / Medien-Slot (z. B. CoverImagePicker) -->
        <div v-if="$slots.media" class="polaroid-media">
          <slot name="media" />
        </div>

        <!-- Polaroid-Body / Beschriftung & Detailzeilen -->
        <div class="polaroid-body">
          <div class="status-details">
            <!-- 1. Titel-Zeile -->
            <div v-if="props.title !== undefined" class="status-meta-row status-title-row">
              <span class="status-row-icon" title="Titel" aria-hidden="true">
                <AppIcon :icon="FORM_FIELD_ICONS.title" :size="14" group="formFields" />
              </span>
              <div v-if="!isEditingTitle && props.title" class="status-meta-display">
                <span class="status-title" :title="props.title">
                  {{ props.title }}
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="inline-edit-btn"
                  :icon="ACTION_ICONS.edit"
                  title="Titel bearbeiten"
                  aria-label="Titel bearbeiten"
                  @click="startEditTitle"
                />
              </div>
              <div v-else class="status-meta-edit status-title-edit">
                <Input
                  v-model="editTitleInput"
                  size="sm"
                  class="inline-edit-input"
                  name="title"
                  data-testid="spot-title-input"
                  placeholder="Titel des Spots..."
                  :required="titleRequired"
                  :invalid="titleInvalid"
                  @input="onTitleInput"
                  @keydown.enter.prevent="saveTitle"
                  @keydown.esc.prevent="cancelTitle"
                  @blur="saveTitle"
                />
                <IconButton
                  v-if="props.title"
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="inline-save-btn"
                  :icon="ACTION_ICONS.done"
                  title="Titel speichern"
                  aria-label="Titel speichern"
                  @click="saveTitle"
                />
              </div>
            </div>

            <!-- 2. Standort-Gruppe: Adresse & Koordinaten näher zusammengerückt -->
            <div class="status-location-group">
              <!-- Adress-Zeile -->
              <div class="status-meta-row status-address-row">
                <span class="status-row-icon" title="Adresse" aria-hidden="true">
                  <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
                </span>
                <div v-if="!isEditingAddress && props.address" class="status-meta-display">
                  <span class="status-address" :title="props.address">
                    {{ props.address }}
                  </span>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="inline-edit-btn"
                    :icon="ACTION_ICONS.edit"
                    title="Adresse bearbeiten"
                    aria-label="Adresse bearbeiten"
                    @click="startEditAddress"
                  />
                </div>
                <div v-else class="status-meta-edit status-address-edit">
                  <Input
                    v-model="editAddressInput"
                    size="sm"
                    class="inline-edit-input"
                    name="spot-address"
                    data-testid="spot-address-input"
                    placeholder="Adresse eingeben..."
                    autocomplete="off"
                    data-protonpass-ignore="true"
                    data-1p-ignore="true"
                    @input="onAddressInput"
                    @keydown.enter.prevent="saveAddress"
                    @keydown.esc.prevent="cancelAddress"
                    @blur="saveAddress"
                  />
                  <IconButton
                    v-if="props.address"
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="inline-save-btn"
                    :icon="ACTION_ICONS.done"
                    title="Adresse speichern"
                    aria-label="Adresse speichern"
                    @click="saveAddress"
                  />
                </div>
              </div>

              <!-- Koordinaten-Zeile mit Standort-Entfernen-Button direkt neben den Koordinaten -->
              <div v-if="modelValue" class="status-meta-row status-coords-row">
                <span class="status-row-icon" title="Koordinaten" aria-hidden="true">
                  <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
                </span>
                <div class="status-meta-display">
                  <span class="status-coords">
                    {{ modelValue.lat.toFixed(5) }}, {{ modelValue.lng.toFixed(5) }}
                  </span>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="clear-btn coords-clear-btn"
                    :icon="ACTION_ICONS.close"
                    title="Standort-Koordinaten entfernen"
                    aria-label="Standort-Koordinaten entfernen"
                    @click="clearCoords"
                  />
                </div>
              </div>
            </div>

            <!-- 3. Kategorie-Zeile -->
            <div v-if="props.category !== undefined" class="status-meta-row status-category-row">
              <span class="status-row-icon" title="Kategorie" aria-hidden="true">
                <AppIcon :icon="FORM_FIELD_ICONS.category" :size="14" group="formFields" />
              </span>
              <div v-if="!isEditingCategory && props.category" class="status-meta-display">
                <CategoryChip :category="props.category" type="spot" />
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="inline-edit-btn"
                  :icon="ACTION_ICONS.edit"
                  title="Kategorie bearbeiten"
                  aria-label="Kategorie bearbeiten"
                  @click="startEditCategory"
                />
              </div>
              <div v-else class="status-meta-edit status-category-edit">
                <div class="inline-category-combobox">
                  <CategoryCombobox
                    v-model="editCategoryInput"
                    type="spot"
                    :options="categoryOptions"
                    size="sm"
                    placeholder="Kategorie wählen..."
                    @select="saveCategory"
                    @keydown.enter.prevent="saveCategory()"
                    @keydown.esc.prevent="cancelCategory"
                    @blur="handleCategoryBlur"
                  />
                </div>
                <IconButton
                  v-if="props.category"
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="inline-save-btn"
                  :icon="ACTION_ICONS.done"
                  title="Kategorie speichern"
                  aria-label="Kategorie speichern"
                  @click="saveCategory()"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
  gap: var(--space-2, 8px);
  position: relative;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.location-search-row {
  width: 100%;
  min-width: 0;
}

.location-search-floating {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  width: auto;
  box-sizing: border-box;
  z-index: var(--z-dropdown, 500);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.location-search-floating:focus-within,
.location-search-floating:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

.manual-details-bar {
  display: flex;
  justify-content: flex-start;
  margin: 0;
}

.manual-details-btn {
  font-size: 0.8rem;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.12));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  height: 28px;
  padding: 2px 10px;
  cursor: pointer;
}

.location-search-wrap {
  position: relative;
  width: 100%;
}

.location-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 2;
}

.location-picker-input,
.location-search-wrap :deep(.location-picker-input) {
  width: 100%;
  box-sizing: border-box;
  padding-left: 36px;
  padding-right: 40px;
  background: var(--color-surface);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
}

.location-search-wrap.is-loading :deep(.location-picker-input) {
  padding-right: 68px;
}

.location-search-wrap :deep(.location-picker-input)::placeholder {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.search-right-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-1-5, 6px);
  z-index: 3;
}

.search-right-actions .input-spinner-wrap {
  position: static;
  transform: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.input-spinner {
  pointer-events: none;
}

.location-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--z-popover, 1100);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 8px);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
  list-style: none;
  padding: 4px 0;
  margin: 0;
  max-height: 240px;
  overflow-y: auto;
}

.location-result-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.location-result-item:hover,
.location-result-item.is-active,
.location-result-item[aria-selected='true'] {
  background: var(--color-hover);
}

.item-icon {
  margin-top: 2px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.location-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.location-item-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.location-item-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-category-badge {
  flex-shrink: 0;
}

.location-item-address {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-result-empty {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
  padding: 10px 12px;
  color: var(--color-text-muted);
  user-select: none;
}

.location-empty-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.location-empty-content .empty-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text);
}

.location-empty-content .empty-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* Polaroid Card */
.polaroid-card {
  position: absolute;
  top: 68px;
  left: 12px;
  width: 260px;
  max-width: calc(100% - 24px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle, 12px);
  corner-shape: squircle;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  transition: all 0.2s ease;
  z-index: var(--z-card-elevated, 5);
}

.polaroid-card:focus-within,
.polaroid-card:has(.open) {
  z-index: var(--z-popover, 1100);
}

.polaroid-card.is-modified {
  border-color: var(--color-accent) !important;
  box-shadow:
    var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15)),
    0 0 0 1px var(--color-accent);
}

.polaroid-header-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
}

.polaroid-action-btn {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.polaroid-action-btn:hover {
  background: var(--color-surface-hover, var(--color-hover));
  color: var(--color-text);
}

.polaroid-reset-btn:hover {
  color: var(--color-accent, #e08e45);
  border-color: var(--color-accent, #e08e45);
}

.polaroid-media {
  width: 100%;
  border-radius: var(--radius-sm-squircle, 8px);
  corner-shape: squircle;
  overflow: hidden;
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
  flex-shrink: 0;
}

.polaroid-card.is-modified:not(:has(.polaroid-media)) .status-title-row {
  padding-right: 32px;
}

.polaroid-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5, 6px);
  min-width: 0;
  padding: 2px 2px 4px 2px;
}

.clear-btn {
  line-height: 1;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.status-location-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: 0;
}

.status-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  min-width: 0;
  max-width: 100%;
  width: 100%;
  min-height: 36px;
}

.status-coords-row {
  align-items: center;
}

.status-coords-row .status-row-icon {
  margin-top: 0;
}

.status-row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  min-width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 0;
}

.status-meta-display {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1-5, 6px);
  min-width: 0;
  max-width: 100%;
  flex: 1;
  min-height: 36px;
}

.status-meta-edit {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  width: 100%;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
}

.status-meta-row:has(.status-meta-edit) {
  align-items: center;
}

.status-meta-row:has(.status-meta-edit) .status-row-icon {
  margin-top: 0;
}

.inline-edit-input {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.inline-edit-btn {
  opacity: 0;
  pointer-events: none;
  padding: 2px 4px;
  flex-shrink: 0;
  align-self: center;
  margin-top: 0;
  transition: opacity 0.15s ease;
}

.status-meta-row:hover .inline-edit-btn,
.inline-edit-btn:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .inline-edit-btn {
    opacity: 0.85;
    pointer-events: auto;
  }
}

.inline-save-btn {
  padding: 2px 4px;
  flex-shrink: 0;
  color: var(--color-success, #2e7d32);
}

.status-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-address {
  font-size: 0.82rem;
  color: var(--color-text);
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-coords {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coords-clear-btn {
  color: var(--color-text-muted);
  padding: 2px 4px;
  flex-shrink: 0;
  align-self: center;
  margin-top: 0;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.status-coords-row:hover .coords-clear-btn,
.coords-clear-btn:focus-visible {
  opacity: 1;
}

.coords-clear-btn:hover {
  opacity: 1;
  color: var(--color-danger, #ef4444);
}

.sub-category-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}

.inline-category-combobox {
  min-width: 0;
  flex: 1;
  width: 100%;
  position: relative;
}

.inline-category-combobox:focus-within,
.inline-category-combobox:has(.open) {
  z-index: var(--z-popover, 1100);
}

.inline-category-combobox :deep(.combobox) {
  min-width: 0;
  width: 100%;
}

/* Map wrap & Mini map */
.map-wrap {
  position: relative;
  width: 100%;
}

.map-wrap:focus-within,
.map-wrap:has(.open),
.map-wrap:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

@media (min-width: 581px) {
  .polaroid-card {
    position: absolute;
    top: 68px;
    left: 12px;
    right: auto;
    width: 260px;
    max-width: calc(100% - 24px);
  }
}

@media (max-width: 580px) {
  .polaroid-card {
    position: absolute;
    top: 68px;
    left: 12px;
    right: 12px;
    width: auto;
    max-width: none;
    max-height: calc(100% - 80px);
    overflow-y: auto;
  }

  .has-polaroid .location-picker-map {
    height: 460px;
    min-height: 460px;
  }
}

.location-picker-map {
  position: relative;
  isolation: isolate;
  z-index: var(--z-canvas, 0);
  height: 380px;
  border-radius: var(--radius-md-squircle, 12px);
  corner-shape: squircle;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.has-polaroid .location-picker-map {
  height: 440px;
  min-height: 440px;
}

.map-tap-hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: var(--z-card-elevated, 5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: 4px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
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
  gap: 4px;
  margin: 0;
  font-size: 0.8rem;
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
