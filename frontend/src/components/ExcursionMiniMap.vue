<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ExcursionStation } from '../utils/excursionStations';
import type { ExcursionLeg } from '../api/types';
import {
  arcPoints,
  arcRoute,
  cachedEmojiPin,
  getRouteColor,
  parseRouteGeometry,
} from '../utils/mapRoute';

// Kleine, eigenständige Leaflet-Instanz für den Ausflug-Detail-Dialog – bewusst lazy erzeugt (erst
// beim Mounten des Dialogs) und beim Schließen wieder mit map.remove() abgebaut (Pi-2-Ressourcen-
// Rücksicht), statt dauerhaft im Hintergrund zu laufen wie die große Karte (TripMap.vue). Der
// Aufrufer liefert bereits gefilterte (lat/lng gesetzt) und in Besuchsreihenfolge sortierte
// Stationen (nicht zwingend echte Spots, siehe utils/excursionStations.ts).
const props = defineProps<{
  stations: ExcursionStation[];
  routeColor?: string;
  legs?: ExcursionLeg[];
}>();

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
    L.marker(latlng, { icon: cachedEmojiPin(station.tabler, station.color) }).addTo(markersLayer);
  }

  for (let i = 0; i < props.stations.length - 1; i++) {
    const s1 = props.stations[i];
    const s2 = props.stations[i + 1];
    if (s1.lat == null || s1.lng == null || s2.lat == null || s2.lng == null) continue;

    const leg = props.legs?.find(
      (l) => l.position === i || (l.from_spot_id === s1.id && l.to_spot_id === s2.id)
    );
    const geometryCoords = parseRouteGeometry(leg?.route_geometry);

    if (geometryCoords) {
      L.polyline(geometryCoords, {
        color: props.routeColor ?? getRouteColor(leg?.transport_type, leg?.routing_profile),
        weight: 3,
        opacity: 0.85,
      }).addTo(routesLayer);
    } else {
      L.polyline(arcPoints([s1.lat, s1.lng], [s2.lat, s2.lng]), {
        color: props.routeColor ?? getRouteColor(leg?.transport_type, leg?.routing_profile),
        weight: 3,
        opacity: 0.65,
        dashArray: '6 6',
      }).addTo(routesLayer);
    }
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
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
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
