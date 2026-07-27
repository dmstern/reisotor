<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type { Accommodation, Excursion, Spot, TravelItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { spotCategoryMeta } from '../utils/spotCategory';
import { arcRoute, cachedEmojiPin } from '../utils/mapRoute';

// Die Karte ist ein generischer, reiner Pin-Layer (kein Anlegen/Bearbeiten hier): sie zeigt
// automatisch jedes Objekt des aktuellen Urlaubs mit hinterlegtem Standort – Unterkunft, Reise
// (Abflug/Ankunft) und Spots. Ein Klick auf einen Punkt zeigt eine kurze Info mit einem
// Sprung-Button zur jeweiligen Ursprungssicht (Architekturregel Batch 3).
type MapOrigin = 'accommodation' | 'travel' | 'spot';

interface MapPoint {
  key: string;
  origin: MapOrigin;
  lat: number;
  lng: number;
  title: string;
  icon: string;
  color: string;
  label: string;
  /** Zuhause-Seite eines Reise-Eintrags (Startpunkt der Anreise / Zielpunkt der Abreise) – wird
   *  vom Urlaubsfokus-Button ausgeblendet, siehe vacationPoints. */
  homeSide?: boolean;
  /** Ursprünglicher Maps-Link (Google/Apple), falls hinterlegt – Fallback für "In Karten-App
   *  öffnen" (openExternally) auf Plattformen ohne App-Auswahl-Dialog (siehe dort). */
  mapsLink: string | null;
}

const ACCOMMODATION_META = { icon: '🛏️', color: '#1baf7a', label: 'Unterkunft' };
const TRAVEL_FROM_META = { icon: '🛫', color: '#4a3aa7', label: 'Abflug/Abfahrt' };
const TRAVEL_TO_META = { icon: '🛬', color: '#4a3aa7', label: 'Ankunft' };

const tripStore = useTripStore();
const drawers = useDrawersStore();
const excursionsStore = useExcursionsStore();
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const spots = ref<Spot[]>([]);
const loading = ref(true);
const selectedPoint = ref<MapPoint | null>(null);

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let routesLayer: L.LayerGroup | null = null;

// Icons/Bogen-Routen sind in utils/mapRoute.ts ausgelagert (gemeinsamer Cache mit der neuen
// Ausflug-Mini-Karte, ExcursionMiniMap.vue) – hier nur noch ein dünner MapPoint-spezifischer
// Wrapper.
function iconFor(point: MapPoint) {
  return cachedEmojiPin(point.icon, point.color);
}

const points = computed<MapPoint[]>(() => {
  const result: MapPoint[] = [];
  for (const a of accommodations.value) {
    if (a.lat != null && a.lng != null) {
      result.push({
        key: `accommodation-${a.id}`,
        origin: 'accommodation',
        lat: a.lat,
        lng: a.lng,
        title: a.name,
        mapsLink: a.maps_link,
        ...ACCOMMODATION_META,
      });
    }
  }
  for (const t of travelItems.value) {
    // homeSide: bei "Anreise" ist der Startpunkt (from) zuhause, bei "Abreise" der Zielpunkt (to).
    // Bei "Weiterreise" oder ohne gesetzte Rolle zählen beide Seiten sicherheitshalber zum Urlaub.
    if (t.from_lat != null && t.from_lng != null) {
      result.push({
        key: `travel-from-${t.id}`,
        origin: 'travel',
        lat: t.from_lat,
        lng: t.from_lng,
        title: `${t.title} (Abflug/Abfahrt)`,
        homeSide: t.role === 'arrival',
        mapsLink: t.from_maps_link,
        ...TRAVEL_FROM_META,
      });
    }
    if (t.to_lat != null && t.to_lng != null) {
      result.push({
        key: `travel-to-${t.id}`,
        origin: 'travel',
        lat: t.to_lat,
        lng: t.to_lng,
        title: `${t.title} (Ankunft)`,
        homeSide: t.role === 'departure',
        mapsLink: t.to_maps_link,
        ...TRAVEL_TO_META,
      });
    }
  }
  for (const s of spots.value) {
    if (s.lat != null && s.lng != null) {
      const meta = spotCategoryMeta(s.category);
      result.push({
        key: `spot-${s.id}`,
        origin: 'spot',
        lat: s.lat,
        lng: s.lng,
        title: s.title,
        icon: meta.icon,
        color: meta.color,
        label: s.category ?? 'Sonstiges',
        mapsLink: s.maps_link,
      });
    }
  }
  return result;
});

// Für den Urlaubsfokus-Button: alle Punkte außer den Zuhause-Seiten von Anreise/Abreise.
const vacationPoints = computed(() => points.value.filter((p) => !p.homeSide));

// "Auf Karte anzeigen" aus einer Ausflug-Karte (ExcursionCard.vue) fokussiert exklusiv auf dessen
// Stationen – alle anderen Spots werden ausgeblendet, Unterkunft/Reise bleiben sichtbar (zur
// Orientierung), siehe visiblePoints.
const focusedExcursion = computed<Excursion | null>(() => {
  if (drawers.mapFocusExcursionId == null) return null;
  return excursionsStore.excursions.find((e) => e.id === drawers.mapFocusExcursionId) ?? null;
});

const visiblePoints = computed(() => {
  const excursion = focusedExcursion.value;
  if (!excursion) return points.value;
  return points.value.filter((p) => p.origin !== 'spot' || excursion.spot_ids.includes(Number(p.key.slice('spot-'.length))));
});

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [accommodationRes, travelRes, spotsRes] = await Promise.all([
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    api.get<Spot[]>(`/spots?trip_id=${tripId}`),
  ]);
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  spots.value = spotsRes;
}

function selectPoint(point: MapPoint) {
  selectedPoint.value = point;
}

// "In Karten-App öffnen": statt zu raten, welche App installiert ist (dafür gibt es per Web-Link
// plattformübergreifend keinen zuverlässigen Mechanismus), zeigt ein kleines Menü die gängigen
// Apps zur Auswahl – jeweils als offizieller Universal-Link, der die App öffnet, falls installiert,
// und sonst auf die Web-Vorschau ausweicht (funktioniert daher überall, ganz ohne
// User-Agent-Sniffing).
const mapsPickerOpen = ref(false);
// Egal auf welchem Weg selectedPoint wechselt (neuer Punkt, Schließen-Button, fitAll/fitVacation,
// Fokus-Sprung aus einer anderen Sicht) – ein noch offenes Auswahl-Menü vom vorherigen Punkt soll
// dabei nie hängen bleiben.
watch(selectedPoint, () => {
  mapsPickerOpen.value = false;
});

function appleMapsHref(point: MapPoint) {
  return `https://maps.apple.com/?ll=${point.lat},${point.lng}&q=${encodeURIComponent(point.title)}`;
}

function googleMapsHref(point: MapPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

// Zoomt/zentriert auf genau den Ausschnitt, der alle aktuell eingetragenen Orte zeigt – z. B.
// nachdem man vorher auf einen einzelnen Punkt fokussiert hatte (openMapAt) oder sich verzoomt hat.
function fitAll() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  const latLngs = points.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
  selectedPoint.value = null;
}

// Zoomt/zentriert nur auf die Punkte am Urlaubsort – ohne die Zuhause-Seite von Anreise/Abreise
// (vacationPoints), damit man im Urlaub direkt den näheren, relevanten Kartenausschnitt bekommt.
function fitVacation() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  const latLngs = vacationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
  selectedPoint.value = null;
}

const accommodationPoints = computed(() => points.value.filter((p) => p.origin === 'accommodation'));

// Zoomt/zentriert nur auf die Unterkünfte – praktisch bei mehreren Unterkünften im selben Urlaub
// (z. B. Roadtrip), um schnell zwischen ihnen zu vergleichen statt Spots/Reise mit anzuzeigen.
function fitAccommodations() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  const latLngs = accommodationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
  selectedPoint.value = null;
}

// Alle Spots, die (mindestens) einem Ausflug als Station zugeordnet sind – für den Ausflüge-Fokus-
// Button unten. Anders als der einzelne Ausflug-Fokus (drawers.mapFocusExcursionId) bezieht sich
// dieser Button auf ALLE Ausflüge gleichzeitig, blendet also nichts aus, sondern zoomt nur.
const excursionSpotIds = computed(() => new Set(excursionsStore.excursions.flatMap((e) => e.spot_ids)));
const excursionPoints = computed(() =>
  points.value.filter((p) => p.origin === 'spot' && excursionSpotIds.value.has(Number(p.key.slice('spot-'.length)))),
);

// Zoomt/zentriert nur auf die Spots, die irgendeinem Ausflug zugeordnet sind – praktisch, um sich
// schnell einen Überblick über alle geplanten Ausflugsziele zu verschaffen.
function fitExcursions() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  const latLngs = excursionPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
  selectedPoint.value = null;
}

function renderMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const latLngs: L.LatLngExpression[] = [];
  for (const point of visiblePoints.value) {
    const latlng: L.LatLngExpression = [point.lat, point.lng];
    latLngs.push(latlng);
    L.marker(latlng, { icon: iconFor(point) })
      .addTo(markersLayer)
      .on('click', () => selectPoint(point));
  }

  // Ausflug-Fokus hat Vorrang vor mapFocusKey (schließen sich laut drawers-Store ohnehin
  // gegenseitig aus) – zoomt gezielt auf die Stationen des Ausflugs statt auf alle sichtbaren
  // Punkte (die z. B. auch Unterkunft/Reise zur Orientierung enthalten können).
  const excursion = focusedExcursion.value;
  const excursionLatLngs: L.LatLngExpression[] = excursion
    ? visiblePoints.value.filter((p) => p.origin === 'spot').map((p): L.LatLngExpression => [p.lat, p.lng])
    : [];

  // "Auf Karte anzeigen" aus Unterkunft/Reise/Spots öffnet die Schublade und setzt
  // drawers.mapFocusKey – hier zentrieren/hervorheben wir dann direkt auf den Punkt.
  const focusPoint = drawers.mapFocusKey ? points.value.find((p) => p.key === drawers.mapFocusKey) : null;

  if (excursion) {
    if (excursionLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(excursionLatLngs), { padding: [32, 32] });
    } else if (excursionLatLngs.length === 1) {
      map.setView(excursionLatLngs[0], 14);
    }
    selectedPoint.value = null;
  } else if (focusPoint) {
    map.setView([focusPoint.lat, focusPoint.lng], 15);
    selectPoint(focusPoint);
  } else if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  } else {
    map.setView([48.1351, 11.582], 5); // Fallback: Mitteleuropa
  }
}

// Zeichnet Verbindungslinien: je Reise-Eintrag mit Start- UND Zielkoordinaten eine Strecke
// (Flug/Bahn/Auto/…), je Ausflug mit ≥2 verorteten Spots eine Route entlang der Stationen
// (in der Reihenfolge von spot_ids). Rein visuell, keine echte Routenführung entlang von Straßen.
function renderRoutes() {
  if (!map || !routesLayer) return;
  routesLayer.clearLayers();

  for (const t of travelItems.value) {
    if (t.from_lat != null && t.from_lng != null && t.to_lat != null && t.to_lng != null) {
      L.polyline(arcRoute([[t.from_lat, t.from_lng], [t.to_lat, t.to_lng]]), {
        color: TRAVEL_FROM_META.color,
        weight: 3,
        opacity: 0.65,
        dashArray: '6 6',
      }).addTo(routesLayer);
    }
  }

  // Im Ausflug-Fokus nur dessen eigene Route zeichnen, nicht die aller anderen Ausflüge.
  const excursionsToDraw = focusedExcursion.value ? [focusedExcursion.value] : excursionsStore.excursions;
  for (const excursion of excursionsToDraw) {
    const coords: L.LatLngExpression[] = [];
    for (const spotId of excursion.spot_ids) {
      const spot = spots.value.find((s) => s.id === spotId);
      if (spot?.lat != null && spot?.lng != null) coords.push([spot.lat, spot.lng]);
    }
    if (coords.length >= 2) {
      L.polyline(arcRoute(coords), { color: '#e08e45', weight: 3, opacity: 0.65, dashArray: '6 6' }).addTo(routesLayer);
    }
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await loadAll();
  loading.value = false;
  // Der Karten-Container steckt hinter v-if="!loading" und existiert im DOM
  // erst, nachdem Vue den Zustandswechsel gerendert hat – ohne nextTick() ist
  // mapEl.value hier immer noch null und die Karte wird nie initialisiert.
  await nextTick();

  if (!mapEl.value) return;
  map = L.map(mapEl.value);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);
  // routesLayer vor markersLayer hinzufügen, damit Routen-Linien unter den (klickbaren) Pins
  // liegen statt sie zu verdecken.
  routesLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
  renderRoutes();

  // Leaflet misst die Containergröße nur einmal beim Initialisieren und merkt sich das intern –
  // ändert sich die Größe danach (Schublade öffnet/schließt, wird per Anfasser breiter/schmaler
  // gezogen, Fenster wird verändert), rendert die Karte sonst nur den halben Ausschnitt statt
  // sich neu zu berechnen. ResizeObserver deckt alle diese Fälle einheitlich ab.
  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

// MapView ist nicht mehr Teil des per Urlaub-Id gekeyten <router-view> (jetzt global gemountete
// Schublade), muss also selbst auf einen Urlaubswechsel reagieren statt sich neu zu mounten.
watch(
  () => tripStore.currentTripId,
  async () => {
    await loadAll();
    renderMarkers();
    renderRoutes();
  },
);

// Die Karte ist eine global gemountete Schublade (nicht mehr an eine Route gebunden) und bleibt
// dauerhaft im Hintergrund geladen – beim Öffnen einmal neu laden, damit Änderungen aus der
// Ausflüge-/Unterkunft-/Reise-Sicht (die diese Karte nicht direkt beobachten) sichtbar werden.
watch(
  () => drawers.mapOpen,
  (open) => {
    if (open) {
      loadAll().then(() => {
        renderMarkers();
        renderRoutes();
      });
    }
  },
);

// Fokus-Punkt kann sich ändern, während die Karte schon offen/gemountet ist (z. B. zweites
// "Auf Karte anzeigen" direkt hintereinander).
watch(
  () => drawers.mapFocusKey,
  () => renderMarkers(),
);

// Ausflug-Fokus (Button "Auf Karte anzeigen" in ExcursionCard.vue) blendet andere Spots aus und
// zeichnet nur dessen eigene Route – beides betrifft Marker UND Routen, daher hier beide neu
// rendern statt nur renderMarkers() wie beim einfachen Punkt-Fokus oben.
watch(
  () => drawers.mapFocusExcursionId,
  () => {
    renderMarkers();
    renderRoutes();
  },
);

// Ausflüge werden im excursions-Store gehalten (u. a. für Drag&Drop in die Kalender-Schublade) und
// erst asynchron geladen – ändert sich die Liste (z. B. Spot-Zuordnung bearbeitet), müssen die
// Ausflugs-Routen neu gezeichnet werden.
watch(
  () => excursionsStore.excursions,
  () => renderRoutes(),
  { deep: true },
);

// Unterkunft/Reise/Spots liegen (anders als Ausflüge) nicht in einem gemeinsamen Store, sondern
// als lokaler State in den jeweiligen Sichten – ohne dieses Signal würde ein frisch hinzugefügter
// Maps-Link erst nach Schließen+Wiederöffnen der Karten-Schublade sichtbar (siehe watch auf
// drawers.mapOpen oben). drawers.touchLocations() wird von Unterkunft-/Reise-/Ausflüge-Sicht nach
// jedem erfolgreichen Anlegen/Bearbeiten eines Orts aufgerufen.
watch(
  () => drawers.locationsVersion,
  async () => {
    await loadAll();
    renderMarkers();
    renderRoutes();
  },
);
</script>

<template>
  <div class="karte" v-if="!loading">
    <h2 class="title">Karte</h2>
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <button
        type="button"
        class="fit-btn"
        title="Alle eingetragenen Orte anzeigen"
        aria-label="Alle eingetragenen Orte anzeigen"
        :disabled="!points.length"
        @click="fitAll"
      >
        🔍
      </button>
      <button
        type="button"
        class="fit-btn vacation-btn"
        title="Nur Urlaubsort fokussieren (ohne Start-/Zielpunkt zuhause)"
        aria-label="Nur Urlaubsort fokussieren"
        :disabled="!vacationPoints.length"
        @click="fitVacation"
      >
        🏖️
      </button>
      <button
        type="button"
        class="fit-btn accommodation-btn"
        title="Nur Unterkünfte fokussieren"
        aria-label="Nur Unterkünfte fokussieren"
        :disabled="!accommodationPoints.length"
        @click="fitAccommodations"
      >
        🛏️
      </button>
      <button
        type="button"
        class="fit-btn excursions-btn"
        title="Nur Ausflugsziele fokussieren"
        aria-label="Nur Ausflugsziele fokussieren"
        :disabled="!excursionPoints.length"
        @click="fitExcursions"
      >
        🎒
      </button>
      <div class="focus-banner" v-if="focusedExcursion">
        <span>🎒 {{ focusedExcursion.title }}</span>
        <button type="button" class="card-action-btn" @click="drawers.mapFocusExcursionId = null">
          ✕ Fokus verlassen
        </button>
      </div>
    </div>

    <div class="card info-panel" v-if="selectedPoint">
      <button type="button" class="close-btn" aria-label="Schließen" @click="selectedPoint = null">✕</button>
      <div class="info-head">
        <span class="info-icon">{{ selectedPoint.icon }}</span>
        <div>
          <h3>{{ selectedPoint.title }}</h3>
          <span class="info-category">{{ selectedPoint.label }}</span>
        </div>
      </div>
      <div class="info-actions">
        <div class="maps-picker">
          <button type="button" class="card-action-btn" @click="mapsPickerOpen = !mapsPickerOpen">
            🗺️ In Karten-App öffnen ↗
          </button>
          <template v-if="mapsPickerOpen">
            <div class="picker-backdrop" @click="mapsPickerOpen = false"></div>
            <div class="picker-menu">
              <a
                :href="appleMapsHref(selectedPoint)"
                target="_blank"
                rel="noopener"
                @click="mapsPickerOpen = false"
              >
                🍎 Apple Maps
              </a>
              <a
                :href="googleMapsHref(selectedPoint)"
                target="_blank"
                rel="noopener"
                @click="mapsPickerOpen = false"
              >
                🗺️ Google Maps
              </a>
              <a
                v-if="selectedPoint.mapsLink"
                :href="selectedPoint.mapsLink"
                target="_blank"
                rel="noopener"
                @click="mapsPickerOpen = false"
              >
                🔗 Ursprünglichen Link öffnen
              </a>
            </div>
          </template>
        </div>
        <router-link v-if="selectedPoint.origin === 'accommodation'" to="/accommodation" class="card-action-btn">
          Zur Unterkunft
        </router-link>
        <router-link v-else-if="selectedPoint.origin === 'travel'" to="/travel" class="card-action-btn">
          Zur Reise
        </router-link>
        <router-link v-else to="/excursions" class="card-action-btn"> Zu den Spots </router-link>
      </div>
    </div>

    <p v-if="!points.length" class="empty">
      Noch keine Orte mit Koordinaten hinterlegt. Füge bei Unterkunft, Reise-Einträgen oder Spots
      einen Maps-Link (Google/Apple) hinzu, damit sie hier erscheinen.
    </p>
  </div>
</template>

<style scoped>
.karte {
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.map-wrap {
  position: relative;
}

.map {
  height: 55vh;
  min-height: 320px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.fit-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 2px solid rgba(0, 0, 0, 0.25);
  color: var(--color-text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.fit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vacation-btn {
  top: 50px;
}

.accommodation-btn {
  top: 90px;
}

.excursions-btn {
  top: 130px;
}

.focus-banner {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  max-width: calc(100% - 60px);
}

.focus-banner span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Die OpenStreetMap-Kacheln selbst kennen keinen Dark Mode – ein Farb-Invert nur auf der
   Kachel-Ebene (nicht auf Markern/Popups) sorgt für eine abgedunkelte Karte statt eines
   grellen weißen Rechtecks im ansonsten dunklen UI. */
:root[data-theme='dark'] .map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}

.info-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  padding: 4px;
  line-height: 1;
}

.info-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.info-icon {
  font-size: 1.6rem;
}

.info-head h3 {
  margin: 0;
  font-size: 1rem;
}

.info-category {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.info-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.maps-picker {
  position: relative;
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.picker-menu a:hover {
  background: var(--color-hover);
}

.empty {
  color: var(--color-text-muted);
}
</style>
