import { getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IconCompass, IconCompassFilled } from '@tabler/icons-vue';
import { cachedEmojiPin, LEAFLET_ATTRIBUTION_PREFIX, pulsingEmojiPin } from '../utils/mapRoute';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { IconDef } from '../utils/icon';

export const OWN_LOCATION_ICON: IconDef = {
  id: 'compass',
  emoji: '🧭',
  outline: IconCompass,
  filled: IconCompassFilled,
};

export const FALLBACK_CENTER = { lat: 48.5, lng: 10 };
export const FALLBACK_ZOOM = 4;

export interface UseLocationPickerMapOptions {
  mapEl: Ref<HTMLDivElement | null>;
  polaroidCardEl: Ref<HTMLDivElement | null>;
  modelValue: Ref<{ lat: number; lng: number } | null | undefined>;
  proximityBias?: Ref<{ lat: number; lng: number } | null | undefined>;
  center?: Ref<{ lat: number; lng: number } | undefined>;
  zoom?: Ref<number | undefined>;
  referencePoints?: Ref<{ lat: number; lng: number; icon?: IconDef }[] | undefined>;
  isDetailsVisible: Ref<boolean>;
  hasMediaSlot: Ref<boolean>;
  onManualCoordsSet: (coords: { lat: number; lng: number }) => void;
}

export function useLocationPickerMap(options: UseLocationPickerMapOptions) {
  let map: L.Map | null = null;
  let marker: L.Marker | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let referenceLayer: L.LayerGroup | null = null;
  let ownLocationMarker: L.Marker | null = null;
  let geoWatchId: number | null = null;
  const locatingSelf = ref(false);
  const locateError = ref(false);
  let isInternalCoordChange = false;

  function markInternalCoordChange() {
    isInternalCoordChange = true;
  }

  function getCoveredOffsets(): { coveredTopPx: number; coveredLeftPx: number } {
    if (!options.isDetailsVisible.value) {
      return { coveredTopPx: 0, coveredLeftPx: 0 };
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 580;
    if (options.polaroidCardEl.value && options.mapEl.value) {
      const cardRect = options.polaroidCardEl.value.getBoundingClientRect();
      const mapRect = options.mapEl.value.getBoundingClientRect();

      if (cardRect.height > 0 || cardRect.width > 0) {
        if (isMobile) {
          // Auf Mobile überdeckt die Card den oberen Bereich der Karte.
          // Sichtbar ist der Bereich unterhalb der Card bis zum unteren Kartenrand.
          const coveredTopPx = Math.max(0, cardRect.bottom - mapRect.top);
          return { coveredTopPx, coveredLeftPx: 0 };
        } else {
          // Auf Desktop überdeckt die Card die linke Seite der Karte.
          // Sichtbar ist der Bereich rechts von der Card.
          const coveredLeftPx = Math.max(0, cardRect.right - mapRect.left);
          return { coveredTopPx: 0, coveredLeftPx };
        }
      }
    }

    // Fallbacks falls noch nicht gerendert oder in Testumgebungen ohne Layout-Geometrie:
    if (isMobile) {
      return { coveredTopPx: options.hasMediaSlot.value ? 440 : 240, coveredLeftPx: 0 };
    }
    return { coveredTopPx: 0, coveredLeftPx: 272 };
  }

  function centerOnPoint(latlng: L.LatLngExpression, zoom?: number) {
    if (!map) return;
    const targetZoom = zoom ?? (map.getZoom ? map.getZoom() : 15) ?? 15;
    const { coveredTopPx, coveredLeftPx } = getCoveredOffsets();
    if (
      (!coveredTopPx && !coveredLeftPx) ||
      typeof map.project !== 'function' ||
      typeof map.unproject !== 'function'
    ) {
      map.setView(latlng, targetZoom, { animate: false });
      return;
    }
    // Direkte Projektions-Rechnung analog zu TripMap.vue:
    // Der Zielpunkt soll nicht im geometrischen Container-Zentrum liegen, sondern im Zentrum
    // der tatsächlich sichtbaren Fläche:
    // - Auf Mobile (oberer Bereich verdeckt): Versatz nach unten (-coveredTopPx / 2)
    // - Auf Desktop (linker Bereich verdeckt): Versatz nach rechts (-coveredLeftPx / 2)
    const targetPoint = map.project(latlng, targetZoom);
    const shiftedCenter = map.unproject(
      targetPoint.add([-coveredLeftPx / 2, -coveredTopPx / 2]),
      targetZoom
    );
    map.setView(shiftedCenter, targetZoom, { animate: false });
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
        options.onManualCoordsSet({ lat: latlng.lat, lng: latlng.lng });
      });
    }
  }

  function removeMarker() {
    if (marker) {
      marker.remove();
      marker = null;
    }
  }

  function renderReferencePoints() {
    if (!map) return;
    referenceLayer?.clearLayers();
    if (!options.referencePoints?.value?.length) return;
    if (!referenceLayer) referenceLayer = L.layerGroup().addTo(map);
    for (const point of options.referencePoints.value) {
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
        options.onManualCoordsSet({ lat: latitude, lng: longitude });
        nextTick(() => {
          centerOnPoint([latitude, longitude], 16);
        });
      },
      () => {
        locatingSelf.value = false;
        locateError.value = true;
      },
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }

  if (getCurrentInstance()) {
    onMounted(async () => {
      await nextTick();
      if (!options.mapEl.value) return;

      const initial =
        options.modelValue.value ??
        options.proximityBias?.value ??
        options.center?.value ??
        FALLBACK_CENTER;
      const initialZoom = options.modelValue.value ? 15 : (options.zoom?.value ?? FALLBACK_ZOOM);

      map = L.map(options.mapEl.value, {
        zoomControl: false,
        rotateControl: false,
      }).setView([initial.lat, initial.lng], initialZoom);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap-Mitwirkende',
        maxZoom: 19,
      }).addTo(map);

      if (options.modelValue.value) {
        placeMarker(options.modelValue.value.lat, options.modelValue.value.lng);
        centerOnPoint([options.modelValue.value.lat, options.modelValue.value.lng], initialZoom);
      } else if (
        options.isDetailsVisible.value &&
        (options.proximityBias?.value || options.center?.value)
      ) {
        centerOnPoint([initial.lat, initial.lng], initialZoom);
      }
      renderReferencePoints();
      startOwnLocation();

      map.on('click', (e: L.LeafletMouseEvent) => {
        options.onManualCoordsSet({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      resizeObserver = new ResizeObserver(() => {
        map?.invalidateSize();
        if (options.modelValue.value) {
          centerOnPoint([options.modelValue.value.lat, options.modelValue.value.lng]);
        }
      });
      resizeObserver.observe(options.mapEl.value);
    });

    onUnmounted(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (geoWatchId != null) navigator.geolocation.clearWatch(geoWatchId);
      map?.remove();
      map = null;
    });
  }

  watch(
    options.modelValue,
    (val) => {
      if (val) {
        placeMarker(val.lat, val.lng);
        if (map && !isInternalCoordChange) {
          nextTick(() => {
            centerOnPoint([val.lat, val.lng], map?.getZoom() || 15);
          });
        }
        isInternalCoordChange = false;
      } else {
        removeMarker();
      }
    },
    { deep: true }
  );

  if (options.referencePoints) {
    watch(options.referencePoints, renderReferencePoints, { deep: true });
  }

  watch(
    () => options.proximityBias?.value ?? options.center?.value,
    (c) => {
      if (!map || options.modelValue.value || !c) return;
      centerOnPoint([c.lat, c.lng], options.zoom?.value ?? FALLBACK_ZOOM);
    }
  );

  return {
    locatingSelf,
    locateError,
    markInternalCoordChange,
    centerOnPoint,
    placeMarker,
    removeMarker,
    renderReferencePoints,
    useOwnLocation,
  };
}
