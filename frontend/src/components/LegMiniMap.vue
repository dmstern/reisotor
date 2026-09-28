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
    coveredTopPx?: number;
    coveredBottomPx?: number;
  }>(),
  {
    fromSpot: null,
    toSpot: null,
    routes: () => [],
    selectedRouteIndex: 0,
    transportType: 'Auto',
    routeDisplayMode: 'exact',
    coveredTopPx: 0,
    coveredBottomPx: 0,
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

function getCoveredOffsets(): { coveredTopPx: number; coveredBottomPx: number } {
  if (props.coveredTopPx || props.coveredBottomPx) {
    return {
      coveredTopPx: props.coveredTopPx ?? 0,
      coveredBottomPx: props.coveredBottomPx ?? 0,
    };
  }

  if (mapEl.value) {
    const container = mapEl.value.closest('.route-calc-map-wrap') || mapEl.value.parentElement;
    if (container) {
      const mapRect = mapEl.value.getBoundingClientRect();
      const topEl = container.querySelector<HTMLElement>('.route-floating-top');
      const bottomEl = container.querySelector<HTMLElement>('.route-floating-bottom');

      let coveredTopPx = 0;
      let coveredBottomPx = 0;

      if (topEl) {
        const topRect = topEl.getBoundingClientRect();
        if (topRect.height > 0) {
          coveredTopPx = Math.max(0, topRect.bottom - mapRect.top);
        }
      }

      if (bottomEl) {
        const bottomRect = bottomEl.getBoundingClientRect();
        if (bottomRect.height > 0) {
          coveredBottomPx = Math.max(0, mapRect.bottom - bottomRect.top);
        }
      }

      if (coveredTopPx > 0 || coveredBottomPx > 0) {
        return { coveredTopPx, coveredBottomPx };
      }
    }
  }

  // Fallback für Tests (jsdom liefert 0 für getBoundingClientRect) und initiales Rendern:
  // Top: SegmentedToggle (~38px) + Offset (10px) = ~48px
  // Bottom: Single Route Card (~46px) + Footer (~20px) + Offset (10px) = ~76px
  return { coveredTopPx: 48, coveredBottomPx: 76 };
}

async function render() {
  await nextTick();
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
  let selectedRouteCoords: [number, number][] = [];

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
        selectedRouteCoords = selected.coordinates as [number, number][];
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
    const arc = arcPoints(s1, s2);
    L.polyline(arc, {
      color: getRouteColor(props.transportType),
      weight: 3,
      opacity: 0.65,
      dashArray: '6 6',
      className: 'direct-line-polyline',
    }).addTo(routesLayer);
    boundsPoints.push(...arc);
  }

  // Gesamte Bounding Box ermitteln
  let fullBounds: L.LatLngBounds | null = null;
  if (boundsPoints.length > 0) {
    fullBounds = L.latLngBounds(boundsPoints);
  }
  if (selectedRouteCoords.length > 0) {
    const routeBounds = L.latLngBounds(selectedRouteCoords);
    fullBounds = fullBounds ? fullBounds.extend(routeBounds) : routeBounds;
  }

  const { coveredTopPx, coveredBottomPx } = getCoveredOffsets();

  // Kartenausschnitt anpassen auf den tatsächlich sichtbaren Bereich
  if (
    fullBounds &&
    fullBounds.isValid() &&
    (boundsPoints.length > 1 || selectedRouteCoords.length > 0)
  ) {
    try {
      map.fitBounds(fullBounds, {
        paddingTopLeft: [20, 20 + coveredTopPx],
        paddingBottomRight: [20, 20 + coveredBottomPx],
        maxZoom: 16,
        animate: false,
      });
    } catch {
      // Ignoriere FitBounds-Fehler bei identischen Koordinaten
    }
  } else if (boundsPoints.length === 1) {
    if (
      (!coveredTopPx && !coveredBottomPx) ||
      typeof map.project !== 'function' ||
      typeof map.unproject !== 'function'
    ) {
      map.setView(boundsPoints[0], 14, { animate: false });
    } else {
      const targetPoint = map.project(boundsPoints[0], 14);
      const shiftedCenter = map.unproject(
        targetPoint.add([0, (coveredBottomPx - coveredTopPx) / 2]),
        14
      );
      map.setView(shiftedCenter, 14, { animate: false });
    }
  }
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;

  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: false,
    rotateControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  routesLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  render();

  if (typeof ResizeObserver !== 'undefined' && mapEl.value) {
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize();
      render();
    });
    resizeObserver.observe(mapEl.value);

    const container = mapEl.value.closest('.route-calc-map-wrap');
    const bottomEl = container?.querySelector('.route-floating-bottom');
    if (bottomEl) {
      resizeObserver.observe(bottomEl);
    }
  }

  setTimeout(() => {
    map?.invalidateSize();
    render();
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
    () => props.coveredTopPx,
    () => props.coveredBottomPx,
  ],
  render,
  { deep: true }
);

defineExpose({
  render,
  invalidateSize: () => map?.invalidateSize(),
});
</script>

<template>
  <div class="leg-mini-map-wrap">
    <div ref="mapEl" class="leg-mini-map" data-testid="leg-mini-map"></div>
  </div>
</template>

<style scoped>
.leg-mini-map-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  z-index: var(--z-canvas, 0);
}

.leg-mini-map {
  height: 380px;
  width: 100%;
  background: var(--color-surface-subtle, var(--color-hover));
}

@media (max-width: 480px) {
  .leg-mini-map {
    height: 400px;
  }
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
