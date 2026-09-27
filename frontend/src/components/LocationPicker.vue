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
import Badge from './primitives/Badge.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
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
    /** Adresse oder Ortsbezeichnung (v-model:address). */
    address?: string;
    /** Maps-Link (v-model:mapsLink). */
    mapsLink?: string;
    /** Proximity-Bias-Koordinaten für die POI-/Adress-Suche (z. B. Urlaubsziel). */
    proximityBias?: { lat: number; lng: number } | null;
    /** Platzhaltertext für das kombinierte Suchfeld. */
    placeholder?: string;
    /** Rückwärtskompatibilität: Initiale Zentrierung der Mini-Karte falls modelValue noch null. */
    center?: { lat: number; lng: number };
    /** Zoom-Stufe. */
    zoom?: number;
    /** Zusätzliche Orientierungspunkte im Umkreis. */
    referencePoints?: { lat: number; lng: number; icon?: IconDef }[];
  }>(),
  {
    address: '',
    mapsLink: '',
    proximityBias: null,
    placeholder: undefined,
    zoom: undefined,
    center: undefined,
    referencePoints: () => [],
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: { lat: number; lng: number } | null): void;
  (e: 'update:address', value: string): void;
  (e: 'update:mapsLink', value: string): void;
  (e: 'select', place: PlaceSearchResult): void;
  (e: 'clear'): void;
}>();

// --- Input & Search Autocomplete State ---
const inputText = ref('');
const isSearching = ref(false);
const isOpen = ref(false);
const results = ref<PlaceSearchResult[]>([]);
const activeIndex = ref(-1);
const selectedPlace = ref<PlaceSearchResult | null>(null);
const shortlinkDetected = ref(false);

const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return props.modelValue
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
    if (link && !inputText.value && !props.modelValue) {
      inputText.value = link;
    }
  },
  { immediate: true }
);

watch(
  () => props.address,
  (addr) => {
    if (addr && !inputText.value && !props.modelValue && !props.mapsLink) {
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

const displayTitle = computed(() => {
  if (selectedPlace.value?.name) return selectedPlace.value.name;
  if (props.address) return props.address;
  return '';
});

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
      const coords = { lat: latlng.lat, lng: latlng.lng };
      selectedPlace.value = null;
      emit('update:modelValue', coords);
      emit('update:mapsLink', buildOsmLink(coords.lat, coords.lng));
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
      const coords = { lat: latitude, lng: longitude };
      placeMarker(latitude, longitude);
      map?.setView([latitude, longitude], 16);
      selectedPlace.value = null;
      emit('update:modelValue', coords);
      emit('update:mapsLink', buildOsmLink(latitude, longitude));
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
  selectedPlace.value = place;
  inputText.value = place.name;
  isOpen.value = false;
  results.value = [];
  activeIndex.value = -1;

  const coords = { lat: place.lat, lng: place.lng };
  placeMarker(coords.lat, coords.lng);
  map?.setView([coords.lat, coords.lng], 16);

  emit('update:modelValue', coords);
  emit('update:address', place.formatted_address || place.address || place.name);
  emit('update:mapsLink', buildGoogleMapsLink(coords.lat, coords.lng));
  emit('select', place);
}

function clear() {
  inputText.value = '';
  selectedPlace.value = null;
  isOpen.value = false;
  results.value = [];
  activeIndex.value = -1;
  shortlinkDetected.value = false;

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

  emit('update:modelValue', null);
  emit('update:address', '');
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

function onBlur() {
  window.setTimeout(() => {
    isOpen.value = false;
  }, 200);
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

  map = L.map(mapEl.value, {}).setView([initial.lat, initial.lng], initialZoom);
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
    const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
    placeMarker(coords.lat, coords.lng);
    selectedPlace.value = null;
    emit('update:modelValue', coords);
    emit('update:mapsLink', buildOsmLink(coords.lat, coords.lng));
  });

  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
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
</script>

<template>
  <div class="location-picker">
    <!-- 1. Kombinierte Steuerungsbox für Standort & Suche -->
    <div class="location-control-box" :class="{ 'has-location': !!modelValue }">
      <!-- Visuelle Status-Details ("Standort gesetzt") -->
      <div v-if="modelValue" class="location-status hint success" data-testid="location-status">
        <div class="status-header">
          <Badge variant="success" size="sm" class="status-badge">
            <AppIcon :icon="FORM_FIELD_ICONS.location" :size="12" group="formFields" />
            Standort gesetzt
          </Badge>
          <Button variant="secondary" size="sm" class="clear-btn" type="button" @click="clear">
            Entfernen
          </Button>
        </div>
        <div class="status-details">
          <span v-if="displayTitle" class="status-title">{{ displayTitle }}</span>
          <span class="status-coords">
            {{ modelValue.lat.toFixed(5) }}, {{ modelValue.lng.toFixed(5) }}
          </span>
        </div>
      </div>

      <!-- Einheitliches Such- und Link-Eingabefeld -->
      <div
        class="location-search-wrap"
        :class="{ 'is-loading': isSearching, loading: isSearching }"
        :aria-busy="isSearching"
      >
        <Input
          :model-value="inputText"
          class="location-picker-input"
          type="text"
          :placeholder="computedPlaceholder"
          aria-label="Standort suchen oder Maps-Link einfügen"
          autocomplete="off"
          @update:model-value="handleInput"
          @keydown="onKeydown"
          @focus="onFocus"
          @blur="onBlur"
        />
        <LoadingSpinner v-if="isSearching" size="sm" class="spinner input-spinner" />

        <!-- Autocomplete Dropdown List -->
        <Transition name="dropdown-unfold">
          <ul
            v-if="isOpen && (results.length > 0 || (!isSearching && inputText.trim().length >= 2))"
            class="location-dropdown options"
            role="listbox"
            aria-label="Suchergebnisse"
          >
            <li
              v-if="!isSearching && results.length === 0"
              role="status"
              class="location-result-empty"
            >
              <AppIcon :icon="ACTION_ICONS.warning" :size="16" group="actions" class="item-icon" />
              <div class="location-empty-content">
                <span class="empty-title">Kein passender Ort gefunden</span>
                <span class="empty-desc">
                  Du kannst den Titel unten manuell eingeben oder direkt auf die Karte tippen.
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
                  <Badge
                    v-if="place.category"
                    variant="default"
                    size="sm"
                    class="location-category-badge"
                  >
                    {{ place.category }}
                  </Badge>
                </div>
                <span class="location-item-address">{{
                  place.formatted_address || place.address
                }}</span>
              </div>
            </li>
          </ul>
        </Transition>
      </div>
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

    <!-- 3. Mini-Karte -->
    <div class="map-wrap">
      <div ref="mapEl" class="location-picker-map"></div>
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

    <p v-if="!modelValue" class="hint">
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
      Tippe auf die Karte, um den Standort zu setzen.
    </p>
  </div>
</template>

<style scoped>
.location-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  position: relative;
}

.location-control-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  position: relative;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.location-control-box.has-location {
  padding: var(--space-3, 12px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 8px);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
  gap: var(--space-2-5, 10px);
}

@media (min-width: 580px) {
  .location-control-box.has-location {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 12px);
  }

  .location-control-box.has-location .location-status {
    flex: 1;
    min-width: 0;
  }

  .location-control-box.has-location .location-search-wrap {
    flex: 1.15;
    min-width: 0;
  }
}

.location-search-wrap {
  position: relative;
  width: 100%;
}

.location-picker-input,
.location-search-wrap :deep(.input) {
  width: 100%;
  box-sizing: border-box;
}

.input-spinner {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.location-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1100;
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

/* Status Info inside Control Box */
.location-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin: 0;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2, 8px);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.clear-btn {
  padding: 2px 8px;
  font-size: 0.78rem;
  line-height: 1.2;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.status-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-coords {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Map wrap & Mini map */
.map-wrap {
  position: relative;
  isolation: isolate;
  z-index: 0;
}

.location-picker-map {
  height: 220px;
  border-radius: var(--radius-sm-squircle, 8px);
  corner-shape: squircle;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.locate-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
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
  align-items: center;
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
