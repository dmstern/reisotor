<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type {
  Accommodation,
  Excursion,
  ExcursionComment,
  ExcursionLike,
  ScheduleItem,
  Spot,
  TravelItem,
  TravelPlace,
  User,
} from '../api/types';
import { buildDayStations } from '../utils/dayStations';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';
import { spotCategoryMeta } from '../utils/spotCategory';
import { buildTravelDerivedLocations } from '../utils/travelDerivedLocations';
import { arcRoute, cachedEmojiPin, pulsingEmojiPin } from '../utils/mapRoute';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { resolveStations, type ExcursionStation } from '../utils/excursionStations';
import { useIsDesktop } from '../composables/useIsDesktop';
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
  /** Für Kategorie-Filter/-Fokus-Kopplung mit der Spots-Sicht (ExcursionsView.vue): bei Spots die
   *  echte Kategorie (bzw. "Sonstiges"), bei Unterkunft/Reise die dortige Sammel-Kategorie
   *  ("Unterkunft"/"Reise") – identisch zu ExcursionsView.vue's itemCategory()/DerivedLocation.category,
   *  damit derselbe Filter/dieselbe Kategorie-Navigation für Liste UND Karte gilt. */
  category: string;
  /** Zuhause-Seite eines Reise-Eintrags (Startpunkt der Anreise / Zielpunkt der Abreise) – wird
   *  vom Urlaubsfokus-Button ausgeblendet, siehe vacationPoints. */
  homeSide?: boolean;
}

const ACCOMMODATION_META = { icon: '🛏️', color: '#1baf7a' };
const TRAVEL_COLOR = '#4a3aa7';

const props = defineProps<{
  /** Von ExcursionsView.vue durchgereichter Kategorie-Filter der Spots-Liste (leer = alles
   *  anzeigen) – koppelt den Karten-Inhalt 1:1 mit dem, was in der Liste sichtbar ist, statt einen
   *  zweiten, unabhängigen Filter zu pflegen. */
  categoryFilter?: string[];
  /** Von ExcursionsView.vue durchgereichter Geplant/Ungeplant-Filter der Spots-Liste (leer = alles
   *  anzeigen) – gilt nur für Spot-Punkte (Unterkunft/Reise kennen dieses Konzept nicht, siehe
   *  ExcursionsView.vue's itemStatus()). Braucht keine eigenen scheduleItems von außen: diese
   *  Komponente lädt ihre eigenen (scheduleItems.value, siehe loadAll()) ohnehin schon unabhängig
   *  von ExcursionsView.vue (gleiches Muster wie die übrige, bewusst duplizierte Datenladung
   *  zwischen beiden Sichten). */
  statusFilter?: ('planned' | 'unplanned')[];
  /** Höhe (px) des von der mobilen Spots-Schublade verdeckten unteren Kartenbereichs, von
   *  ExcursionsView.vue durchgereicht (0/undefined auf Desktop, wo die Schublade eine eigene Spalte
   *  statt eines Overlays ist) – siehe centerOnPoint() unten. */
  coveredBottomPx?: number;
}>();

const emit = defineEmits<{
  // Bearbeiten eines Spots: die Karte besitzt kein eigenes Formular, lebt aber (anders als
  // Ausflüge/Unterkunft/Reise) im selben Komponentenbaum wie die echte Spots-Bearbeiten-Form
  // (beide Teil der Karte-Hauptsicht) – kein Routen-Sprung nötig, nur ein Emit nach oben.
  (e: 'edit-spot', spot: Spot): void;
  // Klick auf einen Spot-Pin (nicht Unterkunft/Reise, siehe handlePointClick): statt eines eigenen
  // Modal-Dialogs (der die Karte dahinter blockieren würde) klappt die passende Spot-Karte in der
  // Liste auf – die kennt TripMap.vue nicht direkt, daher Emit an die Karte-Hauptsicht.
  (e: 'focus-spot', spotId: number): void;
}>();

const router = useRouter();
const isDesktop = useIsDesktop();
// #map-focus-dock (ExcursionsView.vue) ist ein Geschwister-Element, das im selben Render-Takt wie
// diese Komponente entsteht (beide hinter demselben v-if="!loading") – Teleport muss sein Ziel beim
// eigenen Mount bereits im Dokument vorfinden, sonst bricht es dauerhaft ab (Vue-Warnung "Failed to
// locate Teleport target"). Ein Tick Verzögerung reicht: dann ist das Geschwister-Element sicher
// eingehängt.
const teleportReady = ref(false);
onMounted(() => {
  nextTick(() => {
    teleportReady.value = true;
  });
});
const tripStore = useTripStore();
const drawers = useDrawersStore();
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const auth = useAuthStore();
const liveSync = useLiveSyncStore();
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const travelPlaces = ref<TravelPlace[]>([]);
const scheduleItems = ref<ScheduleItem[]>([]);

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
// Eigener Layer für Live-Standort-Marker (eigener + andere Mitglieder), getrennt von markersLayer:
// renderMarkers() räumt bei jedem Aufruf ALLE seine Marker komplett ab und baut sie neu auf (siehe
// dortiger Kommentar) – bei häufigen GPS-Updates würde das unnötig auch alle anderen, unveränderten
// Punkte (Unterkunft/Reise/Spots) mit flackern lassen.
let positionsLayer: L.LayerGroup | null = null;
// Eigener Standort kommt direkt aus dem lokalen navigator.geolocation-Callback (aktuellster Stand,
// keine Netzwerk-Latenz) statt aus liveSync.memberPositions – die Store-Seite filtert den eigenen
// Nutzer dort bewusst heraus (gleiches Muster wie bei onlineUserIds/Präsenz).
const ownPosition = ref<{ lat: number; lng: number } | null>(null);
let geoWatchId: number | null = null;

// Icons/Bogen-Routen sind in utils/mapRoute.ts ausgelagert (gemeinsamer Cache mit der neuen
// Ausflug-Mini-Karte, ExcursionMiniMap.vue) – hier nur noch ein dünner MapPoint-spezifischer
// Wrapper.
function iconFor(point: MapPoint) {
  return cachedEmojiPin(point.icon, point.color, point.key === drawers.mapFocusKey);
}

function formatDate(d: string) {
  return formatDateShared(d);
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
        category: 'Unterkunft',
        icon: ACCOMMODATION_META.icon,
        color: ACCOMMODATION_META.color,
      });
    }
  }
  // buildTravelDerivedLocations() dedupliziert bereits über from_place_id/to_place_id (bzw.
  // gerundete lat/lng) – ohne das zeigte z. B. der Zielflughafen von Hin- UND Rückflug zwei
  // übereinanderliegende Pins am selben Ort.
  for (const loc of buildTravelDerivedLocations(travelItems.value, travelPlaces.value)) {
    result.push({
      key: loc.key,
      origin: 'travel',
      lat: loc.lat,
      lng: loc.lng,
      title: loc.title,
      category: loc.category,
      homeSide: loc.homeSide,
      icon: loc.icon,
      color: TRAVEL_COLOR,
    });
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
        category: s.category ?? 'Sonstiges',
      });
    }
  }
  return result;
});

// Geplant/Ungeplant je Spot – dieselbe Herleitung wie ExcursionsView.vue's spotScheduledDates
// (frühestes Datum eines verknüpften Kalender-Termins gewinnt), hier aber aus den eigenen
// scheduleItems dieser Komponente statt eines geteilten Stores.
const spotScheduledDates = computed(() => {
  const map = new Map<number, string>();
  for (const item of scheduleItems.value) {
    if (item.spot_id == null) continue;
    const existing = map.get(item.spot_id);
    if (!existing || item.date < existing) map.set(item.spot_id, item.date);
  }
  return map;
});

// Kategorie-/Status-Filter aus der Spots-Liste (ExcursionsView.vue) – gilt einheitlich für Spots UND
// (nur beim Kategorie-Filter) die Unterkunft-/Reise-Sammelkategorien, da beide dieselben
// Kategorie-Strings verwenden (siehe MapPoint.category). Der Status-Filter gilt dagegen nur für
// echte Spots (Unterkunft/Reise kennen kein Geplant/Ungeplant, bleiben davon unberührt sichtbar –
// exakt wie ExcursionsView.vue's itemStatus(), das für 'derived' immer null liefert). Leere Filter =
// keine Einschränkung.
const filteredPoints = computed(() => {
  const categoryFilterActive = props.categoryFilter && props.categoryFilter.length > 0;
  const statusFilterActive = props.statusFilter && props.statusFilter.length > 0;
  if (!categoryFilterActive && !statusFilterActive) return points.value;
  return points.value.filter((p) => {
    if (categoryFilterActive && !props.categoryFilter!.includes(p.category)) return false;
    if (statusFilterActive && p.origin === 'spot') {
      const spotId = Number(p.key.slice('spot-'.length));
      const status = spotScheduledDates.value.has(spotId) ? 'planned' : 'unplanned';
      if (!props.statusFilter!.includes(status)) return false;
    }
    return true;
  });
});

// Für den Urlaubsfokus-Button: alle Punkte außer den Zuhause-Seiten von Anreise/Abreise.
const vacationPoints = computed(() => filteredPoints.value.filter((p) => !p.homeSide));

// "Auf Karte anzeigen" aus einer Ausflug-Karte (ExcursionCard.vue) fokussiert exklusiv auf dessen
// Stationen – alle anderen Spots werden ausgeblendet, Unterkunft/Reise bleiben sichtbar (zur
// Orientierung), siehe visiblePoints.
const focusedExcursion = computed<Excursion | null>(() => {
  if (drawers.mapFocusExcursionId == null) return null;
  return excursionsStore.excursions.find((e) => e.id === drawers.mapFocusExcursionId) ?? null;
});

// Tages-Fokus (ScheduleView.vue's "🗺️ Tag auf Karte anzeigen"): ALLE Orte dieses Tages – Termine,
// Reise-Etappen, Unterkunft UND Ausflüge (nicht mehr nur Ausflug-Stationen wie zuvor), in derselben
// Reihenfolge wie ScheduleView.vue's eigene Tagesliste (siehe buildDayStations) – exklusiv zum
// Ausflug-Fokus oben, daher nur ausgewertet, wenn keiner aktiv ist.
const focusedDateStations = computed<ExcursionStation[]>(() => {
  if (focusedExcursion.value || !drawers.mapFocusDate) return [];
  return buildDayStations(
    drawers.mapFocusDate,
    scheduleItems.value,
    excursionsStore.excursions,
    travelItems.value,
    accommodations.value,
    spotsStore.spots,
    travelPlaces.value,
  );
});

// Tage-Leiste: visualisiert den gesamten Urlaubszeitraum als anklickbare Tages-Chips direkt auf
// der Karte (statt den Tages-Fokus nur indirekt über die Kalender-Schublade erreichbar zu machen,
// siehe ScheduleView.vue's "🗺️ Tag auf Karte anzeigen") – nutzt denselben drawers.focusMapOnDate()-
// Mechanismus wie dort, hier aber für JEDEN Urlaubstag statt nur für Tage mit geplantem Ausflug.
const vacationDays = computed<string[]>(() => {
  const trip = tripStore.currentTrip;
  if (!trip) return [];
  const days: string[] = [];
  const cursor = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
});

function dayHasContent(date: string): boolean {
  if (excursionsStore.excursions.some((e) => e.date === date)) return true;
  if (travelItems.value.some((t) => t.date === date)) return true;
  if (accommodations.value.some((a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date)) return true;
  return scheduleItems.value.some(
    (i) => i.lat != null && i.lng != null && i.date <= date && date <= (i.end_date ?? i.date),
  );
}

const dayChipWeekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
function dayChipWeekday(date: string) {
  return dayChipWeekdayFormatter.format(new Date(date));
}
function dayChipNum(date: string) {
  return new Date(date).getDate();
}

function toggleDayFocus(date: string) {
  if (drawers.mapFocusDate === date) {
    drawers.mapFocusDate = null;
  } else {
    drawers.focusMapOnDate(date);
  }
}

const visiblePoints = computed(() => {
  const excursion = focusedExcursion.value;
  if (excursion) {
    return filteredPoints.value.filter((p) => p.origin !== 'spot' || excursion.station_keys.includes(p.key));
  }
  if (drawers.mapFocusDate) {
    const keys = new Set(focusedDateStations.value.map((s) => s.key));
    return filteredPoints.value.filter((p) => p.origin !== 'spot' || keys.has(p.key));
  }
  return filteredPoints.value;
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
  return resolveStations(excursion.station_keys, spotsStore.spots, accommodations.value, travelItems.value, travelPlaces.value);
});

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [accommodationRes, travelRes, travelPlacesRes, scheduleRes, ideaLikesRes, ideaCommentsRes] = await Promise.all([
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    api.get<TravelPlace[]>(`/travel/places?trip_id=${tripId}`),
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
    api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
  ]);
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  travelPlaces.value = travelPlacesRes;
  scheduleItems.value = scheduleRes;
  ideaLikes.value = ideaLikesRes;
  ideaComments.value = ideaCommentsRes;
  // Spots kommen jetzt aus dem geteilten spotsStore (reaktiv, wird u. a. von ExcursionsView.vue
  // selbst aktuell gehalten) – kein eigener Fetch/Refresh-Trigger hier mehr nötig.
}

// Ein Klick auf einen Pin (egal ob direkt auf der Karte oder in der Stationsliste eines Fokus-
// Ausflugs) öffnet den vollständigen Detail-Dialog des jeweiligen Objekts direkt in der Bildschirm-
// mitte – ein separates kleines Info-Panel gibt es dafür nicht mehr (siehe handlePointClick unten).
// "welcher Spot" (openSpotId) und "ist der Dialog offen" (spotDialogOpen) bewusst getrennt:
// SpotDetailDialog.vue braucht ein echtes Spot-Objekt als Prop (nicht nullable), müsste beim
// Schließen also sonst komplett aus dem DOM entfernt werden (v-if) statt nur unsichtbar zu werden –
// das würde Modal.vue's eigene Fade-Out-Transition abschneiden, da sie nie zum Abspielen kommt.
const openSpotId = ref<number | null>(null);
const spotDialogOpen = ref(false);
const openSpot = computed(() => spotsStore.spots.find((s) => s.id === openSpotId.value) ?? null);
// Setzt gleichzeitig drawers.mapFocusKey: der Pin des geöffneten Spots wird dadurch (über iconFor())
// dezent vergrößert dargestellt, egal ob der Dialog per Pin-Klick oder Stationsliste geöffnet wurde.
function openSpotDetail(spotId: number) {
  openSpotId.value = spotId;
  spotDialogOpen.value = true;
  drawers.mapFocusKey = `spot-${spotId}`;
}
// Schließen NUR über Modal.vue's eigene Wege (✕/Backdrop/Escape) hebt die Pin-Hervorhebung wieder
// auf – bewusst nicht als pauschaler watch(spotDialogOpen)-Handler, da @show-on-map unten
// spotDialogOpen ebenfalls auf false setzt, dort aber der Fokus (auf denselben Punkt) bestehen
// bleiben soll (kein Wettlauf zwischen "schließen löscht Fokus" und "Auf-Karte-anzeigen setzt ihn").
function onSpotDialogUpdate(v: boolean) {
  spotDialogOpen.value = v;
  if (!v) drawers.mapFocusKey = null;
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
  drawers.openExcursions();
}

// Klick auf eine Unterkunft-/Reise-Station in der Stationsliste öffnet den echten Unterkunft-/
// Reise-Dialog (nicht mehr einen Spot-Dialog für einen künstlich angelegten Spot, siehe Backend-
// Umbau) – gleiches "welches Objekt"/"ist offen"-Trennungsmuster wie oben bei Spots/Ausflügen.
const openAccommodationId = ref<number | null>(null);
const accommodationDialogOpen = ref(false);
const openAccommodation = computed(() => accommodations.value.find((a) => a.id === openAccommodationId.value) ?? null);
function onAccommodationDialogUpdate(v: boolean) {
  accommodationDialogOpen.value = v;
  if (!v) drawers.mapFocusKey = null;
}

const openTravelId = ref<number | null>(null);
const travelDialogOpen = ref(false);
const openTravel = computed(() => travelItems.value.find((t) => t.id === openTravelId.value) ?? null);
function onTravelDialogUpdate(v: boolean) {
  travelDialogOpen.value = v;
  if (!v) drawers.mapFocusKey = null;
}

function openStationDetail(station: ExcursionStation) {
  if (station.kind === 'spot') {
    openSpotDetail(station.id);
  } else if (station.kind === 'accommodation') {
    openAccommodationId.value = station.id;
    accommodationDialogOpen.value = true;
    drawers.mapFocusKey = station.key;
  } else if (station.kind === 'schedule') {
    // Kein eigener Detail-Dialog für Termine vorhanden (Architekturregel: fremde Objekte springen
    // zur Ursprungssicht statt inline editierbar zu sein) – öffnet stattdessen die Kalender-Schublade
    // (Desktop) bzw. navigiert zur Kalender-Seite (Mobil, siehe drawers.openCalendar()).
    drawers.openCalendar();
    drawers.mapFocusKey = station.key;
  } else if (station.kind === 'travel-place') {
    // Kein eigener Detail-Dialog für angelegte Reise-Orte (nur für einzelne Etappen, siehe
    // TravelDetailDialog.vue unten) – echter Sprung zur Reise-Sicht, gleicher Grund wie bei Terminen
    // oben.
    router.push('/travel');
  } else {
    openTravelId.value = station.id;
    travelDialogOpen.value = true;
    drawers.mapFocusKey = station.key;
  }
}

// Klick auf einen Pin direkt auf der Karte (nicht in der Stationsliste): bei Spots klappt (statt
// eines eigenen Modal-Dialogs, der die Karte dahinter blockieren würde) die passende Karte in der
// Spots-Liste auf (Emit an ExcursionsView.vue, siehe dort) – bei Unterkunft/Reise gibt es kein
// Listen-Gegenstück, dort bleibt der bisherige Modal-Dialog (unproblematisch, da seltener genutzt
// als die primäre Spot↔Karte-Kopplung). Die Pin-Vergrößerung (drawers.mapFocusKey) läuft in beiden
// Fällen weiterhin gleich.
function handlePointClick(point: MapPoint) {
  if (point.origin === 'spot') {
    const spotId = Number(point.key.slice('spot-'.length));
    drawers.mapFocusKey = point.key;
    emit('focus-spot', spotId);
  } else if (point.origin === 'accommodation') {
    openAccommodationId.value = Number(point.key.slice('accommodation-'.length));
    accommodationDialogOpen.value = true;
    drawers.mapFocusKey = point.key;
  } else if (point.key.startsWith('travel-place-')) {
    // Kein eigener Detail-Dialog für angelegte Reise-Orte (nur für einzelne Etappen, siehe
    // TravelDetailDialog.vue unten) – echter Sprung zur Reise-Sicht statt eines Dialogs.
    router.push('/travel');
  } else {
    const isFrom = point.key.startsWith('travel-from-');
    openTravelId.value = Number(point.key.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    travelDialogOpen.value = true;
    drawers.mapFocusKey = point.key;
  }
}
// Unterkunft/Reise bleiben eigene, echte Routen (anders als Ausflüge/Spots) – hier weiterhin ein
// echter Sprung. Hash-Sprung (#accommodation-<id>/#travel-<id>) statt bloß der Ziel-Route: die
// Ziel-Ansicht nimmt die id über hashHighlightId() in ihre highlightedIds-Menge auf und der Router
// scrollt automatisch zum Element mit dieser id (siehe router/index.ts's scrollBehavior). id vorher
// sichern, da das Schließen des Dialogs die *Open-Flags zurücksetzt, nicht aber die id-Refs selbst.
function editOpenAccommodation() {
  const id = openAccommodationId.value;
  accommodationDialogOpen.value = false;
  router.push(`/accommodation#accommodation-${id}`);
}
function editOpenTravel() {
  const id = openTravelId.value;
  travelDialogOpen.value = false;
  router.push(`/travel#travel-${id}`);
}
function payerLabelFor(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}

// Fokussiert alle Punkte einer Kategorie (Aufruf von ExcursionsView.vue's Kategorie-Navigation, per
// Template-Ref/defineExpose statt eines weiteren drawers-Felds, da rein kamera-bewegend und ohne
// Auswirkung auf andere Sichten) – zoomt/zentriert, ohne andere Punkte auszublenden (wie die
// bestehenden Fit-Buttons unten).
function focusCategory(category: string) {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  const catPoints = filteredPoints.value.filter((p) => p.category === category);
  const latLngs = catPoints.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 14);
  }
}
defineExpose({ focusCategory });

// Zoomt/zentriert auf genau den Ausschnitt, der alle aktuell eingetragenen Orte zeigt – z. B.
// nachdem man vorher auf einen einzelnen Punkt fokussiert hatte (openMapAt) oder sich verzoomt hat.
function fitAll() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  const latLngs = filteredPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
}

// Zoomt/zentriert nur auf die Punkte am Urlaubsort – ohne die Zuhause-Seite von Anreise/Abreise
// (vacationPoints), damit man im Urlaub direkt den näheren, relevanten Kartenausschnitt bekommt.
function fitVacation() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  const latLngs = vacationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
}

const accommodationPoints = computed(() => filteredPoints.value.filter((p) => p.origin === 'accommodation'));

// Zoomt/zentriert nur auf die Unterkünfte – praktisch bei mehreren Unterkünften im selben Urlaub
// (z. B. Roadtrip), um schnell zwischen ihnen zu vergleichen statt Spots/Reise mit anzuzeigen.
function fitAccommodations() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  const latLngs = accommodationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
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
  filteredPoints.value.filter((p) => p.origin === 'spot' && excursionSpotIds.value.has(Number(p.key.slice('spot-'.length)))),
);

// Zoomt/zentriert nur auf die Spots, die irgendeinem Ausflug zugeordnet sind – praktisch, um sich
// schnell einen Überblick über alle geplanten Ausflugsziele zu verschaffen.
function fitExcursions() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  const latLngs = excursionPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  }
}

// Zentriert auf einen einzelnen Punkt UND schiebt den sichtbaren Ausschnitt danach so weit nach
// oben, dass der Punkt in der Mitte der tatsächlich sichtbaren Fläche landet – nicht in der Mitte
// des gesamten Karten-Containers, dessen unterer Teil auf mobile von der Spots-Schublade verdeckt
// wird (siehe props.coveredBottomPx, von ExcursionsView.vue durchgereicht). Ohne diesen Ausgleich
// landete ein fokussierter Punkt bei aufgeklappter Schublade optisch dahinter statt im sichtbaren
// oberen Kartenbereich.
function centerOnPoint(latlng: L.LatLngExpression, zoom: number) {
  if (!map) return;
  const coveredBottomPx = props.coveredBottomPx;
  if (!coveredBottomPx) {
    map.setView(latlng, zoom, { animate: false });
    return;
  }
  // Direkte Projektions-Rechnung statt map.setView()+map.panBy(): der Zielpunkt soll nicht im
  // Zentrum des gesamten Karten-Containers landen, sondern im Zentrum der tatsächlich sichtbaren
  // Fläche (Container abzüglich der unten überlagernden Schublade) – dafür muss der neue
  // Karten-MITTELPUNKT um die Hälfte des verdeckten Bereichs "unter" dem Zielpunkt liegen (project()/
  // unproject() arbeiten in einem containerunabhängigen Weltpixel-Raum, in dem sich Y-Versätze 1:1
  // wie Bildschirmpixel verhalten). map.panBy() wurde hier bewusst NICHT verwendet: bei größeren,
  // nicht animierten Offsets nimmt es einen internen Kurzschluss-Pfad, dessen Pixel-Verhalten sich
  // in Tests als nicht zuverlässig vorhersagbar erwiesen hat.
  const targetPoint = map.project(latlng, zoom);
  const shiftedCenter = map.unproject(targetPoint.add([0, coveredBottomPx / 2]), zoom);
  map.setView(shiftedCenter, zoom, { animate: false });
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
      .on('click', () => handlePointClick(point));
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

  // "Auf Karte anzeigen"/Pin-Klick setzt drawers.mapFocusKey – hier zentrieren wir dann direkt auf
  // den Punkt (die dezente Pin-Vergrößerung selbst passiert unabhängig davon in iconFor()).
  const focusPoint = drawers.mapFocusKey ? points.value.find((p) => p.key === drawers.mapFocusKey) : null;

  if (excursion) {
    if (excursionLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(excursionLatLngs), { padding: [32, 32] });
    } else if (excursionLatLngs.length === 1) {
      centerOnPoint(excursionLatLngs[0], 14);
    }
  } else if (drawers.mapFocusDate && dateLatLngs.length) {
    if (dateLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(dateLatLngs), { padding: [32, 32] });
    } else {
      centerOnPoint(dateLatLngs[0], 14);
    }
  } else if (focusPoint) {
    centerOnPoint([focusPoint.lat, focusPoint.lng], 15);
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
        color: TRAVEL_COLOR,
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
    const stations = resolveStations(excursion.station_keys, spotsStore.spots, accommodations.value, travelItems.value, travelPlaces.value);
    const coords: L.LatLngExpression[] = stations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat as number, s.lng as number]);
    if (coords.length >= 2) {
      L.polyline(arcRoute(coords), { color: '#e08e45', weight: 3, opacity: 0.65, dashArray: '6 6' }).addTo(routesLayer);
    }
  }
}

// Zeichnet den eigenen (pulsierenden) und die Standort-Marker der anderen gerade auf der Karte
// aktiven Mitglieder (liveSync.memberPositions) – eigener Layer statt Teil von renderMarkers(),
// siehe Kommentar bei positionsLayer oben.
function renderPositions() {
  if (!map || !positionsLayer) return;
  positionsLayer.clearLayers();

  // Eigene Pane (statt des Default-Marker-Panes): garantiert, dass Standort-Marker immer ÜBER den
  // übrigen Pins liegen (Unterkunft/Reise/Spots teilen sich sonst dieselbe Stapelreihenfolge), und
  // gibt e2e-Tests (live-location.spec.ts) einen eindeutigen Selektor, um Standort-Marker von den
  // übrigen (identisch gebauten) Emoji-Pins zu unterscheiden.
  if (!map.getPane('live-positions')) {
    const pane = map.createPane('live-positions');
    pane.style.zIndex = '650';
  }

  if (ownPosition.value && auth.user) {
    L.marker([ownPosition.value.lat, ownPosition.value.lng], {
      icon: pulsingEmojiPin(auth.user.avatar, '#2f6fed'),
      zIndexOffset: 1000,
      pane: 'live-positions',
    }).addTo(positionsLayer);
  }

  for (const [userId, position] of Object.entries(liveSync.memberPositions)) {
    const user = users.value.find((u) => u.id === Number(userId));
    if (!user) continue;
    L.marker([position.lat, position.lng], {
      icon: cachedEmojiPin(user.avatar, '#2f6fed'),
      pane: 'live-positions',
    }).addTo(positionsLayer);
  }
}

// "Zu meinem Standort springen"-Button: nur aktiv, sobald mindestens ein GPS-Fix vorliegt.
function jumpToMyLocation() {
  if (!map || !ownPosition.value) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  centerOnPoint([ownPosition.value.lat, ownPosition.value.lng], 16);
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
  positionsLayer = L.layerGroup().addTo(map);
  renderMarkers();
  renderRoutes();
  renderPositions();

  // Live-Standort: startet, sobald die Kartenansicht mountet, endet beim Unmounten (siehe unten) –
  // bewusst kein dauerhaftes Hintergrund-Tracking, Teilen ist an "Kartenansicht offen" gekoppelt.
  // watchPosition() statt eines einmaligen getCurrentPosition(): Standort soll sich mit der
  // Nutzerin mitbewegen, ohne die Karte neu laden zu müssen. Fehlt die Geolocation-API (z. B. kein
  // HTTPS-Kontext) oder verweigert die Nutzerin den Zugriff, bleibt die Karte unverändert nutzbar –
  // nur ohne eigenen Standort-Marker.
  if (navigator.geolocation) {
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        ownPosition.value = { lat: position.coords.latitude, lng: position.coords.longitude };
        liveSync.sendPosition(position.coords.latitude, position.coords.longitude);
        renderPositions();
      },
      () => {
        // Zugriff verweigert/fehlgeschlagen – kein Fehlerzustand, die Karte funktioniert weiterhin
        // ohne Live-Standort.
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

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
  if (geoWatchId != null) navigator.geolocation.clearWatch(geoWatchId);
  liveSync.stopSharingPosition();
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

// Kategorie-/Status-Filter (ExcursionsView.vue) ändern zwar sofort filteredPoints/visiblePoints
// (beides computed), das bewirkt aber für sich allein KEIN erneutes Zeichnen der Leaflet-Marker –
// renderMarkers() ist eine reine, imperative Funktion, kein reaktiver Template-Ausdruck, sie muss
// explizit erneut aufgerufen werden. Ohne diesen Watcher blieb die Karte auf dem zuletzt
// gezeichneten Stand hängen, bis irgendein ANDERER beobachteter Zustand (Fokus, Tripwechsel, …)
// zufällig ebenfalls ein renderMarkers() auslöste – daher wirkte der Filter auf der Karte "nur
// manchmal" statt zuverlässig angewendet.
watch(
  () => [props.categoryFilter, props.statusFilter],
  () => renderMarkers(),
  { deep: true },
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

// Standort-Updates anderer Mitglieder (liveSync.ts's position/positions-SSE-Events) – deep, da
// memberPositions ein reaktives Objekt ist, das in-place mutiert wird (kein Array-Austausch).
watch(() => liveSync.memberPositions, () => renderPositions(), { deep: true });
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
        :disabled="!filteredPoints.length"
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
        title="Nur Tourziele fokussieren"
        aria-label="Nur Tourziele fokussieren"
        :disabled="!excursionPoints.length"
        @click="fitExcursions"
      >
        🎒
      </button>
      <button
        type="button"
        class="fit-btn my-location-btn"
        title="Zu meinem Standort springen"
        aria-label="Zu meinem Standort springen"
        :disabled="!ownPosition"
        @click="jumpToMyLocation"
      >
        <!-- Eigenes Avatar-Emoji statt eines generischen Pin-/Fadenkreuz-Icons - eindeutiger
             erkennbar als "das bin ich" und konsistent mit dem eigenen Marker auf der Karte selbst
             (siehe ownMarker weiter unten), der ebenfalls dieses Avatar zeigt. -->
        {{ auth.user?.avatar || '📍' }}
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

      <div class="day-strip" v-if="vacationDays.length">
        <button
          v-for="day in vacationDays"
          :key="day"
          type="button"
          class="day-chip"
          :class="{ active: drawers.mapFocusDate === day, 'has-content': dayHasContent(day) }"
          :title="formatDate(day)"
          @click="toggleDayFocus(day)"
        >
          <span class="day-chip-weekday">{{ dayChipWeekday(day) }}</span>
          <span class="day-chip-num">{{ dayChipNum(day) }}</span>
          <span v-if="dayHasContent(day)" class="day-chip-dot" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <!-- Mobil (Teleport aktiv, siehe isDesktop) landet diese Stationen-Liste in der Spots-Schublade
         (ExcursionsView.vue's #map-focus-dock) statt als Overlay über der Karte zu schweben – sie
         deckte dort sonst einen Teil des Kartenausschnitts (und mitunter die Zoom-Steuerung) ab.
         Auf Desktop bleibt sie unverändert Teil dieser Karten-Spalte (Teleport disabled, siehe
         @container-Regel für .focus-spot-list weiter unten). -->
    <Teleport v-if="teleportReady" to="#map-focus-dock" :disabled="isDesktop">
    <div class="card focus-spot-list" v-if="focusedExcursion && focusedExcursionStations.length">
      <div class="focus-spot-list-header">
        <button type="button" class="focus-spot-list-title-btn" @click="openExcursionDetail">
          <h3 class="focus-spot-list-title">🎒 {{ focusedExcursion.title }}</h3>
          <span class="focus-spot-list-status" :class="{ planned: focusedExcursion.date }">
            {{ focusedExcursion.date ? `📅 ${formatDate(focusedExcursion.date)}` : 'In Planung' }}
          </span>
        </button>
        <button
          type="button"
          class="focus-spot-list-close"
          aria-label="Tour-Fokus schließen"
          title="Tour-Fokus schließen"
          @click="drawers.mapFocusExcursionId = null"
        >
          ✕
        </button>
      </div>
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
      <div class="focus-spot-list-header">
        <h3 class="focus-spot-list-title">🗓️ {{ formatDate(drawers.mapFocusDate) }}</h3>
        <button
          type="button"
          class="focus-spot-list-close"
          aria-label="Tages-Fokus schließen"
          title="Tages-Fokus schließen"
          @click="drawers.mapFocusDate = null"
        >
          ✕
        </button>
      </div>
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
    </Teleport>

    <SpotDetailDialog
      v-if="openSpot"
      :model-value="spotDialogOpen"
      @update:model-value="onSpotDialogUpdate"
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
      :travel-places="travelPlaces"
      @edit="editOpenExcursion"
      @toggle-like="toggleIdeaLike(openExcursion.id)"
      @submit-comment="(content) => submitIdeaComment(openExcursion!.id, content)"
      @remove-comment="removeIdeaComment"
      @show-on-map="excursionDetailOpen = false"
      @edit-station-spot="editOpenExcursion"
    />

    <AccommodationDetailDialog
      v-if="openAccommodation"
      :model-value="accommodationDialogOpen"
      @update:model-value="onAccommodationDialogUpdate"
      :accommodation="openAccommodation"
      :payer-label="payerLabelFor(openAccommodation.paid_by_user_id)"
      @edit="editOpenAccommodation"
      @show-on-map="accommodationDialogOpen = false"
    />

    <TravelDetailDialog
      v-if="openTravel"
      :model-value="travelDialogOpen"
      @update:model-value="onTravelDialogUpdate"
      :item="openTravel"
      :payer-label="payerLabelFor(openTravel.paid_by_user_id)"
      @edit="editOpenTravel"
      @show-on-map-from="travelDialogOpen = false"
      @show-on-map-to="travelDialogOpen = false"
    />

    <p v-if="!points.length" class="empty">
      Noch keine Orte mit Koordinaten hinterlegt. Füge bei Unterkunft, Reise-Einträgen oder Spots
      einen Maps-Link (Google/Apple) hinzu, damit sie hier erscheinen.
    </p>
  </div>
</template>

<style scoped>
/* Mobil (Default): die Karte füllt ihren Container (.map-col in ExcursionsView.vue, dort auf Mobil
   position:fixed über den ganzen Bildschirm) randlos vollflächig aus, ähnlich Google Maps –
   .karte selbst erzeugt dafür keine eigene Box mehr (display:contents), .map-wrap/.map übernehmen
   direkt die volle Fläche ihres jetzt fixed-positionierten Großelternteils. Auf Desktop
   (@container weiter unten) wird das komplett auf den bisherigen Stand zurückgesetzt. */
.karte {
  display: contents;
}

.map-wrap {
  position: absolute;
  inset: 0;
}

.map {
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  border: none;
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

.my-location-btn {
  top: 170px;
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

/* Mobil (Default): schwebt als horizontal scrollbare Leiste über dem unteren Kartenrand (analog zu
   .focus-spot-list oben, nur unten statt oben verankert). Auf Desktop (@container weiter unten)
   wieder normales Flow-Element unterhalb der Karte. */
.day-strip {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 1000;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 6px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.day-chip {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 38px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-hover);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.1;
}

.day-chip-weekday {
  font-size: 0.6rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.day-chip-num {
  font-size: 0.9rem;
}

.day-chip.has-content .day-chip-num {
  color: var(--color-accent);
}

.day-chip-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
}

.day-chip.active {
  background: var(--color-primary);
  color: #fff;
}

.day-chip.active .day-chip-weekday {
  color: rgba(255, 255, 255, 0.8);
}

.day-chip.active .day-chip-num {
  color: #fff;
}

.day-chip.active .day-chip-dot {
  background: #fff;
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

/* Mobil (Default): schwebt als eigene Karte ÜBER der (jetzt vollflächigen) Karte, statt wie bisher
   als normales Flow-Element darunter zu stehen – dafür ist auf dem mobilen Vollbild-Hintergrund
   kein Platz mehr. Bewusst einfach oben verankert statt an die Bottom-Sheet-Höhe der Spots-Liste
   gekoppelt (ExcursionsView.vue) – Ausflug-/Tag-Fokus ist der seltenere Pfad, eine dynamische
   Kopplung wäre hier unverhältnismäßig viel zusätzliche Komplexität. Auf Desktop (@container
   weiter unten) wieder normales Flow-Element wie bisher. */
.focus-spot-list {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Mobil per Teleport in die Spots-Schublade verschoben (siehe Template oben, ExcursionsView.vue's
   #map-focus-dock) – dort ist sie ein normales Flow-Element innerhalb der Schublade statt eines
   Overlays über der Karte, braucht also die obige absolute Positionierung nicht. */
#map-focus-dock .focus-spot-list {
  position: static;
}

/* Kopfzeile: klickbarer Titel-Bereich links (öffnet bei einem Ausflug-Fokus den Detail-Dialog,
   ExcursionDetailDialog.vue – dieselbe Komponente wie in der Ausflüge-Schublade, hier per eigenem
   Likes-/Kommentar-Fetch gefüttert), Schließen-Button rechts. Vorher lag der Schließen-Button
   (ursprünglich .focus-banner weiter oben) exakt an derselben Position wie diese ganze Karte
   (beide position:absolute; top/left:10px) – die Karte deckte ihn dadurch komplett zu. Jetzt fest
   in der Kopfzeile verankert, damit er nicht mehr verdeckt werden kann. */
.focus-spot-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.focus-spot-list-title-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
  background: none;
  border: none;
  padding: 4px;
  margin: -4px 0 -4px -4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
}

.focus-spot-list-title-btn:hover {
  background: var(--color-hover);
}

.focus-spot-list-close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
}

.focus-spot-list-close:hover {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
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


/* Desktop: zurück auf den bisherigen Stand (Karte als eigene, begrenzte Box statt vollflächigem
   Hintergrund – .map-col in ExcursionsView.vue ist hier eine normale sticky Spalte, kein
   fixed-Vollbild-Container mehr, siehe dort). Wieder @container(app-main) statt @media: jetzt, wo
   .map-col in ExcursionsView.vue position:absolute (statt fixed) innerhalb von .page bleibt, ist
   ein knappes .app-main (z. B. beide Schubladen offen) kein Problem mehr – die Karte quetscht sich
   dann einfach mit in den mobilen Vollbild-Modus, statt überdeckt zu werden (siehe dort für die
   ausführliche Begründung). */
@container (min-width: 900px) {
  .karte {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .map-wrap {
    position: relative;
    inset: auto;
  }

  .map {
    height: 70vh;
    min-height: 420px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .focus-spot-list {
    position: static;
  }

  .day-strip {
    position: static;
  }
}
</style>

<!-- Bewusst NICHT scoped: pulsingEmojiPin() (utils/mapRoute.ts) fügt sein Markup per innerHTML in
     einen von Leaflet verwalteten DOM-Knoten außerhalb von Vues Template-Kompilierung ein – ein
     scoped Style-Block würde sein data-v-*-Attribut nie auf dieses Markup anwenden, die Regel griffe
     dadurch nie. -->
<style>
.map-pulse-ring {
  animation: map-pulse-ring 2s ease-out infinite;
}

@keyframes map-pulse-ring {
  0% {
    transform: scale(0.6);
    opacity: 0.55;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
</style>
