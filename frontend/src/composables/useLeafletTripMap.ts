import { type ComputedRef, type Ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
import type { Excursion, LocationTrack, TrackPoint, TravelItem, User } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';
import { excursionStationKeys, resolveStations } from '../utils/excursionStations';
import { interpolateTrackPosition } from '../utils/trackGeometry';
import {
  arcPoints,
  arcRoute,
  cachedEmojiPin,
  cachedImagePin,
  compassPin,
  getRouteColor,
  LEAFLET_ATTRIBUTION_PREFIX,
  parseRouteGeometry,
} from '../utils/mapRoute';
import type { IconDef } from '../utils/icon';
import { IconFlag, IconFlagFilled, IconTarget } from '@tabler/icons-vue';
import { useDrawersStore } from '../stores/drawers';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';
import type { MapPoint } from './useMapPoints';
import { TRAVEL_COLOR } from './useMapPoints';

L.Map.mergeOptions({ rotateControl: false });

export const TRACK_START_ICON: IconDef = {
  id: 'flag',
  emoji: '🚩',
  outline: IconFlag,
  filled: IconFlagFilled,
};

export const TRACK_GOAL_ICON: IconDef = {
  id: 'target',
  emoji: '🏁',
  outline: IconTarget,
};

export function trackPlaybackIcon(): L.DivIcon {
  const size = 32;
  const dotSize = 24;
  const half = size / 2;
  const color = '#9141ac';
  return L.divIcon({
    html: `<div class="track-playback-marker" style="position:relative;width:${size}px;height:${size}px;">
      <div class="map-pulse-ring" style="position:absolute;left:50%;top:50%;width:${dotSize + 12}px;height:${dotSize + 12}px;
        margin:${-(dotSize + 12) / 2}px 0 0 ${-(dotSize + 12) / 2}px;border-radius:50%;background:${color};"></div>
      <div style="position:absolute;left:50%;top:50%;width:${dotSize}px;height:${dotSize}px;
        margin:${-dotSize / 2}px 0 0 ${-dotSize / 2}px;border-radius:50%;background:${color};
        border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);
        display:flex;align-items:center;justify-content:center;">
        <div style="width:8px;height:8px;border-radius:50%;background:#ffffff;"></div>
      </div>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

export interface UseLeafletTripMapOptions {
  coveredBottomPx?: Ref<number | undefined>;
  coveredLeftPx?: Ref<number | undefined>;
  tourRoleFilter?: Ref<string[] | undefined>;
  travelItems: ComputedRef<TravelItem[]>;
  points: ComputedRef<MapPoint[]>;
  filteredPoints: ComputedRef<MapPoint[]>;
  vacationPoints: ComputedRef<MapPoint[]>;
  visiblePoints: ComputedRef<MapPoint[]>;
  accommodationPoints: ComputedRef<MapPoint[]>;
  excursionPoints: ComputedRef<MapPoint[]>;
  focusedExcursion: ComputedRef<Excursion | null>;
  focusedTrack: ComputedRef<LocationTrack | null>;
  focusedTrackPoints: ComputedRef<TrackPoint[]>;
  focusedDateStations: ComputedRef<ExcursionStation[]>;
  excursionPhotoPoints: Ref<MapPoint[]>;
  allTripPhotoPoints: Ref<MapPoint[]>;
  ownPosition: Ref<{ lat: number; lng: number } | null>;
  ownHeading: Ref<number | null>;
  currentBearing: Ref<number>;
  users: Ref<User[]>;
  trackPlaybackProgress: Ref<number>;
  onPointClick: (point: MapPoint) => void;
}

export function useLeafletTripMap(options: UseLeafletTripMapOptions) {
  const drawers = useDrawersStore();
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const auth = useAuthStore();
  const liveSync = useLiveSyncStore();

  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;
  let routesLayer: L.LayerGroup | null = null;
  let positionsLayer: L.LayerGroup | null = null;
  let tracksLayer: L.LayerGroup | null = null;
  let trackPlaybackLayer: L.LayerGroup | null = null;
  let playbackMarker: L.Marker | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let isProgrammaticMove = false;

  function iconFor(point: MapPoint) {
    const isLarge =
      point.key === drawers.mapFocusKey ||
      (point.origin === 'location' && point.key === 'photo-location');
    if (point.imageUrl) {
      return cachedImagePin(point.imageUrl, point.color, isLarge, point.dateBadge);
    }
    return cachedEmojiPin(point.icon, point.color, isLarge);
  }

  function centerOnPoint(latlng: L.LatLngExpression, zoom: number) {
    if (!map) return;
    isProgrammaticMove = true;
    const coveredBottomPx = options.coveredBottomPx?.value ?? 0;
    const coveredLeftPx = options.coveredLeftPx?.value ?? 0;
    if (!coveredBottomPx && !coveredLeftPx) {
      map.setView(latlng, zoom, { animate: false });
      setTimeout(() => {
        isProgrammaticMove = false;
      }, 100);
      return;
    }
    const targetPoint = map.project(latlng, zoom);
    const shiftedCenter = map.unproject(
      targetPoint.add([-coveredLeftPx / 2, coveredBottomPx / 2]),
      zoom
    );
    map.setView(shiftedCenter, zoom, { animate: false });
    setTimeout(() => {
      isProgrammaticMove = false;
    }, 100);
  }

  function fitBoundsWithCoveredBottom(bounds: L.LatLngBoundsExpression) {
    if (!map) return;
    isProgrammaticMove = true;
    const coveredBottomPx = options.coveredBottomPx?.value ?? 0;
    const coveredLeftPx = options.coveredLeftPx?.value ?? 0;
    map.fitBounds(bounds, {
      paddingTopLeft: [32 + coveredLeftPx, 32],
      paddingBottomRight: [32, 32 + coveredBottomPx],
      maxZoom: 15,
      animate: false,
    });
    setTimeout(() => {
      isProgrammaticMove = false;
    }, 100);
  }

  function checkFocusOutOfBounds() {
    if (!map) return;

    const hasFocus =
      drawers.mapFocusExcursionId != null ||
      drawers.mapFocusDate != null ||
      drawers.mapFocusKey != null ||
      drawers.mapFocusTrackId != null ||
      drawers.mapFocusLocation != null ||
      drawers.mapFocusAllPhotos;

    if (!hasFocus) return;

    let focusedLatLngs: [number, number][] = [];

    if (drawers.mapFocusAllPhotos) {
      focusedLatLngs = options.allTripPhotoPoints.value.map((p) => [p.lat, p.lng]);
    } else if (options.focusedExcursion.value) {
      const excursionStations = resolveStations(
        excursionStationKeys(options.focusedExcursion.value.spot_ids),
        spotsStore.spots,
        options.travelItems.value
      );
      focusedLatLngs = excursionStations
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => [s.lat as number, s.lng as number]);
      if (options.excursionPhotoPoints.value.length) {
        for (const p of options.excursionPhotoPoints.value) {
          focusedLatLngs.push([p.lat, p.lng]);
        }
      }
    } else if (drawers.mapFocusDate) {
      focusedLatLngs = options.focusedDateStations.value
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => [s.lat as number, s.lng as number]);
    } else if (drawers.mapFocusLocation) {
      focusedLatLngs = [[drawers.mapFocusLocation.lat, drawers.mapFocusLocation.lng]];
    } else if (drawers.mapFocusKey) {
      const p = options.points.value.find((pt) => pt.key === drawers.mapFocusKey);
      if (p) focusedLatLngs = [[p.lat, p.lng]];
    } else if (options.focusedTrack.value) {
      focusedLatLngs = options.focusedTrackPoints.value.map((pt) => [pt.lat, pt.lng]);
    }

    if (!focusedLatLngs.length) return;

    const coveredLeftPx = options.coveredLeftPx?.value ?? 0;
    const coveredBottomPx = options.coveredBottomPx?.value ?? 0;
    const mapSize = map.getSize();

    const isOutOfBounds = (lat: number, lng: number) => {
      const pt = map!.latLngToContainerPoint([lat, lng]);
      return (
        pt.x < coveredLeftPx || pt.x > mapSize.x || pt.y < 0 || pt.y > mapSize.y - coveredBottomPx
      );
    };

    const areAllOutOfBounds = focusedLatLngs.every(([lat, lng]) => isOutOfBounds(lat, lng));

    if (areAllOutOfBounds) {
      drawers.mapFocusExcursionId = null;
      drawers.mapFocusDate = null;
      drawers.mapFocusKey = null;
      drawers.mapFocusTrackId = null;
      drawers.mapFocusLocation = null;
      drawers.mapFocusAllPhotos = false;
    }
  }

  function clearFocusState() {
    drawers.mapFocusExcursionId = null;
    drawers.mapFocusDate = null;
    drawers.mapFocusKey = null;
    drawers.mapFocusTrackId = null;
    drawers.mapFocusLocation = null;
    drawers.mapFocusAllPhotos = false;
  }

  function focusCategory(category: string) {
    if (!map) return;
    clearFocusState();
    const catPoints = options.filteredPoints.value.filter((p) => p.category === category);
    const latLngs = catPoints.map((p): L.LatLngExpression => [p.lat, p.lng]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 14);
    }
  }

  function fitAll() {
    if (!map) return;
    clearFocusState();
    const latLngs = options.filteredPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitVacation() {
    if (!map) return;
    clearFocusState();
    const latLngs = options.vacationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitAccommodations() {
    if (!map) return;
    clearFocusState();
    const latLngs = options.accommodationPoints.value.map((p): L.LatLngExpression => [
      p.lat,
      p.lng,
    ]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitExcursions() {
    if (!map) return;
    clearFocusState();
    const latLngs = options.excursionPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitAllPhotos() {
    if (!map) return;
    const latLngs = options.allTripPhotoPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 14);
    }
  }

  function renderMarkers() {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    const latLngs: L.LatLngExpression[] = [];
    for (const point of options.visiblePoints.value) {
      const latlng: L.LatLngExpression = [point.lat, point.lng];
      latLngs.push(latlng);
      const marker = L.marker(latlng, { icon: iconFor(point), title: point.title })
        .addTo(markersLayer)
        .on('click', () => options.onPointClick(point));
      marker.bindTooltip(point.title, {
        direction: 'top',
        offset: [0, -18],
        opacity: 0.95,
        className: 'map-marker-tooltip',
      });
    }

    const excursion = options.focusedExcursion.value;
    const excursionStations = excursion
      ? resolveStations(
          excursionStationKeys(excursion.spot_ids),
          spotsStore.spots,
          options.travelItems.value
        )
      : [];
    const excursionLatLngs: L.LatLngExpression[] = excursionStations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s): L.LatLngExpression => [s.lat as number, s.lng as number]);

    if (excursion && options.excursionPhotoPoints.value.length) {
      for (const p of options.excursionPhotoPoints.value) {
        excursionLatLngs.push([p.lat, p.lng]);
      }
    }

    const dateLatLngs: L.LatLngExpression[] =
      !excursion && drawers.mapFocusDate
        ? options.focusedDateStations.value
            .filter((s) => s.lat != null && s.lng != null)
            .map((s): L.LatLngExpression => [s.lat as number, s.lng as number])
        : [];

    const focusPoint = drawers.mapFocusKey
      ? options.points.value.find((p) => p.key === drawers.mapFocusKey)
      : null;

    if (drawers.mapFocusAllPhotos && options.allTripPhotoPoints.value.length) {
      const photoLatLngs = options.allTripPhotoPoints.value.map((p): L.LatLngExpression => [
        p.lat,
        p.lng,
      ]);
      if (photoLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(L.latLngBounds(photoLatLngs));
      } else if (photoLatLngs.length === 1) {
        centerOnPoint(photoLatLngs[0], 14);
      }
    } else if (excursion) {
      if (excursionLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(L.latLngBounds(excursionLatLngs));
      } else if (excursionLatLngs.length === 1) {
        centerOnPoint(excursionLatLngs[0], 14);
      }
    } else if (drawers.mapFocusLocation) {
      centerOnPoint([drawers.mapFocusLocation.lat, drawers.mapFocusLocation.lng], 16);
    } else if (drawers.mapFocusDate && dateLatLngs.length) {
      if (dateLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(L.latLngBounds(dateLatLngs));
      } else {
        centerOnPoint(dateLatLngs[0], 14);
      }
    } else if (focusPoint) {
      centerOnPoint([focusPoint.lat, focusPoint.lng], 15);
    } else if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    } else {
      map.setView([48.1351, 11.582], 5);
    }
  }

  function renderRoutes() {
    if (!map || !routesLayer) return;
    routesLayer.clearLayers();

    const tourRoleFilterActive =
      options.tourRoleFilter?.value && options.tourRoleFilter.value.length > 0;
    for (const t of options.travelItems.value) {
      if (drawers.mapFocusDate && t.date !== drawers.mapFocusDate) continue;
      if (tourRoleFilterActive) {
        const tRole = t.role ?? 'arrival';
        if (!options.tourRoleFilter!.value!.includes(tRole)) continue;
      }
      if (t.from_lat != null && t.from_lng != null && t.to_lat != null && t.to_lng != null) {
        const leg = t.legs?.[0];
        const geometryCoords = parseRouteGeometry(leg?.route_geometry);
        if (geometryCoords) {
          L.polyline(geometryCoords, {
            color: getRouteColor(t.type, leg?.routing_profile),
            weight: 4,
            opacity: 0.85,
          }).addTo(routesLayer);
        } else {
          L.polyline(
            arcRoute([
              [t.from_lat, t.from_lng],
              [t.to_lat, t.to_lng],
            ]),
            {
              color: TRAVEL_COLOR,
              weight: 3,
              opacity: 0.65,
              dashArray: '6 6',
            }
          ).addTo(routesLayer);
        }
      }
    }

    if (!options.focusedExcursion.value && drawers.mapFocusDate) {
      const coords: L.LatLngExpression[] = options.focusedDateStations.value
        .filter((s) => s.lat != null && s.lng != null)
        .map((s): L.LatLngExpression => [s.lat as number, s.lng as number]);
      if (coords.length >= 2) {
        L.polyline(arcRoute(coords), {
          color: '#e08e45',
          weight: 3,
          opacity: 0.65,
          dashArray: '6 6',
        }).addTo(routesLayer);
      }
      return;
    }

    const excursionsToDraw = options.focusedExcursion.value
      ? options.focusedExcursion.value.role
        ? []
        : [options.focusedExcursion.value]
      : excursionsStore.excursions.filter((e) => {
          if (e.role) return false;
          if (tourRoleFilterActive && !options.tourRoleFilter!.value!.includes('excursion'))
            return false;
          return true;
        });

    for (const excursion of excursionsToDraw) {
      const stations = resolveStations(
        excursionStationKeys(excursion.spot_ids),
        spotsStore.spots,
        options.travelItems.value
      );
      for (let i = 0; i < stations.length - 1; i++) {
        const s1 = stations[i];
        const s2 = stations[i + 1];
        if (s1.lat == null || s1.lng == null || s2.lat == null || s2.lng == null) continue;

        const leg = excursion.legs?.find(
          (l) => l.position === i || (l.from_spot_id === s1.id && l.to_spot_id === s2.id)
        );
        const geometryCoords = parseRouteGeometry(leg?.route_geometry);

        if (geometryCoords) {
          L.polyline(geometryCoords, {
            color: getRouteColor(leg?.transport_type, leg?.routing_profile),
            weight: 4,
            opacity: 0.85,
          }).addTo(routesLayer);
        } else {
          L.polyline(arcPoints([s1.lat, s1.lng], [s2.lat, s2.lng]), {
            color: getRouteColor(leg?.transport_type, leg?.routing_profile),
            weight: 3,
            opacity: 0.65,
            dashArray: '6 6',
          }).addTo(routesLayer);
        }
      }
    }
  }

  function renderTracks() {
    if (!map || !tracksLayer) return;
    tracksLayer.clearLayers();
    const trackPts = options.focusedTrackPoints.value;
    if (trackPts.length < 2) {
      if (trackPlaybackLayer) {
        trackPlaybackLayer.clearLayers();
        playbackMarker = null;
      }
      return;
    }
    const coords: L.LatLngExpression[] = trackPts.map((p) => [p.lat, p.lng]);
    L.polyline(coords, { color: '#2f6fed', weight: 4, opacity: 0.85 }).addTo(tracksLayer);

    const startPt = trackPts[0];
    L.marker([startPt.lat, startPt.lng], {
      icon: cachedEmojiPin(TRACK_START_ICON, '#3f8f5c'),
      zIndexOffset: 800,
      title: 'Start',
    })
      .bindTooltip('Start', {
        direction: 'top',
        offset: [0, -28],
        opacity: 0.95,
        className: 'map-marker-tooltip',
      })
      .on('click', () => {
        options.trackPlaybackProgress.value = 0;
      })
      .addTo(tracksLayer);

    const goalPt = trackPts[trackPts.length - 1];
    L.marker([goalPt.lat, goalPt.lng], {
      icon: cachedEmojiPin(TRACK_GOAL_ICON, '#c1503f'),
      zIndexOffset: 800,
      title: 'Ziel',
    })
      .bindTooltip('Ziel', {
        direction: 'top',
        offset: [0, -28],
        opacity: 0.95,
        className: 'map-marker-tooltip',
      })
      .on('click', () => {
        options.trackPlaybackProgress.value = 1;
      })
      .addTo(tracksLayer);

    fitBoundsWithCoveredBottom(L.latLngBounds(coords));
    updateTrackPlaybackMarker();
  }

  function updateTrackPlaybackMarker() {
    if (!map || !trackPlaybackLayer) return;
    const trackPts = options.focusedTrackPoints.value;
    if (trackPts.length < 2) {
      trackPlaybackLayer.clearLayers();
      playbackMarker = null;
      return;
    }
    const pos = interpolateTrackPosition(trackPts, options.trackPlaybackProgress.value);
    if (!pos) {
      trackPlaybackLayer.clearLayers();
      playbackMarker = null;
      return;
    }
    if (!playbackMarker) {
      trackPlaybackLayer.clearLayers();
      playbackMarker = L.marker([pos.lat, pos.lng], {
        icon: trackPlaybackIcon(),
        zIndexOffset: 1200,
        title: 'Aktuelle Position',
      }).addTo(trackPlaybackLayer);
    } else {
      playbackMarker.setLatLng([pos.lat, pos.lng]);
    }
  }

  function renderPositions() {
    if (!map || !positionsLayer) return;
    positionsLayer.clearLayers();

    if (!map.getPane('live-positions')) {
      const pane = map.createPane('live-positions');
      pane.style.zIndex = '650';
    }

    if (options.ownPosition.value && auth.user) {
      const coneRotation =
        options.ownHeading.value == null
          ? null
          : (options.ownHeading.value - options.currentBearing.value + 360) % 360;
      L.marker([options.ownPosition.value.lat, options.ownPosition.value.lng], {
        icon: compassPin(auth.user.avatar, '#2f6fed', coneRotation),
        zIndexOffset: 1000,
        pane: 'live-positions',
      }).addTo(positionsLayer);
    }

    for (const [userId, position] of Object.entries(liveSync.memberPositions)) {
      const user = options.users.value.find((u) => u.id === Number(userId));
      if (!user) continue;
      L.marker([position.lat, position.lng], {
        icon: cachedEmojiPin(user.avatar, '#2f6fed'),
        pane: 'live-positions',
      }).addTo(positionsLayer);
    }
  }

  function setBearing(bearing: number) {
    if (map) {
      map.setBearing(bearing);
    }
  }

  function getBounds() {
    return map?.getBounds();
  }

  function initMap(mapEl: HTMLElement) {
    map = L.map(mapEl, {
      rotate: true,
      rotateControl: false,
      zoomControl: false,
      touchRotate: true,
      bearing: 0,
      doubleClickZoom: true,
    });
    map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
    mapEl.setAttribute('data-tiles-loading', 'true');
    const baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap-Mitwirkende',
      maxZoom: 19,
    }).addTo(map);
    baseTileLayer.on('loading', () => {
      mapEl.setAttribute('data-tiles-loading', 'true');
      mapEl.removeAttribute('data-tiles-loaded');
    });
    baseTileLayer.on('load', () => {
      mapEl.removeAttribute('data-tiles-loading');
      mapEl.setAttribute('data-tiles-loaded', 'true');
    });

    routesLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    positionsLayer = L.layerGroup().addTo(map);
    tracksLayer = L.layerGroup().addTo(map);
    trackPlaybackLayer = L.layerGroup().addTo(map);

    renderMarkers();
    renderRoutes();
    renderPositions();
    renderTracks();

    map.on('rotate', () => {
      options.currentBearing.value = map!.getBearing();
      renderPositions();
    });

    map.on('moveend', () => {
      if (isProgrammaticMove) return;
      checkFocusOutOfBounds();
    });

    resizeObserver = new ResizeObserver(() => map?.invalidateSize());
    resizeObserver.observe(mapEl);
  }

  function clearTrackLayers() {
    if (tracksLayer) tracksLayer.clearLayers();
    if (trackPlaybackLayer) {
      trackPlaybackLayer.clearLayers();
      playbackMarker = null;
    }
  }

  function destroyMap() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    clearTrackLayers();
    map?.remove();
    map = null;
    markersLayer = null;
    routesLayer = null;
    positionsLayer = null;
    tracksLayer = null;
    trackPlaybackLayer = null;
  }

  return {
    initMap,
    destroyMap,
    setBearing,
    getBounds,
    centerOnPoint,
    fitBoundsWithCoveredBottom,
    checkFocusOutOfBounds,
    focusCategory,
    fitAll,
    fitVacation,
    fitAccommodations,
    fitExcursions,
    fitAllPhotos,
    renderMarkers,
    renderRoutes,
    renderTracks,
    renderPositions,
    updateTrackPlaybackMarker,
    clearTrackLayers,
  };
}
