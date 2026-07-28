<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ExcursionStation } from '../utils/excursionStations';
import { arcRoute, cachedEmojiPin } from '../utils/mapRoute';

// Kleine, eigenständige Leaflet-Instanz für den Ausflug-Detail-Dialog – bewusst lazy erzeugt (erst
// beim Mounten des Dialogs) und beim Schließen wieder mit map.remove() abgebaut (Pi-2-Ressourcen-
// Rücksicht), statt dauerhaft im Hintergrund zu laufen wie die große Karte (TripMap.vue). Der
// Aufrufer liefert bereits gefilterte (lat/lng gesetzt) und in Besuchsreihenfolge sortierte
// Stationen (nicht zwingend echte Spots, siehe utils/excursionStations.ts).
const props = defineProps<{ stations: ExcursionStation[]; routeColor?: string }>();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let routesLayer: L.LayerGroup | null = null;
let resizeObserver: ResizeObserver | null = null;

function render() {
  if (!map || !markersLayer || !routesLayer) return;
  markersLayer.clearLayers();
  routesLayer.clearLayers();

  const coords: L.LatLngExpression[] = [];
  for (const station of props.stations) {
    if (station.lat == null || station.lng == null) continue;
    const latlng: L.LatLngExpression = [station.lat, station.lng];
    coords.push(latlng);
    L.marker(latlng, { icon: cachedEmojiPin(station.icon, station.color) }).addTo(markersLayer);
  }

  if (coords.length >= 2) {
    L.polyline(arcRoute(coords), {
      color: props.routeColor ?? '#e08e45',
      weight: 3,
      opacity: 0.65,
      dashArray: '6 6',
    }).addTo(routesLayer);
  }

  if (coords.length > 1) {
    map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
  } else if (coords.length === 1) {
    map.setView(coords[0], 14);
  }
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;
  map = L.map(mapEl.value, { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  routesLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  render();

  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

watch(() => props.stations, render, { deep: true });
</script>

<template>
  <div ref="mapEl" class="mini-map"></div>
</template>

<style scoped>
.mini-map {
  height: 180px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

:root[data-theme='dark'] .mini-map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .mini-map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}
</style>
