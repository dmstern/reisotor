<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type { Accommodation, Excursion, ExcursionComment, ExcursionLike, Spot, TravelItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useAuthStore } from '../stores/auth';
import { spotCategoryMeta } from '../utils/spotCategory';
import { arcRoute, cachedEmojiPin } from '../utils/mapRoute';
import { resolveStations, type ExcursionStation } from '../utils/excursionStations';
import SpotDetailDialog from './SpotDetailDialog.vue';
import MiniStationCard from './MiniStationCard.vue';
import ExcursionDetailDialog from './ExcursionDetailDialog.vue';
import AccommodationDetailDialog from './AccommodationDetailDialog.vue';
import TravelDetailDialog from './TravelDetailDialog.vue';

// Die Karte ist ein generischer, reiner Pin-Layer (kein Anlegen/Bearbeiten hier): sie zeigt
// automatisch jedes Objekt des aktuellen Urlaubs mit hinterlegtem Standort – Unterkunft, Reise
// (Abflug/Ankunft) und Spots. Ein Klick auf einen Punkt zeigt eine kurze Info mit einem
// Sprung-Button zur jeweiligen Ursprungssicht (Architekturregel Batch 3).
//
// Anders als die frühere Schubladen-Version (MapView.vue) ist diese Komponente dauerhaft Teil
// der Karte-Hauptsicht (ExcursionsView.vue) statt lazy per Schublade ein-/ausgeblendet zu
// werden – Laden/Neuladen läuft daher nur noch über Datenänderungen (Urlaubswechsel,
// locationsVersion), nicht mehr über ein "beim Öffnen"-Signal.
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

const emit = defineEmits<{
  // Bearbeiten eines Spots: die Karte besitzt kein eigenes Formular, lebt aber (anders als
  // Ausflüge/Unterkunft/Reise) im selben Komponentenbaum wie die echte Spots-Bearbeiten-Form
  // (beide Teil der Karte-Hauptsicht) – kein Routen-Sprung nötig, nur ein Emit nach oben.
  (e: 'edit-spot', spot: Spot): void;
}>();

const router = useRouter();
const tripStore = useTripStore();
const drawers = useDrawersStore();
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const auth = useAuthStore();
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const selectedPoint = ref<MapPoint | null>(null);

// Eigener kleiner users-Fetch: nur für die Autor-Anzeige im Spot-/Ausflug-Detail-Dialog gebraucht,
// die sich aus der Stationsliste heraus öffnen lassen (siehe unten) – gleiches Vorgehen wie in
// anderen Views, die /users unabhängig voneinander laden, statt einen weiteren globalen Store
// dafür anzulegen.
const users = ref<User[]>([]);

// Likes/Kommentare von Ausflügen liegen (wie in ExcursionsView.vue) nicht im excursions-Store,
// sondern weiterhin lokal an ideas/idea_likes/idea_comments gebunden – hier eigens geladen, damit
// der Ausflug-Detail-Dialog (unten, Klick auf den Kartentitel unter der Karte) dieselben Daten
// zeigen kann wie in der Ausflüge-Sicht.
const ideaLikes = ref<ExcursionLike[]>([]);
const ideaComments = ref<ExcursionComment[]>([]);

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  for (const s of spotsStore.spots) {
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

// Tages-Fokus (ScheduleView.vue's "🗺️ Tag auf Karte anzeigen"): alle an diesem Tag geplanten
// Ausflüge zusammen (kann mehrere sein, z. B. mehrere spontan eingeplante Einzel-Spots ohne
// gemeinsamen Ausflug) – exklusiv zum Ausflug-Fokus oben, daher nur ausgewertet, wenn keiner
// aktiv ist.
const focusedDateExcursions = computed<Excursion[]>(() => {
  if (focusedExcursion.value || !drawers.mapFocusDate) return [];
  return excursionsStore.excursions.filter((e) => e.date === drawers.mapFocusDate);
});
const focusedDateStations = computed<ExcursionStation[]>(() =>
  focusedDateExcursions.value.flatMap((e) =>
    resolveStations(e.station_keys, spotsStore.spots, accommodations.value, travelItems.value),
  ),
);

const visiblePoints = computed(() => {
  const excursion = focusedExcursion.value;
  if (excursion) {
    return points.value.filter((p) => p.origin !== 'spot' || excursion.station_keys.includes(p.key));
  }
  if (drawers.mapFocusDate) {
    const keys = new Set(focusedDateStations.value.map((s) => s.key));
    return points.value.filter((p) => p.origin !== 'spot' || keys.has(p.key));
  }
  return points.value;
});

// Stationsliste unter der Karte bei Ausflug-Fokus: in station_keys-Reihenfolge (= Route/Abklapper-
// Reihenfolge), als aufgelöste ExcursionStation-Objekte (statt MapPoint) für MiniStationCard und
// damit dieselbe Station mehrfach vorkommen kann (Rundgang, z. B. Start UND Ende an der
// Unterkunft) – ein MapPoint-Lookup per Key wäre dafür ungeeignet, da mehrere Stationen dann
// denselben Key/dieselbe Referenz teilen. Eine Station ist nicht zwingend ein echter Spot (siehe
// utils/excursionStations.ts).
const focusedExcursionStations = computed<ExcursionStation[]>(() => {
  const excursion = focusedExcursion.value;
  if (!excursion) return [];
  return resolveStations(excursion.station_keys, spotsStore.spots, accommodations.value, travelItems.value);
});

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [accommodationRes, travelRes, ideaLikesRes, ideaCommentsRes] = await Promise.all([
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
    api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
  ]);
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  ideaLikes.value = ideaLikesRes;
  ideaComments.value = ideaCommentsRes;
  // Spots kommen jetzt aus dem geteilten spotsStore (reaktiv, wird u. a. von ExcursionsView.vue
  // selbst aktuell gehalten) – kein eigener Fetch/Refresh-Trigger hier mehr nötig.
}

function selectPoint(point: MapPoint) {
  selectedPoint.value = point;
}

// Klick auf eine Zeile in der Stationsliste öffnet den vollständigen Spot-Detail-Dialog (statt nur
// des kleinen Info-Panels wie bei einem Pin-Klick) – die Liste besteht ausschließlich aus Spots
// (Stationen eines Ausflugs), daher hier kein origin-Check nötig. "welcher Spot" (openSpotId) und
// "ist der Dialog offen" (spotDialogOpen) bewusst getrennt: SpotDetailDialog.vue braucht ein
// echtes Spot-Objekt als Prop (nicht nullable), müsste beim Schließen also sonst komplett aus dem
// DOM entfernt werden (v-if) statt nur unsichtbar zu werden – das würde Modal.vue's eigene
// Fade-Out-Transition abschneiden, da sie nie zum Abspielen kommt.
const openSpotId = ref<number | null>(null);
const spotDialogOpen = ref(false);
const openSpot = computed(() => spotsStore.spots.find((s) => s.id === openSpotId.value) ?? null);
function openSpotDetail(spotId: number) {
  openSpotId.value = spotId;
  spotDialogOpen.value = true;
}
function spotCreatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function spotCommentItemsFor(spotId: number) {
  return spotsStore.commentsFor(spotId).map((c) => ({
    id: c.id,
    avatar: users.value.find((u) => u.id === c.author_id)?.avatar ?? '❓',
    username: users.value.find((u) => u.id === c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
// Bearbeiten öffnet die echte Spots-Bearbeiten-Form der Karte-Hauptsicht (beide Teil desselben
// Komponentenbaums, siehe emit-Deklaration oben) – kein Routen-Sprung mehr nötig.
function editOpenSpot() {
  if (!openSpot.value) return;
  spotDialogOpen.value = false;
  emit('edit-spot', openSpot.value);
}

// Klick auf den Ausflug-Titel unter der Karte öffnet dessen Detail-Dialog (dieselbe Komponente wie
// in ExcursionsView.vue) – "welcher Ausflug" (openExcursionId) und "ist der Dialog offen"
// (excursionDetailOpen) bewusst getrennt, gleicher Grund wie bei openSpotId/spotDialogOpen oben.
const openExcursionId = ref<number | null>(null);
const excursionDetailOpen = ref(false);
const openExcursion = computed(() => excursionsStore.excursions.find((e) => e.id === openExcursionId.value) ?? null);
function openExcursionDetail() {
  if (!focusedExcursion.value) return;
  openExcursionId.value = focusedExcursion.value.id;
  excursionDetailOpen.value = true;
}
function ideaCreatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function ideaLikeCount(ideaId: number) {
  return ideaLikes.value.filter((l) => l.idea_id === ideaId).length;
}
function ideaLikedByMe(ideaId: number) {
  return ideaLikes.value.some((l) => l.idea_id === ideaId && l.user_id === auth.user?.id);
}
function ideaCommentItemsFor(ideaId: number) {
  return ideaComments.value
    .filter((c) => c.idea_id === ideaId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => ({
      id: c.id,
      avatar: users.value.find((u) => u.id === c.author_id)?.avatar ?? '❓',
      username: users.value.find((u) => u.id === c.author_id)?.username ?? '?',
      content: c.content,
      canRemove: c.author_id === auth.user?.id,
    }));
}
async function toggleIdeaLike(ideaId: number) {
  const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);
  if (result.liked) {
    ideaLikes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user!.id });
  } else {
    ideaLikes.value = ideaLikes.value.filter((l) => !(l.idea_id === ideaId && l.user_id === auth.user!.id));
  }
}
async function submitIdeaComment(ideaId: number, content: string) {
  const created = await api.post<ExcursionComment>(`/ideas/${ideaId}/comments`, { content });
  ideaComments.value.push(created);
}
async function removeIdeaComment(id: number) {
  await api.delete(`/ideas/comments/${id}`);
  ideaComments.value = ideaComments.value.filter((c) => c.id !== id);
}
// Bearbeiten eines Ausflugs (oder einer seiner Stationen) braucht das echte Formular, das nur die
// Ausflüge-Schublade besitzt (eigenständig gemountet, kein gemeinsamer Eltern-Scope mit der
// Karte-Hauptsicht) – daher hier nur die Schublade öffnen statt eines Emits, die Nutzerin findet
// den Ausflug dort selbst (Architekturregel: fremde Objekte nur lesend/verknüpfend).
function editOpenExcursion() {
  excursionDetailOpen.value = false;
  drawers.excursionsOpen = true;
}

// Klick auf eine Unterkunft-/Reise-Station in der Stationsliste öffnet den echten Unterkunft-/
// Reise-Dialog (nicht mehr einen Spot-Dialog für einen künstlich angelegten Spot, siehe Backend-
// Umbau) – gleiches "welches Objekt"/"ist offen"-Trennungsmuster wie oben bei Spots/Ausflügen.
const openAccommodationId = ref<number | null>(null);
const accommodationDialogOpen = ref(false);
const openAccommodation = computed(() => accommodations.value.find((a) => a.id === openAccommodationId.value) ?? null);

const openTravelId = ref<number | null>(null);
const travelDialogOpen = ref(false);
const openTravel = computed(() => travelItems.value.find((t) => t.id === openTravelId.value) ?? null);

function openStationDetail(station: ExcursionStation) {
  if (station.kind === 'spot') {
    openSpotDetail(station.id);
  } else if (station.kind === 'accommodation') {
    openAccommodationId.value = station.id;
    accommodationDialogOpen.value = true;
  } else {
    openTravelId.value = station.id;
    travelDialogOpen.value = true;
  }
}
// Unterkunft/Reise bleiben eigene, echte Routen (anders als Ausflüge/Spots) – hier weiterhin ein
// echter Sprung.
function editOpenAccommodation() {
  accommodationDialogOpen.value = false;
  router.push('/accommodation');
}
function editOpenTravel() {
  travelDialogOpen.value = false;
  router.push('/travel');
}
function payerLabelFor(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
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
  drawers.mapFocusDate = null;
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
  drawers.mapFocusDate = null;
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
  drawers.mapFocusDate = null;
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
// dieser Button auf ALLE Ausflüge gleichzeitig, blendet also nichts aus, sondern zoomt nur. Bewusst
// weiterhin nur auf echte Spot-Stationen beschränkt (Button-Icon 🎒 "Ausflugsziele"), nicht auf
// Unterkunft/Reise-Stationen – die sind über die eigenen Fokus-Buttons bereits erreichbar.
const excursionSpotIds = computed(
  () =>
    new Set(
      excursionsStore.excursions.flatMap((e) =>
        e.station_keys.filter((k) => k.startsWith('spot-')).map((k) => Number(k.slice('spot-'.length))),
      ),
    ),
);
const excursionPoints = computed(() =>
  points.value.filter((p) => p.origin === 'spot' && excursionSpotIds.value.has(Number(p.key.slice('spot-'.length)))),
);

// Zoomt/zentriert nur auf die Spots, die irgendeinem Ausflug zugeordnet sind – praktisch, um sich
// schnell einen Überblick über alle geplanten Ausflugsziele zu verschaffen.
function fitExcursions() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
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

  const dateLatLngs: L.LatLngExpression[] =
    !excursion && drawers.mapFocusDate
      ? focusedDateStations.value
          .filter((s) => s.lat != null && s.lng != null)
          .map((s): L.LatLngExpression => [s.lat as number, s.lng as number])
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
  } else if (drawers.mapFocusDate && dateLatLngs.length) {
    if (dateLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(dateLatLngs), { padding: [32, 32] });
    } else {
      map.setView(dateLatLngs[0], 14);
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
// (Flug/Bahn/Auto/…), je Ausflug mit ≥2 verorteten Stationen eine Route entlang der Stationen
// (in der Reihenfolge von station_keys). Rein visuell, keine echte Routenführung entlang von
// Straßen. Im Tages-Fokus wird stattdessen eine einzige, zusammenhängende Route über alle
// Stationen ALLER Ausflüge dieses Tages gezeichnet (statt je Ausflug eine eigene) – analog zum
// Ausflug-Fokus, der ebenfalls nur dessen eigene Route statt aller Ausflüge zeigt.
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

  if (!focusedExcursion.value && drawers.mapFocusDate) {
    const coords: L.LatLngExpression[] = focusedDateStations.value
      .filter((s) => s.lat != null && s.lng != null)
      .map((s): L.LatLngExpression => [s.lat as number, s.lng as number]);
    if (coords.length >= 2) {
      L.polyline(arcRoute(coords), { color: '#e08e45', weight: 3, opacity: 0.65, dashArray: '6 6' }).addTo(routesLayer);
    }
    return;
  }

  // Im Ausflug-Fokus nur dessen eigene Route zeichnen, nicht die aller anderen Ausflüge.
  const excursionsToDraw = focusedExcursion.value ? [focusedExcursion.value] : excursionsStore.excursions;
  for (const excursion of excursionsToDraw) {
    const stations = resolveStations(excursion.station_keys, spotsStore.spots, accommodations.value, travelItems.value);
    const coords: L.LatLngExpression[] = stations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat as number, s.lng as number]);
    if (coords.length >= 2) {
      L.polyline(arcRoute(coords), { color: '#e08e45', weight: 3, opacity: 0.65, dashArray: '6 6' }).addTo(routesLayer);
    }
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  const [, , usersRes] = await Promise.all([loadAll(), spotsStore.load(), api.get<User[]>('/users')]);
  users.value = usersRes;

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
  // ändert sich die Größe danach (Fenster wird verändert, Layout-Spalten ändern ihr Verhältnis),
  // rendert die Karte sonst nur den halben Ausschnitt statt sich neu zu berechnen. ResizeObserver
  // deckt alle diese Fälle einheitlich ab.
  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

// TripMap ist dauerhaft Teil der Karte-Hauptsicht (kein Schubladen-Toggle mehr, das früher ein
// Neuladen "beim Öffnen" auslöste) – reagiert stattdessen direkt auf Datenänderungen.
watch(
  () => tripStore.currentTripId,
  async () => {
    await loadAll();
    renderMarkers();
    renderRoutes();
  },
);

// Fokus-Punkt kann sich ändern, während die Karte bereits sichtbar ist (z. B. zweites
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

// Tages-Fokus (ScheduleView.vue's "🗺️ Tag auf Karte anzeigen") – gleicher Grund wie beim
// Ausflug-Fokus oben (betrifft Marker UND Route).
watch(
  () => drawers.mapFocusDate,
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
// als lokaler State in dieser Komponente – ohne dieses Signal würde ein frisch hinzugefügter
// Maps-Link erst nach einem Reload sichtbar. drawers.touchLocations() wird von Unterkunft-/Reise-/
// Ausflüge-Sicht nach jedem erfolgreichen Anlegen/Bearbeiten eines Orts aufgerufen.
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
  <div class="karte">
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
      <div class="focus-banner" v-else-if="drawers.mapFocusDate">
        <span>🗓️ {{ formatDate(drawers.mapFocusDate) }}</span>
        <button type="button" class="card-action-btn" @click="drawers.mapFocusDate = null">✕ Fokus verlassen</button>
      </div>
    </div>

    <div class="card focus-spot-list" v-if="focusedExcursion && focusedExcursionStations.length">
      <button type="button" class="focus-spot-list-header" @click="openExcursionDetail">
        <h3 class="focus-spot-list-title">🎒 {{ focusedExcursion.title }}</h3>
        <span class="focus-spot-list-status" :class="{ planned: focusedExcursion.date }">
          {{ focusedExcursion.date ? `📅 ${formatDate(focusedExcursion.date)}` : 'In Planung' }}
        </span>
      </button>
      <p class="focus-spot-list-subtitle">Stationen</p>
      <div class="station-timeline">
        <template v-for="(station, index) in focusedExcursionStations" :key="index">
          <button type="button" class="station-node" @click="openStationDetail(station)">
            <span class="station-order">{{ index + 1 }}</span>
            <MiniStationCard :station="station" />
          </button>
          <div v-if="index < focusedExcursionStations.length - 1" class="station-connector" aria-hidden="true"></div>
        </template>
      </div>
    </div>

    <div class="card focus-spot-list" v-else-if="drawers.mapFocusDate && focusedDateStations.length">
      <h3 class="focus-spot-list-title">🗓️ {{ formatDate(drawers.mapFocusDate) }}</h3>
      <p class="focus-spot-list-subtitle">Stationen</p>
      <div class="station-timeline">
        <template v-for="(station, index) in focusedDateStations" :key="index">
          <button type="button" class="station-node" @click="openStationDetail(station)">
            <span class="station-order">{{ index + 1 }}</span>
            <MiniStationCard :station="station" />
          </button>
          <div v-if="index < focusedDateStations.length - 1" class="station-connector" aria-hidden="true"></div>
        </template>
      </div>
    </div>

    <SpotDetailDialog
      v-if="openSpot"
      v-model="spotDialogOpen"
      :spot="openSpot"
      :creator-label="spotCreatorLabel(openSpot.created_by)"
      :like-count="spotsStore.likeCountFor(openSpot.id)"
      :liked="spotsStore.likedByMe(openSpot.id, auth.user?.id)"
      :comments="spotCommentItemsFor(openSpot.id)"
      @edit="editOpenSpot"
      @toggle-like="spotsStore.toggleLike(openSpot.id, auth.user!.id)"
      @submit-comment="(content) => spotsStore.submitComment(openSpot!.id, content)"
      @remove-comment="spotsStore.removeComment"
      @show-on-map="spotDialogOpen = false"
    />

    <ExcursionDetailDialog
      v-if="openExcursion"
      v-model="excursionDetailOpen"
      :excursion="openExcursion"
      :creator-label="ideaCreatorLabel(openExcursion.created_by)"
      :like-count="ideaLikeCount(openExcursion.id)"
      :liked="ideaLikedByMe(openExcursion.id)"
      :comments="ideaCommentItemsFor(openExcursion.id)"
      :stations="spotsStore.spots"
      :accommodations="accommodations"
      :travel-items="travelItems"
      @edit="editOpenExcursion"
      @toggle-like="toggleIdeaLike(openExcursion.id)"
      @submit-comment="(content) => submitIdeaComment(openExcursion!.id, content)"
      @remove-comment="removeIdeaComment"
      @show-on-map="excursionDetailOpen = false"
      @edit-station-spot="editOpenExcursion"
    />

    <AccommodationDetailDialog
      v-if="openAccommodation"
      v-model="accommodationDialogOpen"
      :accommodation="openAccommodation"
      :payer-label="payerLabelFor(openAccommodation.paid_by_user_id)"
      @edit="editOpenAccommodation"
      @show-on-map="accommodationDialogOpen = false"
    />

    <TravelDetailDialog
      v-if="openTravel"
      v-model="travelDialogOpen"
      :item="openTravel"
      :payer-label="payerLabelFor(openTravel.paid_by_user_id)"
      @edit="editOpenTravel"
      @show-on-map-from="travelDialogOpen = false"
      @show-on-map-to="travelDialogOpen = false"
    />

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
  gap: var(--space-3);
}

.map-wrap {
  position: relative;
}

.map {
  height: 70vh;
  min-height: 420px;
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

.focus-spot-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Klickbarer Titel-Bereich: öffnet den Ausflug-Detail-Dialog (ExcursionDetailDialog.vue) – dieselbe
   Komponente wie in der Ausflüge-Schublade, hier per eigenem Likes-/Kommentar-Fetch gefüttert. */
.focus-spot-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  background: none;
  border: none;
  padding: 4px;
  margin: -4px -4px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.focus-spot-list-header:hover {
  background: var(--color-hover);
}

.focus-spot-list-title {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-primary-dark);
}

.focus-spot-list-status {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.focus-spot-list-status.planned {
  color: var(--color-success);
}

.focus-spot-list-subtitle {
  margin: 0 0 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Timeline-Optik identisch zu ExcursionDetailDialog.vue's Stationsliste (Nummern-Badge +
   Mini-Vorschaubild + gestrichelte Verbindung) – bewusst dieselben Klassen/Werte, damit dieselbe
   Ausflug-Reihenfolge überall gleich aussieht. */
.station-timeline {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 12px 10px 8px 14px;
}

.station-node {
  position: relative;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.station-order {
  position: absolute;
  top: -6px;
  left: -6px;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.station-connector {
  flex: 0 0 24px;
  height: 0;
  border-top: 3px dashed var(--color-primary);
  margin: 0 4px;
  align-self: center;
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
