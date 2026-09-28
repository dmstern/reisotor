<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot, RouteResult } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { arcPoints, cachedEmojiPin, getRouteColor } from '../utils/mapRoute';

const props = withDefaults(
  defineProps<{
    fromSpot?: Spot | null;
    toSpot?: Spot | null;
    routes?: RouteResult[];
    selectedRouteIndex?: number;
    transportType?: string;
    routeDisplayMode?: 'exact' | 'direct';
  }>(),
  {
    fromSpot: null,
    toSpot: null,
    routes: () => [],
    selectedRouteIndex: 0,
    transportType: 'Auto',
    routeDisplayMode: 'exact',
  }
);

const emit = defineEmits<{
  (e: 'select-route', index: number): void;
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

  const boundsPoints: L.LatLngExpression[] = [];

  // Start-Spot Marker
  if (props.fromSpot?.lat != null && props.fromSpot?.lng != null) {
    const latlng: [number, number] = [props.fromSpot.lat, props.fromSpot.lng];
    boundsPoints.push(latlng);
    const cat = spotCategoryMeta(props.fromSpot.category);
    const m = L.marker(latlng, {
      icon: cachedEmojiPin(cat.tabler, cat.color),
    }).addTo(markersLayer);
    if (props.fromSpot.title) {
      m.bindTooltip(`Start: ${props.fromSpot.title}`, { direction: 'top', offset: [0, -28] });
    }
  }

  // Ziel-Spot Marker
  if (props.toSpot?.lat != null && props.toSpot?.lng != null) {
    const latlng: [number, number] = [props.toSpot.lat, props.toSpot.lng];
    boundsPoints.push(latlng);
    const cat = spotCategoryMeta(props.toSpot.category);
    const m = L.marker(latlng, {
      icon: cachedEmojiPin(cat.tabler, cat.color),
    }).addTo(markersLayer);
    if (props.toSpot.title) {
      m.bindTooltip(`Ziel: ${props.toSpot.title}`, { direction: 'top', offset: [0, -28] });
    }
  }

  // Routen zeichnen
  const isExactMode = props.routeDisplayMode === 'exact';
  if (isExactMode && props.routes && props.routes.length > 0) {
    // 1. Zuerst alternative (nicht ausgewählte) Routen dezent im Hintergrund zeichnen
    props.routes.forEach((r, idx) => {
      if (idx === props.selectedRouteIndex) return;
      const poly = L.polyline(r.coordinates, {
        color: '#94a3b8',
        weight: 4,
        opacity: 0.65,
        className: 'alternative-route-polyline',
      }).addTo(routesLayer!);

      // Klick auf eine Alternativ-Linie auf der Karte wählt diese Route aus
      poly.on('click', () => {
        emit('select-route', idx);
      });
      poly.bindTooltip(`Alternative ${idx + 1} auswählen`, { sticky: true });

      if (r.coordinates.length) {
        boundsPoints.push(r.coordinates[0]);
        boundsPoints.push(r.coordinates[Math.floor(r.coordinates.length / 2)]);
        boundsPoints.push(r.coordinates[r.coordinates.length - 1]);
      }
    });

    // 2. Aktive/Ausgewählte Route im Vordergrund mit kräftiger Farbe zeichnen
    const selected = props.routes[props.selectedRouteIndex];
    if (selected) {
      const activePoly = L.polyline(selected.coordinates, {
        color: getRouteColor(props.transportType, selected.profile),
        weight: 5,
        opacity: 0.95,
        className: 'active-route-polyline',
      }).addTo(routesLayer!);
      activePoly.bringToFront();

      if (selected.coordinates.length) {
        boundsPoints.push(selected.coordinates[0]);
        boundsPoints.push(selected.coordinates[Math.floor(selected.coordinates.length / 2)]);
        boundsPoints.push(selected.coordinates[selected.coordinates.length - 1]);
      }
    }
  } else if (
    props.fromSpot?.lat != null &&
    props.fromSpot?.lng != null &&
    props.toSpot?.lat != null &&
    props.toSpot?.lng != null
  ) {
    // Gestrichelte Luftlinie
    const s1: [number, number] = [props.fromSpot.lat, props.fromSpot.lng];
    const s2: [number, number] = [props.toSpot.lat, props.toSpot.lng];
    L.polyline(arcPoints(s1, s2), {
      color: getRouteColor(props.transportType),
      weight: 3,
      opacity: 0.65,
      dashArray: '6 6',
      className: 'direct-line-polyline',
    }).addTo(routesLayer);
  }

  // Kartenausschnitt anpassen
  if (boundsPoints.length > 1) {
    try {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [24, 24] });
    } catch {
      // Ignoriere FitBounds-Fehler bei identischen Koordinaten
    }
  } else if (boundsPoints.length === 1) {
    map.setView(boundsPoints[0], 14);
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

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize();
    });
    resizeObserver.observe(mapEl.value);
  }

  // Kurzer verzögerter Aufruf zur sicheren Größenberechnung nach Rendern des Modals
  setTimeout(() => {
    map?.invalidateSize();
  }, 100);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

watch(
  [
    () => props.fromSpot,
    () => props.toSpot,
    () => props.routes,
    () => props.selectedRouteIndex,
    () => props.routeDisplayMode,
    () => props.transportType,
  ],
  render,
  { deep: true }
);
</script>

<template>
  <div class="leg-mini-map-wrap">
    <div ref="mapEl" class="leg-mini-map" data-testid="leg-mini-map"></div>
  </div>
</template>

<style scoped>
.leg-mini-map-wrap {
  width: 100%;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.leg-mini-map {
  height: 180px;
  width: 100%;
  background: var(--color-surface-subtle, var(--color-hover));
}

:deep(.alternative-route-polyline) {
  cursor: pointer;
  transition:
    stroke 0.15s ease,
    stroke-width 0.15s ease;
}

:deep(.alternative-route-polyline:hover) {
  stroke: #64748b;
  stroke-width: 6;
}

:deep(.active-route-polyline) {
  pointer-events: none;
}

:root[data-theme='dark'] .leg-mini-map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .leg-mini-map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}
</style>
