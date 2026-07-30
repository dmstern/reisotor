<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cachedEmojiPin } from '../utils/mapRoute';

// Manueller Fallback, falls weder clientseitiges Parsen noch die serverseitige Kurzlink-Auflösung
// (backend/src/utils/mapsLink.ts) Koordinaten liefern (z. B. wenn Google einen Maps-Kurzlink per
// Bot-Erkennung mit 403 blockt – siehe TripForm.vue/AccommodationView.vue/ExcursionsView.vue/
// TravelView.vue, die diese Komponente einbinden). Struktur an ExcursionMiniMap.vue angelehnt
// (eigenständige, lazy erzeugte Leaflet-Instanz, beim Unmount wieder abgebaut), aber MIT normaler
// Zoom-Kontrolle statt zoomControl:false, da hier tatsächlich zum präzisen Antippen gezoomt wird.
const props = defineProps<{
  modelValue: { lat: number; lng: number } | null;
  center?: { lat: number; lng: number };
  zoom?: number;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: { lat: number; lng: number } | null): void }>();

// Pragmatischer Default (weite Europa-Ansicht), falls weder ein Pin noch ein center-Prop vorliegt –
// relevant v. a. für TripForm.vue, das (anders als Spot/Unterkunft/Reise) keinen übergeordneten Ort
// hat, an dem sich die Startansicht orientieren könnte.
const FALLBACK_CENTER = { lat: 48.5, lng: 10 };
const FALLBACK_ZOOM = 4;

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let marker: L.Marker | null = null;
let resizeObserver: ResizeObserver | null = null;

function placeMarker(lat: number, lng: number) {
  if (!map) return;
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng], { icon: cachedEmojiPin('📍', '#e08e45') }).addTo(map);
  }
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;
  const initial = props.modelValue ?? props.center ?? FALLBACK_CENTER;
  const initialZoom = props.modelValue ? 15 : props.zoom ?? FALLBACK_ZOOM;
  map = L.map(mapEl.value).setView([initial.lat, initial.lng], initialZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);

  if (props.modelValue) placeMarker(props.modelValue.lat, props.modelValue.lng);

  map.on('click', (e: L.LeafletMouseEvent) => {
    placeMarker(e.latlng.lat, e.latlng.lng);
    emit('update:modelValue', { lat: e.latlng.lat, lng: e.latlng.lng });
  });

  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

// Zieht die Ansicht nicht weg, sobald bereits ein Pin gesetzt ist (z. B. wenn die Trip-Koordinaten,
// aus denen sich center für Spot-/Unterkunft-/Reise-Formulare ableitet, erst nach dem Mount
// asynchron nachladen) – nur relevant, solange der Nutzer noch keinen eigenen Punkt gewählt hat.
watch(
  () => props.center,
  (c) => {
    if (!map || props.modelValue || !c) return;
    map.setView([c.lat, c.lng], props.zoom ?? FALLBACK_ZOOM);
  },
);

function clear() {
  marker?.remove();
  marker = null;
  emit('update:modelValue', null);
}
</script>

<template>
  <div class="location-picker">
    <p class="hint">🗺️ Tippe auf die Karte, um den Standort zu setzen.</p>
    <div ref="mapEl" class="location-picker-map"></div>
    <p v-if="modelValue" class="hint success">
      📍 Standort gesetzt: {{ modelValue.lat.toFixed(5) }}, {{ modelValue.lng.toFixed(5) }}
      <button type="button" class="secondary clear-btn" @click="clear">Entfernen</button>
    </p>
  </div>
</template>

<style scoped>
.location-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.hint.success {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary-dark);
}

.clear-btn {
  padding: 2px 8px;
  font-size: 0.78rem;
}

.location-picker-map {
  height: 220px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
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
