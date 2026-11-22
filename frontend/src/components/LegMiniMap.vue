<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot, RouteResult } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { arcPoints, cachedEmojiPin, getRouteColor } from '../utils/mapRoute';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useMobileMapLock } from '../composables/useMobileMapLock';
import Button from './primitives/Button.vue';

const props = withDefaults(
  defineProps<{
    fromSpot?: Spot | null;
    toSpot?: Spot | null;
    routes?: RouteResult[];
    selectedRouteIndex?: number;
    transportType?: string;
    routeDisplayMode?: 'exact' | 'direct';
    coveredTopPx?: number;
    coveredLeftPx?: number;
  }>(),
  {
    fromSpot: null,
    toSpot: null,
    routes: () => [],
    selectedRouteIndex: 0,
    transportType: 'Auto',
    routeDisplayMode: 'exact',
    coveredTopPx: 0,
    coveredLeftPx: 0,
  }
);

const emit = defineEmits<{
  (e: 'select-route', index: number): void;
}>();

const DESKTOP_CARD_FALLBACK_WIDTH_PX = 272;

const mapEl = ref<HTMLDivElement | null>(null);
let map: leaflet.Map | null = null;
let markersLayer: leaflet.LayerGroup | null = null;
let routesLayer: leaflet.LayerGroup | null = null;
let resizeObserver: ResizeObserver | null = null;

const {
  isExpanded: isMapExpanded,
  isMobileLayout,
  syncInteractivity,
  toggleExpanded,
} = useMobileMapLock({ getMap: () => map, containerEl: mapEl });

function onToggleExpanded() {
  toggleExpanded();
  nextTick(() => {
    map?.invalidateSize();
    render();
  });
}

function getCoveredOffsets(): { coveredTopPx: number; coveredLeftPx: number } {
  if (props.coveredTopPx || props.coveredLeftPx) {
    return {
      coveredTopPx: props.coveredTopPx ?? 0,
      coveredLeftPx: props.coveredLeftPx ?? 0,
    };
  }

  // Auf Mobile ist die Card im gestapelten Layout und überdeckt die Karte nicht mehr.
  if (isMobileLayout()) {
    return { coveredTopPx: 0, coveredLeftPx: 0 };
  }

  const container = mapEl.value?.closest('.route-calc-map-wrap');
  const cardEl = container?.querySelector<HTMLElement>('.route-floating-card');

  if (mapEl.value && cardEl) {
    const cardRect = cardEl.getBoundingClientRect();
    const mapRect = mapEl.value.getBoundingClientRect();

    if (cardRect.height > 0 || cardRect.width > 0) {
      // Auf Desktop überdeckt die Card die linke Seite der Karte.
      // Sichtbar ist der Bereich rechts von der Card.
      return { coveredTopPx: 0, coveredLeftPx: Math.max(0, cardRect.right - mapRect.left) };
    }
  }

  // Fallback für Tests (jsdom liefert 0 für getBoundingClientRect) und initiales Rendern:
  return { coveredTopPx: 0, coveredLeftPx: DESKTOP_CARD_FALLBACK_WIDTH_PX };
}

async function render() {
  await nextTick();

  if (!map || !markersLayer || !routesLayer) {
    return;
  }

  markersLayer.clearLayers();
  routesLayer.clearLayers();

  const boundsPoints: leaflet.LatLngExpression[] = [];

  // Start-Spot Marker
  if (props.fromSpot?.lat != null && props.fromSpot?.lng != null) {
    const latlng: [number, number] = [props.fromSpot.lat, props.fromSpot.lng];
    boundsPoints.push(latlng);
    const cat = spotCategoryMeta(props.fromSpot.category);
    const marker = leaflet
      .marker(latlng, {
        icon: cachedEmojiPin(cat.tabler, cat.color),
      })
      .addTo(markersLayer);

    if (props.fromSpot.title) {
      marker.bindTooltip(`Start: ${props.fromSpot.title}`, { direction: 'top', offset: [0, -28] });
    }
  }

  // Ziel-Spot Marker
  if (props.toSpot?.lat != null && props.toSpot?.lng != null) {
    const latlng: [number, number] = [props.toSpot.lat, props.toSpot.lng];
    boundsPoints.push(latlng);
    const cat = spotCategoryMeta(props.toSpot.category);
    const marker = leaflet
      .marker(latlng, {
        icon: cachedEmojiPin(cat.tabler, cat.color),
      })
      .addTo(markersLayer);

    if (props.toSpot.title) {
      marker.bindTooltip(`Ziel: ${props.toSpot.title}`, { direction: 'top', offset: [0, -28] });
    }
  }

  // Routen zeichnen
  const isExactMode = props.routeDisplayMode === 'exact';
  let selectedRouteCoords: [number, number][] = [];

  if (isExactMode && props.routes && props.routes.length > 0) {
    // 1. Zuerst alternative (nicht ausgewählte) Routen dezent im Hintergrund zeichnen
    props.routes.forEach((route, idx) => {
      if (idx === props.selectedRouteIndex) {
        return;
      }

      const poly = leaflet
        .polyline(route.coordinates, {
          color: '#94a3b8',
          weight: 4,
          opacity: 0.65,
          className: 'alternative-route-polyline',
        })
        .addTo(routesLayer!);

      // Klick auf eine Alternativ-Linie auf der Karte wählt diese Route aus
      poly.on('click', () => {
        emit('select-route', idx);
      });
      poly.bindTooltip(`Alternative ${idx + 1} auswählen`, { sticky: true });
    });

    // 2. Aktive/Ausgewählte Route im Vordergrund mit kräftiger Farbe zeichnen
    const selected = props.routes[props.selectedRouteIndex];

    if (selected) {
      const activePoly = leaflet
        .polyline(selected.coordinates, {
          color: getRouteColor(props.transportType, selected.profile),
          weight: 5,
          opacity: 0.95,
          className: 'active-route-polyline',
        })
        .addTo(routesLayer!);
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
    leaflet
      .polyline(arc, {
        color: getRouteColor(props.transportType),
        weight: 3,
        opacity: 0.65,
        dashArray: '6 6',
        className: 'direct-line-polyline',
      })
      .addTo(routesLayer);
    boundsPoints.push(...arc);
  }

  // Gesamte Bounding Box ermitteln
  let fullBounds: leaflet.LatLngBounds | null = null;

  if (boundsPoints.length > 0) {
    fullBounds = leaflet.latLngBounds(boundsPoints);
  }

  if (selectedRouteCoords.length > 0) {
    const routeBounds = leaflet.latLngBounds(selectedRouteCoords);
    fullBounds = fullBounds ? fullBounds.extend(routeBounds) : routeBounds;
  }

  const { coveredTopPx, coveredLeftPx } = getCoveredOffsets();
  let adjustedCoveredLeftPx = coveredLeftPx;

  if (map?.getSize && map.getSize().x > 0) {
    adjustedCoveredLeftPx = Math.min(adjustedCoveredLeftPx, Math.max(0, map.getSize().x - 80));
  }

  // Kartenausschnitt anpassen auf den tatsächlich sichtbaren Bereich
  if (
    fullBounds &&
    fullBounds.isValid() &&
    (boundsPoints.length > 1 || selectedRouteCoords.length > 0)
  ) {
    try {
      map.fitBounds(fullBounds, {
        paddingTopLeft: [20 + adjustedCoveredLeftPx, 20 + coveredTopPx],
        paddingBottomRight: [20, 20],
        maxZoom: 16,
        animate: false,
      });
    } catch {
      // Ignoriere FitBounds-Fehler bei identischen Koordinaten
    }
  } else if (boundsPoints.length === 1) {
    if (
      (!coveredTopPx && !adjustedCoveredLeftPx) ||
      typeof map.project !== 'function' ||
      typeof map.unproject !== 'function'
    ) {
      map.setView(boundsPoints[0], 14, { animate: false });
    } else {
      const targetPoint = map.project(boundsPoints[0], 14);
      const shiftedCenter = map.unproject(
        targetPoint.add([-adjustedCoveredLeftPx / 2, -coveredTopPx / 2]),
        14
      );
      map.setView(shiftedCenter, 14, { animate: false });
    }
  }
}

onMounted(async () => {
  await nextTick();

  if (!mapEl.value) {
    return;
  }

  map = leaflet.map(mapEl.value, {
    zoomControl: false,
    attributionControl: false,
    rotateControl: false,
  });
  leaflet
    .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
    .addTo(map);
  routesLayer = leaflet.layerGroup().addTo(map);
  markersLayer = leaflet.layerGroup().addTo(map);
  syncInteractivity();

  render();

  if (typeof ResizeObserver !== 'undefined' && mapEl.value) {
    resizeObserver = new ResizeObserver(() => {
      syncInteractivity();
      map?.invalidateSize();
      render();
    });
    resizeObserver.observe(mapEl.value);

    const container = mapEl.value.closest('.route-calc-map-wrap');
    const cardEl = container?.querySelector('.route-floating-card');

    if (cardEl) {
      resizeObserver.observe(cardEl);
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
    () => props.coveredLeftPx,
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
  <div class="leg-mini-map-wrap" :class="{ 'is-map-expanded': isMapExpanded }">
    <div ref="mapEl" class="leg-mini-map" data-testid="leg-mini-map"></div>

    <!-- Nur auf Mobile sichtbar: Karte bewusst zum Zoomen/Verschieben freigeben -->
    <Button
      :variant="isMapExpanded ? 'primary' : 'overlay'"
      shape="pill"
      size="xs"
      class="leg-map-expand-btn"
      :aria-expanded="isMapExpanded"
      :icon="isMapExpanded ? ACTION_ICONS.done : ACTION_ICONS.maximize"
      data-testid="leg-map-expand-btn"
      @click.stop="onToggleExpanded"
    >
      {{ isMapExpanded ? 'Fertig' : 'Karte bedienen' }}
    </Button>
  </div>
</template>

<style scoped lang="scss">
$leg-map-preview-height: 180px;
$leg-map-expanded-height: 320px;

.leg-mini-map-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  z-index: var(--z-canvas, 0);
}

.leg-mini-map {
  height: 420px;
  width: 100%;
  background: var(--color-hover);
}

.leg-map-expand-btn {
  display: none;
}

@include container-down('tablet-sm') {
  .leg-mini-map {
    height: $leg-map-preview-height;
    touch-action: pan-y;
  }

  .is-map-expanded .leg-mini-map {
    height: $leg-map-expanded-height;
    touch-action: auto;
  }

  .leg-map-expand-btn {
    display: inline-flex;
    position: absolute;
    bottom: 12px;
    left: 12px;
    z-index: var(--z-fab, 120);
  }
}
</style>

<style>
/* Imperatives Third-Party-DOM (Leaflet):
   Leaflet erzeugt SVG-Pfade und Tile-Container dynamisch per JS außerhalb des Vue-Scoped-CSS.
   Daher werden diese Selektoren isoliert unter .leg-mini-map ungescopt definiert. */
.leg-mini-map .alternative-route-polyline {
  cursor: pointer;
  transition:
    stroke var(--transition-fast, 0.15s ease),
    stroke-width var(--transition-fast, 0.15s ease);
}

.leg-mini-map .alternative-route-polyline:hover {
  stroke: var(--color-text-muted);
  stroke-width: 6;
}

.leg-mini-map .active-route-polyline {
  pointer-events: none;
}

:root[data-theme='dark'] .leg-mini-map .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .leg-mini-map .leaflet-tile-pane {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}
</style>
