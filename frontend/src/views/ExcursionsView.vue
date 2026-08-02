<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
import { api } from '../api/client';
import type { Accommodation, Spot, TravelItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useIsDesktop } from '../composables/useIsDesktop';
import SpotCard from '../components/SpotCard.vue';
import DerivedLocationCard from '../components/DerivedLocationCard.vue';
import TripMap from '../components/TripMap.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import LocationPicker from '../components/LocationPicker.vue';
import { parseLatLngFromMapsLink, tilePreviewUrl } from '../utils/googleMaps';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import type { DerivedLocation } from '../utils/derivedLocation';

// Ausflüge-Verwaltung (Anlegen/Bearbeiten/Einplanen) lebt jetzt in der eigenständigen
// Ausflüge-Schublade (views/ExcursionsDrawer.vue, rechter Schubladen-Platz) statt hier – diese
// Sicht zeigt nur noch Spots (inkl. der automatisch eingebetteten Unterkunft-/Reise-Orte). Lädt
// deshalb eigene Unterkunft-/Reise-/Nutzer-Daten unabhängig von der Ausflüge-Schublade, analog zur
// bereits bestehenden Duplikation zwischen der früheren MapView.vue und dieser View.
const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
const isDesktop = useIsDesktop();

const users = ref<User[]>([]);
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);

// Höhe des Seitentitels (nur auf Desktop sichtbar, siehe .page-title-CSS) live gemessen und als
// CSS-Variable bereitgestellt (gleiches Vorgehen wie --navbar-offset in NavBar.vue) – ohne das
// rechneten .spots-col/.map-col/.col-resize-handle's max-height/height-Formeln (weiter unten im
// CSS) nur mit der NavBar-Höhe, nicht mit dem darüber liegenden Titel. Dadurch wurden die sticky
// Spalten beim ersten Rendern (bevor sie tatsächlich "einrasten") um genau die Titel-Höhe zu hoch,
// die Seite bekam eine überflüssige eigene Scrollbar mit leerem Weißraum am Ende.
const pageTitleHeight = ref(0);
let pageTitleObserver: ResizeObserver | null = null;
function setPageTitleRef(el: Element | ComponentPublicInstance | null) {
  pageTitleObserver?.disconnect();
  pageTitleObserver = null;
  if (el instanceof HTMLElement) {
    pageTitleObserver = new ResizeObserver(() => {
      // getBoundingClientRect() liefert nur die Border-Box, nicht den eigenen margin-bottom des
      // Titels (siehe .page-title-CSS) – der zählt aber genauso zum Platz, den .layout darunter
      // frei lassen muss, sonst fehlte genau dieser Rest weiterhin in der max-height-Rechnung.
      const marginBottom = parseFloat(getComputedStyle(el).marginBottom) || 0;
      pageTitleHeight.value = el.getBoundingClientRect().height + marginBottom;
    });
    pageTitleObserver.observe(el);
  }
}
onUnmounted(() => {
  pageTitleObserver?.disconnect();
});

onMounted(async () => {
  const [usersRes, accommodationRes, travelRes] = await Promise.all([
    api.get<User[]>('/users'),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    spotsStore.load(),
  ]);
  users.value = usersRes;
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  loading.value = false;
});

function creatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function author(id: number) {
  return users.value.find((u) => u.id === id);
}

// --- Likes/Kommentare Spots (über stores/spots.ts, geteilt mit TripMap.vue/
// ExcursionDetailDialog.vue, die Spot-Detail-Dialoge außerhalb dieser Sicht öffnen können) ---
function spotCommentItemsFor(spotId: number) {
  return spotsStore.commentsFor(spotId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
async function toggleSpotLike(spotId: number) {
  await spotsStore.toggleLike(spotId, auth.user!.id);
}
async function submitSpotComment(spotId: number, content: string) {
  await spotsStore.submitComment(spotId, content);
}
async function removeSpotComment(id: number) {
  await spotsStore.removeComment(id);
}

// --- Abgeleitete Orte (Unterkunft, Reise-Start-/Zielorte) ---
// Automatisch als feste Karten in die Spots-Übersicht eingebettet (DerivedLocationCard.vue) –
// zeigt Orte, die bereits anderswo (Unterkunft, Reise) mit Koordinaten hinterlegt sind.
const derivedLocations = computed<DerivedLocation[]>(() => {
  const result: DerivedLocation[] = [];
  for (const a of accommodations.value) {
    if (a.lat != null && a.lng != null) {
      result.push({ key: `accommodation-${a.id}`, title: a.name, icon: '🛏️', category: 'Unterkunft', maps_link: a.maps_link, lat: a.lat, lng: a.lng });
    }
  }
  for (const t of travelItems.value) {
    if (t.from_lat != null && t.from_lng != null) {
      result.push({
        key: `travel-from-${t.id}`,
        title: `${t.title} (Abflug/Abfahrt)`,
        icon: '🛫',
        category: 'Reise',
        maps_link: t.from_maps_link,
        lat: t.from_lat,
        lng: t.from_lng,
      });
    }
    if (t.to_lat != null && t.to_lng != null) {
      result.push({
        key: `travel-to-${t.id}`,
        title: `${t.title} (Ankunft)`,
        icon: '🛬',
        category: 'Reise',
        maps_link: t.to_maps_link,
        lat: t.to_lat,
        lng: t.to_lng,
      });
    }
  }
  return result;
});

// --- Spots ---
const showSpotForm = ref(false);
const emptySpotForm = () => ({ title: '', image_url: '', maps_link: '', note: '', category: '' });
const spotForm = ref(emptySpotForm());
const spotMapsLinkResolved = ref<boolean | null>(null);
const spotManualPin = ref<{ lat: number; lng: number } | null>(null);
const spotPickerOpen = ref(false);
const spotLocationError = ref(false);
// Bleibt gesetzt, solange nach dem Anlegen die Standort-Auflösung fehlschlägt – ein erneuter
// Speicherversuch (manuell gesetzter Pin) muss dann den bereits angelegten Spot AKTUALISIEREN
// statt einen zweiten anzulegen (gleiches Muster wie TripSwitcher.vue's pendingFixTripId).
const spotPendingFixId = ref<number | null>(null);

const editingSpot = ref<Spot | null>(null);
const editSpotForm = ref(emptySpotForm());
const editSpotMapsLinkResolved = ref<boolean | null>(null);
const editSpotManualPin = ref<{ lat: number; lng: number } | null>(null);
const editSpotPickerOpen = ref(false);
const editSpotLocationError = ref(false);

// Öffnet die Karte des manuellen Pickers direkt im Urlaubsgebiet statt einer leeren Weltkarte,
// sobald die Trip-Koordinaten bekannt sind.
const spotPickerCenter = computed(() => {
  const t = tripStore.currentTrip;
  return t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : undefined;
});

// Live-Vorschau im Anlege-/Bearbeiten-Dialog (Bild-Banner, wie bei der Card): eigenes Bild, sonst
// Kachel-Vorschau der Koordinate, sofern der Maps-Link clientseitig parsbar ist (bei Kurzlinks
// erst nach dem Speichern möglich, siehe resolveLatLng serverseitig).
const spotPreviewImage = computed(() => {
  if (spotForm.value.image_url) return spotForm.value.image_url;
  const parsed = parseLatLngFromMapsLink(spotForm.value.maps_link);
  return parsed ? tilePreviewUrl(parsed.lat, parsed.lng) : null;
});
const editSpotPreviewImage = computed(() => {
  if (editSpotForm.value.image_url) return editSpotForm.value.image_url;
  const parsed = parseLatLngFromMapsLink(editSpotForm.value.maps_link);
  return parsed ? tilePreviewUrl(parsed.lat, parsed.lng) : null;
});

const spotCategoryOptions = computed(() => {
  const used = spotsStore.spots.map((s) => s.category).filter((c): c is string => !!c);
  return [...new Set([...SPOT_CATEGORY_SUGGESTIONS, ...used])];
});

// --- Sortierung, Kategorie-Filter & -Gruppierung der Spots-Übersicht ---
// Ein "Spots-Item" ist entweder ein echter Spot oder ein abgeleiteter Ort (Unterkunft/Reise) – beide
// werden gemeinsam sortiert, gefiltert und nach Kategorie gruppiert dargestellt.
type SpotsGroupItem = { kind: 'spot'; spot: Spot } | { kind: 'derived'; loc: DerivedLocation };

// Ein Spot gilt als "geplant", wenn ein Kalender-Termin (schedule_items) über spot_id auf ihn
// verweist (analog zu Excursion.date, siehe db/index.ts) – rein clientseitig aus dem bereits
// reaktiv geladenen scheduleStore abgeleitet statt eines eigenen Backend-Felds, damit sowohl das
// spontane Einplanen per Ziehen auf den Kalender (SpotCard.vue) als auch jede Änderung/Löschung in
// ScheduleView.vue sofort hier ankommt, ohne die Spots extra neu zu laden. Mehrfache Termine für
// denselben Spot sind möglich (kein UNIQUE-Constraint) – das früheste Datum gewinnt.
const spotScheduledDates = computed(() => {
  const map = new Map<number, string>();
  for (const item of scheduleStore.items) {
    if (item.spot_id == null) continue;
    const existing = map.get(item.spot_id);
    if (!existing || item.date < existing) map.set(item.spot_id, item.date);
  }
  return map;
});
// Unterkunft-/Reise-Orte (kind 'derived') haben kein Kalender-Geplant-Konzept – null statt eines
// Status heißt "Filter nicht anwendbar", sie bleiben unabhängig vom Status-Filter sichtbar.
function itemStatus(item: SpotsGroupItem): 'planned' | 'unplanned' | null {
  if (item.kind !== 'spot') return null;
  return spotScheduledDates.value.has(item.spot.id) ? 'planned' : 'unplanned';
}

function itemCategory(item: SpotsGroupItem): string {
  return item.kind === 'spot' ? item.spot.category ?? 'Sonstiges' : item.loc.category;
}
function itemTitle(item: SpotsGroupItem): string {
  return item.kind === 'spot' ? item.spot.title : item.loc.title;
}
function itemLikeCount(item: SpotsGroupItem): number {
  return item.kind === 'spot' ? spotsStore.likeCountFor(item.spot.id) : 0;
}
// Unterkunft/Reise sind keine "echten" Spot-Kategorien (spotCategoryMeta kennt sie nicht) – eigenes
// Icon je Sammel-Kategorie, sonst wie gewohnt über spotCategoryMeta (inkl. 📍-Fallback).
function groupIcon(category: string): string {
  if (category === 'Unterkunft') return '🛏️';
  if (category === 'Reise') return '🧳';
  return spotCategoryMeta(category).icon;
}

const sortMenuOpen = ref(false);
const sortMode = ref<'alpha' | 'likes'>('alpha');

const categoryMenuOpen = ref(false);
const categoryFilter = ref<string[]>([]);
function removeCategoryFilter(cat: string) {
  categoryFilter.value = categoryFilter.value.filter((c) => c !== cat);
}

const STATUS_FILTER_LABEL: Record<'planned' | 'unplanned', string> = { planned: '📅 Geplant', unplanned: '📝 Ungeplant' };
const statusMenuOpen = ref(false);
const statusFilter = ref<('planned' | 'unplanned')[]>([]);
function removeStatusFilter(status: 'planned' | 'unplanned') {
  statusFilter.value = statusFilter.value.filter((s) => s !== status);
}

const allSpotItems = computed<SpotsGroupItem[]>(() => [
  ...spotsStore.spots.map((spot): SpotsGroupItem => ({ kind: 'spot', spot })),
  ...derivedLocations.value.map((loc): SpotsGroupItem => ({ kind: 'derived', loc })),
]);

const filteredSpotItems = computed(() =>
  allSpotItems.value.filter((item) => {
    if (categoryFilter.value.length && !categoryFilter.value.includes(itemCategory(item))) return false;
    const status = itemStatus(item);
    if (statusFilter.value.length && status !== null && !statusFilter.value.includes(status)) return false;
    return true;
  }),
);

// Reihenfolge der Gruppen: die automatisch eingebetteten Unterkunft-/Reise-Orte zuerst (sind
// bereits anderswo gepflegt, sollen als "kostenloser" Ausgangspunkt sofort ins Auge fallen), dann
// bekannte Spot-Kategorien (spotCategory.ts-Reihenfolge), dann eigene Freitext-Kategorien
// alphabetisch, "Sonstiges" (keine Kategorie) zuletzt – bleibt unabhängig von der gewählten
// Sortierung innerhalb der Gruppen stabil.
const CATEGORY_GROUP_ORDER = ['Unterkunft', 'Reise', ...SPOT_CATEGORY_SUGGESTIONS];

function sortedCategoryKeys(categories: Iterable<string>): string[] {
  const set = new Set(categories);
  const known = CATEGORY_GROUP_ORDER.filter((c) => set.has(c));
  const custom = [...set].filter((c) => !CATEGORY_GROUP_ORDER.includes(c) && c !== 'Sonstiges').sort();
  return [...known, ...custom, ...(set.has('Sonstiges') ? ['Sonstiges'] : [])];
}

const spotGroups = computed(() => {
  const groups = new Map<string, SpotsGroupItem[]>();
  for (const item of filteredSpotItems.value) {
    const cat = itemCategory(item);
    const list = groups.get(cat) ?? [];
    list.push(item);
    groups.set(cat, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) =>
      sortMode.value === 'likes'
        ? itemLikeCount(b) - itemLikeCount(a) || itemTitle(a).localeCompare(itemTitle(b))
        : itemTitle(a).localeCompare(itemTitle(b)),
    );
  }
  return sortedCategoryKeys(groups.keys()).map((category) => ({
    category,
    icon: groupIcon(category),
    items: groups.get(category)!,
  }));
});

const filterCategoryOptions = computed(() => sortedCategoryKeys(allSpotItems.value.map(itemCategory)));

// Horizontale Kategorie-Navigation (Wolt-Stil): Map statt DOM-`id`, damit Leerzeichen/Umlaute in
// Kategorienamen ("Aussichtspunkt", "Unterkunft") kein Escaping-Problem sind. scrollIntoView()
// läuft die scrollenden Vorfahren selbst hoch – landet also automatisch in .spots-col, sobald die
// Container-Query (≥900px) diese Spalte selbst scrollen lässt, sonst in der normalen Seite.
const categoryRefs = new Map<string, HTMLElement>();
function setCategoryRef(category: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) categoryRefs.set(category, el);
  else categoryRefs.delete(category);
}
// Ref auf die eingebettete Karte (TripMap.vue): scrollToCategory() lässt bei Klick auf eine
// Kategorie-Nav-Pille zusätzlich die Karte auf alle Punkte dieser Kategorie zoomen (siehe
// TripMap.vue's defineExpose(focusCategory)) – dieselbe Kategorie-Kopplung wie beim Filter oben.
const tripMapRef = ref<InstanceType<typeof TripMap> | null>(null);
function scrollToCategory(category: string) {
  categoryRefs.get(category)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  tripMapRef.value?.focusCategory(category);
}

// Welcher Spot ist gerade in der Liste aufgeklappt (SpotCard.vue, ersetzt den früheren Modal-
// Dialog) – lebt hier statt lokal in SpotCard.vue, da ein Pin-Klick auf der Karte (TripMap.vue's
// @focus-spot) dieselbe Karte von außen aufklappen können muss, exakt wie ein Kategorie-Klick
// scrollToCategory() von außen auslöst (gleiches Ref-Map-Muster wie categoryRefs oben).
const expandedSpotId = ref<number | null>(null);
const spotRefs = new Map<number, HTMLElement>();
function setSpotRef(id: number, el: Element | ComponentPublicInstance | null) {
  const domEl = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null);
  if (domEl instanceof HTMLElement) spotRefs.set(id, domEl);
  else spotRefs.delete(id);
}
function scrollToSpot(id: number) {
  spotRefs.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// Klick auf einen Spot-Pin auf der Karte (TripMap.vue) klappt die passende Karte hier auf und
// scrollt sie in den Blick – die Pin-Vergrößerung selbst setzt TripMap.vue bereits eigenständig
// (drawers.mapFocusKey), hier geht es nur um die Liste.
function onFocusSpotFromMap(spotId: number) {
  expandedSpotId.value = spotId;
  scrollToSpot(spotId);
}

// --- Aufteilung Spots-Liste/Karte per Anfasser verschiebbar (nur Desktop-Grid, siehe @container-
// Query im CSS) ---
const SPOTS_COL_WIDTH_KEY = 'reisotor-spots-col-width';
const MIN_SPOTS_COL_WIDTH = 280;
// Großzügig bemessen (der tatsächliche visuelle Anschlag kommt aus dem CSS, siehe
// grid-template-columns: min(var(--spots-col-width), 75cqw) ... – container-relativ, damit die
// Karte auf schmaleren Containern nie komplett verdrängt wird, unabhängig von diesem px-Wert hier).
const MAX_SPOTS_COL_WIDTH = 1400;
const DEFAULT_SPOTS_COL_WIDTH = 380;

function loadSpotsColWidth(): number {
  const stored = Number(localStorage.getItem(SPOTS_COL_WIDTH_KEY));
  return Number.isFinite(stored) && stored >= MIN_SPOTS_COL_WIDTH && stored <= MAX_SPOTS_COL_WIDTH
    ? stored
    : DEFAULT_SPOTS_COL_WIDTH;
}
const spotsColWidth = ref(loadSpotsColWidth());
watch(spotsColWidth, (v) => localStorage.setItem(SPOTS_COL_WIDTH_KEY, String(v)));

// Anfasser zwischen Spots-Liste und Karte (Pointer Events statt separater Maus-/Touch-Handler,
// analog zu Drawer.vue's Schubladen-Anfasser) – verschiebt das Grid-Spaltenverhältnis, indem er
// die CSS-Variable --spots-col-width der ersten Spalte (siehe :style auf .layout) anpasst.
const resizingCol = ref(false);
let colStartX = 0;
let colStartWidth = 0;
function onColResizeStart(event: PointerEvent) {
  resizingCol.value = true;
  colStartX = event.clientX;
  colStartWidth = spotsColWidth.value;
  window.addEventListener('pointermove', onColResizeMove);
  window.addEventListener('pointerup', onColResizeEnd);
  event.preventDefault();
}
function onColResizeMove(event: PointerEvent) {
  if (!resizingCol.value) return;
  const delta = event.clientX - colStartX;
  spotsColWidth.value = Math.min(MAX_SPOTS_COL_WIDTH, Math.max(MIN_SPOTS_COL_WIDTH, colStartWidth + delta));
}
function onColResizeEnd() {
  resizingCol.value = false;
  window.removeEventListener('pointermove', onColResizeMove);
  window.removeEventListener('pointerup', onColResizeEnd);
}

// --- Mobil: Spots-Liste als Bottom-Sheet über der (jetzt vollflächigen, siehe TripMap.vue)
// Karte, ähnlich Google Maps – drei Zustände statt eines stufenlosen Anfassers wie oben, da hier
// ein fester "Ziel"-Zustand (eingeklappt/angeschnitten/voll) gewünscht ist statt einer frei
// wählbaren Aufteilung. Nur auf dem Mobil-CSS-Zweig sichtbar (siehe @container weiter unten).
type SheetState = 'collapsed' | 'partial' | 'full';
const sheetState = ref<SheetState>('partial');
const sheetDragging = ref(false);
const sheetDragHeightPx = ref<number | null>(null);

// Deckelt alle drei Zustände auf den Platz UNTER der Kopfzeile/NavBar (56px App-Header +
// --navbar-offset, dieselbe Formel wie .map-col's sticky top weiter unten) – ohne diesen Deckel
// wuchs der "voll"-Zustand (88vh der GESAMTEN Fensterhöhe) auf kurzen Fenstern über die Kopfzeile
// hinaus, sein oberer Rand landete dann teilweise dahinter/darunter verdeckt.
function sheetHeightPx(state: SheetState): number {
  const navbarOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-offset')) || 0;
  const maxAvailable = Math.max(160, window.innerHeight - 56 - navbarOffset - 8);
  if (state === 'collapsed') return Math.min(96, maxAvailable);
  if (state === 'partial') return Math.min(window.innerHeight * 0.46, maxAvailable);
  return Math.min(window.innerHeight * 0.88, maxAvailable);
}

let sheetStartY = 0;
let sheetStartHeight = 0;
function onSheetDragStart(event: PointerEvent) {
  sheetDragging.value = true;
  sheetStartY = event.clientY;
  sheetStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
  window.addEventListener('pointermove', onSheetDragMove);
  window.addEventListener('pointerup', onSheetDragEnd);
  event.preventDefault();
}
function onSheetDragMove(event: PointerEvent) {
  if (!sheetDragging.value) return;
  // Nach oben ziehen (kleinerer clientY) vergrößert die Höhe.
  const delta = sheetStartY - event.clientY;
  const next = sheetStartHeight + delta;
  sheetDragHeightPx.value = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
}
function onSheetDragEnd() {
  sheetDragging.value = false;
  window.removeEventListener('pointermove', onSheetDragMove);
  window.removeEventListener('pointerup', onSheetDragEnd);
  const current = sheetDragHeightPx.value;
  sheetDragHeightPx.value = null;
  // current bleibt null, wenn zwischen Down und Up kein einziges pointermove-Event feuerte – bei
  // einem echten, sehr kurzen/bewegungslosen Antippen (v. a. auf Touch-Geräten üblich) kommt das
  // durchaus vor. Wurde das bisher wie "keine Bewegung erfasst, also gar nichts tun" behandelt
  // (früher Return), reagierte der Anfasser auf genau so einen Tap gar nicht – dabei ist "keine
  // Bewegung" der eindeutigste Tap-Fall überhaupt, kein Sonderfall zum Ignorieren.
  const movedFar = current != null && Math.abs(current - sheetStartHeight) > 8;
  if (!movedFar) {
    // Kaum/keine Bewegung = Tippen statt Ziehen: einen Zustand weiterschalten statt "an derselben
    // Stelle" wieder einzurasten (das wäre sonst ein wirkungsloser Tap gewesen).
    const order: SheetState[] = ['collapsed', 'partial', 'full'];
    sheetState.value = order[(order.indexOf(sheetState.value) + 1) % order.length];
    return;
  }
  // Ab hier laut movedFar-Berechnung oben garantiert nicht null.
  const resolvedCurrent = current as number;
  const states: SheetState[] = ['collapsed', 'partial', 'full'];
  let closest: SheetState = 'partial';
  let bestDist = Infinity;
  for (const s of states) {
    const dist = Math.abs(sheetHeightPx(s) - resolvedCurrent);
    if (dist < bestDist) {
      bestDist = dist;
      closest = s;
    }
  }
  sheetState.value = closest;
}

// Buttons als Alternative zum Ziehen am Anfasser (weniger präzise auf kleinen Touch-Zielen) –
// schalten jeweils einen Rasterschritt weiter statt frei zu ziehen, genau wie ein Tap auf den
// Anfasser selbst (siehe onSheetDragEnd oben).
const SHEET_ORDER: SheetState[] = ['collapsed', 'partial', 'full'];
function stepSheet(direction: 1 | -1) {
  const next = SHEET_ORDER[SHEET_ORDER.indexOf(sheetState.value) + direction];
  if (next) sheetState.value = next;
}
const canExpandSheet = computed(() => sheetState.value !== 'full');
const canCollapseSheet = computed(() => sheetState.value !== 'collapsed');

// Aktuelle Sheet-Höhe in px (Grundlage für die Karten-Zentrierung unten): der Anfasser selbst
// verdeckt keine Karte, aber .spots-col liegt auf mobile als Overlay ÜBER der Karte (siehe .spots-
// col/.map-col CSS) – ein per Fokus zentrierter Punkt landete deshalb bislang teils unsichtbar
// dahinter, weil map.setView() die Karten-MITTE nimmt, nicht die tatsächlich sichtbare Restfläche
// oberhalb des Sheets. Nur auf mobile relevant (Desktop: eigene Spalte statt Overlay, siehe
// @container weiter unten im CSS).
const currentSheetHeightPx = computed(() => sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value));
const mapCoveredBottomPx = computed(() => (isDesktop.value ? 0 : currentSheetHeightPx.value));

// Ein Klick auf eine Spot-Karte öffnet sie (siehe SpotCard.vue's onCardClick, das bereits
// drawers.openMapAt() aufruft) – steht das Sheet dabei auf "voll", verdeckt es die Karte komplett;
// ein Schritt zurück auf "angeschnitten" gibt genug sichtbare Kartenfläche frei, um den gerade
// fokussierten Punkt auch tatsächlich zu sehen, ohne die Liste ganz zu verstecken.
function onSpotCardOpen(spot: Spot) {
  expandedSpotId.value = spot.id;
  if (sheetState.value === 'full') sheetState.value = 'partial';
}

function checkSpotMapsLink() {
  spotMapsLinkResolved.value = spotForm.value.maps_link ? parseLatLngFromMapsLink(spotForm.value.maps_link) != null : null;
}
function checkEditSpotMapsLink() {
  editSpotMapsLinkResolved.value = editSpotForm.value.maps_link
    ? parseLatLngFromMapsLink(editSpotForm.value.maps_link) != null
    : null;
}

function spotToBody(f: ReturnType<typeof emptySpotForm>, manual?: { lat: number; lng: number } | null) {
  const parsed = parseLatLngFromMapsLink(f.maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    image_url: f.image_url || undefined,
    category: f.category || undefined,
    note: f.note || undefined,
    maps_link: f.maps_link || undefined,
    lat: manual?.lat ?? parsed?.lat,
    lng: manual?.lng ?? parsed?.lng,
  };
}

function closeSpotForm() {
  showSpotForm.value = false;
  spotForm.value = emptySpotForm();
  spotMapsLinkResolved.value = null;
  spotManualPin.value = null;
  spotPickerOpen.value = false;
  spotLocationError.value = false;
  spotPendingFixId.value = null;
}

async function addSpot() {
  if (!spotForm.value.title.trim()) return;
  const body = spotToBody(spotForm.value, spotManualPin.value);
  const result =
    spotPendingFixId.value != null
      ? await spotsStore.update(spotPendingFixId.value, body)
      : await spotsStore.create(body);
  drawers.touchLocations();
  // Serverseitige Auflösung (backend/src/utils/mapsLink.ts) ebenfalls fehlgeschlagen, z. B. weil
  // Google einen Maps-Kurzlink per Bot-Erkennung blockt – Dialog offen lassen, manuellen Picker
  // automatisch aufklappen (LocationPicker.vue).
  if (body.maps_link && result.lat == null && !spotManualPin.value) {
    spotPendingFixId.value = result.id;
    spotLocationError.value = true;
    spotPickerOpen.value = true;
    return;
  }
  closeSpotForm();
}

watch(spotManualPin, (pin) => {
  if (pin && spotLocationError.value) addSpot();
});

function startEditSpot(spot: Spot) {
  editingSpot.value = spot;
  editSpotForm.value = {
    title: spot.title,
    image_url: spot.image_url ?? '',
    maps_link: spot.maps_link ?? '',
    note: spot.note ?? '',
    category: spot.category ?? '',
  };
  editSpotMapsLinkResolved.value = null;
  editSpotManualPin.value = null;
  editSpotPickerOpen.value = false;
  editSpotLocationError.value = false;
}

async function submitEditSpot() {
  if (!editingSpot.value || !editSpotForm.value.title.trim()) return;
  const body = spotToBody(editSpotForm.value, editSpotManualPin.value);
  const updated = await spotsStore.update(editingSpot.value.id, body);
  drawers.touchLocations();
  if (body.maps_link && updated.lat == null && !editSpotManualPin.value) {
    editSpotLocationError.value = true;
    editSpotPickerOpen.value = true;
    return;
  }
  editSpotLocationError.value = false;
  editingSpot.value = null;
}

watch(editSpotManualPin, (pin) => {
  if (pin && editSpotLocationError.value) submitEditSpot();
});

async function removeSpot(id: number) {
  await spotsStore.remove(id);
  drawers.touchLocations();
}
</script>

<template>
  <div class="page" v-if="!loading" :style="{ '--page-title-height': pageTitleHeight + 'px' }">
    <h1 class="page-title" :ref="setPageTitleRef">🗺️ Karte</h1>
    <div class="layout" :style="{ '--spots-col-width': spotsColWidth + 'px' }">
    <div
      class="spots-col"
      :class="[sheetState, { dragging: sheetDragging }]"
      :style="sheetDragHeightPx != null ? { height: sheetDragHeightPx + 'px' } : {}"
    >
      <div class="sheet-handle-row">
        <button
          type="button"
          class="sheet-step-btn"
          :disabled="!canExpandSheet"
          aria-label="Spots-Liste weiter hochschieben"
          title="Hochschieben"
          @click="stepSheet(1)"
        >
          ▲
        </button>
        <div
          class="sheet-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Spots-Liste ein-/ausklappen"
          @pointerdown="onSheetDragStart"
        >
          <span class="sheet-grip" aria-hidden="true"></span>
          <span class="sheet-summary">📍 {{ filteredSpotItems.length }} {{ filteredSpotItems.length === 1 ? 'Ort' : 'Orte' }}</span>
        </div>
        <button
          type="button"
          class="sheet-step-btn"
          :disabled="!canCollapseSheet"
          aria-label="Spots-Liste weiter runterschieben"
          title="Runterschieben"
          @click="stepSheet(-1)"
        >
          ▼
        </button>
      </div>
      <div class="spots-col-body">
      <div class="header">
        <h2>Spots</h2>
        <div class="header-actions">
          <button @click="showSpotForm = true">+ Neuer Spot</button>
        </div>
      </div>
      <p class="hint">
        Orte (Restaurant, Sehenswürdigkeit, Strand, …), die du als Stationen bei Touren zuordnen kannst –
        auch unabhängig von einer Tour. Tipp: Ziehe eine Spot-Karte direkt auf eine Tour in der
        Touren-Schublade oder auf einen Kalendertag, um sie dort als Station bzw. spontan einzuplanen.
      </p>

      <!-- Filter und Sortierung bewusst direkt hier, unmittelbar über der Kategorie-Navi (statt
           Sortierung z. B. oben im .header): beide wirken auf dieselbe Kategorie-gruppierte Liste,
           sollen deshalb auch räumlich als zusammengehöriges Werkzeug-Trio wahrgenommen werden.
           Sortierung und Filter in getrennten Zeilen (statt einer gemeinsamen, umbrechenden Reihe):
           beides sind konzeptionell unterschiedliche Werkzeuge (eine Reihenfolge vs. eine
           Ein-/Ausblend-Auswahl), ein eigenes Label+Icon je Zeile macht das auf einen Blick klar. -->
      <div class="filter-bar" v-if="filterCategoryOptions.length">
        <div class="tool-row">
          <span class="tool-label">🔀 Sortieren</span>
          <div class="dropdown">
            <button
              type="button"
              class="secondary sort-btn"
              title="Sortierung ändern"
              aria-label="Sortierung ändern"
              @click="sortMenuOpen = !sortMenuOpen"
            >
              {{ sortMode === 'likes' ? '❤️ Nach Likes' : '🔤 Alphabetisch' }}
            </button>
            <template v-if="sortMenuOpen">
              <div class="picker-backdrop" @click="sortMenuOpen = false"></div>
              <div class="picker-menu">
                <button type="button" :class="{ active: sortMode === 'alpha' }" @click="sortMode = 'alpha'; sortMenuOpen = false">
                  🔤 Alphabetisch
                </button>
                <button type="button" :class="{ active: sortMode === 'likes' }" @click="sortMode = 'likes'; sortMenuOpen = false">
                  ❤️ Nach Likes
                </button>
              </div>
            </template>
          </div>
        </div>

        <div class="tool-row">
          <span class="tool-label">🔎 Filtern</span>
          <div class="dropdown">
            <button
              type="button"
              class="secondary category-btn"
              title="Nach Kategorie filtern"
              aria-label="Nach Kategorie filtern"
              @click="categoryMenuOpen = !categoryMenuOpen"
            >
              🏷️ Kategorie
            </button>
            <template v-if="categoryMenuOpen">
              <div class="picker-backdrop" @click="categoryMenuOpen = false"></div>
              <div class="picker-menu category-menu">
                <label v-for="cat in filterCategoryOptions" :key="cat" class="category-option">
                  <input type="checkbox" :value="cat" v-model="categoryFilter" />
                  {{ groupIcon(cat) }} {{ cat }}
                </label>
              </div>
            </template>
          </div>
          <div class="dropdown">
            <button
              type="button"
              class="secondary category-btn"
              title="Nach Status (geplant/ungeplant) filtern"
              aria-label="Nach Status filtern"
              @click="statusMenuOpen = !statusMenuOpen"
            >
              🗓️ Status
            </button>
            <template v-if="statusMenuOpen">
              <div class="picker-backdrop" @click="statusMenuOpen = false"></div>
              <div class="picker-menu category-menu">
                <label class="category-option">
                  <input type="checkbox" value="planned" v-model="statusFilter" />
                  📅 Geplant
                </label>
                <label class="category-option">
                  <input type="checkbox" value="unplanned" v-model="statusFilter" />
                  📝 Ungeplant
                </label>
              </div>
            </template>
          </div>
          <div class="filter-chips">
            <span v-for="cat in categoryFilter" :key="cat" class="filter-chip">
              {{ groupIcon(cat) }} {{ cat }}
              <button type="button" @click="removeCategoryFilter(cat)" aria-label="Filter entfernen">✕</button>
            </span>
            <span v-for="status in statusFilter" :key="status" class="filter-chip">
              {{ STATUS_FILTER_LABEL[status] }}
              <button type="button" @click="removeStatusFilter(status)" aria-label="Filter entfernen">✕</button>
            </span>
          </div>
        </div>
      </div>

      <Modal :model-value="showSpotForm" title="Neuer Spot" @update:model-value="(v) => !v && closeSpotForm()">
        <form class="edit-form" @submit.prevent="addSpot">
          <div class="form-image-banner" :style="spotPreviewImage ? { backgroundImage: `url(${spotPreviewImage})` } : {}">
            <span v-if="!spotPreviewImage" class="placeholder">{{ spotCategoryMeta(spotForm.category).icon }}</span>
          </div>
          <input v-model="spotForm.title" type="text" placeholder="Titel" required />
          <input v-model="spotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
          <Combobox v-model="spotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional, z. B. Restaurant – oder eigene erstellen)" />
          <input
            v-model="spotForm.maps_link"
            type="url"
            placeholder="Maps-Link (Google/Apple) (optional)"
            @blur="checkSpotMapsLink"
          />
          <p v-if="spotMapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
          <p v-if="spotMapsLinkResolved === false" class="hint">
            Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
          </p>
          <p v-if="spotLocationError" class="hint error">
            ⚠️ Der Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
          </p>
          <button type="button" class="secondary picker-toggle" @click="spotPickerOpen = !spotPickerOpen">
            📍 Standort manuell setzen {{ spotPickerOpen ? '▲' : '▼' }}
          </button>
          <LocationPicker v-if="spotPickerOpen" v-model="spotManualPin" :center="spotPickerCenter" />
          <textarea v-model="spotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
          <button type="submit">Speichern</button>
        </form>
      </Modal>

      <nav class="category-nav" v-if="spotGroups.length > 1" aria-label="Zu Kategorie springen">
        <button
          v-for="grp in spotGroups"
          :key="grp.category"
          type="button"
          class="category-nav-item"
          @click="scrollToCategory(grp.category)"
        >
          <span class="category-nav-icon">{{ grp.icon }}</span>
          <span class="category-nav-label">{{ grp.category }}</span>
        </button>
      </nav>

      <section class="group category-group" v-for="grp in spotGroups" :key="grp.category">
        <h3 class="category-heading" :ref="(el) => setCategoryRef(grp.category, el)">{{ grp.icon }} {{ grp.category }}</h3>
        <TransitionGroup tag="div" name="list" class="grid cards">
          <template v-for="item in grp.items" :key="item.kind === 'spot' ? `spot-${item.spot.id}` : item.loc.key">
            <SpotCard
              v-if="item.kind === 'spot'"
              :key="`spot-${item.spot.id}`"
              :ref="(el) => setSpotRef(item.spot.id, el)"
              :spot="item.spot"
              :expanded="expandedSpotId === item.spot.id"
              :scheduled-date="spotScheduledDates.get(item.spot.id) ?? null"
              :creator-label="creatorLabel(item.spot.created_by)"
              :like-count="spotsStore.likeCountFor(item.spot.id)"
              :liked="spotsStore.likedByMe(item.spot.id, auth.user?.id)"
              :comments="spotCommentItemsFor(item.spot.id)"
              @edit="startEditSpot"
              @remove="removeSpot"
              @toggle-like="toggleSpotLike(item.spot.id)"
              @submit-comment="(content) => submitSpotComment(item.spot.id, content)"
              @remove-comment="removeSpotComment"
              @open="onSpotCardOpen"
              @close="expandedSpotId = null"
            />
            <DerivedLocationCard v-else :key="item.loc.key" :location="item.loc" />
          </template>
        </TransitionGroup>
      </section>
      <p v-if="!spotGroups.length" class="empty">Noch keine Spots angelegt.</p>

      <Modal
        :model-value="editingSpot !== null"
        title="Spot bearbeiten"
        @update:model-value="(v) => !v && (editingSpot = null)"
      >
        <form class="edit-form" @submit.prevent="submitEditSpot">
          <div class="form-image-banner" :style="editSpotPreviewImage ? { backgroundImage: `url(${editSpotPreviewImage})` } : {}">
            <span v-if="!editSpotPreviewImage" class="placeholder">{{ spotCategoryMeta(editSpotForm.category).icon }}</span>
          </div>
          <input v-model="editSpotForm.title" type="text" placeholder="Titel" required />
          <input v-model="editSpotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
          <Combobox v-model="editSpotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional, z. B. Restaurant – oder eigene erstellen)" />
          <input
            v-model="editSpotForm.maps_link"
            type="url"
            placeholder="Maps-Link (Google/Apple) (optional)"
            @blur="checkEditSpotMapsLink"
          />
          <p v-if="editSpotMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
          <p v-if="editSpotMapsLinkResolved === false" class="hint">
            Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
          </p>
          <p v-if="editSpotLocationError" class="hint error">
            ⚠️ Der Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
          </p>
          <button type="button" class="secondary picker-toggle" @click="editSpotPickerOpen = !editSpotPickerOpen">
            📍 Standort manuell setzen {{ editSpotPickerOpen ? '▲' : '▼' }}
          </button>
          <LocationPicker v-if="editSpotPickerOpen" v-model="editSpotManualPin" :center="spotPickerCenter" />
          <textarea v-model="editSpotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
          <button type="submit">Speichern</button>
        </form>
      </Modal>
      </div>
    </div>

    <div
      class="col-resize-handle resize-grip"
      role="separator"
      aria-orientation="vertical"
      aria-label="Aufteilung zwischen Spots-Liste und Karte anpassen"
      @pointerdown="onColResizeStart"
    ></div>

    <div class="map-col">
      <TripMap
        ref="tripMapRef"
        :category-filter="categoryFilter"
        :status-filter="statusFilter"
        :covered-bottom-px="mapCoveredBottomPx"
        @edit-spot="startEditSpot"
        @focus-spot="onFocusSpotFromMap"
      />
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Mobil (Default): kein eigener Titel-Balken über der (jetzt dahinterliegenden, siehe .map-col
   weiter unten) vollflächigen Karte – anders als bei Google Maps (Vorbild für die vollflächige
   Karte) ist das hier kein Suchfeld, nur eine leere Kopfzeile ohne Funktion. Auf Desktop
   (@container weiter unten) bleibt der bisherige schlichte Titel unverändert sichtbar. */
.page-title {
  display: none;
  font-size: 1.3rem;
  color: var(--color-primary-dark);
}

/* Mobil (Default) UND Desktop mit stark eingeschränktem .app-main (z. B. beide Schubladen
   gleichzeitig aufgeklappt, siehe @container weiter unten für die genaue Schwelle): .page bekommt
   eine feste Höhe unterhalb von Kopfzeile/NavBar und wird zum Positionierungsrahmen für Karte +
   Bottom-Sheet, die beide position:absolute (nicht mehr position:fixed) sind. Der Unterschied ist
   entscheidend: fixed wäre viewport-weit verankert und würde damit auch über eventuell geöffnete
   Schubladen (die .app-main als Flex-Geschwister lediglich schmaler machen, siehe Drawer.vue)
   hinweg alles überlagern – absolute bleibt dagegen innerhalb von .page und damit innerhalb des
   tatsächlich für die Karte verbleibenden Platzes. */
.page {
  position: relative;
  height: calc(100vh - 56px - var(--navbar-offset, 0px) - var(--navbar-bottom-offset, 0px));
  overflow: hidden;
  padding: 0;
}

.map-col {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* Bottom-Sheet mit drei Rasteinungen (siehe sheetState/onSheetDragStart im Script) – Höhe kommt
   entweder aus der Zustands-Klasse (collapsed/full, Default = "partial" ohne eigene Klasse) oder,
   während eines aktiven Ziehens, aus dem inline gesetzten :style (folgt direkt dem Finger).
   .dragging schaltet die Transition ab, damit das Ziehen nicht hinterherhinkt. */
.spots-col {
  /* Macht .spots-col selbst zum Container für die Kompakt-Zeile-Entscheidung in SpotCard.vue/
     DerivedLocationCard.vue/.cards weiter unten (@container-Abfragen dort) – reagiert dadurch auf
     die TATSÄCHLICHE Breite dieser Spalte (auch beim Verschieben des Anfassers auf Desktop),
     unabhängig von Viewport/anderer-Container-Breite. Gilt unverändert in beiden Modi (Mobil
     fixed/Desktop sticky), da hier nicht zurückgesetzt. Benannt (statt anonym) und die Kompakt-
     Zeilen-Abfragen unten explizit "spots-col" statt unbenannt: sonst würden auch die unbenannten
     @container(min-width:900px)-Abfragen für Nachfahren wie .sheet-handle/.spots-col-body
     versehentlich gegen DIESEN (statt gegen .app-main, App.vue) ausgewertet – .spots-col ist selbst
     nie ≥900px breit, das "Desktop"-Zurücksetzen von .sheet-handle etc. hätte dadurch nie gegriffen. */
  container: spots-col / inline-size;
  /* Deckelt alle drei Höhen-Zustände (unten) auf .page's eigene Höhe (siehe .page weiter oben, die
     rechnet Kopfzeile/NavBar bereits ein) – reine vh-Werte kennen weder NavBar- noch Titel-Höhe und
     wuchsen sonst über den verfügbaren Platz hinaus. 100% statt einer eigenen vh-Rechnung, da
     .spots-col jetzt position:absolute innerhalb des bereits korrekt bemessenen .page ist (dessen
     Höhe ist die "Containing Block"-Höhe, gegen die % hier auflöst) – einfacher und automatisch
     konsistent mit .page, statt dieselbe Formel ein zweites Mal zu duplizieren. Reine CSS-Rechnung,
     nicht die JS-Berechnung in sheetHeightPx() – die greift nur während eines aktiven Ziehens/beim
     Einrasten, nicht für diesen ruhenden Grundzustand. */
  --sheet-max-height: calc(100% - 8px);
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg-squircle) var(--radius-lg-squircle) 0 0;
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  height: min(46vh, var(--sheet-max-height));
  transition: height 0.25s ease;
  overflow: hidden;
  /* Bekannter iOS-Safari-Bug: ein fixed/absolute positioniertes Element mit border-radius+box-shadow
     malt seinen Hintergrund beim allerersten Paint mitunter nicht korrekt (bleibt transparent, bis
     irgendeine Interaktion – z. B. das Ziehen am Griff – einen Repaint erzwingt). Der Fix (eigene
     Compositing-Ebene erzwingen) sitzt bewusst auf einem ::before statt direkt auf .spots-col
     selbst: ein echtes transform HIER würde .spots-col zum Containing Block für alle
     fixed-positionierten Nachfahren machen (z. B. .picker-backdrop unten, das per position:fixed
     bewusst den ganzen Viewport abdecken soll) und deren Positionierung auf die Sheet-Fläche
     einschränken. */
}

.spots-col::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: inherit;
  transform: translateZ(0);
}

.spots-col.collapsed {
  height: min(96px, var(--sheet-max-height));
}

.spots-col.full {
  height: min(88vh, var(--sheet-max-height));
}

.spots-col.dragging {
  transition: none;
}

.sheet-handle-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 0;
  /* Gilt für die ganze Zeile (nicht nur .sheet-handle): ein Zug, der knapp neben dem eigentlichen
     Anfasser beginnt (z. B. noch über den Stufen-Buttons), soll trotzdem nicht als Seiten-Scroll/
     Pull-to-Refresh interpretiert werden. */
  touch-action: none;
}

.sheet-handle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  /* Größerer Anfassbereich für Touch (vorher 4px/6px): der eigentliche Treffer-Bereich reichte auf
     mobile oft nicht, ein Runterziehen landete leicht knapp daneben. */
  padding: 10px 0 14px;
  margin: -6px 0 -8px;
  cursor: grab;
  touch-action: none;
}

/* Alternative zum Ziehen am Anfasser (weniger präzise auf kleinen Touch-Zielen): schaltet jeweils
   einen Rasterschritt weiter, disabled am jeweiligen Ende (siehe canExpandSheet/canCollapseSheet
   im Script). */
.sheet-step-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  corner-shape: round;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.sheet-step-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.sheet-step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.sheet-grip {
  width: 40px;
  height: 4px;
  border-radius: 3px;
  background: var(--color-border);
}

.sheet-summary {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.spots-col-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-3) var(--space-3);
}

/* Nebeneinander statt untereinander, sobald genug Breite verfügbar ist – schmalere Spots-Liste
   links, große Karte rechts (grob an Google Maps orientiert: Liste/Suche links, Karte füllt den
   Rest). Container-Query statt @media, da sich die verfügbare Breite durchs Auf-/Zuklappen der
   Schubladen ändert, ohne dass sich das Browserfenster ändert (der Container ist .app-main in
   App.vue, nicht diese Seite selbst). Zusätzlich wird hier auch .page breiter gemacht – dessen
   normaler max-width:960px-Deckel (style.css, für die einspaltige Lesbarkeit auf allen anderen
   Seiten gedacht) würde die zwei Spalten sonst weiterhin auf denselben schmalen Streifen
   zusammenquetschen, obwohl links/rechts noch reichlich Platz frei wäre. */
/* Anfasser zwischen Spots-Liste und Karte: nur auf dem Desktop-Grid sichtbar (mobil stapeln sich
   die Spalten normal untereinander, ein horizontaler Anfasser ergäbe dort keinen Sinn). Eigene
   Grid-Spalte statt eines absolut positionierten Elements im Gap (wie ursprünglich bei Drawer.vue's
   Schubladen-Anfasser) – vermeidet dieselbe Falle wie dort: .spots-col/.map-col sind overflow-y:
   auto, was overflow-x laut CSS-Spec implizit auf auto setzt und ein überlappendes Element clippen
   würde. */
.col-resize-handle {
  display: none;
}

/* Zurück zu @container(app-main): jetzt, wo Karte+Sheet innerhalb von .page bleiben
   (position:absolute statt fixed, siehe .page/.map-col/.spots-col weiter oben), ist ein knappes
   .app-main (z. B. durch beide gleichzeitig geöffneten Schubladen) kein Problem mehr – die Karte
   quetscht sich dann einfach mit in den (jetzt wieder passend bemessenen) mobilen Vollbild-Modus,
   statt von den Schubladen überdeckt zu werden. Genau dieses Verhalten ist inzwischen auch
   gewünscht: bei sehr wenig Platz (unabhängig davon, ob das an einem schmalen Gerät oder an
   geöffneten Schubladen auf Desktop liegt) macht ein enges 2-Spalten-Grid weniger Sinn als eine
   große Karte mit Sheet darüber. Die feinere "wie schmal darf .spots-col selbst werden"-Frage
   (Kompakt-Zeile, Ein-Spalten-Raster) bleibt weiterhin ein separates @container(spots-col)-Query. */
@container app-main (min-width: 900px) {
  .page {
    position: static;
    height: auto;
    overflow: visible;
    max-width: 1600px;
    /* Die globale .page-Regel (style.css) bringt padding-bottom:88px für normal scrollende Seiten
       mit (Platz z. B. für eine untere mobile Navigation) – hier unnötig und der Hauptgrund für den
       sichtbaren leeren Weißraum am Seitenende, da .layout's Inhalt (sticky) sich schon selbst
       begrenzt. padding-top wird stattdessen unten in der max-height-Rechnung berücksichtigt
       (statt es hier auf 0 zu setzen), damit der Titel nicht direkt am Seitenrand klebt. */
    padding: var(--space-3) var(--space-4) 0;
  }

  /* Auf Desktop gibt es keine vollflächige Hintergrund-Karte (siehe .map-col weiter unten) – der
     Titel ist hier weiterhin sinnvoll und bleibt sichtbar. */
  .page-title {
    display: block;
    margin: 0 0 var(--space-3);
  }

  .layout {
    display: grid;
    /* min(..., 75cqw) statt einfach var(--spots-col-width): deckelt die Spots-Spalte zusätzlich
       relativ zur tatsächlichen Container-Breite (derselbe Container wie die @container-Query hier,
       .app-main in App.vue) – ohne das könnte die Karte auf schmaleren Containern komplett verdrängt
       werden, wenn spotsColWidth (JS, siehe MAX_SPOTS_COL_WIDTH) großzügiger als der verfügbare
       Platz gewählt wurde. 75cqw erlaubt der Liste bis zu 3/4 des Platzes, wenn gewünscht. */
    grid-template-columns: min(var(--spots-col-width), 75cqw) 20px 1fr;
    align-items: start;
    gap: 0;
  }

  /* Beide Spalten scrollen ab hier unabhängig voneinander statt gemeinsam mit der Seite – dieselbe
     Sticky-Offset-Formel wie Drawer.vue's Desktop-Panel (56px NavBar + evtl. zusätzlicher
     --navbar-offset, falls die NavBar selbst "oben" positioniert ist). Auch der komplette Reset
     der mobilen Bottom-Sheet-/Vollbild-Eigenschaften (fixed-Positionierung, Höhe, Hintergrund, …)
     zurück auf den bisherigen Stand. */
  .spots-col,
  .map-col {
    position: sticky;
    left: auto;
    right: auto;
    bottom: auto;
    z-index: auto;
    top: calc(56px + var(--navbar-offset, 0px));
    /* Zieht zusätzlich die (live gemessene, siehe pageTitleHeight im Script) Höhe des Seitentitels
       samt seines margin-bottom sowie .page's eigenes padding-top (var(--space-3), s. o.) ab – ohne
       das war die Spalte beim ersten Rendern (bevor sie tatsächlich einrastet) zu groß, was eine
       überflüssige Seiten-Scrollbar samt leerem Weißraum am Ende erzeugte. */
    max-height: calc(100vh - 56px - var(--navbar-offset, 0px) - var(--navbar-bottom-offset, 0px) - var(--page-title-height, 0px) - var(--space-3));
    overflow-y: auto;
  }

  .spots-col {
    /* Der native Scrollbalken sitzt sonst direkt auf dem Kartenrand – etwas Luft, damit er nicht
       am Inhalt klebt. */
    padding-right: var(--space-3);
    display: block;
    height: auto;
    background: none;
    border-radius: 0;
    box-shadow: none;
    transition: none;
  }

  /* .spots-col.collapsed/.full (höhere Spezifität als die einfache .spots-col-Regel oben, da zwei
     statt einer Klasse) würden das dortige height:auto sonst weiterhin überschreiben, falls
     sheetState beim Wechsel in den Desktop-Modus zufällig "collapsed"/"full" war (z. B. nach
     Schließen einer Schublade, während die Karte vorher im mobilen Modus auf "voll" stand). */
  .spots-col.collapsed,
  .spots-col.full {
    height: auto;
  }

  .sheet-handle-row {
    display: none;
  }

  .spots-col-body {
    flex: none;
    overflow-y: visible;
    padding: 0;
  }

  /* Dieselbe Sticky-Formel wie die beiden Inhaltsspalten – hier aber als explizite `height` statt
     nur `max-height`: .spots-col/.map-col bekommen ihre Höhe automatisch von ihrem (teils langen)
     Inhalt, ein leeres Element wie dieses hätte ohne erzwungene `height` sonst nur eine Höhe nahe 0
     (Grid-`align-items: start` auf .layout streckt Items nicht automatisch) – der Anfasser wäre
     dadurch praktisch unsichtbar/nicht greifbar gewesen. Nur Positionierung/Größe hier – die
     eigentliche Anfasser-Optik (Hover-Hintergrund, Griff-Strich) kommt aus der geteilten
     .resize-grip-Klasse (style.css), damit sie überall identisch aussieht (Drawer.vue's
     Schubladen-Anfasser nutzt dieselbe Klasse). display:flex MUSS hier trotzdem explizit gesetzt
     bleiben (nicht der globalen .resize-grip-Regel überlassen): der unconditional Mobil-Default
     weiter oben (.col-resize-handle { display: none; }) hat dieselbe Spezifität wie .resize-grip's
     eigenes display:flex, und scoped Component-Styles gewinnen bei einem Unentschieden gegen
     globale Styles typischerweise unabhängig von der Lade-Reihenfolge – ohne dieses explizite
     Zurücksetzen blieb der Anfasser dadurch auch auf Desktop display:none, wodurch er als
     Grid-Element komplett wegfiel und .map-col in seine 20px-Spalte statt die eigentliche
     1fr-Spalte rutschte (dadurch wirkte die Karte winzig). */
  .col-resize-handle {
    display: flex;
    position: sticky;
    top: calc(56px + var(--navbar-offset, 0px));
    height: calc(100vh - 56px - var(--navbar-offset, 0px) - var(--navbar-bottom-offset, 0px) - var(--page-title-height, 0px) - var(--space-3));
  }
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.hint.error {
  color: var(--color-danger);
}

.picker-toggle {
  align-self: flex-start;
  padding: 6px 12px;
  font-size: 0.85rem;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-image-banner {
  height: 140px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-image-banner .placeholder {
  font-size: 2.2rem;
}

.syntax-hint {
  margin: -4px 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.syntax-hint code {
  background: var(--color-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.78rem;
}

.group {
  margin-bottom: var(--space-4);
}

.group h3 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-3);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

/* Auf schmalen .spots-col-Breiten (Bottom-Sheet auf Mobil, ODER auf Desktop, wenn der Anfasser sehr
   weit zur Karte hin gezogen wurde) immer eine einzelne Spalte statt auto-fill – bei knapper, aber
   nicht ganz ausreichender Breite für zwei 240px-Spalten schnitt auto-fill die zweite Karte sonst
   am rechten Rand ab, statt sie in eine neue Zeile umbrechen zu lassen. Container-Query statt
   @media (siehe container-type auf .spots-col oben) – reagiert dadurch auf die tatsächliche
   Spalten-Breite, nicht auf die Fenster-/Viewport-Breite. Derselbe Schwellenwert wie in
   SpotCard.vue/DerivedLocationCard.vue (muss übereinstimmen, sonst driftet die Kompakt-Zeile dort
   von der Ein-Spalten-Entscheidung hier auseinander). Explizit "spots-col" statt unbenannt, damit
   eindeutig gegen diesen (statt versehentlich gegen .app-main) ausgewertet wird. */
@container spots-col (max-width: 480px) {
  .cards {
    grid-template-columns: 1fr;
  }
}

.dropdown {
  position: relative;
}

.sort-btn.active,
.category-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
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
  min-width: 180px;
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

.picker-menu button {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 0.85rem;
  white-space: nowrap;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
}

.picker-menu button:hover {
  background: var(--color-hover);
}

.picker-menu button.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.category-menu {
  min-width: 220px;
}

.category-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 8px;
  font-size: 0.9rem;
  font-weight: 400;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.category-option:hover {
  background: var(--color-hover);
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
}

/* Je eine Zeile für Sortieren und Filtern, statt einer gemeinsamen umbrechenden Reihe – siehe
   Kommentar am Template. */
.tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.tool-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
  color: var(--color-primary-dark);
  border-radius: 999px;
  padding: 3px 6px 3px 12px;
  font-size: 0.82rem;
  font-weight: 600;
}

.filter-chip button {
  background: none;
  border: none;
  padding: 2px;
  color: inherit;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  display: flex;
}

.category-btn {
  font-size: 0.85rem;
}

.category-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  /* scrollToCategory() landet sonst mit der Überschrift genau unter der fest/sticky positionierten
     AppHeader (56px) + ggf. der oben positionierten NavBar (--navbar-offset) – dieselbe Formel wie
     bei .spots-col/.map-col weiter oben und Drawer.vue. */
  scroll-margin-top: calc(56px + var(--navbar-offset, 0px) + var(--space-2));
}

/* Horizontale Kategorie-Navigation (Wolt-Stil): Icon zentriert über dem Label, ganze Leiste
   scrollt bei Bedarf horizontal statt umzubrechen (viele Kategorien nebeneinander). */
.category-nav {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding: 4px 2px var(--space-3);
  margin-bottom: var(--space-2);
}

.category-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 4px 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  min-width: 52px;
}

.category-nav-item:hover {
  color: var(--color-primary-dark);
}

.category-nav-icon {
  font-size: 1.3rem;
  line-height: 1;
}

.category-nav-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.empty {
  color: var(--color-text-muted);
}
</style>
