<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Reiner Patch-Import (kein Named/Default-Export genutzt): erweitert L.Map/L.Marker/... zur
// Laufzeit um Rotationsunterstützung (setBearing()/getBearing(), touchRotate-Geste) - siehe
// leaflet-rotate.d.ts für die zugehörige Typ-Ergänzung. Muss vor der ersten L.map()-Instanziierung
// geladen sein.
import 'leaflet-rotate';
import { api } from '../api/client';
import type {
  Excursion,
  LocationTrack,
  ScheduleItem,
  TrackPoint,
  TrackVisibility,
  TravelItem,
  User,
} from '../api/types';
import { buildDayStations } from '../utils/dayStations';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useTracksStore } from '../stores/tracks';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';
import { useMapOrientationStore } from '../stores/mapOrientation';
import { useLocationSharingStore, type ShareDuration } from '../stores/locationSharing';
import { spotCategoryMeta } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { buildTravelDerivedLocations } from '../utils/travelDerivedLocations';
import {
  arcRoute,
  cachedEmojiPin,
  compassPin,
  LEAFLET_ATTRIBUTION_PREFIX,
} from '../utils/mapRoute';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { MAP_TOOL_ICONS } from '../utils/mapToolIcons';
import type { IconDef } from '../utils/icon';
import { downloadTiles, estimateTileDownload, formatApproxSize } from '../utils/offlineMapTiles';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import {
  excursionStationKeys,
  resolveStations,
  type ExcursionStation,
} from '../utils/excursionStations';
import { interpolateTrackPosition } from '../utils/trackGeometry';
import { useIsDesktop } from '../composables/useIsDesktop';
import { usePersistedRef } from '../composables/usePersistedRef';
import Card from './primitives/Card.vue';
import IconButton from './primitives/IconButton.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import TravelDetailDialog from './TravelDetailDialog.vue';
import DayChip from './DayChip.vue';
import AppIcon from './AppIcon.vue';
import TrackRecordingWarningModal from './TrackRecordingWarningModal.vue';

// Die Karte ist ein generischer, reiner Pin-Layer (kein Anlegen/Bearbeiten hier): sie zeigt
// automatisch jedes Objekt des aktuellen Urlaubs mit hinterlegtem Standort – Unterkunft, Reise
// (Abflug/Ankunft) und Spots. Ein Klick auf einen Punkt zeigt eine kurze Info mit einem
// Sprung-Button zur jeweiligen Ursprungssicht (Architekturregel Batch 3).
//
// Anders als die frühere Schubladen-Version (MapView.vue) ist diese Komponente dauerhaft Teil
// der Karte-Hauptsicht (ExcursionsView.vue) statt lazy per Schublade ein-/ausgeblendet zu
// werden – Laden/Neuladen läuft daher nur noch über Datenänderungen (Urlaubswechsel,
// locationsVersion), nicht mehr über ein "beim Öffnen"-Signal.
type MapOrigin = 'travel' | 'spot';

interface MapPoint {
  key: string;
  origin: MapOrigin;
  lat: number;
  lng: number;
  title: string;
  icon: IconDef;
  color: string;
  /** Für Kategorie-Filter/-Fokus-Kopplung mit der Spots-Sicht (ExcursionsView.vue): bei Spots die
   *  echte Kategorie (bzw. "Sonstiges", inkl. "Unterkunft" seit deren Verschmelzung in Spots – siehe
   *  Migrationskommentar in db/index.ts), bei Reise die dortige Sammel-Kategorie ("Reise") –
   *  identisch zu ExcursionsView.vue's itemCategory()/DerivedLocation.category, damit derselbe
   *  Filter/dieselbe Kategorie-Navigation für Liste UND Karte gilt. */
  category: string;
  /** Zuhause-Seite eines Reise-Eintrags (Startpunkt der Anreise / Zielpunkt der Abreise) – wird
   *  vom Urlaubsfokus-Button ausgeblendet, siehe vacationPoints. */
  homeSide?: boolean;
  /** Nur bei origin 'spot' gesetzt (Spot.done) - für den 'done'-Wert im Status-Filter, siehe
   *  filteredPoints unten. Unterkunft-/Reise-Punkte kennen kein "gemacht"-Konzept. */
  done?: boolean;
}

const TRAVEL_COLOR = '#4a3aa7';

const props = defineProps<{
  /** Von ExcursionsView.vue durchgereichter Kategorie-Filter der Spots-Liste (leer = alles
   *  anzeigen) – koppelt den Karten-Inhalt 1:1 mit dem, was in der Liste sichtbar ist, statt einen
   *  zweiten, unabhängigen Filter zu pflegen. */
  categoryFilter?: string[];
  /** Von ExcursionsView.vue durchgereichter Geplant/Ungeplant/Gemacht-Filter der Spots-Liste (leer =
   *  alles anzeigen) – gilt nur für Spot-Punkte (Unterkunft/Reise kennen dieses Konzept nicht, siehe
   *  ExcursionsView.vue's itemStatus()). Braucht keine eigenen scheduleItems von außen: diese
   *  Komponente lädt ihre eigenen (scheduleItems.value, siehe loadAll()) ohnehin schon unabhängig
   *  von ExcursionsView.vue (gleiches Muster wie die übrige, bewusst duplizierte Datenladung
   *  zwischen beiden Sichten). */
  statusFilter?: ('planned' | 'unplanned' | 'done')[];
  /** Höhe (px) des von der mobilen Spots-Schublade verdeckten unteren Kartenbereichs, von
   *  ExcursionsView.vue durchgereicht (0/undefined auf Desktop, wo die Schublade eine eigene Spalte
   *  statt eines Overlays ist) – siehe centerOnPoint() unten. */
  coveredBottomPx?: number;
  /** Breite (px) des von schwebenden Schubladen/Spalten verdeckten linken Kartenbereichs (auf Desktop),
   *  von ExcursionsView.vue durchgereicht – siehe centerOnPoint() unten. */
  coveredLeftPx?: number;
  /** Von ExcursionsView.vue durchgereicht: rendert .spots-col gerade als mobiles Overlay-Sheet statt
   *  als eigene Desktop-Spalte (misst .app-main's tatsächliche Breite gegen dieselbe 900px-Schwelle
   *  wie der @container-Query unten, siehe dortiger Kommentar zu isSheetOverlayMode). Steuert den
   *  Teleport der Stationen-Liste (#map-focus-dock) weiter unten – reines window.matchMedia
   *  (isDesktop) reichte hier nicht: bei mittleren Fensterbreiten (>800px, aber .app-main <900px,
   *  z. B. geöffnete Kalender-Schublade) blieb die Liste bislang fälschlich als Overlay AUF der
   *  Karte stehen (Teleport deaktiviert), obwohl ihre eigene CSS zu diesem Zeitpunkt schon den
   *  mobilen Overlay-Stil nutzt – deckte dabei teils fokussierte Marker ab. Fällt ohne übergebenen
   *  Wert auf das alte, reine isDesktop-Verhalten zurück. */
  sheetOverlayMode?: boolean;
}>();

const emit = defineEmits<{
  // Klick auf einen Spot-Pin (nicht Unterkunft/Reise, siehe handlePointClick): statt eines eigenen
  // Modal-Dialogs (der die Karte dahinter blockieren würde) klappt die passende Spot-Karte in der
  // Liste auf – die kennt TripMap.vue nicht direkt, daher Emit an die Karte-Hauptsicht.
  (e: 'focus-spot', spotId: number): void;
  // Klick auf den Ausflug-Titel unter der Karte (#92, ersetzt den früheren ExcursionDetailDialog.vue)
  // – analog zu focus-spot: die passende ExcursionCard klappt in der Spots-Liste auf/scrollt in den
  // Blick, statt einen eigenen Dialog zu öffnen.
  (e: 'focus-excursion', excursionId: number): void;
  // Bearbeiten eines Ausflugs: die Karte besitzt kein eigenes Touren-Formular, lebt aber (wie beim
  // Spot-Formular oben) im selben Komponentenbaum wie die echte Touren-Bearbeiten-Form
  // (ExcursionsView.vue) – kein Routen-/Schubladen-Sprung nötig, nur ein Emit nach oben.
  (e: 'edit-excursion', excursion: Excursion): void;
}>();

const router = useRouter();
const isDesktop = useIsDesktop();
const drawers = useDrawersStore();

const calendarOffset = computed(() => {
  return isDesktop.value && drawers.calendarOpen ? drawers.calendarWidth : 0;
});

const calendarMargin = computed(() => {
  return isDesktop.value && drawers.calendarOpen
    ? 'calc(var(--space-4) * 2)'
    : 'var(--drawer-tab-width)';
});
// Steuert den Teleport der Stationen-Liste unten (siehe sheetOverlayMode-Prop-Dokumentation oben) -
// mit props.sheetOverlayMode statt des rohen isDesktop, sobald ExcursionsView.vue diesen Wert
// mitgibt (immer der Fall, da TripMap.vue aktuell nur von dort aus verwendet wird); Fallback auf das
// alte isDesktop-Verhalten nur zur Absicherung, falls die Komponente je ohne diesen Prop genutzt wird.
const isNarrowLayout = computed(() => props.sheetOverlayMode ?? !isDesktop.value);
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
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const tracksStore = useTracksStore();
const trackRecording = useTrackRecordingStore();
const auth = useAuthStore();
const liveSync = useLiveSyncStore();
const mapOrientation = useMapOrientationStore();
const locationSharing = useLocationSharingStore();
// #176: keine eigene Reise-Etappen-Liste mehr, sondern aus role-getaggten Touren abgeleitet (siehe
// utils/deriveTravelItems.ts) - excursionsStore/spotsStore laden bereits unten.
const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));
const scheduleItems = ref<ScheduleItem[]>([]);

// Eigener kleiner users-Fetch: nur für die Autor-Anzeige im Spot-/Ausflug-Detail-Dialog gebraucht,
// die sich aus der Stationsliste heraus öffnen lassen (siehe unten) – gleiches Vorgehen wie in
// anderen Views, die /users unabhängig voneinander laden, statt einen weiteren globalen Store
// dafür anzulegen.
const users = ref<User[]>([]);

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let routesLayer: L.LayerGroup | null = null;
// Eigener Layer für Live-Standort-Marker (eigener + andere Mitglieder), getrennt von markersLayer:
// renderMarkers() räumt bei jedem Aufruf ALLE seine Marker komplett ab und baut sie neu auf (siehe
// dortiger Kommentar) – bei häufigen GPS-Updates würde das unnötig auch alle anderen, unveränderten
// Punkte (Unterkunft/Reise/Spots) mit flackern lassen.
let positionsLayer: L.LayerGroup | null = null;
// Aufgezeichnete Route (Standort-Aufzeichnung, stores/tracks.ts) – eigener Layer statt Teil von
// routesLayer, da eine echte GPS-Aufzeichnung (durchgezogene Linie) optisch klar von den
// schematischen, gestrichelten Touren-Bögen (renderRoutes()) unterschieden werden soll. Zusätzlicher
// eigener Layer nur für den Zeit-Slider-Marker (trackPlaybackLayer): dessen Position ändert sich bei
// jedem Slider-Tick, ein gemeinsamer Layer mit der Route würde dafür unnötig die ganze Polyline neu
// zeichnen (gleicher Grund wie bei positionsLayer/markersLayer oben).
let tracksLayer: L.LayerGroup | null = null;
let trackPlaybackLayer: L.LayerGroup | null = null;
// Eigener Standort kommt direkt aus dem lokalen navigator.geolocation-Callback (aktuellster Stand,
// keine Netzwerk-Latenz) statt aus liveSync.memberPositions – die Store-Seite filtert den eigenen
// Nutzer dort bewusst heraus (gleiches Muster wie bei onlineUserIds/Präsenz).
const ownPosition = ref<{ lat: number; lng: number } | null>(null);
let geoWatchId: number | null = null;

// Blickrichtung des eigenen Kompass-Markers (compassPin(), utils/mapRoute.ts) - 0 = Norden, im
// Uhrzeigersinn, wie webkitCompassHeading es liefert. null solange kein Sensor-Wert vorliegt (kein
// Magnetometer, Berechtigung verweigert/noch nicht erteilt, Desktop) - der Marker zeigt dann nur den
// Punkt ohne Richtungskegel.
const ownHeading = ref<number | null>(null);
let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
let orientationEventName: 'deviceorientationabsolute' | 'deviceorientation' = 'deviceorientation';

// Aktuelle Kartendrehung (leaflet-rotate's map.getBearing(), 0 = Norden oben) - eigene reaktive
// Kopie statt jedes Mal map.getBearing() aufzurufen, u. a. weil renderPositions() sie synchron
// braucht, bevor `map` in seltenen Fällen (Fehlerpfade) überhaupt gesetzt ist. Wird sowohl bei
// automatischer Drehung (mapOrientation.mode==='heading', siehe handleOrientation() unten) als auch
// bei einer manuellen Zwei-Finger-Drehgeste aktuell gehalten (map.on('rotate', ...) in onMounted).
const currentBearing = ref(0);

// iOS liefert die bereits Kompass-korrigierte Blickrichtung direkt über das nicht standardisierte
// webkitCompassHeading (0-360, im Uhrzeigersinn) - das ist zuverlässiger als alpha (auf iOS relativ
// zur Startausrichtung, nicht zu Norden). Andere Plattformen (Android/Chrome) liefern kein
// webkitCompassHeading, dafür alpha bereits Nord-referenziert über das 'deviceorientationabsolute'-
// Event; alpha zählt dort gegen den Uhrzeigersinn, daher (360 - alpha) zur Umrechnung.
function headingFromOrientationEvent(event: DeviceOrientationEvent): number | null {
  const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof webkitHeading === 'number') return webkitHeading;
  if (event.alpha == null) return null;
  return (360 - event.alpha) % 360;
}

function handleOrientation(event: DeviceOrientationEvent) {
  const heading = headingFromOrientationEvent(event);
  if (heading == null) return;
  ownHeading.value = heading;
  // Im Fahrtrichtung-Modus dreht sich die Karte laufend mit dem Kompass mit ("oben" = Guckrichtung);
  // im Nord-Modus bleibt die Kartendrehung unangetastet (bleibt bei 0° bzw. wo eine manuelle
  // Zwei-Finger-Geste sie zuletzt hingedreht hat, siehe map.on('rotate', ...) in onMounted).
  if (map && mapOrientation.mode === 'heading') map.setBearing(heading);
  renderPositions();
}

// Wechselt zwischen "Norden oben" (feste 0°-Ausrichtung) und "Fahrtrichtung oben" (Kartendrehung
// folgt laufend dem Kompass-Heading). Die Zwei-Finger-Drehgeste (touchRotate, siehe map-Optionen in
// onMounted) bleibt in BEIDEN Modi nutzbar - dieser Umschalter steuert nur, ob die Karte sich
// zusätzlich automatisch mitdreht.
function toggleMapOrientation() {
  if (!map) return;
  mapOrientation.toggle();
  if (mapOrientation.mode === 'north') {
    map.setBearing(0);
  } else if (ownHeading.value != null) {
    map.setBearing(ownHeading.value);
  }
}

// Fasst die vier vorher einzeln gestapelten "Kartenausschnitt fokussieren"-Buttons (Alle/Urlaubsort/
// Unterkünfte/Tourziele) hinter einem einzigen Popover-Trigger zusammen (Nutzer-Feedback: die lange
// Button-Spalte auf der Karte war unübersichtlich geworden, einzelne Buttons wurden vom Bottom-Sheet
// verdeckt). Gleiches Teleport-Popover-Muster wie shareMenuOpen/recordMenuOpen unten (eigene Kopie
// statt geteilter Komponente, da scoped styles nicht komponentenübergreifend gelten).
const focusMenuOpen = ref(false);
const focusButtonRef = ref<HTMLButtonElement | null>(null);
const focusMenuStyle = ref({ top: '0px', left: '0px' });

// 252 statt der 216 der übrigen (kürzeren) Popover-Menüs unten: die Menüpunkte hier ("Alle
// eingetragenen Orte anzeigen", "Zu meinem Standort springen", …) sind spürbar länger als
// "🚫 Nicht teilen" & Co. - siehe .picker-menu-wide im CSS (feste Breite + Zeilenumbruch statt
// des sonst üblichen white-space:nowrap, das die Menübreite an den längsten Eintrag anpassen würde).
const WIDE_PICKER_MENU_WIDTH = 252;

function computeTeleportMenuPosition(triggerRef: any, event?: MouseEvent, menuWidth = 216) {
  const el =
    (event?.currentTarget as HTMLElement) || (triggerRef?.value as any)?.$el || triggerRef?.value;
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return { top: '0px', left: '0px' };
  }
  const rect = el.getBoundingClientRect();
  return {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth))}px`,
  };
}

function toggleFocusMenu(event?: MouseEvent) {
  if (!focusMenuOpen.value) {
    focusMenuStyle.value = computeTeleportMenuPosition(
      focusButtonRef,
      event,
      WIDE_PICKER_MENU_WIDTH
    );
    focusMenuOpen.value = true;
  } else {
    focusMenuOpen.value = false;
  }
}

function selectFocus(action: () => void) {
  focusMenuOpen.value = false;
  action();
}

// Fasst "Zu meinem Standort springen" und den Ausrichtungs-Umschalter (Norden/Fahrtrichtung oben)
// hinter einem zweiten Popover zusammen - beide drehen sich um "wo bin ich / wohin schaue ich auf
// der Karte", anders als die reine Datenfokus-Gruppe oben. Der Ausrichtungs-Umschalter wird hier als
// echte Zwei-Optionen-Auswahl statt als reiner Toggle dargestellt (klarer als ein Icon, das je nach
// aktuellem Zustand wechselt), toggleMapOrientation() bleibt darunter unverändert der eigentliche
// Umschalt-Mechanismus.
const locationMenuOpen = ref(false);
const locationButtonRef = ref<HTMLButtonElement | null>(null);
const locationMenuStyle = ref({ top: '0px', left: '0px' });

function toggleLocationMenu(event?: MouseEvent) {
  if (!locationMenuOpen.value) {
    locationMenuStyle.value = computeTeleportMenuPosition(
      locationButtonRef,
      event,
      WIDE_PICKER_MENU_WIDTH
    );
    locationMenuOpen.value = true;
  } else {
    locationMenuOpen.value = false;
  }
}

function selectLocation(action: () => void) {
  locationMenuOpen.value = false;
  action();
}

function setMapOrientationMode(mode: 'north' | 'heading') {
  if (mapOrientation.mode !== mode) toggleMapOrientation();
}

// Standort-Freigabe (stores/locationSharing.ts): läuft app-weit, unabhängig davon, ob diese
// Kartenansicht gerade gemountet ist - hier nur die Dauer-Auswahl-UI, gleiches Teleport-Menü-Muster
// wie MapsAppPicker.vue.
const shareMenuOpen = ref(false);
const shareButtonRef = ref<HTMLButtonElement | null>(null);
const shareMenuStyle = ref({ top: '0px', left: '0px' });

const shareDurationLabel = computed(() => {
  if (!locationSharing.shareUntil) return 'Standort teilen';
  const until = new Date(locationSharing.shareUntil);
  const daysLeft = (until.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (daysLeft > 365) return 'Standort wird dauerhaft geteilt';
  return `Standort geteilt bis ${until.toLocaleDateString('de-DE')}`;
});

function toggleShareMenu(event?: MouseEvent) {
  if (!shareMenuOpen.value) {
    shareMenuStyle.value = computeTeleportMenuPosition(shareButtonRef, event, 216);
    shareMenuOpen.value = true;
  } else {
    shareMenuOpen.value = false;
  }
}

async function chooseShareDuration(duration: ShareDuration) {
  shareMenuOpen.value = false;
  await locationSharing.setDuration(duration);
}

// Standort-Aufzeichnung (stores/trackRecording.ts): läuft (wie die Standort-Freigabe oben) app-weit
// unabhängig von dieser Kartenansicht – Klick öffnet nur die Start-Auswahl bzw. beendet direkt eine
// bereits laufende Aufzeichnung, gleiches Teleport-Menü-Muster wie beim Share-Button.
const recordMenuOpen = ref(false);
const recordButtonRef = ref<HTMLButtonElement | null>(null);
const recordMenuStyle = ref({ top: '0px', left: '0px' });
const showTrackRecordingWarningModal = ref(false);
const pendingRecordVisibility = ref<TrackVisibility>('private');
const trackWarningDismissed = usePersistedRef<boolean>(
  'reisotor-track-recording-warning-acknowledged',
  false
);

async function toggleRecordMenu(event?: MouseEvent) {
  if (trackRecording.recording) {
    await trackRecording.stop();
    return;
  }
  if (!recordMenuOpen.value) {
    recordMenuStyle.value = computeTeleportMenuPosition(recordButtonRef, event, 216);
    recordMenuOpen.value = true;
  } else {
    recordMenuOpen.value = false;
  }
}

// Ist gerade eine Tour auf der Karte fokussiert (drawers.mapFocusExcursionId, siehe
// focusedExcursion unten), wird eine neu gestartete Aufzeichnung automatisch mit ihr verknüpft –
// diskreter, kontextabhängiger Weg für die "optional an eine Tour koppeln"-Anforderung, ohne ein
// zusätzliches Auswahl-Steuerelement im ohnehin schon kleinen Menü zu brauchen.
async function chooseRecordVisibility(visibility: TrackVisibility) {
  recordMenuOpen.value = false;
  if (trackWarningDismissed.value) {
    await trackRecording.start({ visibility, excursionId: drawers.mapFocusExcursionId });
  } else {
    pendingRecordVisibility.value = visibility;
    showTrackRecordingWarningModal.value = true;
  }
}

async function startRecordingConfirmed() {
  showTrackRecordingWarningModal.value = false;
  await trackRecording.start({
    visibility: pendingRecordVisibility.value,
    excursionId: drawers.mapFocusExcursionId,
  });
}

// Einmal gestartet, läuft der Kompass unabhängig von weiteren Klicks weiter (kein erneutes
// addEventListener nötig) - orientationHandler dient hier nur als "läuft schon?"-Wächter.
function startCompass() {
  if (orientationHandler) return;
  orientationEventName =
    'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  orientationHandler = handleOrientation;
  window.addEventListener(orientationEventName, orientationHandler as EventListener);
}

function stopCompass() {
  if (!orientationHandler) return;
  window.removeEventListener(orientationEventName, orientationHandler as EventListener);
  orientationHandler = null;
}

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
  // buildTravelDerivedLocations() deckt nur noch Etappen-Enden OHNE verknüpften Ort ab (Freitext-
  // Eingabe) – ein verknüpfter Ort (from_place_id/to_place_id) ist seit der Verschmelzung von
  // Reise-Orten in Spots (siehe Migrationskommentar in db/index.ts) bereits ein normaler Spot und
  // erscheint über die Spots-Schleife unten, dedupliziert über from_place_id/to_place_id (bzw.
  // gerundete lat/lng bei Freitext) – ohne das zeigte z. B. der Zielflughafen von Hin- UND Rückflug
  // zwei übereinanderliegende Pins am selben Ort.
  for (const loc of buildTravelDerivedLocations(travelItems.value)) {
    result.push({
      key: loc.key,
      origin: 'travel',
      lat: loc.lat,
      lng: loc.lng,
      title: loc.title,
      category: loc.category,
      homeSide: loc.homeSide,
      icon: loc.tabler,
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
        icon: meta.tabler,
        color: meta.color,
        category: s.category ?? 'Sonstiges',
        // Ein zuhause-markierter Reise-Ort-Spot (Flughafen/Bahnhof/… mit is_home) wird vom
        // Urlaubsfokus-Button ausgeblendet, genau wie vorher travel_places.is_home – bei
        // gewöhnlichen Spots ist is_home immer 0.
        homeSide: !!s.is_home,
        done: !!s.done,
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
      // 'done' ist unabhängig von planned/unplanned, per ODER kombiniert - identische Logik wie
      // ExcursionsView.vue's filteredSpotItems (beide Filter müssen im Gleichschritt bleiben).
      const matchesStatus = props.statusFilter!.includes(status);
      const matchesDone = props.statusFilter!.includes('done') && !!p.done;
      if (!matchesStatus && !matchesDone) return false;
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

// Standort-Aufzeichnung, die gerade auf der Karte gezeigt wird (ExcursionsView.vue's
// Aufzeichnungen-Liste, drawers.openMapForTrack()) – exklusiv zu den drei Fokus-Arten oben (siehe
// drawers.ts), gleiches Muster wie focusedExcursion.
const focusedTrack = computed<LocationTrack | null>(() => {
  if (drawers.mapFocusTrackId == null) return null;
  const found = tracksStore.tracks.find((t) => Number(t.id) === Number(drawers.mapFocusTrackId));
  if (found) return found;
  return {
    id: drawers.mapFocusTrackId,
    trip_id: Number(tripStore.currentTripId) || 0,
    user_id: auth.user?.id ?? 0,
    excursion_id: null,
    title: null,
    visibility: 'private',
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
  };
});
const focusedTrackPoints = computed<TrackPoint[]>(() => {
  if (!focusedTrack.value) return [];
  return tracksStore.getPointsForTrack(focusedTrack.value.id);
});
// Fortschritt des Zeit-Sliders (TrackPlayback.vue) – lebt hier statt in der Kind-Komponente, damit
// der Playback-Marker unten (updateTrackPlaybackMarker()) direkt auf denselben Wert reagieren kann.
const trackPlaybackProgress = ref(0);

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
    spotsStore.spots
  );
});

// Tage-Leiste: visualisiert den gesamten Urlaubszeitraum als anklickbare Tages-Chips direkt auf
// der Karte (statt den Tages-Fokus nur indirekt über die Kalender-Schublade erreichbar zu machen,
// siehe ScheduleView.vue's "🗺️ Tag auf Karte anzeigen") – nutzt denselben drawers.focusMapOnDate()-
// Mechanismus wie dort, hier aber für JEDEN Urlaubstag statt nur für Tage mit geplantem Ausflug.
const vacationDays = computed<string[]>(() => {
  const trip = tripStore.currentTrip;
  if (!trip || !trip.start_date || !trip.end_date) return [];
  const days: string[] = [];
  const cursor = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  while (cursor <= end) {
    days.push(toLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
});

function dayHasContent(date: string): boolean {
  if (excursionsStore.excursions.some((e) => e.date === date)) return true;
  if (travelItems.value.some((t) => t.date === date)) return true;
  if (
    spotsStore.spots.some(
      (s) =>
        s.category === 'Unterkunft' &&
        s.start_date &&
        s.end_date &&
        s.start_date <= date &&
        date <= s.end_date
    )
  )
    return true;
  return scheduleItems.value.some(
    (i) => i.lat != null && i.lng != null && i.date <= date && date <= (i.end_date ?? i.date)
  );
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
    const excursionKeys = excursionStationKeys(excursion.spot_ids);
    return filteredPoints.value.filter((p) => p.origin !== 'spot' || excursionKeys.includes(p.key));
  }
  if (drawers.mapFocusDate) {
    const keys = new Set(focusedDateStations.value.map((s) => s.key));
    return filteredPoints.value.filter((p) => p.origin !== 'spot' || keys.has(p.key));
  }
  return filteredPoints.value;
});

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  scheduleItems.value = await api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`);
  // Spots kommen jetzt aus dem geteilten spotsStore (reaktiv, wird u. a. von ExcursionsView.vue
  // selbst aktuell gehalten) – kein eigener Fetch/Refresh-Trigger hier mehr nötig.
}

const openTravelId = ref<number | null>(null);
const travelDialogOpen = ref(false);
const openTravel = computed(
  () => travelItems.value.find((t) => t.id === openTravelId.value) ?? null
);
function onTravelDialogUpdate(v: boolean) {
  travelDialogOpen.value = v;
  if (!v) drawers.mapFocusKey = null;
}

// Klick auf einen Pin direkt auf der Karte (nicht in der Stationsliste): bei Spots (inkl. Kategorie
// "Unterkunft", seit deren Verschmelzung in Spots ganz normale Spots) klappt statt eines eigenen
// Modal-Dialogs, der die Karte dahinter blockieren würde, die passende Karte in der Spots-Liste auf
// (Emit an ExcursionsView.vue, siehe dort) – bei Reise gibt es kein Listen-Gegenstück, dort bleibt
// der bisherige Modal-Dialog (unproblematisch, da seltener genutzt als die primäre Spot↔Karte-
// Kopplung). Die Pin-Vergrößerung (drawers.mapFocusKey) läuft in beiden Fällen weiterhin gleich.
function handlePointClick(point: MapPoint) {
  if (point.origin === 'spot') {
    const spotId = Number(point.key.slice('spot-'.length));
    drawers.mapFocusKey = point.key;
    emit('focus-spot', spotId);
  } else {
    const isFrom = point.key.startsWith('travel-from-');
    openTravelId.value = Number(point.key.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    travelDialogOpen.value = true;
    drawers.mapFocusKey = point.key;
  }
}
// Reise-Etappen sind seit #176 ganz normale Touren (Touren-Formular öffnet sich in der
// "Touren"-Gruppierung) - #196 entfernte die frühere eigene "Reise"-Gruppierung, dorthin springt
// also derselbe #excursion-<id>-Hash wie bei jeder anderen Tour (onFocusExcursionFromMap in
// ExcursionsView.vue). id vorher sichern, da das Schließen des Dialogs die *Open-Flags zurücksetzt,
// nicht aber die id-Refs selbst.
function editOpenTravel() {
  const id = openTravelId.value;
  travelDialogOpen.value = false;
  router.push(`/excursions#excursion-${id}`);
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
  drawers.mapFocusTrackId = null;
  const catPoints = filteredPoints.value.filter((p) => p.category === category);
  const latLngs = catPoints.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
  } else if (latLngs.length === 1) {
    centerOnPoint(latLngs[0], 14);
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
  drawers.mapFocusTrackId = null;
  const latLngs = filteredPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
  } else if (latLngs.length === 1) {
    centerOnPoint(latLngs[0], 13);
  }
}

// Zoomt/zentriert nur auf die Punkte am Urlaubsort – ohne die Zuhause-Seite von Anreise/Abreise
// (vacationPoints), damit man im Urlaub direkt den näheren, relevanten Kartenausschnitt bekommt.
function fitVacation() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  drawers.mapFocusTrackId = null;
  const latLngs = vacationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
  } else if (latLngs.length === 1) {
    centerOnPoint(latLngs[0], 13);
  }
}

const accommodationPoints = computed(() =>
  filteredPoints.value.filter((p) => p.category === 'Unterkunft')
);

// Zoomt/zentriert nur auf die Unterkünfte – praktisch bei mehreren Unterkünften im selben Urlaub
// (z. B. Roadtrip), um schnell zwischen ihnen zu vergleichen statt Spots/Reise mit anzuzeigen.
function fitAccommodations() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  drawers.mapFocusTrackId = null;
  const latLngs = accommodationPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
  } else if (latLngs.length === 1) {
    centerOnPoint(latLngs[0], 13);
  }
}

// Alle Spots, die (mindestens) einem Ausflug als Station zugeordnet sind – für den Ausflüge-Fokus-
// Button unten. Anders als der einzelne Ausflug-Fokus (drawers.mapFocusExcursionId) bezieht sich
// dieser Button auf ALLE Ausflüge gleichzeitig, blendet also nichts aus, sondern zoomt nur. Bewusst
// weiterhin nur auf echte Spot-Stationen beschränkt (Button-Icon 🎒 "Ausflugsziele"), nicht auf
// Unterkunft/Reise-Stationen – die sind über die eigenen Fokus-Buttons bereits erreichbar.
const excursionSpotIds = computed(
  () => new Set(excursionsStore.excursions.flatMap((e) => e.spot_ids))
);
const excursionPoints = computed(() =>
  filteredPoints.value.filter(
    (p) => p.origin === 'spot' && excursionSpotIds.value.has(Number(p.key.slice('spot-'.length)))
  )
);

// Zoomt/zentriert nur auf die Spots, die irgendeinem Ausflug zugeordnet sind – praktisch, um sich
// schnell einen Überblick über alle geplanten Ausflugsziele zu verschaffen.
function fitExcursions() {
  if (!map) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  drawers.mapFocusTrackId = null;
  const latLngs = excursionPoints.value.map((p): L.LatLngExpression => [p.lat, p.lng]);
  if (latLngs.length > 1) {
    fitBoundsWithCoveredBottom(L.latLngBounds(latLngs));
  } else if (latLngs.length === 1) {
    centerOnPoint(latLngs[0], 13);
  }
}

let isProgrammaticMove = false;

function checkFocusOutOfBounds() {
  if (!map) return;

  const hasFocus =
    drawers.mapFocusExcursionId != null ||
    drawers.mapFocusDate != null ||
    drawers.mapFocusKey != null ||
    drawers.mapFocusTrackId != null;

  if (!hasFocus) return;

  let focusedLatLngs: [number, number][] = [];

  if (focusedExcursion.value) {
    focusedLatLngs = visiblePoints.value
      .filter((p) => p.origin === 'spot')
      .map((p) => [p.lat, p.lng]);
  } else if (drawers.mapFocusDate) {
    focusedLatLngs = focusedDateStations.value
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat as number, s.lng as number]);
  } else if (drawers.mapFocusKey) {
    const p = points.value.find((pt) => pt.key === drawers.mapFocusKey);
    if (p) focusedLatLngs = [[p.lat, p.lng]];
  } else if (focusedTrack.value) {
    focusedLatLngs = focusedTrackPoints.value.map((pt) => [pt.lat, pt.lng]);
  }

  if (!focusedLatLngs.length) return;

  const coveredLeftPx = props.coveredLeftPx ?? 0;
  const coveredBottomPx = props.coveredBottomPx ?? 0;
  const mapSize = map.getSize();

  let isAnyOutOfBounds = false;
  for (const [lat, lng] of focusedLatLngs) {
    const pt = map.latLngToContainerPoint([lat, lng]);
    if (
      pt.x < coveredLeftPx ||
      pt.x > mapSize.x ||
      pt.y < 0 ||
      pt.y > mapSize.y - coveredBottomPx
    ) {
      isAnyOutOfBounds = true;
      break;
    }
  }

  if (isAnyOutOfBounds) {
    drawers.mapFocusExcursionId = null;
    drawers.mapFocusDate = null;
    drawers.mapFocusKey = null;
    drawers.mapFocusTrackId = null;
  }
}

// Zentriert auf einen einzelnen Punkt UND schiebt den sichtbaren Ausschnitt danach so weit nach
// oben/rechts, dass der Punkt in der Mitte der tatsächlich sichtbaren Fläche landet – nicht in der Mitte
// des gesamten Karten-Containers, dessen unterer Teil auf mobile von der Spots-Schublade verdeckt
// wird (siehe props.coveredBottomPx) und dessen linker Teil auf Desktop von den schwebenden Schubladen
// verdeckt wird (siehe props.coveredLeftPx). Ohne diesen Ausgleich landete ein fokussierter Punkt bei
// aufgeklappter Schublade optisch dahinter statt im sichtbaren freien Kartenbereich.
function centerOnPoint(latlng: L.LatLngExpression, zoom: number) {
  if (!map) return;
  isProgrammaticMove = true;
  const coveredBottomPx = props.coveredBottomPx ?? 0;
  const coveredLeftPx = props.coveredLeftPx ?? 0;
  if (!coveredBottomPx && !coveredLeftPx) {
    map.setView(latlng, zoom, { animate: false });
    return;
  }
  // Direkte Projektions-Rechnung statt map.setView()+map.panBy(): der Zielpunkt soll nicht im
  // Zentrum des gesamten Karten-Containers landen, sondern im Zentrum der tatsächlich sichtbaren
  // Fläche (Container abzüglich der unten/links überlagernden Schubladen) – dafür muss der neue
  // Karten-MITTELPUNKT um die Hälfte des verdeckten Bereichs verschoben werden (project()/
  // unproject() arbeiten in einem containerunabhängigen Weltpixel-Raum, in dem sich Versätze 1:1
  // wie Bildschirmpixel verhalten). map.panBy() wurde hier bewusst NICHT verwendet: bei größeren,
  // nicht animierten Offsets nimmt es einen internen Kurzschluss-Pfad, dessen Pixel-Verhalten sich
  // in Tests als nicht zuverlässig vorhersagbar erwiesen hat.
  const targetPoint = map.project(latlng, zoom);
  const shiftedCenter = map.unproject(
    targetPoint.add([-coveredLeftPx / 2, coveredBottomPx / 2]),
    zoom
  );
  map.setView(shiftedCenter, zoom, { animate: false });
}

// Wie centerOnPoint() oben, aber für einen ganzen Ausschnitt (mehrere Punkte): Leaflets eigene
// fitBounds()-padding-Option wirkt standardmäßig symmetrisch auf alle vier Seiten - Leaflet
// unterstützt für genau diesen ungleichen Fall aber bereits eingebautes asymmetrisches Padding über
// paddingTopLeft/paddingBottomRight, das reicht hier vollständig aus, ohne die project()/unproject()-
// Rechnung von centerOnPoint() zu duplizieren.
function fitBoundsWithCoveredBottom(bounds: L.LatLngBoundsExpression) {
  if (!map) return;
  isProgrammaticMove = true;
  const coveredBottomPx = props.coveredBottomPx ?? 0;
  const coveredLeftPx = props.coveredLeftPx ?? 0;
  map.fitBounds(bounds, {
    paddingTopLeft: [32 + coveredLeftPx, 32],
    paddingBottomRight: [32, 32 + coveredBottomPx],
  });
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
    ? visiblePoints.value
        .filter((p) => p.origin === 'spot')
        .map((p): L.LatLngExpression => [p.lat, p.lng])
    : [];

  const dateLatLngs: L.LatLngExpression[] =
    !excursion && drawers.mapFocusDate
      ? focusedDateStations.value
          .filter((s) => s.lat != null && s.lng != null)
          .map((s): L.LatLngExpression => [s.lat as number, s.lng as number])
      : [];

  // "Auf Karte anzeigen"/Pin-Klick setzt drawers.mapFocusKey – hier zentrieren wir dann direkt auf
  // den Punkt (die dezente Pin-Vergrößerung selbst passiert unabhängig davon in iconFor()).
  const focusPoint = drawers.mapFocusKey
    ? points.value.find((p) => p.key === drawers.mapFocusKey)
    : null;

  if (excursion) {
    if (excursionLatLngs.length > 1) {
      fitBoundsWithCoveredBottom(L.latLngBounds(excursionLatLngs));
    } else if (excursionLatLngs.length === 1) {
      centerOnPoint(excursionLatLngs[0], 14);
    }
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
    map.setView([48.1351, 11.582], 5); // Fallback: Mitteleuropa
  }
}

// Zeichnet Verbindungslinien: je Reise-Eintrag mit Start- UND Zielkoordinaten eine Strecke
// (Flug/Bahn/Auto/…), je Ausflug mit ≥2 verorteten Stationen eine Route entlang der Stationen
// (in der Reihenfolge von spot_ids). Rein visuell, keine echte Routenführung entlang von
// Straßen. Im Tages-Fokus wird stattdessen eine einzige, zusammenhängende Route über alle
// Stationen ALLER Ausflüge dieses Tages gezeichnet (statt je Ausflug eine eigene) – analog zum
// Ausflug-Fokus, der ebenfalls nur dessen eigene Route statt aller Ausflüge zeigt.
function renderRoutes() {
  if (!map || !routesLayer) return;
  routesLayer.clearLayers();

  // Im Tages-Fokus nur die Reise-Etappen DIESES Tages zeichnen - sonst blieben irrelevante
  // Hin-/Rückflug-Strecken anderer Tage als zusätzliche gestrichelte Linien sichtbar, obwohl der
  // Fokus laut Marker-Filterung (visiblePoints) eigentlich nur die Orte dieses einen Tages zeigen soll.
  for (const t of travelItems.value) {
    if (drawers.mapFocusDate && t.date !== drawers.mapFocusDate) continue;
    if (t.from_lat != null && t.from_lng != null && t.to_lat != null && t.to_lng != null) {
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

  if (!focusedExcursion.value && drawers.mapFocusDate) {
    const coords: L.LatLngExpression[] = focusedDateStations.value
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

  // Im Ausflug-Fokus nur dessen eigene Route zeichnen, nicht die aller anderen Ausflüge. Touren mit
  // gesetzter role (#176: ehemalige Reise-Etappe) sind hier bewusst ausgeschlossen - ihre Route
  // zeichnet bereits die travelItems-Schleife oben (grün/gestrichelt), ein zweiter, orangener
  // Streckenzug zwischen denselben zwei Stationen wäre nur eine optisch überlappende Dopplung.
  const excursionsToDraw = focusedExcursion.value
    ? focusedExcursion.value.role
      ? []
      : [focusedExcursion.value]
    : excursionsStore.excursions.filter((e) => !e.role);
  for (const excursion of excursionsToDraw) {
    const stations = resolveStations(
      excursionStationKeys(excursion.spot_ids),
      spotsStore.spots,
      travelItems.value
    );
    const coords: L.LatLngExpression[] = stations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat as number, s.lng as number]);
    if (coords.length >= 2) {
      L.polyline(arcRoute(coords), {
        color: '#e08e45',
        weight: 3,
        opacity: 0.65,
        dashArray: '6 6',
      }).addTo(routesLayer);
    }
  }
}

// Zeichnet die aktuell fokussierte Standort-Aufzeichnung als durchgezogene Linie (echte GPS-Punkte,
// kein arcRoute()-Bogen wie bei den schematischen Touren-Routen in renderRoutes()) – wird nur bei
// einem Track-Wechsel/frisch geladenen Punkten neu aufgerufen, nicht bei jedem Zeit-Slider-Tick
// (dafür updateTrackPlaybackMarker() unten).
function renderTracks() {
  if (!map || !tracksLayer) return;
  tracksLayer.clearLayers();
  const trackPts = focusedTrackPoints.value;
  if (trackPts.length < 2) return;
  const coords: L.LatLngExpression[] = trackPts.map((p) => [p.lat, p.lng]);
  L.polyline(coords, { color: '#2f6fed', weight: 4, opacity: 0.85 }).addTo(tracksLayer);
  fitBoundsWithCoveredBottom(L.latLngBounds(coords));
  updateTrackPlaybackMarker();
}

// Bewegt den Zeit-Slider-Marker (TrackPlayback.vue's v-model:progress) entlang der aufgezeichneten
// Route – eigener, leichtgewichtiger Layer statt Teil von tracksLayer, da sich der Fortschritt bei
// laufender Wiedergabe mehrfach pro Sekunde ändert und dafür nicht jedes Mal die ganze Polyline neu
// gezeichnet werden soll (gleicher Grund wie bei positionsLayer/markersLayer oben).
function updateTrackPlaybackMarker() {
  if (!map || !trackPlaybackLayer) return;
  trackPlaybackLayer.clearLayers();
  const pos = interpolateTrackPosition(focusedTrackPoints.value, trackPlaybackProgress.value);
  if (!pos) return;
  L.marker([pos.lat, pos.lng], {
    icon: cachedEmojiPin(FORM_FIELD_ICONS.location, '#2f6fed'),
    zIndexOffset: 900,
  }).addTo(trackPlaybackLayer);
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
    // Der Richtungskegel wird als Teil des (nicht mitrotierenden, siehe leaflet-rotate's
    // rotateWithView-Default) Marker-Icons in Bildschirm-Koordinaten gezeichnet - dreht sich die
    // Karte selbst (currentBearing), muss die Kegel-Rotation um denselben Betrag ausgeglichen
    // werden, sonst zeigt er nach einer Kartendrehung in die falsche Richtung. Im Fahrtrichtung-
    // Modus (bearing wird laufend auf den Heading-Wert gesetzt, siehe handleOrientation()) kürzt
    // sich das exakt heraus - der Kegel zeigt dann konstant nach oben.
    const coneRotation =
      ownHeading.value == null ? null : (ownHeading.value - currentBearing.value + 360) % 360;
    L.marker([ownPosition.value.lat, ownPosition.value.lng], {
      icon: compassPin(auth.user.avatar, '#2f6fed', coneRotation),
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

// Andere Mitreisende für den "Zu Standort von …"-Teil des Standort-Popovers (#182) – alle
// Mitglieder außer einem selbst, unabhängig von Online-/Freigabe-Status (der wird erst pro
// Menüpunkt per isMemberOnline()/hasMemberPosition() ausgewertet, s. Template). Gleiche
// Mitglieder-Quelle wie payerLabelFor() oben (users.value, per /trips/:id/members geladen).
const otherMembers = computed(() => users.value.filter((u) => u.id !== auth.user?.id));

function isMemberOnline(userId: number) {
  return liveSync.onlineUserIds.includes(userId);
}

// Nur wer aktuell Standort teilt (liveSync.memberPositions, aus den SSE-position(s)-Events) hat
// überhaupt ein Sprungziel - Online-Sein allein reicht nicht (Standort-Freigabe ist ein eigener,
// bewusster Opt-in, siehe stores/locationSharing.ts).
function hasMemberPosition(userId: number) {
  return userId in liveSync.memberPositions;
}

function jumpToMemberLocation(userId: number) {
  const position = liveSync.memberPositions[userId];
  if (!map || !position) return;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  drawers.mapFocusTrackId = null;
  centerOnPoint([position.lat, position.lng], 16);
}

// "Zu meinem Standort springen"-Button: nur aktiv, sobald mindestens ein GPS-Fix vorliegt. Dient
// zusätzlich als Auslöser für die Kompass-Berechtigung auf iOS 13+ (siehe requestCompassPermission
// oben an startCompass()) - DeviceOrientationEvent.requestPermission() liefert dort NUR innerhalb
// eines echten Klick-Handlers einen Berechtigungsdialog statt lautlos fehlzuschlagen, ein Aufruf
// direkt in onMounted() würde also nie einen Dialog zeigen. Dieser Button ist der einzige gezielte
// Nutzer-Klick im Kartenkontext, der sich dafür eignet.
async function jumpToMyLocation() {
  if (!map || !ownPosition.value) return;
  const OrientationEventCtor = (
    window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }
  ).DeviceOrientationEvent;
  if (OrientationEventCtor?.requestPermission && !orientationHandler) {
    try {
      const state = await OrientationEventCtor.requestPermission();
      if (state === 'granted') startCompass();
    } catch {
      // Berechtigung abgelehnt/fehlgeschlagen - Marker bleibt einfach ohne Richtungskegel.
    }
  }
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusKey = null;
  drawers.mapFocusTrackId = null;
  centerOnPoint([ownPosition.value.lat, ownPosition.value.lng], 16);
}

// Vorab-Herunterladen des sichtbaren Kartenausschnitts für den "totalen" Offline-Fall (siehe
// utils/offlineMapTiles.ts) - bewusst der GERADE sichtbare Ausschnitt (map.getBounds()) statt einer
// automatisch ermittelten "Urlaubsregion": die Nutzerin steuert Ausschnitt/Detailgrad selbst durch
// Pan/Zoom, bevor sie den Button drückt - dasselbe Prinzip wie bei "Diesen Bereich herunterladen" in
// gängigen Karten-Apps.
type TileDownloadState = 'idle' | 'downloading' | 'done';
const tileDownloadState = ref<TileDownloadState>('idle');
const tileDownloadProgress = ref({ done: 0, total: 0 });
const tileDownloadResult = ref<{ downloaded: number; failed: number } | null>(null);

async function downloadOfflineMap() {
  if (!map || tileDownloadState.value === 'downloading') return;
  const bounds = map.getBounds();
  const estimate = estimateTileDownload(bounds);
  const confirmed = window.confirm(
    `Aktuellen Kartenausschnitt für die Offline-Nutzung herunterladen?\n\n${estimate.count} Kacheln, ca. ${formatApproxSize(estimate.approxBytes)}.`
  );
  if (!confirmed) return;

  tileDownloadState.value = 'downloading';
  tileDownloadProgress.value = { done: 0, total: estimate.count };
  tileDownloadResult.value = await downloadTiles(bounds, (done, total) => {
    tileDownloadProgress.value = { done, total };
  });
  tileDownloadState.value = 'done';
}

function dismissTileDownloadResult() {
  tileDownloadState.value = 'idle';
  tileDownloadResult.value = null;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  const [, , usersRes] = await Promise.all([
    loadAll(),
    spotsStore.load(),
    api.get<User[]>(`/trips/${tripStore.currentTripId}/members`),
  ]);
  users.value = usersRes;

  if (!mapEl.value) return;
  // rotate/touchRotate (leaflet-rotate, siehe Import oben): aktiviert die Zwei-Finger-Drehgeste.
  // rotateControl:false, weil wir einen eigenen, zum übrigen Button-Stack passenden Umschalter
  // bauen (siehe toggleMapOrientation(), erreichbar über das Standort-&-Ausrichtung-Popover
  // .location-btn) statt des mitgelieferten Steuerelements.
  map = L.map(mapEl.value, {
    rotate: true,
    rotateControl: false,
    touchRotate: true,
    bearing: 0,
    // Explizit statt nur Leaflets Default (der ohnehin schon true ist) - macht die Absicht klar und
    // schützt gegen versehentliches Abschalten bei künftigen Leaflet-Versionen/Default-Änderungen.
    doubleClickZoom: true,
  });
  map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);
  // routesLayer vor markersLayer hinzufügen, damit Routen-Linien unter den (klickbaren) Pins
  // liegen statt sie zu verdecken.
  routesLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  positionsLayer = L.layerGroup().addTo(map);
  tracksLayer = L.layerGroup().addTo(map);
  trackPlaybackLayer = L.layerGroup().addTo(map);
  renderMarkers();
  renderRoutes();
  renderPositions();
  renderTracks();

  // Hält currentBearing (für den Richtungskegel-Ausgleich in renderPositions()) unabhängig von der
  // Drehquelle synchron - sowohl bei automatischer Drehung (handleOrientation()) als auch bei einer
  // manuellen Zwei-Finger-Geste, die die Karte ohne unser Zutun dreht.
  map.on('rotate', () => {
    currentBearing.value = map!.getBearing();
    renderPositions();
  });

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
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }

  // Kompass-Blickrichtung: auf den meisten Plattformen (Android/Chrome, Desktop) ohne gesonderte
  // Berechtigung nutzbar, deshalb hier direkt starten. iOS 13+ ist die Ausnahme (siehe
  // jumpToMyLocation() oben) - dort bleibt DeviceOrientationEvent.requestPermission ungenutzt, bis
  // die Nutzerin dort klickt, ein automatischer Aufruf hier würde ohnehin lautlos verpuffen.
  const OrientationEventCtor = (
    window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }
  ).DeviceOrientationEvent;
  if (OrientationEventCtor && !OrientationEventCtor.requestPermission) {
    startCompass();
  }

  // Automatische Fokus-Rücksetzung, wenn die Nutzerin manuell von fokussierten Orten wegscrolled
  map.on('moveend', () => {
    if (isProgrammaticMove) {
      isProgrammaticMove = false;
      return;
    }
    checkFocusOutOfBounds();
  });

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
  stopCompass();
  // Nicht abbrechen, falls eine app-weite Standort-Freigabe (stores/locationSharing.ts) aktiv ist -
  // die läuft bewusst unabhängig von dieser Ansicht weiter (siehe dortiger Kommentar), ein Verlassen
  // der Kartenansicht darf eine "dauerhaft"/"für eine Woche" gewählte Freigabe nicht beenden.
  if (!locationSharing.shareUntil) liveSync.stopSharingPosition();
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
  }
);

// Fokus-Punkt kann sich ändern, während die Karte bereits sichtbar ist (z. B. zweites
// "Auf Karte anzeigen" direkt hintereinander).
watch(
  () => drawers.mapFocusKey,
  () => renderMarkers()
);

// Ausflug-Fokus (Button "Auf Karte anzeigen" in ExcursionCard.vue) blendet andere Spots aus und
// zeichnet nur dessen eigene Route – beides betrifft Marker UND Routen, daher hier beide neu
// rendern statt nur renderMarkers() wie beim einfachen Punkt-Fokus oben.
watch(
  () => drawers.mapFocusExcursionId,
  () => {
    renderMarkers();
    renderRoutes();
  }
);

// Tages-Fokus (ScheduleView.vue's "🗺️ Tag auf Karte anzeigen") – gleicher Grund wie beim
// Ausflug-Fokus oben (betrifft Marker UND Route).
watch(
  () => drawers.mapFocusDate,
  () => {
    renderMarkers();
    renderRoutes();
  }
);

// Erneuter Aufruf von "Auf Karte anzeigen" – zentriert den Ausschnitt auch dann neu,
// wenn sich die Fokus-Id im Store selbst nicht geändert hat.
watch(
  () => drawers.focusVersion,
  () => {
    if (!map) return;
    renderMarkers();
    renderRoutes();
    if (focusedTrackPoints.value.length >= 2) {
      renderTracks();
    }
  }
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
  { deep: true }
);

// Verdeckter Bereich der Karte ändert sich (z. B. Kalender-Schublade auf Desktop geöffnet/geschlossen
// oder Spots-Schublade auf Mobil umgestuft) – zentriert sichtbare Marker/Aufzeichnungen im neuen
// freien Bereich neu.
watch(
  () => [props.coveredBottomPx, props.coveredLeftPx],
  () => {
    if (!map) return;
    renderMarkers();
    if (focusedTrackPoints.value.length >= 2) {
      renderTracks();
    }
  }
);

// Ausflüge werden im excursions-Store gehalten (u. a. für Drag&Drop in die Kalender-Schublade) und
// erst asynchron geladen – ändert sich die Liste (z. B. Spot-Zuordnung bearbeitet), müssen die
// Ausflugs-Routen neu gezeichnet werden.
watch(
  () => excursionsStore.excursions,
  () => renderRoutes(),
  { deep: true }
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
  }
);

// Standort-Updates anderer Mitglieder (liveSync.ts's position/positions-SSE-Events) – deep, da
// memberPositions ein reaktives Objekt ist, das in-place mutiert wird (kein Array-Austausch).
watch(
  () => liveSync.memberPositions,
  () => renderPositions(),
  { deep: true }
);

// Fokussierte Aufzeichnung wechselt (Klick in ExcursionsView.vue's Aufzeichnungen-Liste, siehe
// drawers.openMapForTrack()) – Punkte werden erst on-demand geladen (tracksStore.pointsByTrack ist
// zunächst leer für einen frisch fokussierten Track), Slider startet jeweils von vorn.
watch(
  focusedTrack,
  async (track) => {
    trackPlaybackProgress.value = 0;
    renderTracks();
    if (track && !tracksStore.getPointsForTrack(track.id).length) {
      try {
        const points = await tracksStore.loadPoints(track.id);
        renderTracks();
        if (!points.length) {
          setTimeout(async () => {
            if (focusedTrack.value?.id === track.id) {
              await tracksStore.loadPoints(track.id).catch(() => []);
              renderTracks();
            }
          }, 600);
        }
      } catch {}
    }
  },
  { immediate: true }
);
// Punkte können auch eintreffen, ohne dass sich mapFocusTrackId selbst ändert (z. B. erneuter
// Fokus auf einen zuvor schon einmal geladenen, dann aber aktualisierten Track) – reagiert auf die
// tatsächliche Punkte-Anzahl statt nur auf die Track-id.
watch(
  () => focusedTrackPoints.value.length,
  () => renderTracks()
);
// Zeit-Slider (TrackPlayback.vue) – nur der leichtgewichtige Marker wird bewegt, nicht die ganze
// Route neu gezeichnet (siehe updateTrackPlaybackMarker()-Kommentar).
watch(trackPlaybackProgress, () => updateTrackPlaybackMarker());
</script>

<template>
  <div
    class="karte"
    :class="{ 'sheet-overlay-mode': isNarrowLayout }"
    :style="{
      '--calendar-offset': `${calendarOffset}px`,
      '--calendar-margin': calendarMargin,
    }"
  >
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <!-- Fasst "Alle anzeigen"/"Nur Urlaubsort"/"Nur Unterkünfte"/"Nur Tourziele" hinter einem
           Popover zusammen statt vier eigenen Buttons (Nutzer-Feedback: die Button-Spalte war zu
           lang/unübersichtlich geworden, einzelne Buttons rutschten hinter das Bottom-Sheet). -->
      <IconButton
        ref="focusButtonRef"
        variant="floating"
        shape="circle"
        class="fit-btn focus-btn"
        title="Kartenausschnitt fokussieren"
        aria-label="Kartenausschnitt fokussieren"
        :disabled="!filteredPoints.length"
        :icon="MAP_TOOL_ICONS.focusGroup"
        @click="toggleFocusMenu($event)"
      />
      <!-- Fasst "Zu meinem Standort springen" und den Ausrichtungs-Umschalter (Norden/Fahrtrichtung
           oben) hinter einem zweiten Popover zusammen - beide drehen sich um "wo bin ich/wohin
           schaue ich", anders als die reine Datenfokus-Gruppe oben. -->
      <IconButton
        ref="locationButtonRef"
        variant="floating"
        shape="circle"
        class="fit-btn location-btn"
        title="Standort & Ausrichtung"
        aria-label="Standort & Ausrichtung"
        :icon="MAP_TOOL_ICONS.locationGroup"
        @click="toggleLocationMenu($event)"
      />
      <IconButton
        variant="floating"
        shape="circle"
        class="fit-btn offline-download-btn"
        title="Sichtbaren Kartenausschnitt für die Offline-Nutzung herunterladen"
        aria-label="Sichtbaren Kartenausschnitt für die Offline-Nutzung herunterladen"
        :disabled="tileDownloadState === 'downloading'"
        :icon="ACTION_ICONS.download"
        @click="downloadOfflineMap"
      />
      <!-- Standort-Freigabe (stores/locationSharing.ts): läuft unabhängig davon, ob diese
           Kartenansicht offen ist - Klick öffnet nur die Dauer-Auswahl. -->
      <IconButton
        ref="shareButtonRef"
        variant="floating"
        shape="circle"
        class="fit-btn share-location-btn"
        :active="!!locationSharing.shareUntil"
        :title="shareDurationLabel"
        :aria-label="shareDurationLabel"
        :icon="ACTION_ICONS.shareLocation"
        @click="toggleShareMenu($event)"
      />
      <!-- Standort-Aufzeichnung (stores/trackRecording.ts): läuft ebenfalls unabhängig von dieser
           Kartenansicht weiter - Klick öffnet bei Nicht-Aufzeichnung nur die Start-Auswahl, beendet
           bei laufender Aufzeichnung direkt (kein Menü nötig). -->
      <IconButton
        ref="recordButtonRef"
        variant="floating"
        shape="circle"
        class="fit-btn record-btn"
        :active="trackRecording.recording"
        :title="trackRecording.recording ? 'Aufzeichnung beenden' : 'Standort aufzeichnen'"
        :aria-label="trackRecording.recording ? 'Aufzeichnung beenden' : 'Standort aufzeichnen'"
        :icon="trackRecording.recording ? ACTION_ICONS.recordStop : ACTION_ICONS.recordStart"
        @click="toggleRecordMenu($event)"
      />
      <Teleport to="body">
        <template v-if="focusMenuOpen">
          <div class="picker-backdrop" @click="focusMenuOpen = false"></div>
          <div class="picker-menu picker-menu-wide" :style="focusMenuStyle">
            <DropdownItem
              :disabled="!filteredPoints.length"
              :icon="MAP_TOOL_ICONS.fitAll"
              label="Alle eingetragenen Orte anzeigen"
              @click="selectFocus(fitAll)"
            />
            <DropdownItem
              :disabled="!vacationPoints.length"
              :icon="MAP_TOOL_ICONS.vacation"
              label="Nur Urlaubsort"
              @click="selectFocus(fitVacation)"
            />
            <DropdownItem
              :disabled="!accommodationPoints.length"
              :icon="MAP_TOOL_ICONS.accommodation"
              label="Nur Unterkünfte"
              @click="selectFocus(fitAccommodations)"
            />
            <DropdownItem
              v-if="excursionsStore.excursions.length"
              :disabled="!excursionPoints.length"
              :icon="MAP_TOOL_ICONS.excursions"
              label="Nur Tourziele"
              @click="selectFocus(fitExcursions)"
            />
          </div>
        </template>
        <template v-if="locationMenuOpen">
          <div class="picker-backdrop" @click="locationMenuOpen = false"></div>
          <div class="picker-menu picker-menu-wide" :style="locationMenuStyle">
            <DropdownItem :disabled="!ownPosition" @click="selectLocation(jumpToMyLocation)">
              <span class="picker-item-emoji" aria-hidden="true">{{
                auth.user?.avatar || '📍'
              }}</span>
              Zu meinem Standort springen
            </DropdownItem>
            <DropdownItem
              v-for="member in otherMembers"
              :key="member.id"
              :disabled="!hasMemberPosition(member.id)"
              :title="`${member.username} teilt gerade ${hasMemberPosition(member.id) ? '' : 'keinen '}Standort`"
              @click="selectLocation(() => jumpToMemberLocation(member.id))"
            >
              <span
                class="picker-item-emoji"
                :class="{ offline: !isMemberOnline(member.id) }"
                aria-hidden="true"
              >
                {{ member.avatar }}
                <span v-if="isMemberOnline(member.id)" class="online-dot" aria-hidden="true" />
              </span>
              Zu Standort von {{ member.username }} springen
            </DropdownItem>
            <DropdownItem
              :active="mapOrientation.mode === 'north'"
              :icon="MAP_TOOL_ICONS.orientationNorth"
              label="Norden oben"
              @click="selectLocation(() => setMapOrientationMode('north'))"
            />
            <DropdownItem
              :active="mapOrientation.mode === 'heading'"
              :icon="MAP_TOOL_ICONS.orientationHeading"
              label="Fahrtrichtung oben"
              @click="selectLocation(() => setMapOrientationMode('heading'))"
            />
          </div>
        </template>
        <template v-if="shareMenuOpen">
          <div class="picker-backdrop" @click="shareMenuOpen = false"></div>
          <div class="picker-menu" :style="shareMenuStyle">
            <DropdownItem
              :active="!locationSharing.shareUntil"
              :icon="ACTION_ICONS.off"
              label="Nicht teilen"
              @click="chooseShareDuration('off')"
            />
            <DropdownItem
              :icon="FORM_FIELD_ICONS.date"
              icon-group="formFields"
              label="Für einen Tag"
              @click="chooseShareDuration('day')"
            />
            <DropdownItem
              :icon="FORM_FIELD_ICONS.period"
              icon-group="formFields"
              label="Für eine Woche"
              @click="chooseShareDuration('week')"
            />
            <DropdownItem
              :icon="ACTION_ICONS.forever"
              label="Dauerhaft"
              @click="chooseShareDuration('forever')"
            />
          </div>
        </template>
        <template v-if="recordMenuOpen">
          <div class="picker-backdrop" @click="recordMenuOpen = false"></div>
          <div class="picker-menu" :style="recordMenuStyle">
            <p v-if="focusedExcursion" class="picker-menu-hint">
              <AppIcon :icon="FORM_FIELD_ICONS.link" :size="14" group="formFields" /> wird an „{{
                focusedExcursion.title
              }}" gekoppelt
            </p>
            <DropdownItem
              :icon="ACTION_ICONS.private"
              label="Privat aufzeichnen"
              @click="chooseRecordVisibility('private')"
            />
            <DropdownItem
              :icon="ACTION_ICONS.shared"
              label="Geteilt aufzeichnen"
              @click="chooseRecordVisibility('shared')"
            />
          </div>
        </template>
      </Teleport>
      <TrackRecordingWarningModal
        v-model="showTrackRecordingWarningModal"
        @confirm="startRecordingConfirmed"
      />
      <div class="tile-download-pill" v-if="trackRecording.startError">
        <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
        {{ trackRecording.startError }}
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          aria-label="Meldung schließen"
          title="Schließen"
          @click="trackRecording.startError = null"
        />
      </div>
      <div class="tile-download-pill" v-if="tileDownloadState === 'downloading'">
        <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Lädt Kartenkacheln…
        {{ tileDownloadProgress.done }}/{{ tileDownloadProgress.total }}
      </div>
      <div
        class="tile-download-pill"
        v-else-if="tileDownloadState === 'done' && tileDownloadResult"
      >
        <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        {{ tileDownloadResult.downloaded }} Kacheln offline gespeichert{{
          tileDownloadResult.failed ? `, ${tileDownloadResult.failed} fehlgeschlagen` : ''
        }}
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          aria-label="Meldung schließen"
          title="Schließen"
          @click="dismissTileDownloadResult"
        />
      </div>
      <div class="focus-banner" v-if="focusedExcursion">
        <span
          ><AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" />
          {{ focusedExcursion.title }}</span
        >
        <button type="button" class="card-action-btn" @click="drawers.mapFocusExcursionId = null">
          <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" /> Fokus verlassen
        </button>
      </div>
      <div class="focus-banner" v-else-if="drawers.mapFocusDate">
        <span
          ><AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
          {{ formatDate(drawers.mapFocusDate) }}</span
        >
        <button type="button" class="card-action-btn" @click="drawers.mapFocusDate = null">
          <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" /> Fokus verlassen
        </button>
      </div>
    </div>

    <!-- Mobil/schmales Layout (Teleport aktiv, siehe isNarrowLayout) landet diese Stationen-Liste UND
         (weiter unten) den Tage-Streifen in der Spots-Schublade (ExcursionsView.vue's
         #map-focus-dock) statt als Overlay über der Karte zu schweben. Für die Stationen-Liste war
         das schon immer so (deckte sonst einen Teil des Kartenausschnitts/der Zoom-Steuerung ab); der
         Tage-Streifen kam erst nachträglich dazu, nachdem er als schwebendes Overlay am unteren
         Kartenrand auf Mobil praktisch permanent von der (dort ebenfalls unten verankerten, meist
         mindestens "partial" hohen) Spots-Schublade verdeckt und damit faktisch unbedienbar war -
         genau dieselbe Falle wie bei der Stationen-Liste vorher, jetzt mit demselben Muster gelöst.
         Auf echtem Desktop bleibt beides unverändert Teil dieser Karten-Spalte (Teleport disabled,
         siehe @container-Regel für .focus-spot-list/.day-strip weiter unten - dieselbe 720px-
         Schwelle wie isNarrowLayout). -->
    <Teleport
      v-if="teleportReady || !isNarrowLayout"
      to="#map-focus-dock"
      :disabled="!isNarrowLayout"
    >
      <div class="day-strip" v-if="vacationDays.length">
        <DayChip
          v-for="day in vacationDays"
          :key="day"
          :date="day"
          :active="drawers.mapFocusDate === day"
          :has-content="dayHasContent(day)"
          :title="formatDate(day)"
          @click="toggleDayFocus(day)"
        />
      </div>
    </Teleport>

    <TravelDetailDialog
      v-if="openTravel"
      :model-value="travelDialogOpen"
      @update:model-value="onTravelDialogUpdate"
      :item="openTravel"
      :payer-label="payerLabelFor(openTravel.paid_by_user_id)"
      :has-multiple-members="users.length > 1"
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
  /* Eckenabstand/Lücke über --space-3/--space-2 (statt der alten 10px/6px), auf Mobil wie auf
     Desktop einheitlich - nur der Durchmesser selbst bleibt auf Mobil kleiner (@container weiter
     unten hebt ihn auf Desktop auf Apples 44px an, siehe dort). Der Stapel selbst wurde von
     vormals 9 Einzel-Buttons auf 5 verkürzt (Nutzer-Feedback: zu lang/unübersichtlich, einzelne
     Buttons rutschten hinter das Bottom-Sheet) - die vier Fokus-Buttons (Alle/Urlaubsort/
     Unterkünfte/Tourziele) sowie Standort-Sprung + Ausrichtungs-Umschalter leben jetzt hinter je
     einem Popover-Trigger (.focus-btn/.location-btn), siehe deren Klick-Handler im Script. */
  --fit-btn-size: 34px;
  --fit-btn-gap: var(--space-2);
  --fit-btn-inset: var(--space-3);
  --fit-btn-step: calc(var(--fit-btn-size) + var(--fit-btn-gap));
  position: absolute;
  inset: 0;
}

.map {
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  border: none;
}

/* Echter Kreisbogen (50% + corner-shape:round) statt der Squircle-Variable, die hier vorher ohne
   passendes corner-shape blieb - siehe DESIGN.md, Abschnitt "Eckenrundung", runde Icon-Buttons
   bekommen Kreisbogen, keinen Squircle. Größe/Abstand kommen aus den --fit-btn-*-Variablen
   (.map-wrap oben) statt fester px-Werte direkt hier, damit Mobil/Desktop (@container weiter
   unten) nur noch die Variablen überschreiben müssen statt jede top-Regel einzeln. */
.fit-btn {
  position: absolute;
  top: var(--fit-btn-inset);
  right: var(--fit-btn-inset);
  z-index: 1000;
  width: var(--fit-btn-size);
  height: var(--fit-btn-size);
  padding: 0;
  border-radius: 50%;
  corner-shape: round;
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

.location-btn {
  top: calc(var(--fit-btn-inset) + var(--fit-btn-step));
}

.offline-download-btn {
  top: calc(var(--fit-btn-inset) + 2 * var(--fit-btn-step));
}

.share-location-btn {
  top: calc(var(--fit-btn-inset) + 3 * var(--fit-btn-step));
}

.record-btn {
  top: calc(var(--fit-btn-inset) + 4 * var(--fit-btn-step));
}

/* Gleiche Akzentfarbe, solange die jeweilige Funktion aktiv ist/läuft - dieselbe wie z. B.
   TripSwitcher.vue's aktiver Zustand, statt einer neuen Farbsprache. */
.share-location-btn.active,
.record-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

/* Gleiches Dropdown-Muster wie MapsAppPicker.vue/ExcursionsView.vue's Sortier-/Filter-Menüs -
   scoped styles werden nicht komponentenübergreifend geteilt, daher eigene Kopie hier. */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
}

.picker-menu {
  position: fixed;
  min-width: 200px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 111;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Fokus-/Standort-Popover (siehe WIDE_PICKER_MENU_WIDTH im Script, muss mit der Breite hier
   übereinstimmen): eine feste statt einer sich am Inhalt orientierenden Breite, weil die
   Menüpunkte hier ("Alle eingetragenen Orte anzeigen", "Zu meinem Standort springen", …) spürbar
   länger sind als bei den übrigen (schmaleren) Popover-Menüs unten - ohne festes width + erlaubten
   Zeilenumbruch würde die Menübreite sich am längsten Eintrag ausrichten und auf schmalen
   Mobilbreiten seitlich über den Bildschirmrand hinausragen. */
.picker-menu-wide {
  width: 236px;
}

/* Compound-Selektor (zwei Klassen statt einer) statt .picker-menu-wide button allein: braucht
   höhere Spezifität als .picker-menu button (white-space:nowrap, weiter unten deklariert) - bei
   gleicher Spezifität hätte sonst allein die spätere Reihenfolge im Stylesheet gewonnen, nicht die
   inhaltliche Absicht (derselbe Stolperstein wie DESIGN.md, Abschnitt "Abstände" ihn für .hint
   dokumentiert). */
.picker-menu.picker-menu-wide button {
  white-space: normal;
}

.picker-menu button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  border: none;
  background: none;
  color: var(--color-text);
  text-align: left;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
  /* #183: der globale `button`-Basisstil (style.css) setzt box-shadow: var(--shadow-sm) - ohne
     Reset trug jeder Menüpunkt hier zusätzlich zum eigenen .picker-menu-Container-Schatten einen
     eigenen "erhobenen" Schatten (v. a. auf iOS Safari sichtbar). */
  box-shadow: none;
}

.picker-menu button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.picker-menu button:hover {
  background: var(--color-hover);
}

.picker-menu button.active {
  background: var(--color-primary);
  color: white;
}

/* Größe an AppIcon.vue's Default (20px) angeglichen, damit das Avatar-Emoji im Standort-Menü
   (bewusst kein AppIcon, siehe dortiger Template-Kommentar) genauso mit dem Folgetext fluchtet wie
   die AppIcon-Icons in den übrigen Menüpunkten. */
.picker-item-emoji {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

/* Mitreisende ohne Online-Präsenz (#182): ausgegraut, analog zu PresenceAvatars.vue's
   .presence-avatar.offline im Header - Klickbarkeit selbst hängt aber an hasMemberPosition()
   (:disabled), nicht am Online-Status allein (Standort-Freigabe ist ein eigener Opt-in). */
.picker-item-emoji.offline {
  filter: grayscale(1);
  opacity: 0.6;
}

.picker-item-emoji .online-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  border: 2px solid var(--color-surface);
}

.picker-menu-hint {
  margin: 0 0 2px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: normal;
}

/* Eigene Zeile unterhalb der Fokus-Banner-Position (links, wie .focus-banner) statt direkt neben
   dem auslösenden Button rechts - eine mehrzeilige Fortschritts-/Ergebnismeldung neben einer engen
   Button-Spalte hätte dort keinen Platz. */
.tile-download-pill {
  position: absolute;
  top: 56px;
  left: var(--space-3);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  max-width: calc(100% - 60px);
}

.focus-banner {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  bottom: unset;
  right: unset;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  max-width: calc(100% - 60px);
}

@media screen and (min-width: 720px) {
  .focus-banner {
    bottom: var(--space-4);
    right: var(--space-4);
    top: unset;
    left: unset;
  }
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
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  /* --shadow-sm (statt --shadow-md) - dessen 24px-Blur-Radius sprengte das für
     .focus-spot-list/.map-col/.spots-col-body reservierte Padding (8-16px) und wurde deshalb
     weiterhin links/rechts abgeschnitten (#158, Folgefeedback). Gleiche Schatten-Stärke wie die
     übrigen schwebenden Karten hier (.card-Klasse). */
  box-shadow: var(--shadow-sm);
}

/* Innerhalb der teleportierten Spots-Schublade (siehe Teleport-Kommentar oben) ist der Streifen
   normales Fließ-Element am Anfang der Liste statt eines schwebenden Overlays - ID-Selektor statt nur
   .day-strip, damit diese Regel unabhängig von Deklarationsreihenfolge/@container zuverlässig
   gewinnt (gleiches Prinzip wie DESIGN.md, Abschnitt "Abstände"). */
#map-focus-dock .day-strip {
  position: static;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: auto;
  margin-bottom: var(--space-2);
}

/* Die OpenStreetMap-Kacheln selbst kennen keinen Dark Mode – ein Farb-Invert nur auf der
   Kachel-Ebene (nicht auf Markern/Popups) sorgt für eine abgedunkelte Karte statt eines
   grellen weißen Rechtecks im ansonsten dunklen UI. */
:root[data-theme='dark'] .map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

/* Hintergrund der Karte anpassen, damit beim Nachladen der Kacheln 
   keine weiße Fläche aufblitzt. var(--color-bg) passt sich automatisch 
   dem aktuellen Theme (Light/Dark) an. */
.map,
:deep(.leaflet-container) {
  background: var(--color-bg);
}

/* Ein weicherer Fade-In für nachladende Kacheln, um das visuelle Erlebnis
   beim schnellen Scrollen/Zoomen weiter zu verbessern. */
:deep(.leaflet-fade-anim .leaflet-tile) {
  transition: opacity 0.3s ease-in-out;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}

/* Anpassung der Leaflet Zoom-Buttons an den Reisotor Styleguide */
:deep(.leaflet-bar) {
  border: 1px solid var(--color-border) !important;
  box-shadow: var(--shadow-sm) !important;
  border-radius: var(--radius-md-squircle) !important;
  overflow: hidden;
  background-color: var(--color-surface) !important;
}

:deep(.leaflet-bar a) {
  background-color: var(--color-surface) !important;
  color: var(--color-text) !important;
  border-bottom: 1px solid var(--color-border) !important;
  width: 34px !important;
  height: 34px !important;
  line-height: 34px !important;
}

:deep(.leaflet-bar a:hover) {
  background-color: var(--color-hover) !important;
  color: var(--color-text) !important;
}

:deep(.leaflet-bar a:last-child) {
  border-bottom: none !important;
}

:deep(.leaflet-bar a.leaflet-disabled) {
  color: var(--color-text-muted) !important;
  background-color: var(--color-surface) !important;
}

/* Dezenter Copyright-Hinweis wie bei Google Maps (ohne Kasten, nur Text mit leichtem Halo-Effekt
   für Lesbarkeit auf beliebigen Kartenuntergründen) */
:deep(.leaflet-control-attribution) {
  background: transparent !important;
  color: var(--color-text) !important;
  text-shadow:
    -1px -1px 0 var(--color-surface),
    1px -1px 0 var(--color-surface),
    -1px 1px 0 var(--color-surface),
    1px 1px 0 var(--color-surface),
    0 0 4px var(--color-surface) !important;
  font-size: 0.7rem;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

:deep(.leaflet-control-attribution:hover) {
  opacity: 1;
}

:deep(.leaflet-control-attribution a) {
  color: var(--color-text) !important;
}

/* Desktop: zurück auf den bisherigen Stand (Karte als eigene, begrenzte Box statt vollflächigem
   Hintergrund – .map-col in ExcursionsView.vue ist hier eine normale sticky Spalte, kein
   fixed-Vollbild-Container mehr, siehe dort). Wieder @container(app-main) statt @media: jetzt, wo
   .map-col in ExcursionsView.vue position:absolute (statt fixed) innerhalb von .page bleibt, ist
   ein knappes .app-main (z. B. beide Schubladen offen) kein Problem mehr – die Karte quetscht sich
   dann einfach mit in den mobilen Vollbild-Modus, statt überdeckt zu werden (siehe dort für die
   ausführliche Begründung). 720px statt 900px - muss exakt der @container app-main-Schwelle in
   ExcursionsView.vue (dort samt Begründung) UND deren isSheetOverlayMode-JS-Spiegelung entsprechen,
   sonst schaltet dieser Bereich hier (Karte/Tage-Streifen) bei einer anderen Breite auf Desktop-Optik
   um als der umgebende Spalten-Grid, was zu einer inkonsistenten Zwischenbreite führen würde. */
@container app-main (min-width: 720px) {
  .map-wrap {
    /* Eckenabstand/Lücke sind schon auf Mobil (.map-wrap oben) auf Apples Maß, hier reicht der Platz zusätzlich
       für den größeren Durchmesser: 44px (dasselbe "großer runder Icon-Button"-Maß wie
       DashboardView.vue's .tile-icon) statt der auf Mobil aus Platznot nötigen 34px. */
    --fit-btn-size: 44px;
  }

  .fit-btn {
    font-size: 1.2rem;
  }

  /* Auf Desktop schwebt der day-strip als zentrierte Pille im verfügbaren Kartenbereich (neben dem Drawer) */
  .day-strip {
    left: calc(var(--calendar-offset, 0px) + var(--spots-col-width, 400px));
    right: 0;
    margin: 0 auto;
    width: fit-content;
    max-width: calc(100vw - var(--calendar-offset, 0px) - var(--spots-col-width, 400px) - 40px);
    border-radius: 999px;
    bottom: 24px;
    padding: 8px 16px;
  }

  /* Zoom-Buttons rechts neben den Drawer schieben */
  :deep(.leaflet-left) {
    /* Nutzt die dynamische Margin (drawer-tab-width bei geschlossenem Kalender, 2*space-4 bei offenem) 
       für korrekte Platzierung rechts neben der Spots-Schublade. */
    left: calc(
      var(--calendar-margin, var(--drawer-tab-width)) + var(--calendar-offset, 0px) +
        var(--spots-col-width, 400px) + var(--space-4) + var(--space-3)
    ) !important;
  }

  :deep(.leaflet-top) {
    top: var(--space-4) !important;
  }

  :deep(.leaflet-left .leaflet-control) {
    margin-left: 0 !important;
  }

  :deep(.leaflet-top .leaflet-control) {
    margin-top: 0 !important;
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
