import { type ComputedRef, type Ref } from 'vue';
import leaflet from 'leaflet';
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
import { useTripStore } from '../stores/trip';
import { FALLBACK_CENTER, FALLBACK_ZOOM } from './useLocationPickerMap';
import type { MapPoint } from './useMapPoints';
import { TRAVEL_COLOR } from './useMapPoints';

export { FALLBACK_CENTER, FALLBACK_ZOOM };
export const DEFAULT_TRIP_ZOOM = 11;

export function getDefaultMapCenterAndZoom(
  trip?: { lat?: number | null; lng?: number | null } | null
): {
  center: [number, number];
  zoom: number;
} {
  if (
    trip &&
    typeof trip.lat === 'number' &&
    typeof trip.lng === 'number' &&
    !Number.isNaN(trip.lat) &&
    !Number.isNaN(trip.lng)
  ) {
    return { center: [trip.lat, trip.lng], zoom: DEFAULT_TRIP_ZOOM };
  }

  return { center: [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng], zoom: FALLBACK_ZOOM };
}

leaflet.Map.mergeOptions({ rotateControl: false });

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

export function trackPlaybackIcon(): leaflet.DivIcon {
  const size = 32;
  const dotSize = 24;
  const half = size / 2;
  const color = '#9141ac';
  return leaflet.divIcon({
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
  homePoints: ComputedRef<MapPoint[]>;
  visiblePoints: ComputedRef<MapPoint[]>;
  accommodationPoints: ComputedRef<MapPoint[]>;
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

export interface FitBoundsPaddingOptions {
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  maxZoom?: number;
}

export function calcFitBoundsPadding(params: {
  isPhotos: boolean;
  hasFocusBanner?: boolean;
  coveredLeftPx?: number;
  coveredBottomPx?: number;
  mapSize?: { x: number; y: number } | null;
  custom?: FitBoundsPaddingOptions;
}) {
  const coveredLeft = params.coveredLeftPx ?? 0;
  const coveredBottom = params.coveredBottomPx ?? 0;

  // Header ist 56px (--app-header-height). Bei sichtbarem Fokus-Banner reicht dieses bis ~116px von oben.
  // Marker ragen als Pin bis zu ~42-56px über ihre Koordinate hinaus.
  // Für Fotos ("Alle Fotos mit Standort") lassen wir zu allen Seiten großzügigen Freiraum,
  // damit kein Bild hinter dem Fokus-Banner oder Tages-Strip verdeckt wird und alle zentriert wirken.
  // Für reguläre Orte (Ausflüge, Spots, Urlaubsort) bleibt das bewährte Standard-Padding (32px) erhalten.
  const defaultTop = params.isPhotos ? 190 : 32;
  const defaultBottom = params.isPhotos ? Math.max(coveredBottom + 48, 120) : 32 + coveredBottom;
  const defaultLeft = coveredLeft + (params.isPhotos ? 90 : 32);
  const defaultRight = params.isPhotos ? 90 : 32;

  let paddingTop = params.custom?.paddingTop ?? defaultTop;
  let paddingBottom = params.custom?.paddingBottom ?? defaultBottom;
  let paddingLeft = params.custom?.paddingLeft ?? defaultLeft;
  let paddingRight = params.custom?.paddingRight ?? defaultRight;

  if (params.mapSize) {
    if (params.mapSize.y > 0) {
      const totalV = paddingTop + paddingBottom;
      const maxV = Math.floor(params.mapSize.y * 0.75);

      if (totalV > maxV && totalV > 0) {
        const scale = maxV / totalV;
        paddingTop = Math.max(16, Math.floor(paddingTop * scale));
        paddingBottom = Math.max(16, Math.floor(paddingBottom * scale));
      }
    }

    if (params.mapSize.x > 0) {
      const totalH = paddingLeft + paddingRight;
      const maxH = Math.floor(params.mapSize.x * 0.75);

      if (totalH > maxH && totalH > 0) {
        const scale = maxH / totalH;
        paddingLeft = Math.max(16, Math.floor(paddingLeft * scale));
        paddingRight = Math.max(16, Math.floor(paddingRight * scale));
      }
    }
  }

  return { paddingTop, paddingBottom, paddingLeft, paddingRight };
}

export function useLeafletTripMap(options: UseLeafletTripMapOptions) {
  const drawers = useDrawersStore();
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const auth = useAuthStore();
  const liveSync = useLiveSyncStore();
  const tripStore = useTripStore();

  let map: leaflet.Map | null = null;
  let markersLayer: leaflet.LayerGroup | null = null;
  let routesLayer: leaflet.LayerGroup | null = null;
  let positionsLayer: leaflet.LayerGroup | null = null;
  let tracksLayer: leaflet.LayerGroup | null = null;
  let trackPlaybackLayer: leaflet.LayerGroup | null = null;
  let playbackMarker: leaflet.Marker | null = null;
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

  function centerOnPoint(latlng: leaflet.LatLngExpression, zoom: number) {
    if (!map) {
      return;
    }

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

  function getCameraPadding(custom?: FitBoundsPaddingOptions) {
    const isPhotos = drawers.mapFocusAllPhotos;
    const hasFocusBanner =
      isPhotos ||
      options.focusedExcursion.value != null ||
      drawers.mapFocusDate != null ||
      drawers.mapFocusLocation != null;

    return calcFitBoundsPadding({
      isPhotos,
      hasFocusBanner,
      coveredLeftPx: options.coveredLeftPx?.value,
      coveredBottomPx: options.coveredBottomPx?.value,
      mapSize: map ? map.getSize() : null,
      custom,
    });
  }

  function fitBoundsWithCoveredBottom(
    bounds: leaflet.LatLngBoundsExpression,
    customPadding?: FitBoundsPaddingOptions
  ) {
    if (!map) {
      return;
    }

    isProgrammaticMove = true;
    const { paddingTop, paddingBottom, paddingLeft, paddingRight } =
      getCameraPadding(customPadding);
    map.fitBounds(bounds, {
      paddingTopLeft: [paddingLeft, paddingTop],
      paddingBottomRight: [paddingRight, paddingBottom],
      maxZoom: customPadding?.maxZoom ?? 15,
      animate: false,
    });
    setTimeout(() => {
      isProgrammaticMove = false;
    }, 100);
  }

  function checkFocusOutOfBounds() {
    if (!map) {
      return;
    }

    const hasFocus =
      drawers.mapFocusExcursionId != null ||
      drawers.mapFocusDate != null ||
      drawers.mapFocusKey != null ||
      drawers.mapFocusTrackId != null ||
      drawers.mapFocusLocation != null ||
      drawers.mapFocusAllPhotos;

    if (!hasFocus) {
      return;
    }

    let focusedLatLngs: [number, number][] = [];

    if (drawers.mapFocusAllPhotos) {
      focusedLatLngs = options.allTripPhotoPoints.value.map((point) => [point.lat, point.lng]);
    } else if (options.focusedExcursion.value) {
      const excursionStations = resolveStations(
        excursionStationKeys(options.focusedExcursion.value.spot_ids),
        spotsStore.spots,
        options.travelItems.value
      );
      focusedLatLngs = excursionStations
        .filter((station) => station.lat != null && station.lng != null)
        .map((station) => [station.lat as number, station.lng as number]);

      if (options.excursionPhotoPoints.value.length) {
        for (const photoPoint of options.excursionPhotoPoints.value) {
          focusedLatLngs.push([photoPoint.lat, photoPoint.lng]);
        }
      }
    } else if (drawers.mapFocusDate) {
      focusedLatLngs = options.focusedDateStations.value
        .filter((station) => station.lat != null && station.lng != null)
        .map((station) => [station.lat as number, station.lng as number]);
    } else if (drawers.mapFocusLocation) {
      focusedLatLngs = [[drawers.mapFocusLocation.lat, drawers.mapFocusLocation.lng]];
    } else if (drawers.mapFocusKey) {
      const focusPoint = options.points.value.find((pt) => pt.key === drawers.mapFocusKey);

      if (focusPoint) {
        focusedLatLngs = [[focusPoint.lat, focusPoint.lng]];
      }
    } else if (options.focusedTrack.value) {
      focusedLatLngs = options.focusedTrackPoints.value.map((pt) => [pt.lat, pt.lng]);
    }

    if (!focusedLatLngs.length) {
      return;
    }

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

    if (!areAllOutOfBounds) {
      return;
    }

    drawers.mapFocusExcursionId = null;
    drawers.mapFocusDate = null;
    drawers.mapFocusKey = null;
    drawers.mapFocusTrackId = null;
    drawers.mapFocusLocation = null;
    drawers.mapFocusAllPhotos = false;
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
    if (!map) {
      return;
    }

    clearFocusState();
    const catPoints = options.filteredPoints.value.filter((point) => point.category === category);
    const latLngs = catPoints.map((point): leaflet.LatLngExpression => [point.lat, point.lng]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 14);
    }
  }

  function fitAll() {
    if (!map) {
      return;
    }

    clearFocusState();
    const latLngs = options.filteredPoints.value.map((point): leaflet.LatLngExpression => [
      point.lat,
      point.lng,
    ]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    } else {
      const { center, zoom } = getDefaultMapCenterAndZoom(tripStore.currentTrip);
      centerOnPoint(center, zoom);
    }
  }

  function fitVacation() {
    if (!map) {
      return;
    }

    clearFocusState();
    const latLngs = options.vacationPoints.value.map((point): leaflet.LatLngExpression => [
      point.lat,
      point.lng,
    ]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    } else {
      const { center, zoom } = getDefaultMapCenterAndZoom(tripStore.currentTrip);
      centerOnPoint(center, zoom);
    }
  }

  function fitAccommodations() {
    if (!map) {
      return;
    }

    clearFocusState();
    const latLngs = options.accommodationPoints.value.map((point): leaflet.LatLngExpression => [
      point.lat,
      point.lng,
    ]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitHome() {
    if (!map) {
      return;
    }

    clearFocusState();
    const latLngs = options.homePoints.value.map((point): leaflet.LatLngExpression => [
      point.lat,
      point.lng,
    ]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs));
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 13);
    }
  }

  function fitAllPhotos() {
    if (!map) {
      return;
    }

    const latLngs = options.allTripPhotoPoints.value.map((point): leaflet.LatLngExpression => [
      point.lat,
      point.lng,
    ]);

    if (latLngs.length > 1) {
      fitBoundsWithCoveredBottom(leaflet.latLngBounds(latLngs), {
        paddingTop: 190,
        paddingBottom: Math.max((options.coveredBottomPx?.value ?? 0) + 48, 120),
        paddingLeft: (options.coveredLeftPx?.value ?? 0) + 90,
        paddingRight: 90,
      });
    } else if (latLngs.length === 1) {
      centerOnPoint(latLngs[0], 14);
    }
  }

  function renderMarkers() {
    if (!map || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    const latLngs: leaflet.LatLngExpression[] = [];

    for (const point of options.visiblePoints.value) {
      const latlng: leaflet.LatLngExpression = [point.lat, point.lng];
      latLngs.push(latlng);
      const marker = leaflet
        .marker(latlng, { icon: iconFor(point), title: point.title })
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
    const excursionLatLngs: leaflet.LatLngExpression[] = excursionStations
      .filter((station) => station.lat != null && station.lng != null)
      .map((station): leaflet.LatLngExpression => [station.lat as number, station.lng as number]);

    if (excursion && options.excursionPhotoPoints.value.length) {
      for (const photoPoint of options.excursionPhotoPoints.value) {
        excursionLatLngs.push([photoPoint.lat, photoPoint.lng]);
      }
    }

    const dateLatLngs: leaflet.LatLngExpression[] =
      !excursion && drawers.mapFocusDate
        ? options.focusedDateStations.value
            .filter((station) => station.lat != null && station.lng != null)
            .map((station): leaflet.LatLngExpression => [
              station.lat as number,
              station.lng as number,
            ])
        : [];

    const focusPoint = drawers.mapFocusKey
      ? options.points.value.find((pt) => pt.key === drawers.mapFocusKey)
      : null;

    if (drawers.mapFocusAllPhotos && options.allTripPhotoPoints.value.length) {
      const photoLatLngs = options.allTripPhotoPoints.value.map(
        (photoPoint): leaflet.LatLngExpression => [photoPoint.lat, photoPoint.lng]
      );

      if (photoLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(leaflet.latLngBounds(photoLatLngs));
      } else if (photoLatLngs.length === 1) {
        centerOnPoint(photoLatLngs[0], 14);
      }
    } else if (excursion) {
      if (excursionLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(leaflet.latLngBounds(excursionLatLngs));
      } else if (excursionLatLngs.length === 1) {
        centerOnPoint(excursionLatLngs[0], 14);
      }
    } else if (drawers.mapFocusLocation) {
      centerOnPoint([drawers.mapFocusLocation.lat, drawers.mapFocusLocation.lng], 16);
    } else if (drawers.mapFocusDate && dateLatLngs.length) {
      if (dateLatLngs.length > 1) {
        fitBoundsWithCoveredBottom(leaflet.latLngBounds(dateLatLngs));
      } else {
        centerOnPoint(dateLatLngs[0], 14);
      }
    } else if (focusPoint) {
      centerOnPoint([focusPoint.lat, focusPoint.lng], 15);
    }
  }

  function renderRoutes() {
    if (!map || !routesLayer) {
      return;
    }

    routesLayer.clearLayers();

    const tourRoleFilterActive =
      options.tourRoleFilter?.value && options.tourRoleFilter.value.length > 0;

    for (const travelItem of options.travelItems.value) {
      if (drawers.mapFocusDate && travelItem.date !== drawers.mapFocusDate) {
        continue;
      }

      if (tourRoleFilterActive) {
        const itemRole = travelItem.role ?? 'arrival';

        if (!options.tourRoleFilter!.value!.includes(itemRole)) {
          continue;
        }
      }

      if (
        travelItem.from_lat != null &&
        travelItem.from_lng != null &&
        travelItem.to_lat != null &&
        travelItem.to_lng != null
      ) {
        const leg = travelItem.legs?.[0];
        const geometryCoords = parseRouteGeometry(leg?.route_geometry);

        if (geometryCoords) {
          leaflet
            .polyline(geometryCoords, {
              color: getRouteColor(travelItem.type, leg?.routing_profile),
              weight: 4,
              opacity: 0.85,
            })
            .addTo(routesLayer);
        } else {
          leaflet
            .polyline(
              arcRoute([
                [travelItem.from_lat, travelItem.from_lng],
                [travelItem.to_lat, travelItem.to_lng],
              ]),
              {
                color: TRAVEL_COLOR,
                weight: 3,
                opacity: 0.65,
                dashArray: '6 6',
              }
            )
            .addTo(routesLayer);
        }
      }
    }

    if (!options.focusedExcursion.value && drawers.mapFocusDate) {
      const coords: leaflet.LatLngExpression[] = options.focusedDateStations.value
        .filter((station) => station.lat != null && station.lng != null)
        .map((station): leaflet.LatLngExpression => [station.lat as number, station.lng as number]);

      if (coords.length >= 2) {
        leaflet
          .polyline(arcRoute(coords), {
            color: '#e08e45',
            weight: 3,
            opacity: 0.65,
            dashArray: '6 6',
          })
          .addTo(routesLayer);
      }

      return;
    }

    let excursionsToDraw: Excursion[] = [];

    if (options.focusedExcursion.value) {
      if (!options.focusedExcursion.value.role) {
        excursionsToDraw = [options.focusedExcursion.value];
      }
    } else {
      excursionsToDraw = excursionsStore.excursions.filter((e) => {
        if (e.role) {
          return false;
        }

        if (tourRoleFilterActive && !options.tourRoleFilter!.value!.includes('excursion')) {
          return false;
        }

        return true;
      });
    }

    for (const excursion of excursionsToDraw) {
      const stations = resolveStations(
        excursionStationKeys(excursion.spot_ids),
        spotsStore.spots,
        options.travelItems.value
      );

      for (let i = 0; i < stations.length - 1; i++) {
        const s1 = stations[i];
        const s2 = stations[i + 1];

        if (s1.lat == null || s1.lng == null || s2.lat == null || s2.lng == null) {
          continue;
        }

        const leg = excursion.legs?.find(
          (excursionLeg) =>
            excursionLeg.position === i ||
            (excursionLeg.from_spot_id === s1.id && excursionLeg.to_spot_id === s2.id)
        );
        const geometryCoords = parseRouteGeometry(leg?.route_geometry);

        if (geometryCoords) {
          leaflet
            .polyline(geometryCoords, {
              color: getRouteColor(leg?.transport_type, leg?.routing_profile),
              weight: 4,
              opacity: 0.85,
            })
            .addTo(routesLayer);
        } else {
          leaflet
            .polyline(arcPoints([s1.lat, s1.lng], [s2.lat, s2.lng]), {
              color: getRouteColor(leg?.transport_type, leg?.routing_profile),
              weight: 3,
              opacity: 0.65,
              dashArray: '6 6',
            })
            .addTo(routesLayer);
        }
      }
    }
  }

  function renderTracks() {
    if (!map || !tracksLayer) {
      return;
    }

    tracksLayer.clearLayers();
    const trackPts = options.focusedTrackPoints.value;

    if (trackPts.length < 2) {
      if (trackPlaybackLayer) {
        trackPlaybackLayer.clearLayers();
        playbackMarker = null;
      }

      return;
    }

    const coords: leaflet.LatLngExpression[] = trackPts.map((point) => [point.lat, point.lng]);
    leaflet.polyline(coords, { color: '#2f6fed', weight: 4, opacity: 0.85 }).addTo(tracksLayer);

    const startPt = trackPts[0];
    leaflet
      .marker([startPt.lat, startPt.lng], {
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
    leaflet
      .marker([goalPt.lat, goalPt.lng], {
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

    fitBoundsWithCoveredBottom(leaflet.latLngBounds(coords));
    updateTrackPlaybackMarker();
  }

  function updateTrackPlaybackMarker() {
    if (!map || !trackPlaybackLayer) {
      return;
    }

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
      playbackMarker = leaflet
        .marker([pos.lat, pos.lng], {
          icon: trackPlaybackIcon(),
          zIndexOffset: 1200,
          title: 'Aktuelle Position',
        })
        .addTo(trackPlaybackLayer);
    } else {
      playbackMarker.setLatLng([pos.lat, pos.lng]);
    }
  }

  function renderPositions() {
    if (!map || !positionsLayer) {
      return;
    }

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
      leaflet
        .marker([options.ownPosition.value.lat, options.ownPosition.value.lng], {
          icon: compassPin(auth.user.avatar, '#2f6fed', coneRotation),
          zIndexOffset: 1000,
          pane: 'live-positions',
        })
        .addTo(positionsLayer);
    }

    for (const [userId, position] of Object.entries(liveSync.memberPositions)) {
      const user = options.users.value.find((memberUser) => memberUser.id === Number(userId));

      if (!user) {
        continue;
      }

      leaflet
        .marker([position.lat, position.lng], {
          icon: cachedEmojiPin(user.avatar, '#2f6fed'),
          pane: 'live-positions',
        })
        .addTo(positionsLayer);
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
    const { center: defaultCenter, zoom: defaultZoom } = getDefaultMapCenterAndZoom(
      tripStore.currentTrip
    );

    map = leaflet.map(mapEl, {
      center: defaultCenter,
      zoom: defaultZoom,
      rotate: true,
      rotateControl: false,
      zoomControl: false,
      touchRotate: true,
      bearing: 0,
      doubleClickZoom: true,
    });
    map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
    mapEl.setAttribute('data-tiles-loading', 'true');
    const baseTileLayer = leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap-Mitwirkende',
        maxZoom: 19,
      })
      .addTo(map);
    baseTileLayer.on('loading', () => {
      mapEl.setAttribute('data-tiles-loading', 'true');
      mapEl.removeAttribute('data-tiles-loaded');
    });
    baseTileLayer.on('load', () => {
      mapEl.removeAttribute('data-tiles-loading');
      mapEl.setAttribute('data-tiles-loaded', 'true');
    });

    routesLayer = leaflet.layerGroup().addTo(map);
    markersLayer = leaflet.layerGroup().addTo(map);
    positionsLayer = leaflet.layerGroup().addTo(map);
    tracksLayer = leaflet.layerGroup().addTo(map);
    trackPlaybackLayer = leaflet.layerGroup().addTo(map);

    renderMarkers();
    renderRoutes();
    renderPositions();
    renderTracks();

    const hasFocus =
      drawers.mapFocusAllPhotos ||
      options.focusedExcursion.value != null ||
      drawers.mapFocusLocation != null ||
      drawers.mapFocusDate != null ||
      drawers.mapFocusKey != null;

    if (!hasFocus) {
      fitAll();
    }

    map.on('rotate', () => {
      options.currentBearing.value = map!.getBearing();
      renderPositions();
    });

    map.on('moveend', () => {
      if (isProgrammaticMove) {
        return;
      }

      checkFocusOutOfBounds();
    });

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(mapEl);
    }
  }

  function clearTrackLayers() {
    if (tracksLayer) {
      tracksLayer.clearLayers();
    }

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
    fitHome,
    fitAccommodations,
    fitAllPhotos,
    renderMarkers,
    renderRoutes,
    renderTracks,
    renderPositions,
    updateTrackPlaybackMarker,
    clearTrackLayers,
  };
}
