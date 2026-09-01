<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
  type ComponentPublicInstance,
  type Ref,
} from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import type {
  Excursion,
  ExcursionComment,
  ExcursionLike,
  IdeaRole,
  LocationTrack,
  Spot,
  User,
} from '../api/types';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { TRAVEL_ROLE_META, TRAVEL_ROLE_OPTIONS } from '../utils/travelRole';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useExcursionsStore } from '../stores/excursions';
import { useTracksStore } from '../stores/tracks';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useIconStyleStore } from '../stores/iconStyle';
import { formatDateTime } from '../utils/dateFormat';
import { formatDurationShort } from '../utils/trackGeometry';
import { usePersistedRef } from '../composables/usePersistedRef';
import { hashHighlightId } from '../utils/hashHighlight';
import SpotCard from '../components/SpotCard.vue';
import ExcursionCard from '../components/ExcursionCard.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import SearchFilterBar from '../components/SearchFilterBar.vue';
import SpotOrderPicker from '../components/SpotOrderPicker.vue';
import TripMap from '../components/TripMap.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import TourAssignPicker from '../components/TourAssignPicker.vue';
import TrackRecordingWarningModal from '../components/TrackRecordingWarningModal.vue';
import ResizeHandle from '../components/ResizeHandle.vue';
import LocationPicker from '../components/LocationPicker.vue';
import CoverImagePicker from '../components/CoverImagePicker.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import FileAttachments from '../components/FileAttachments.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { isEmptyRichText } from '../utils/richText';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { parseLatLngFromMapsLink, tilePreviewUrl } from '../utils/googleMaps';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import AppIcon from '../components/AppIcon.vue';
import AnimatedText from '../components/AnimatedText.vue';
import Button from '../components/primitives/Button.vue';
import ButtonGroup from '../components/primitives/ButtonGroup.vue';
import IconButton from '../components/primitives/IconButton.vue';
import DropdownItem from '../components/primitives/DropdownItem.vue';

// Touren-Verwaltung (Anlegen/Bearbeiten/Einplanen) ist seit dem Zurückbau des früheren "erweiterten
// Touren-Modus" (vormals eine eigenständige Ausflüge-Schublade, views/ExcursionsDrawer.vue) Teil
// dieser Sicht: bei Gruppierung nach Touren (siehe groupMode/spotGroups unten) steht statt einer
// reinen Text-Überschrift eine anklickbare ExcursionCard über den zugehörigen Spots, Klick darauf
// visualisiert die Tour direkt auf der danebenliegenden Karte – kein Sichtwechsel mehr nötig, um
// eine Tour zu sehen/bearbeiten.
const auth = useAuthStore();
const tripStore = useTripStore();
const route = useRoute();
const tripId = tripStore.currentTripId as number;
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const excursionsStore = useExcursionsStore();
const tracksStore = useTracksStore();
const trackRecording = useTrackRecordingStore();
const iconStyle = useIconStyleStore();

const tracksSectionOpen = ref(false);

function trackTitle(track: LocationTrack): string {
  return track.title || `Aufzeichnung vom ${formatDateTime(track.started_at)}`;
}

function trackDurationLabel(track: LocationTrack): string {
  if (!track.ended_at) return '';
  const ms = new Date(track.ended_at).getTime() - new Date(track.started_at).getTime();
  return formatDurationShort(ms);
}

async function toggleTrackVisibility(track: LocationTrack) {
  await tracksStore.update(track.id, {
    visibility: track.visibility === 'shared' ? 'private' : 'shared',
  });
}

async function removeTrack(id: number) {
  if (drawers.mapFocusTrackId === id) drawers.mapFocusTrackId = null;
  await tracksStore.remove(id);
}

const users = ref<User[]>([]);
// #176: keine eigene Reise-Etappen-Liste mehr, sondern aus role-getaggten Touren abgeleitet (siehe
// utils/deriveTravelItems.ts) - excursionsStore/spotsStore laden bereits unten in onMounted.
const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());
// Likes/Kommentare von Touren liegen (wie in TripMap.vue) nicht im excursions-Store, sondern
// weiterhin lokal an ideas/idea_likes/idea_comments gebunden – eigens hier geladen, analog zur
// bereits bestehenden Duplikation zwischen TripMap.vue und dieser Sicht.
const excursionLikes = ref<ExcursionLike[]>([]);
const excursionComments = ref<ExcursionComment[]>([]);

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
  categoryNavObserver?.disconnect();
});

// .category-nav bekommt nur dann ihren dezenten "schwebt gerade über Inhalt"-Schatten (siehe CSS
// unten), wenn sie tatsächlich im position:sticky-"stuck"-Zustand ist. Ein CSS-`:stuck`-
// Pseudoselektor ist noch nicht unterstützt, daher ein unsichtbares Sentinel-Element direkt davor +
// IntersectionObserver: sobald das Sentinel den sichtbaren Bereich verlässt, "klebt" die Nav.
// root=.spots-col reicht für Mobil- UND Desktop-Layout, da IntersectionObserver automatisch alle
// overflow-clippenden Vorfahren zwischen root und target berücksichtigt (egal ob .spots-col selbst
// oder .spots-col-body scrollt).
const isCategoryNavStuck = ref(false);
let categoryNavObserver: IntersectionObserver | null = null;
function setCategoryNavSentinelRef(el: Element | ComponentPublicInstance | null) {
  categoryNavObserver?.disconnect();
  categoryNavObserver = null;
  if (el instanceof HTMLElement) {
    categoryNavObserver = new IntersectionObserver(
      ([entry]) => {
        isCategoryNavStuck.value = !entry.isIntersecting;
      },
      { root: el.closest('.spots-col'), threshold: 0 }
    );
    categoryNavObserver.observe(el);
  }
}

onMounted(async () => {
  // #196: die frühere eigene "Reise"-Gruppierung (dritte Toggle-Option) entfällt - Touren mit
  // gesetzter role sind seit #176 ohnehin ganz normale Einträge der "Touren"-Gruppierung. Ein alter
  // ?group=travel-Deep-Link (DashboardView.vue's Reise-Kachel/notificationTarget.ts/router redirect
  // von /travel) landet deshalb einfach in der Touren-Ansicht statt einer eigenen.
  if (route.query.group === 'travel' || route.query.group === 'tours') groupMode.value = 'tours';
  markSeenForGroupMode(groupMode.value);
  // Querverweis-Sprung (z. B. aus dem Budget bei einem automatisch aus einer Unterkunft erzeugten
  // Ausgabe-Eintrag, siehe BudgetView.vue's autoSourceFor()) – dieselbe highlightedIds-Menge wie
  // oben, kein zweites Hervorhebungs-System (siehe hashHighlight.ts).
  const hashId = hashHighlightId(route.hash, 'spot');
  if (hashId != null) highlightedIds.value.add(hashId);
  // #106: Rücksprung aus dem Kalender (ScheduleView.vue's returnToCard()) nach dem Einplanen/
  // Bestätigen einer Tour - analog zum bestehenden Spot-Hash oben. Deckt seit #196 auch Touren mit
  // gesetzter role ab (früher eigenes Hash-Präfix "travel-" für die inzwischen entfernte
  // Reise-Gruppierung - alte "travel-<id>"-Links aus derselben Ära werden hier als Fallback
  // ebenfalls als Tour-id interpretiert).
  const excursionHashId =
    hashHighlightId(route.hash, 'excursion') ?? hashHighlightId(route.hash, 'travel');
  if (excursionHashId != null) highlightedIds.value.add(excursionHashId);
  try {
    const [usersRes, likesRes, commentsRes] = await Promise.all([
      api.get<User[]>(`/trips/${tripId}/members`),
      api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
      api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
      spotsStore.load(),
      excursionsStore.load(),
    ]);
    users.value = usersRes;
    excursionLikes.value = likesRes;
    excursionComments.value = commentsRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
  if (hashId != null) {
    await nextTick();
    onFocusSpotFromMap(hashId);
  }
  if (excursionHashId != null) {
    await nextTick();
    onFocusExcursionFromMap(excursionHashId);
  }
});

// #264: Hash-Sprünge auch reagieren, wenn die View bereits gemountet ist (z. B. Querverweise aus
// dem Kalender-Detail-Dialog, der auf derselben Route /excursions liegt, oder programmatische
// router.push-Aufrufe, die nur den Hash ändern).
watch(
  () => route.hash,
  async (newHash) => {
    if (!newHash) return;
    const spotId = hashHighlightId(newHash, 'spot');
    if (spotId != null) {
      highlightedIds.value.add(spotId);
      await nextTick();
      onFocusSpotFromMap(spotId);
      return;
    }
    const excursionId = hashHighlightId(newHash, 'excursion') ?? hashHighlightId(newHash, 'travel');
    if (excursionId != null) {
      highlightedIds.value.add(excursionId);
      await nextTick();
      onFocusExcursionFromMap(excursionId);
    }
  }
);

function creatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function author(id: number) {
  return users.value.find((u) => u.id === id);
}

// --- Likes/Kommentare Spots (über stores/spots.ts, geteilt mit TripMap.vue, das Spot-Detail-
// Dialoge außerhalb dieser Sicht öffnen kann) ---
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

// --- Likes/Kommentare Touren (weiterhin an ideas/idea_likes/idea_comments gebunden, siehe
// excursionLikes/excursionComments oben) ---
function excursionLikesFor(ideaId: number) {
  return excursionLikes.value.filter((l) => l.idea_id === ideaId);
}
function excursionLikedByMe(ideaId: number) {
  return excursionLikesFor(ideaId).some((l) => l.user_id === auth.user?.id);
}
function excursionCommentsFor(ideaId: number) {
  return excursionComments.value
    .filter((c) => c.idea_id === ideaId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function excursionCommentItemsFor(ideaId: number) {
  return excursionCommentsFor(ideaId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
async function toggleExcursionLike(ideaId: number) {
  const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);
  if (result.liked) {
    excursionLikes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user!.id });
  } else {
    excursionLikes.value = excursionLikes.value.filter(
      (l) => !(l.idea_id === ideaId && l.user_id === auth.user!.id)
    );
  }
}
async function submitExcursionComment(ideaId: number, content: string) {
  const created = await api.post<ExcursionComment>(`/ideas/${ideaId}/comments`, { content });
  excursionComments.value.push(created);
}
async function removeExcursionComment(id: number) {
  await api.delete(`/ideas/comments/${id}`);
  excursionComments.value = excursionComments.value.filter((c) => c.id !== id);
}

// --- Touren anlegen/bearbeiten/löschen (aus der früheren Ausflüge-Schublade, views/
// ExcursionsDrawer.vue, hierher übernommen, siehe Kommentar oben) ---
// #176: Transportmittel-Abschnitt (aufklappbar) macht aus einer normalen Tour eine ehemalige
// Reise-Etappe (Anreise/Abreise/Weiterreise) - EIN Formular/Modell statt zweier getrennter, siehe
// Konzept-Entscheidung in Issue #68/#176. transportEnabled ist reiner Formular-Zustand (steuert nur,
// ob der Abschnitt aufgeklappt ist), NICHT direkt an role gekoppelt: role bleibt bewusst optional
// wählbar (z. B. Fährfahrt zur Nachbarinsel = Transportmittel, aber keine der drei Rollen).
const TRANSPORT_TYPE_OPTIONS = ['Flug', 'Zug', 'Bus', 'Auto', 'Fähre', 'Sonstiges'];
const showExcursionForm = ref(false);
const emptyExcursionForm = () => ({
  title: '',
  image_url: '',
  note: '',
  date: '',
  spot_ids: [] as number[],
  transportEnabled: false,
  role: '' as IdeaRole | '',
  transport_type: 'Flug',
  from_spot_id: '',
  to_spot_id: '',
  departure_time: '',
  arrival_time: '',
  checkin_info: '',
  amount: '',
  paid_by_user_id: '',
  luggage: '',
  seat: '',
  ticket_link: '',
});
const excursionForm = ref(emptyExcursionForm());

const editingExcursion = ref<number | null>(null);
const editExcursionForm = ref(emptyExcursionForm());

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts).
const newExcursionDraft = useDraftAutosave('excursions:new', excursionForm, showExcursionForm);
const editExcursionDraft = useDraftAutosave(
  () => `excursions:edit:${editingExcursion.value}`,
  editExcursionForm,
  computed(() => editingExcursion.value !== null)
);

function openExcursionForm() {
  excursionForm.value = emptyExcursionForm();
  showExcursionForm.value = true;
}

function closeExcursionForm() {
  showExcursionForm.value = false;
  excursionForm.value = emptyExcursionForm();
  newExcursionDraft.clear();
}

/** Baut spot_ids aus dem Von-/Nach-Paar, wenn der Transportmittel-Abschnitt aktiv ist (genau zwei
 *  Stationen, siehe routes/ideas.ts's Validierung) - sonst bleibt die per SpotOrderPicker gepflegte
 *  Liste unangetastet. */
function resolveTourSpotIds(form: ReturnType<typeof emptyExcursionForm>): number[] {
  if (!form.transportEnabled) return form.spot_ids;
  return [form.from_spot_id, form.to_spot_id].filter((id): id is string => !!id).map(Number);
}

function tourPayload(form: ReturnType<typeof emptyExcursionForm>) {
  const role = form.transportEnabled && form.role ? form.role : undefined;
  return {
    title: form.title.trim(),
    image_url: form.image_url || undefined,
    note: form.note && !isEmptyRichText(form.note) ? form.note : undefined,
    note_format: 'html' as const,
    date: form.date || undefined,
    spot_ids: resolveTourSpotIds(form),
    role,
    transport_type: form.transportEnabled ? form.transport_type : null,
    departure_time: form.transportEnabled ? form.departure_time || null : null,
    arrival_time: form.transportEnabled ? form.arrival_time || null : null,
    checkin_info: form.transportEnabled ? form.checkin_info || null : null,
    amount: form.transportEnabled && form.amount ? Number(form.amount) : null,
    paid_by_user_id:
      form.transportEnabled && form.amount
        ? form.paid_by_user_id
          ? Number(form.paid_by_user_id)
          : users.value.length === 1
            ? users.value[0].id
            : (auth.user?.id ?? null)
        : null,
    luggage: form.transportEnabled ? form.luggage || null : null,
    seat: form.transportEnabled ? form.seat || null : null,
    ticket_link: form.transportEnabled ? form.ticket_link || null : null,
  };
}

async function addExcursion() {
  if (!excursionForm.value.title.trim()) return;
  if (
    excursionForm.value.transportEnabled &&
    excursionForm.value.role &&
    resolveTourSpotIds(excursionForm.value).length !== 2
  ) {
    return;
  }
  await excursionsStore.create(tourPayload(excursionForm.value));
  closeExcursionForm();
}

function startEditExcursion(excursion: Excursion) {
  editingExcursion.value = excursion.id;
  const transportEnabled = !!excursion.role || !!excursion.transport_type;
  editExcursionForm.value = {
    title: excursion.title,
    image_url: excursion.image_url ?? '',
    note: excursion.note ?? '',
    date: excursion.date ?? '',
    spot_ids: [...excursion.spot_ids],
    transportEnabled,
    role: excursion.role ?? '',
    transport_type: excursion.transport_type ?? 'Flug',
    from_spot_id:
      transportEnabled && excursion.spot_ids[0] != null ? String(excursion.spot_ids[0]) : '',
    to_spot_id:
      transportEnabled && excursion.spot_ids[1] != null ? String(excursion.spot_ids[1]) : '',
    departure_time: excursion.departure_time ?? '',
    arrival_time: excursion.arrival_time ?? '',
    checkin_info: excursion.checkin_info ?? '',
    amount: excursion.amount != null ? String(excursion.amount) : '',
    paid_by_user_id: excursion.paid_by_user_id != null ? String(excursion.paid_by_user_id) : '',
    luggage: excursion.luggage ?? '',
    seat: excursion.seat ?? '',
    ticket_link: excursion.ticket_link ?? '',
  };
}

async function submitEditExcursion() {
  if (editingExcursion.value == null || !editExcursionForm.value.title.trim()) return;
  if (
    editExcursionForm.value.transportEnabled &&
    editExcursionForm.value.role &&
    resolveTourSpotIds(editExcursionForm.value).length !== 2
  ) {
    return;
  }
  await excursionsStore.update(editingExcursion.value, tourPayload(editExcursionForm.value));
  editExcursionDraft.clear();
  editingExcursion.value = null;
}

function closeEditExcursionForm() {
  editExcursionDraft.clear();
  editingExcursion.value = null;
}

async function removeExcursion(id: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === id);
  if (excursion?.date) {
    const confirmed = window.confirm(
      'Diese Tour ist bereits im Kalender eingeplant. Wirklich löschen? Die zugeordneten Spots bleiben erhalten und werden nicht mitgelöscht.'
    );
    if (!confirmed) return;
  }
  await excursionsStore.remove(id);
}

// Spot per Drag&Drop aus der Spots-Liste auf eine Tour-Karte fallen lassen (ExcursionCard.vue ist
// die Drop-Zone, emittiert die abgelegte Spot-Id, siehe SpotCard.vue's "🎒 Auf Tour ziehen"-Anfasser).
async function addSpotToExcursion(excursionId: number, spotId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    spot_ids: [...excursion.spot_ids, spotId],
  });
}

// #106: Gegenstück zu addSpotToExcursion oben, für SpotCard.vue's "Tour zuordnen"-Dropdown
// (TourAssignDropdown.vue) statt Drag&Drop - listet nur bereits bestehende Touren auf (arbeitet mit
// dem Titel statt einer Id, siehe excursionForGroupTitle), legt aber, falls die Tour zwischen dem
// Laden der Optionen und der Auswahl gelöscht wurde, defensiv eine neue mit diesem Titel an statt
// den Klick stillschweigend zu verwerfen.
async function assignSpotToTourTitle(spotId: number, title: string) {
  const excursion = excursionForGroupTitle(title);
  if (excursion) {
    if (!excursion.spot_ids.includes(spotId)) await addSpotToExcursion(excursion.id, spotId);
  } else {
    await excursionsStore.create({ title, spot_ids: [spotId] });
  }
}

// --- Spots ---
const showSpotForm = ref(false);
const emptySpotForm = () => ({
  title: '',
  image_url: '',
  maps_link: '',
  note: '',
  category: '',
  is_home: false,
  // Zusatzfelder für Kategorie "Unterkunft" (siehe Migrationskommentar in db/index.ts).
  address: '',
  start_date: '',
  end_date: '',
  checkin: '',
  checkout: '',
  contact: '',
  amount: '',
  paid_by_user_id: '',
  // Touren, denen dieser Spot zugeordnet ist – Titel statt Ids, siehe TourAssignPicker.vue/
  // syncSpotTours() unten (creatable: ein neuer Titel legt beim Speichern eine neue Tour an).
  tourTitles: [] as string[],
});
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

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts). closeSpotForm()/
// submitEditSpot()'s "editingSpot = null" sind bewusst die einzigen Clear()-Stellen: solange
// addSpot()/submitEditSpot() im Zwischenzustand "Standort manuell fixen" hängen (spotPendingFixId
// gesetzt bzw. früher return, siehe dort), ist der Vorgang noch nicht abgeschlossen - der Entwurf
// soll bis dahin bestehen bleiben.
const newSpotDraft = useDraftAutosave('spots:new', spotForm, showSpotForm);
const editSpotDraft = useDraftAutosave(
  () => `spots:edit:${editingSpot.value?.id}`,
  editSpotForm,
  computed(() => editingSpot.value !== null)
);
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

const showSpotLocationSection = ref(false);
const showEditSpotLocationSection = ref(false);
const showSpotToursSection = ref(false);
const showEditSpotToursSection = ref(false);
const showExcursionSpotsSection = ref(false);
const showEditExcursionSpotsSection = ref(false);
const showExcursionTransportSection = computed({
  get: () => excursionForm.value.transportEnabled,
  set: (val: boolean) => {
    excursionForm.value.transportEnabled = val;
  },
});
const showEditExcursionTransportSection = computed({
  get: () => editExcursionForm.value.transportEnabled,
  set: (val: boolean) => {
    editExcursionForm.value.transportEnabled = val;
  },
});

// Track Recording Hinweis-Modal (#230)
const showTrackRecordingWarningModal = ref(false);
const trackWarningDismissed = usePersistedRef<boolean>(
  'reisotor-track-recording-warning-acknowledged',
  false
);

function onRecordButtonClick() {
  if (trackRecording.recording) {
    trackRecording.stop();
  } else if (trackWarningDismissed.value) {
    trackRecording.start({ visibility: 'private' });
  } else {
    showTrackRecordingWarningModal.value = true;
  }
}

function startRecordingConfirmed() {
  showTrackRecordingWarningModal.value = false;
  trackRecording.start({ visibility: 'private' });
}

// Andere bereits gespeicherte Spots als gedimmte Referenzpunkte im manuellen Karten-Picker (siehe
// LocationPicker.vue) – rein zur Orientierung beim Antippen, welche Umgebung man dort gerade setzt.
// Beim Bearbeiten wird der gerade bearbeitete Spot selbst ausgeschlossen (der zeigt sich ohnehin
// schon als der aktiv gesetzte Pin, siehe editSpotManualPin).
const spotReferencePoints = computed(() =>
  spotsStore.spots
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      lat: s.lat as number,
      lng: s.lng as number,
      icon: spotCategoryMeta(s.category).tabler,
    }))
);
const editSpotReferencePoints = computed(() =>
  spotsStore.spots
    .filter((s) => s.id !== editingSpot.value?.id && s.lat != null && s.lng != null)
    .map((s) => ({
      lat: s.lat as number,
      lng: s.lng as number,
      icon: spotCategoryMeta(s.category).tabler,
    }))
);

// --- Sortierung, Kategorie-Filter & -Gruppierung der Spots-Übersicht ---
type SpotsGroupItem = { kind: 'spot'; spot: Spot };

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
function itemStatus(item: SpotsGroupItem): 'planned' | 'unplanned' {
  return spotScheduledDates.value.has(item.spot.id) ? 'planned' : 'unplanned';
}

function itemCategory(item: SpotsGroupItem): string {
  return item.spot.category ?? 'Sonstiges';
}
function itemTitle(item: SpotsGroupItem): string {
  return item.spot.title;
}
function itemLikeCount(item: SpotsGroupItem): number {
  return spotsStore.likeCountFor(item.spot.id);
}
// Unterkunft ist keine "echte" Spot-Kategorie (spotCategoryMeta kennt sie nicht) – eigenes Icon,
// sonst wie gewohnt über spotCategoryMeta. Dasselbe Icon wie SECTION_ICONS.accommodation
// (sectionIcons.ts) für App-weite Konsistenz.
function groupIconDef(category: string): IconDef {
  if (category === 'Unterkunft') return spotCategoryMeta('Unterkunft').tabler;
  return spotCategoryMeta(category).tabler;
}
// Farbe für die Gruppen-Icons in Kategorie-Überschrift/-Navigation (#142): Badges (CategoryChip.vue)
// sind jetzt immer eingefärbt, das "Kategorie-Icons einfärben"-Setting steuert nur noch diese
// beiden Stellen. Bei Touren-Gruppierung ist grp.category ein Ausflugs-/"Ohne Tour"-Titel, keine
// echte Spot-Kategorie - spotCategoryMeta hätte dafür keine sinnvolle Farbe, deshalb dort bei der
// neutralen Standardfarbe (currentColor, siehe AppIcon.vue-Default) bleiben.
function groupIconColor(grp: {
  category: string;
  excursion: Excursion | null;
}): string | undefined {
  if (groupMode.value === 'tours') return undefined;
  return iconStyle.colorizeCategories ? spotCategoryMeta(grp.category).color : undefined;
}

// Sortierung/Gruppierung/Filter bleiben über localStorage auch nach einem Reload/erneuten Besuch
// erhalten (siehe usePersistedRef.ts) - dieselbe "Orte"-Liste, die CLAUDE.md's Backlog meint (es
// gibt keine eigene SpotsView, diese gruppierte/filterbare Liste hier ist die gemeinte Stelle).
const sortMode = usePersistedRef<'alpha' | 'likes' | 'date'>(
  'reisotor-excursions-sort-mode',
  'date'
);

// Umschalter Kategorie/Touren (siehe spotGroups unten): gruppiert die Spots-Übersicht wahlweise nach
// Kategorie (Standard) oder nach Tour-Zugehörigkeit – letzteres zeigt einen Spot in JEDER Tour, der
// er zugeordnet ist (mehrfach, da viele-zu-viele), untaggte Spots/abgeleitete Orte landen gemeinsam
// in "Ohne Tour". Reise-Etappen (Touren mit gesetzter role) sind seit #176 ganz normale Einträge
// dieser "Touren"-Gruppierung - die früher dritte Toggle-Option "Reise" (#175, TravelSection.vue)
// wurde dadurch redundant und ist seit #196 wieder entfernt.
const groupMode = usePersistedRef<'category' | 'tours'>(
  'reisotor-excursions-group-mode',
  'category'
);
const UNASSIGNED_TOUR_GROUP = 'Ohne Tour';

// Spots UND Touren (beide "ideas", #176: role-getaggte Touren sind keine eigene Domäne mehr) teilen
// sich diese eine Sicht, tracken in liveSync aber als getrennte Domänen. Nur die gerade aktive
// Gruppierung wird als gesehen markiert (initial in onMounted unten, danach bei jedem Wechsel hier).
function markSeenForGroupMode(mode: 'category' | 'tours') {
  const domain = mode === 'category' ? 'spots' : 'ideas';
  for (const id of liveSync.markSeen(domain)) highlightedIds.value.add(id);
}

watch(groupMode, (mode) => markSeenForGroupMode(mode));

function tourTitlesForItem(item: SpotsGroupItem): string[] {
  return excursionsStore.excursions
    .filter((e) => e.spot_ids.includes(item.spot.id))
    .map((e) => e.title);
}

// Popover-Menüs der drei Dropdowns unten (Info-Popover, Kategorie-/Status-Filter) werden per
// Teleport nach <body> gerendert statt lokal per position:absolute zu hängen (gleiches Muster wie
// MapsAppPicker.vue) - .picker-backdrop braucht dafür position:fixed übers ganze Sichtfeld, das
// ginge sonst nicht mehr zuverlässig: sobald .spots-col (das Bottom-Sheet, weiter unten im
// Template) ein transform bekommt (z. B. für den Zusammen-/Ausklapp-Skalierungseffekt), wird es
// laut CSS-Spezifikation zum Containing Block für alle position:fixed-Nachfahren - das Backdrop
// würde sich sonst auf die Sheet-Fläche statt den ganzen Bildschirm beschränken (siehe DESIGN.md,
// Abschnitt "Zieh-Interaktionen").
function computeMenuStyle(
  btnEl: any,
  event?: MouseEvent,
  minWidth = 200
): { top: string; left: string } {
  const el = (event?.currentTarget as HTMLElement) || (btnEl as any)?.$el || btnEl;
  if (!el || typeof el.getBoundingClientRect !== 'function') return { top: '0px', left: '0px' };
  const rect = el.getBoundingClientRect();
  return {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8))}px`,
  };
}

const descriptionOpen = ref(false);
const descriptionBtnRef = ref<any>(null);
const descriptionMenuStyle = ref({ top: '0px', left: '0px' });
function toggleDescription(event?: MouseEvent) {
  if (!descriptionOpen.value) {
    descriptionMenuStyle.value = computeMenuStyle(descriptionBtnRef.value, event, 260);
    descriptionOpen.value = true;
  } else {
    descriptionOpen.value = false;
  }
}

const categoryFilter = usePersistedRef<string[]>('reisotor-excursions-category-filter', []);
function removeCategoryFilter(cat: string) {
  categoryFilter.value = categoryFilter.value.filter((c) => c !== cat);
}

// 'done' ist unabhängig von 'planned'/'unplanned' (ein Spot kann beides gleichzeitig sein, siehe
// SpotCard.vue's zwei getrennte Status-Badges) - deshalb eine eigene, per ODER kombinierbare
// Prüfung in filteredSpotItems unten statt eines dritten Werts derselben Status-Dimension.
const STATUS_FILTER_LABEL: Record<'planned' | 'unplanned' | 'done', string> = {
  planned: 'Geplant',
  unplanned: 'Ungeplant',
  done: 'Gemacht',
};
const STATUS_FILTER_ICON: Record<'planned' | 'unplanned' | 'done', IconDef> = {
  planned: FORM_FIELD_ICONS.date,
  unplanned: FORM_FIELD_ICONS.note,
  done: ACTION_ICONS.done,
};

const statusFilter = usePersistedRef<('planned' | 'unplanned' | 'done')[]>(
  'reisotor-excursions-status-filter',
  []
);
function removeStatusFilter(status: 'planned' | 'unplanned' | 'done') {
  statusFilter.value = statusFilter.value.filter((s) => s !== status);
}
function itemDone(item: SpotsGroupItem): boolean {
  return !!item.spot.done;
}

const searchQuery = ref('');

const allSpotItems = computed<SpotsGroupItem[]>(() =>
  spotsStore.spots.map((spot): SpotsGroupItem => ({ kind: 'spot', spot }))
);

const filteredSpotItems = computed(() =>
  allSpotItems.value.filter((item) => {
    if (categoryFilter.value.length && !categoryFilter.value.includes(itemCategory(item)))
      return false;
    const status = itemStatus(item);
    // Mehrere gewählte Filter werden per ODER kombiniert (planned/unplanned/done können alle
    // gleichzeitig zutreffen), damit z. B. "Geplant" + "Gemacht" beide Teilmengen gleichzeitig zeigt.
    if (statusFilter.value.length) {
      const matchesStatus = statusFilter.value.includes(status);
      const matchesDone = statusFilter.value.includes('done') && itemDone(item);
      if (!matchesStatus && !matchesDone) return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase();
      const title = itemTitle(item).toLowerCase();
      const category = itemCategory(item).toLowerCase();
      const note = (item.spot.note ?? '').toLowerCase();
      if (!title.includes(q) && !category.includes(q) && !note.includes(q)) return false;
    }
    return true;
  })
);

// Reihenfolge der Gruppen: die automatisch eingebettete Unterkunft zuerst (bereits anderswo
// gepflegt, soll als "kostenloser" Ausgangspunkt sofort ins Auge fallen), dann bekannte
// Spot-Kategorien (spotCategory.ts-Reihenfolge), dann eigene Freitext-Kategorien alphabetisch,
// "Sonstiges" (keine Kategorie) zuletzt – bleibt unabhängig von der gewählten Sortierung innerhalb
// der Gruppen stabil. new Set(...) statt eines rohen Arrays: "Unterkunft" ist selbst auch schon eine
// bekannte Spot-Kategorie (SPOT_CATEGORY_SUGGESTIONS, spotCategory.ts) - ohne die Deduplizierung
// tauchte "Unterkunft" zweimal in dieser Liste auf, wodurch sortedCategoryKeys() unten (filter()
// dedupliziert seine Quelle nicht) dieselbe Gruppe samt Karten zweimal rendert (u. a. als doppelte
// Kategorie-Nav-Pille sichtbar geworden).
const CATEGORY_GROUP_ORDER = [...new Set(['Unterkunft', ...SPOT_CATEGORY_SUGGESTIONS])];

function sortedCategoryKeys(categories: Iterable<string>): string[] {
  const set = new Set(categories);
  const known = CATEGORY_GROUP_ORDER.filter((c) => set.has(c));
  const custom = [...set]
    .filter((c) => !CATEGORY_GROUP_ORDER.includes(c) && c !== 'Sonstiges')
    .sort();
  return [...known, ...custom, ...(set.has('Sonstiges') ? ['Sonstiges'] : [])];
}

const spotGroups = computed(() => {
  const groups = new Map<string, SpotsGroupItem[]>();
  const groupKeysFor =
    groupMode.value === 'tours'
      ? tourTitlesForItem
      : (item: SpotsGroupItem) => [itemCategory(item)];
  for (const item of filteredSpotItems.value) {
    const keys = groupKeysFor(item);
    const effectiveKeys =
      groupMode.value === 'tours' && keys.length === 0 ? [UNASSIGNED_TOUR_GROUP] : keys;
    for (const key of effectiveKeys) {
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
  }
  if (groupMode.value === 'tours') {
    // Touren ohne zugeordneten Spot (z. B. frisch angelegt, noch ohne Stationen) bekommen trotzdem
    // eine (leere) Gruppe - sonst verschwänden sie komplett aus dieser Ansicht, sobald man nach
    // Touren statt Kategorie gruppiert, weil die Gruppierung oben rein über die Spot-Zuordnung
    // (tourTitlesForItem) läuft.
    const q = searchQuery.value.trim().toLowerCase();
    for (const ex of excursionsStore.excursions) {
      if (!groups.has(ex.title)) {
        if (!q || ex.title.toLowerCase().includes(q) || (ex.note ?? '').toLowerCase().includes(q)) {
          groups.set(ex.title, []);
        }
      }
    }
  }
  for (const [key, list] of groups) {
    // Echte Tour-Gruppen (nicht "Ohne Tour") in der tatsächlichen Stationen-Reihenfolge der Tour
    // (spot_ids, siehe SpotOrderPicker.vue) statt alphabetisch/nach Likes sortieren - macht die
    // Reihenfolge/den Rundgang direkt in der Liste sichtbar (siehe verbindende gestrichelte Linie
    // im Template unten). Erster Vorkommen-Index gewinnt bei Mehrfachbesuch (derselbe Spot bekommt
    // hier ohnehin nur eine Karte, keine zweite für den Wiederbesuch).
    const excursion =
      groupMode.value === 'tours' && key !== UNASSIGNED_TOUR_GROUP
        ? excursionForGroupTitle(key)
        : null;
    if (excursion) {
      const order = new Map<number, number>();
      excursion.spot_ids.forEach((id, idx) => {
        if (!order.has(id)) order.set(id, idx);
      });
      list.sort((a, b) => {
        const ai = a.kind === 'spot' ? (order.get(a.spot.id) ?? Infinity) : Infinity;
        const bi = b.kind === 'spot' ? (order.get(b.spot.id) ?? Infinity) : Infinity;
        return ai - bi;
      });
    } else {
      list.sort((a, b) => {
        if (sortMode.value === 'date') {
          const dateA = spotScheduledDates.value.get(a.spot.id) || '\uFFFF';
          const dateB = spotScheduledDates.value.get(b.spot.id) || '\uFFFF';
          return dateA.localeCompare(dateB) || itemTitle(a).localeCompare(itemTitle(b));
        }
        if (sortMode.value === 'likes') {
          return itemLikeCount(b) - itemLikeCount(a) || itemTitle(a).localeCompare(itemTitle(b));
        }
        return itemTitle(a).localeCompare(itemTitle(b));
      });
    }
  }
  if (groupMode.value === 'tours') {
    // "Ohne Tour" bewusst zuletzt statt alphabetisch einsortiert – die eigentlichen Touren sind der
    // interessante Teil dieser Gruppierung, die Sammelgruppe für untaggte Spots bildet den Abschluss.
    const known = [...groups.keys()]
      .filter((k) => k !== UNASSIGNED_TOUR_GROUP)
      .sort((a, b) => {
        if (sortMode.value === 'date') {
          const ea = excursionForGroupTitle(a);
          const eb = excursionForGroupTitle(b);
          const da = ea?.date || '\uFFFF';
          const db = eb?.date || '\uFFFF';
          return da.localeCompare(db) || a.localeCompare(b);
        }
        return a.localeCompare(b);
      });
    const keys = groups.has(UNASSIGNED_TOUR_GROUP) ? [...known, UNASSIGNED_TOUR_GROUP] : known;
    return keys.map((title) => ({
      category: title,
      iconDef:
        title === UNASSIGNED_TOUR_GROUP ? FORM_FIELD_ICONS.location : SECTION_ICON_DEFS.excursions,
      items: groups.get(title)!,
      // Echte Excursion hinter dem Gruppen-Titel (nur bei Touren-Gruppierung, "Ohne Tour" bleibt
      // null) – die Gruppen-Überschrift rendert damit statt reinem Text eine anklickbare
      // ExcursionCard (siehe Template unten), Klick visualisiert die Tour auf der Karte.
      excursion: title === UNASSIGNED_TOUR_GROUP ? null : excursionForGroupTitle(title),
    }));
  }
  return sortedCategoryKeys(groups.keys()).map((category) => ({
    category,
    iconDef: groupIconDef(category),
    items: groups.get(category)!,
    excursion: null as Excursion | null,
  }));
});

const filterCategoryOptions = computed(() =>
  sortedCategoryKeys(allSpotItems.value.map(itemCategory))
);

// Löst den Gruppen-Titel (siehe spotGroups oben, Gruppierung läuft über den Tour-TITEL, nicht die
// Id - gleiches Muster wie tourTitlesForItem/TourAssignPicker.vue) auf die tatsächliche Excursion
// auf, damit die Gruppen-Überschrift bei Touren-Gruppierung als echte ExcursionCard gerendert
// werden kann (Klick darauf visualisiert die Tour auf der Karte, siehe Template unten).
function excursionForGroupTitle(title: string): Excursion | null {
  return excursionsStore.excursions.find((e) => e.title === title) ?? null;
}

// Horizontale Kategorie-Navigation (Wolt-Stil): Map statt DOM-`id`, damit Leerzeichen/Umlaute in
// Kategorienamen ("Aussichtspunkt", "Unterkunft") kein Escaping-Problem sind. scrollIntoView()
// läuft die scrollenden Vorfahren selbst hoch – landet also automatisch in .spots-col, sobald die
// Container-Query (≥720px) diese Spalte selbst scrollen lässt, sonst in der normalen Seite.
// Ziel kann sowohl eine reine Überschrift (Kategorie-Gruppierung) als auch eine ExcursionCard
// (Touren-Gruppierung, siehe excursionForGroupTitle oben) sein - el.$el löst dafür wie bei
// setSpotRef unten auf das tatsächliche DOM-Element der Komponente auf.
const categoryRefs = new Map<string, HTMLElement>();
function setCategoryRef(category: string, el: Element | ComponentPublicInstance | null) {
  const domEl = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null);
  if (domEl instanceof HTMLElement) categoryRefs.set(category, domEl);
  else categoryRefs.delete(category);
}
// Ref auf die eingebettete Karte (TripMap.vue): scrollToCategory() lässt bei Klick auf eine
// Kategorie-Nav-Pille zusätzlich die Karte auf alle Punkte dieser Kategorie zoomen (siehe
// TripMap.vue's defineExpose(focusCategory)) – dieselbe Kategorie-Kopplung wie beim Filter oben.
const tripMapRef = ref<InstanceType<typeof TripMap> | null>(null);
function scrollToCategory(category: string) {
  // Sofort setzen statt nur auf den IntersectionObserver (Scrollspy weiter unten) zu warten: bei
  // kurzen Gruppen, die schon vor dem Scrollen alle gleichzeitig im Beobachtungsfenster liegen,
  // ändert sich die Schnittmenge durchs Scrollen u. U. gar nicht - die Unterstreichung sprang dann
  // beim Klick nie zur angeklickten Kategorie (nur die zuerst in spotGroups gelistete blieb aktiv).
  // Der Observer-Callback unten überschreibt diesen Wert ohnehin wieder, sobald sich die Scrollposition
  // tatsächlich ändert - "in beide Richtungen" bleibt dadurch erhalten.
  activeCategory.value = category;
  categoryRefs.get(category)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  tripMapRef.value?.focusCategory(category);
}

// Scrollspy (Wolt-Stil, "in beide Richtungen"): welche Gruppe gilt gerade als aktiv, abgeleitet aus
// der tatsächlichen Scrollposition statt nur aus einem Klick - klicken bleibt weiterhin möglich
// (scrollToCategory oben), landet aber am Ziel einfach in derselben, per Scrollposition erkannten
// Auswahl. Default: die erste Gruppe, bevor überhaupt gescrollt/ein Callback gefeuert wurde bzw.
// falls die zuvor aktive Kategorie durch einen Filter-/Gruppierungswechsel weggefallen ist.
const activeCategory = ref<string | null>(null);
watch(
  spotGroups,
  (groups) => {
    if (!groups.some((g) => g.category === activeCategory.value)) {
      activeCategory.value = groups[0]?.category ?? null;
    }
  },
  { immediate: true }
);

// Umgekehrte Zuordnung DOM-Element -> Kategorie für den IntersectionObserver-Callback unten
// (categoryRefs oben bildet stattdessen Kategorie -> Element ab, gebraucht für scrollToCategory).
const categoryByEl = new Map<HTMLElement, string>();
// Alle Gruppen, deren Überschrift/ExcursionCard gerade die Erkennungslinie unten berührt - bei
// mehreren gleichzeitig (nur bei sehr kurzen, dicht aufeinanderfolgenden Gruppen möglich) gewinnt
// die laut spotGroups-Reihenfolge oberste (siehe Observer-Callback unten).
const intersectingCategories = new Set<string>();
let categorySectionObserver: IntersectionObserver | null = null;

// Baut den Observer bei jeder Änderung der Gruppen (Filter/Gruppierung/neue Spots) komplett neu auf
// statt einzelne Targets nachzuziehen - günstig genug (nur bei Gruppenänderung, nicht pro Scroll)
// und vermeidet, mit veralteten categoryRefs-Einträgen zu beobachten.
function rebuildCategorySectionObserver() {
  categorySectionObserver?.disconnect();
  categorySectionObserver = null;
  intersectingCategories.clear();
  categoryByEl.clear();
  const firstEl = categoryRefs.values().next().value as HTMLElement | undefined;
  // .spots-col statt .spots-col-body: Letztere scrollt nur mobil (siehe .spots-col-body-CSS unten),
  // auf Desktop (≥720px) wird sie per CSS auf overflow-y:visible zurückgesetzt und .spots-col selbst
  // scrollt (siehe dortiges CSS) - mit .spots-col-body als root berichtete der Observer auf Desktop
  // nie eine Änderung, activeCategory blieb beim Scrollen unverändert stehen (#102). .spots-col
  // funktioniert für beide Layouts, siehe identische Begründung bei setCategoryNavSentinelRef oben.
  const root = firstEl?.closest('.spots-col') ?? null;
  if (!root) return;
  categorySectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const category = categoryByEl.get(entry.target as HTMLElement);
        if (!category) continue;
        if (entry.isIntersecting) intersectingCategories.add(category);
        else intersectingCategories.delete(category);
      }
      const active = spotGroups.value.find((g) => intersectingCategories.has(g.category));
      if (active) activeCategory.value = active.category;
    },
    // Erkennungslinie knapp unterhalb der sticky Kategorie-Nav (categoryNavHeight, live gemessen -
    // derselbe Wert wie beim scroll-margin-top der Gruppen über --category-nav-clearance - "aktiv"
    // und "per Klick angesprungen" greifen dadurch konsistent an derselben Stelle). -65% unten
    // begrenzt die Erkennungszone auf einen schmalen Streifen statt der kompletten sichtbaren Liste.
    { root, rootMargin: `-${categoryNavHeight.value}px 0px -65% 0px`, threshold: 0 }
  );
  for (const [category, el] of categoryRefs) {
    categoryByEl.set(el, category);
    categorySectionObserver.observe(el);
  }
}
watch(spotGroups, () => nextTick(rebuildCategorySectionObserver));

// Gleitende Unterstreichung + horizontales Nachscrollen der Nav-Leiste selbst, damit die aktive
// Kategorie (egal ob per Klick oder per Scrollspy oben gesetzt) immer sichtbar bleibt - gleiches
// Grundprinzip wie ListenView.vue's .tab-underline (dortiger Kommentar für die Begründung, warum
// JS-gemessene offsetLeft/offsetWidth statt eines starren CSS-Grids nötig sind).
const navItemRefs = new Map<string, HTMLElement>();
function setNavItemRef(category: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) navItemRefs.set(category, el);
  else navItemRefs.delete(category);
}
const underlineLeft = ref(0);
const underlineWidth = ref(0);
function updateCategoryNavUnderline() {
  const activeEl = activeCategory.value ? navItemRefs.get(activeCategory.value) : null;
  if (!activeEl) return;
  underlineLeft.value = activeEl.offsetLeft;
  underlineWidth.value = activeEl.offsetWidth;
}
// Tatsächlich gerenderte Höhe der .category-nav-Leiste, live gemessen statt (wie zuvor) als starrer
// CSS-Schätzwert angenommen - Grund für #101 (Kategorie-Klick landete nicht weit genug gescrollt,
// weil der Schätzwert von der echten Höhe abwich). Default 44px hält den vorherigen Schätzwert nur
// als Fallback für den allerersten Sprung, bevor der ResizeObserver unten überhaupt einmal gefeuert
// hat (gleiches Problem/Vorgehen wie bei pageTitleHeight oben). Wird unten als Inline-Style-Var
// --category-nav-clearance auf .spots-col-body gebunden und ersetzt dort den bisherigen CSS-Fixwert.
const categoryNavHeight = ref(44);
let categoryNavResizeObserver: ResizeObserver | null = null;
// Element-Referenz zusätzlich zum ResizeObserver oben gehalten (#144) - die Klick-Pfeile links/
// rechts (Template) brauchen sie zum tatsächlichen Scrollen (scrollNavBy) sowie zur Sichtbarkeits-
// Berechnung (updateNavArrows), beides von außerhalb dieser Setter-Funktion.
const categoryNavEl = ref<HTMLElement | null>(null);
const canScrollNavLeft = ref(false);
const canScrollNavRight = ref(false);
// 1px Toleranz statt exaktem Vergleich - scrollWidth/scrollLeft/clientWidth landen bei fraktionaler
// Geräte-Pixel-Skalierung (z. B. 125%-Windows-Skalierung) nicht immer exakt auf demselben Wert,
// obwohl visuell schon ganz durchgescrollt - ein exakter Vergleich ließe den jeweiligen Pfeil dann
// dauerhaft (fälschlich) sichtbar.
function updateNavArrows() {
  const el = categoryNavEl.value;
  if (!el) return;
  canScrollNavLeft.value = el.scrollLeft > 1;
  canScrollNavRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}
function setCategoryNavRef(el: Element | ComponentPublicInstance | null) {
  categoryNavResizeObserver?.disconnect();
  categoryNavResizeObserver = null;
  categoryNavEl.value = el instanceof HTMLElement ? el : null;
  if (el instanceof HTMLElement) {
    categoryNavResizeObserver = new ResizeObserver(() => {
      updateCategoryNavUnderline();
      categoryNavHeight.value = el.getBoundingClientRect().height;
      updateNavArrows();
    });
    categoryNavResizeObserver.observe(el);
    updateNavArrows();
  }
}
// Scrollt in Sprüngen von ~70% der sichtbaren Breite statt der vollen Breite - hält das letzte Item
// vor dem Sprung teilweise sichtbar, macht den Zusammenhang zum nächsten Ausschnitt klarer (gleiches
// Prinzip wie viele native Wisch-Karussells).
function scrollNavBy(direction: 1 | -1) {
  const el = categoryNavEl.value;
  if (!el) return;
  el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
}
// Kategorienanzahl kann sich ändern (Gruppieren-Umschalter, Filter), ohne dass die Nav-Leiste
// selbst ihre eigene Breite ändert - der ResizeObserver in setCategoryNavRef beobachtet nur DEREN
// Box, nicht ihren Inhalt/scrollWidth, würde einen dadurch neu scrollbar gewordenen Zustand also
// nicht von selbst erkennen.
watch(spotGroups, () => nextTick(updateNavArrows));
watch(activeCategory, () => {
  nextTick(() => {
    updateCategoryNavUnderline();
    const activeEl = activeCategory.value ? navItemRefs.get(activeCategory.value) : null;
    const navEl = activeEl?.closest('.category-nav') as HTMLElement | null;
    if (!activeEl || !navEl) return;
    // Bewusst NICHT activeEl.scrollIntoView({inline:'nearest', block:'nearest'}): das lässt den
    // Browser den nächsten scrollenden Vorfahren für JEDE Achse einzeln bestimmen - vertikal ist das
    // .spots-col (Nav-Item steckt selbst in .spots-col-body/.spots-col), nicht nur die Nav-Leiste
    // selbst. Ein zeitgleich per scrollToCategory() oben ausgelöster vertikaler Sprung (derselbe
    // Tick, nur einen nextTick später) wurde dadurch von diesem zweiten scrollIntoView()-Aufruf
    // regelmäßig überschrieben/gekappt (block:'nearest' erkennt die Pille als vertikal bereits
    // sichtbar und "gewinnt" gegen den noch laufenden vertikalen Scroll) - dadurch landete ein Klick
    // auf eine Kategorie-Pille kaum oder gar nicht gescrollt (#101). Stattdessen nur die Nav-Leiste
    // selbst (ihr eigenes scrollLeft) horizontal anpassen, ohne die vertikalen Vorfahren zu berühren.
    const elLeft = activeEl.offsetLeft;
    const elRight = elLeft + activeEl.offsetWidth;
    const viewLeft = navEl.scrollLeft;
    const viewRight = viewLeft + navEl.clientWidth;
    if (elLeft < viewLeft) navEl.scrollTo({ left: elLeft, behavior: 'smooth' });
    else if (elRight > viewRight)
      navEl.scrollTo({ left: elRight - navEl.clientWidth, behavior: 'smooth' });
  });
});
onUnmounted(() => {
  categorySectionObserver?.disconnect();
  categoryNavResizeObserver?.disconnect();
});

// Welcher Spot ist gerade in der Liste aufgeklappt (SpotCard.vue, ersetzt den früheren Modal-
// Dialog) – lebt hier statt lokal in SpotCard.vue, da ein Pin-Klick auf der Karte (TripMap.vue's
// @focus-spot) dieselbe Karte von außen aufklappen können muss, exakt wie ein Kategorie-Klick
// scrollToCategory() von außen auslöst (gleiches Ref-Map-Muster wie categoryRefs oben).
const expandedSpotId = ref<number | null>(null);

// Mobil (Bottom-Sheet, siehe isSheetOverlayMode unten) wechselt eine Karte beim Auf-/Zuklappen
// zwischen einer Zeilen- und einer Spalten-Anordnung (@container-Regel in SpotCard.vue) - anders
// als Desktops reine .image-Höhen-Transition lässt sich ein flex-direction-Wechsel nicht per
// simpler CSS-transition animieren (#90). Die View-Transitions-API (soweit unterstützt, sonst
// schlichter Sprung als Fallback) übernimmt hier stattdessen den Übergang: sie fotografiert Vorher/
// Nachher und blendet/morpht selbst über einen echten Layout-Wechsel hinweg - dieselbe Karte trägt
// dafür kurzzeitig einen festen view-transition-name (siehe :style an der SpotCard-Instanz im
// Template), IMMER nur eine einzige gleichzeitig (ein Tap wechselt genau eine Karte), Kollisionen
// mit demselben Namen sind dadurch ausgeschlossen. Nur im Sheet-Overlay-Modus aktiv: Desktop hat
// bereits seine eigene, ausreichende CSS-Transition, eine zusätzliche View-Transition würde dort
// nur unnötig doppelt (und ggf. wechselwirkend) animieren.
const transitioningSpotId = ref<number | null>(null);
const supportsViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document;
// Nutzer-Feedback (nach dem #140-Fix, auf echtem iPhone/Safari beobachtet): gelegentlich bleibt eine
// Spot-Karte nach dem Auf-/Zuklappen unsichtbar (aber weiterhin normal selektierbar/interaktiv) und
// wird erst wieder korrekt gezeichnet, sobald sie aus dem sichtbaren Bereich heraus- und wieder
// hineingescrollt wird - klassisches Symptom eines WebKit-"stale paint"-Bugs (Compositing-Layer wird
// nach der view-transition-Umstrukturierung nicht neu gezeichnet, Layout/Hit-Testing sind aber schon
// korrekt, sonst wäre die Karte nicht mehr anklickbar). Kein einzelner offizieller WebKit-Bugreport
// dafür gefunden, aber dieselbe Bug-Klasse wie andere bekannte WebKit-Repaint-Aussetzer nach
// Transform-/Layer-Änderungen - Standard-Workaround dafür ist ein erzwungener Repaint direkt nach
// Abschluss der Transition (hier: kurzzeitige Opacity-Änderung auf dem scrollenden Listen-Container,
// der WebKit zwingt, dessen Compositing-Layer neu zu zeichnen), analog zum verbreiteten
// translateZ(0)/opacity-Kick-Trick gegen ähnliche Safari-Rendering-Aussetzer. Best effort wie der
// restliche #140-Fix - ohne echtes Safari/iOS-Testgerät hier nicht verifizierbar.
const spotsColBodyEl = ref<HTMLElement | null>(null);
function nudgeRepaint() {
  const el = spotsColBodyEl.value;
  if (!el) return;
  const prevOpacity = el.style.opacity;
  el.style.opacity = '0.999';
  requestAnimationFrame(() => {
    el.style.opacity = prevOpacity;
  });
}

const spotRefs = new Map<number, HTMLElement>();
function setSpotRef(id: number, el: Element | ComponentPublicInstance | null) {
  const domEl = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null);
  if (domEl instanceof HTMLElement) spotRefs.set(id, domEl);
  else spotRefs.delete(id);
}
function scrollToSpot(id: number) {
  // 'start' statt 'nearest': Ziel ist, dass die Oberkante der Karte exakt am oberen Rand des
  // sichtbaren Bereichs landet (siehe .spot-card's scroll-margin-top in SpotCard.vue für die
  // Kompensation der sticky .category-nav) - 'nearest' scrollte zuvor nur das nötige Minimum ohne
  // definierte Ausrichtung, dadurch landete die Karte je nach vorheriger Scrollposition uneinheitlich
  // zu weit oben oder unten (#103).
  spotRefs.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Klick auf einen Spot-Pin auf der Karte (TripMap.vue) klappt die passende Karte hier auf und
// scrollt sie in den Blick – die Pin-Vergrößerung selbst setzt TripMap.vue bereits eigenständig
// (drawers.mapFocusKey), hier geht es nur um die Liste. Mobil ist die Liste dabei ein Bottom-Sheet
// über der Karte (siehe sheetState unten) – steht es eingeklappt, wäre die aufgeklappte Karte
// unsichtbar. Öffnet deshalb (Google-Maps-Stil) mindestens "angeschnitten", rührt einen bereits
// weiter geöffneten Zustand (partial/full) aber nicht an (#104).
function onFocusSpotFromMap(spotId: number) {
  expandedSpotId.value = spotId;
  if (sheetState.value === 'collapsed') sheetState.value = 'partial';
  scrollToSpot(spotId);
}

// Touren-Stationsliste (siehe .tour-station-wrap/.tour-station-line im Template/CSS unten, #100):
// eine gebogene, gestrichelte SVG-Linie verbindet Kreis-Punkte auf Höhe der jeweiligen Spot-Karten,
// statt wie zuvor eines starren, per CSS-border-left gezeichneten geraden Strichs über die volle
// Container-Höhe hinweg (der dadurch abrupt am unteren Rand der letzten Karte endete statt exakt an
// deren Mitte). Punkte/Pfad werden aus den tatsächlichen DOM-Positionen der Spot-Karten berechnet
// (per-Excursion in tourLines gespeichert), da deren Höhen variabel sind (Bild ja/nein, aufgeklappt/
// eingeklappt, Kommentare ein-/ausgeblendet) - ein rein statisches CSS-Muster könnte das nicht
// abbilden. Gleiche Bogen-Idee wie utils/mapRoute.ts's arcPoints() (Kontrollpunkt senkrecht zur
// Verbindungslinie versetzt, proportional zum Segmentabstand), hier auf Bildschirm-Pixel statt
// Geo-Koordinaten angewandt.
interface TourLineData {
  width: number;
  height: number;
  pathD: string;
  dots: { x: number; y: number }[];
}
const TOUR_LINE_X = 10;
const TOUR_LINE_WIDTH = 20;
const tourLines = reactive(new Map<number, TourLineData>());
const tourWrapRefs = new Map<number, HTMLElement>();
let tourLineResizeObserver: ResizeObserver | null = null;

function recomputeTourLine(excursionId: number) {
  const wrapEl = tourWrapRefs.get(excursionId);
  const listEl = wrapEl?.querySelector<HTMLElement>(':scope > .tour-station-list');
  const items = listEl ? (Array.from(listEl.children) as HTMLElement[]) : [];
  if (!items.length) {
    tourLines.delete(excursionId);
    return;
  }
  const dots = items.map((item) => ({ x: TOUR_LINE_X, y: item.offsetTop + item.offsetHeight / 2 }));
  const points = [{ x: TOUR_LINE_X, y: 0 }, ...dots];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dy = p2.y - p1.y;
    const controlX = (p1.x + p2.x) / 2 - dy * 0.15;
    const controlY = (p1.y + p2.y) / 2;
    d += ` Q ${controlX} ${controlY} ${p2.x} ${p2.y}`;
  }
  tourLines.set(excursionId, {
    width: TOUR_LINE_WIDTH,
    height: dots[dots.length - 1].y,
    pathD: d,
    dots,
  });
}

function setTourWrapRef(excursionId: number, el: Element | ComponentPublicInstance | null) {
  const domEl = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null);
  const previous = tourWrapRefs.get(excursionId);
  // Vue ruft Funktions-Refs bei JEDEM Re-Render erneut auf, nicht nur beim Mount/Unmount - ohne
  // dieses Gleichheits-Gate würde recomputeTourLine() bei jedem Aufruf erneut in die reaktive
  // tourLines-Map schreiben, was wiederum ein Re-Render (und damit den nächsten Ref-Aufruf)
  // auslöst: eine Endlosschleife, die den Tab einfriert. Nur bei tatsächlichem Element-Wechsel
  // (Mount/Unmount/Ersetzung) neu beobachten/berechnen.
  if (domEl === previous) return;
  if (previous) tourLineResizeObserver?.unobserve(previous);
  if (domEl instanceof HTMLElement) {
    tourWrapRefs.set(excursionId, domEl);
    tourLineResizeObserver?.observe(domEl);
    nextTick(() => recomputeTourLine(excursionId));
  } else {
    tourWrapRefs.delete(excursionId);
    tourLines.delete(excursionId);
  }
}

onMounted(() => {
  tourLineResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const id = [...tourWrapRefs.entries()].find(([, el]) => el === entry.target)?.[0];
      if (id != null) recomputeTourLine(id);
    }
  });
  for (const [id, el] of tourWrapRefs) tourLineResizeObserver.observe(el);
});
onUnmounted(() => tourLineResizeObserver?.disconnect());
// Neben Größenänderungen einzelner Karten (ResizeObserver oben) auch bei Zuordnungsänderungen
// (Spot zu Tour hinzugefügt/entfernt/umsortiert) neu berechnen - ändert die Anzahl/Reihenfolge der
// Kinder, worauf der ResizeObserver nicht zuverlässig anspringt, wenn sich dadurch die
// Gesamthöhe zufällig nicht ändert.
watch(spotGroups, () =>
  nextTick(() => {
    for (const id of tourWrapRefs.keys()) recomputeTourLine(id);
  })
);

// Welcher Ausflug (Tour) ist in der Karten-Liste gerade fokussiert/aufgeklappt?
// Die Liste (ExcursionsView) und die Karte (TripMap) synchronisieren sich über diesen State.
// Nur für Touren verwendet (groupMode === 'tours').
const expandedExcursionId = ref<number | null>(null);

watch(expandedExcursionId, (newId) => {
  if (newId != null) {
    nextTick(() => recomputeTourLine(newId));
  }
});

// Klick auf den Ausflug-Titel im Karten-Fokus-Panel (TripMap.vue's @focus-excursion) klappt die
// passende ExcursionCard hier auf und scrollt sie in den Blick – exakt dasselbe Muster wie
// onFocusSpotFromMap oben. Die Gruppen-Überschrift ist nur bei Touren-Gruppierung eine echte
// ExcursionCard (siehe spotGroups), deshalb hier ggf. zuerst umschalten.
function onFocusExcursionFromMap(excursionId: number) {
  groupMode.value = 'tours';
  expandedExcursionId.value = excursionId;
  if (sheetState.value === 'collapsed') sheetState.value = 'partial';
  nextTick(() => {
    const grp = spotGroups.value.find((g) => g.excursion?.id === excursionId);
    if (grp) categoryRefs.get(grp.category)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
function updateSpotsColRight() {
  if (isSheetOverlayMode.value || !sheetEl.value) {
    spotsColRightPx.value = 0;
    return;
  }
  const spotsRect = sheetEl.value.getBoundingClientRect();
  const mapLeft = tripMapRef.value?.$el?.getBoundingClientRect().left ?? 0;
  spotsColRightPx.value = Math.max(0, Math.round(spotsRect.right - mapLeft));
}

function onColResizeMove(event: PointerEvent) {
  if (!resizingCol.value) return;
  const delta = event.clientX - colStartX;
  spotsColWidth.value = Math.min(
    MAX_SPOTS_COL_WIDTH,
    Math.max(MIN_SPOTS_COL_WIDTH, colStartWidth + delta)
  );
  updateSpotsColRight();
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
const SHEET_ORDER: SheetState[] = ['collapsed', 'partial', 'full'];
const sheetState = ref<SheetState>('partial');
const sheetDragging = ref(false);
const sheetDragHeightPx = ref<number | null>(null);
// Element-Ref auf .spots-col (Template unten) – der Drag selbst schreibt seine Höhe direkt hierauf
// statt über eine reaktive :style-Bindung (siehe applySheetHeight() unten), um während des Ziehens
// keinen Vue-Render-Tick pro pointermove abzuwarten.
const sheetEl = ref<HTMLElement | null>(null);

// Deckelt alle drei Zustände auf den Platz UNTER der Kopfzeile/NavBar – MUSS exakt dieselbe Formel
// wie .page's Höhe bzw. .spots-col's CSS-Variable --sheet-max-height (siehe CSS weiter unten:
// calc(100% - 8px) von .page) verwenden, nicht nur eine Annäherung: onSheetDragStart() liest die
// Ausgangshöhe für "voll" aus genau dieser Funktion, obwohl der ruhende Grundzustand tatsächlich
// über die reine CSS-Rechnung gerendert wird (siehe Kommentar an .spots-col im CSS). Vorher fehlte
// hier --navbar-bottom-offset komplett und --app-header-height war hart auf 56 verdrahtet (statt
// wie überall sonst aus der CSS-Variable gelesen) - auf Mobil steht die NavBar per Default unten
// (siehe navPosition.ts), --navbar-bottom-offset ist dort also ungleich 0. Die dadurch zu groß
// berechnete "voll"-Höhe wich spürbar von der tatsächlich gerenderten Höhe ab: zog man den Anfasser
// direkt aus dem ruhenden "voll"-Zustand (ohne dass dragHeightPx bereits gesetzt war), sprang die
// Schublade beim allerersten pointermove auf diese falsche, größere Höhe – sichtbar als kurzes
// Hochzucken, bevor sie dann dem Finger nach unten folgte (#138).
function sheetHeightPx(state: SheetState): number {
  const rootStyle = getComputedStyle(document.documentElement);
  const headerHeight = parseFloat(rootStyle.getPropertyValue('--app-header-height')) || 56;
  const navbarOffset = parseFloat(rootStyle.getPropertyValue('--navbar-offset')) || 0;
  const navbarBottomOffset = parseFloat(rootStyle.getPropertyValue('--navbar-bottom-offset')) || 0;
  const maxAvailable = Math.max(
    160,
    window.innerHeight - headerHeight - navbarOffset - navbarBottomOffset - 8
  );
  // 64px statt der früheren 96px: die Pille zeigt jetzt nur noch die Anfasser-Zeile (siehe
  // .spots-col.collapsed CSS), kein Rest von .spots-col-body ragt mehr hinein.
  if (state === 'collapsed') return Math.min(64, maxAvailable);
  if (state === 'partial') return Math.min(window.innerHeight * 0.46, maxAvailable);
  return Math.min(window.innerHeight * 0.88, maxAvailable);
}

// Schreibt die Sheet-Höhe während des Ziehens direkt aufs Element (statt über eine reaktive
// :style-Bindung) - spart pro pointermove einen Vue-Render-Tick, damit das Ziehen dem Finger ohne
// spürbare Verzögerung folgt.
function applySheetHeight(heightPx: number) {
  if (sheetEl.value) sheetEl.value.style.height = `${heightPx}px`;
}
function clearSheetHeightOverride() {
  // Entfernt die inline Höhe wieder, sodass die CSS-Klassen-Regel (sheetState) inkl. ihrer eigenen
  // Transition die Einrast-Animation übernimmt.
  if (sheetEl.value) sheetEl.value.style.height = '';
}

// Schwung-/Flick-Erkennung fürs Loslassen (wie bei Google Maps): ein kurzer, schneller Wisch soll
// unabhängig von der zurückgelegten Distanz einen Zustand weiterschalten, statt (wie zuvor
// ausschließlich) nur nach der End-Position zu entscheiden - sonst "poppt" ein knackiger, aber kurzer
// Wisch beim Loslassen zurück auf den Ausgangszustand. Von beiden Zug-Pfaden (Anfasser
// onSheetDragEnd() UND Listen-Zug onSheetBodyPointerUp()) über resolveSheetTargetState() genutzt.
const FLICK_SAMPLE_WINDOW_MS = 80;
const FLICK_VELOCITY_PX_MS = 0.35;
let dragSamples: { y: number; t: number }[] = [];
function resetDragSamples() {
  dragSamples = [];
}
function recordDragSample(y: number) {
  const t = performance.now();
  dragSamples.push({ y, t });
  while (dragSamples.length > 1 && t - dragSamples[0].t > FLICK_SAMPLE_WINDOW_MS)
    dragSamples.shift();
}
// px/ms bezogen auf clientY, negativ = Finger bewegt sich nach oben (vergrößert die Sheet-Höhe).
function dragFlickVelocity(): number {
  if (dragSamples.length < 2) return 0;
  const first = dragSamples[0];
  const last = dragSamples[dragSamples.length - 1];
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

let sheetStartY = 0;
let sheetStartHeight = 0;
function onSheetDragStart(event: PointerEvent) {
  // Maus-Drag auf Desktop unterdrücken (verhindert versehentliches Resize bei Rechtsklick u. ä.).
  // Touch/Pen bleibt immer erlaubt - auch auf Tablets/breiten Geräten im Overlay-Modus.
  if (event.pointerType === 'mouse' && !isSheetOverlayMode.value) return;
  sheetDragging.value = true;
  sheetStartY = event.clientY;
  sheetStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
  resetDragSamples();
  recordDragSample(event.clientY);
  window.addEventListener('pointermove', onSheetDragMove);
  window.addEventListener('pointerup', onSheetDragEnd);
  event.preventDefault();
}
function onSheetDragMove(event: PointerEvent) {
  if (!sheetDragging.value) return;
  // Nach oben ziehen (kleinerer clientY) vergrößert die Höhe.
  const delta = sheetStartY - event.clientY;
  const next = sheetStartHeight + delta;
  const clamped = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
  sheetDragHeightPx.value = clamped;
  applySheetHeight(clamped);
  recordDragSample(event.clientY);
}
// Rundet eine frei gezogene Höhe auf den nächstgelegenen der drei festen Zustände - reiner
// Distanz-Fallback für resolveSheetTargetState() unten, wenn kein knackiger Flick vorlag.
function closestSheetState(heightPx: number): SheetState {
  let closest: SheetState = 'partial';
  let bestDist = Infinity;
  for (const s of SHEET_ORDER) {
    const dist = Math.abs(sheetHeightPx(s) - heightPx);
    if (dist < bestDist) {
      bestDist = dist;
      closest = s;
    }
  }
  return closest;
}
// Entscheidet den Ziel-Zustand beim Loslassen - von onSheetDragEnd() (Anfasser) UND
// onSheetBodyPointerUp() (Ziehen auf der Liste selbst, siehe dort) genutzt, damit beide exakt gleich
// einrasten. Bei einem knackigen Flick (siehe dragFlickVelocity()) zählt die Wisch-Richtung, sonst
// die reine End-Position (closestSheetState()).
function resolveSheetTargetState(startState: SheetState, heightPx: number): SheetState {
  const velocity = dragFlickVelocity();
  if (Math.abs(velocity) > FLICK_VELOCITY_PX_MS) {
    const direction = velocity < 0 ? 1 : -1; // Finger nach oben (kleineres clientY) -> Zustand aufwärts.
    const next = SHEET_ORDER[SHEET_ORDER.indexOf(startState) + direction];
    if (next) return next;
  }
  return closestSheetState(heightPx);
}

function onSheetDragEnd() {
  sheetDragging.value = false;
  window.removeEventListener('pointermove', onSheetDragMove);
  window.removeEventListener('pointerup', onSheetDragEnd);
  const current = sheetDragHeightPx.value;
  // current bleibt null, wenn zwischen Down und Up kein einziges pointermove-Event feuerte – bei
  // einem echten, sehr kurzen/bewegungslosen Antippen (v. a. auf Touch-Geräten üblich) kommt das
  // durchaus vor. Wurde das bisher wie "keine Bewegung erfasst, also gar nichts tun" behandelt
  // (früher Return), reagierte der Anfasser auf genau so einen Tap gar nicht – dabei ist "keine
  // Bewegung" der eindeutigste Tap-Fall überhaupt, kein Sonderfall zum Ignorieren.
  const movedFar = current != null && Math.abs(current - sheetStartHeight) > 8;
  if (!movedFar) {
    // Kaum/keine Bewegung = Tippen statt Ziehen: einen Zustand weiterschalten statt "an derselben
    // Stelle" wieder einzurasten (das wäre sonst ein wirkungsloser Tap gewesen).
    sheetState.value =
      SHEET_ORDER[(SHEET_ORDER.indexOf(sheetState.value) + 1) % SHEET_ORDER.length];
  } else {
    // Ab hier laut movedFar-Berechnung oben garantiert nicht null.
    sheetState.value = resolveSheetTargetState(sheetState.value, current as number);
  }
  // Erst NACHDEM sheetState (und damit die Ziel-Höhen-Klasse) im DOM angekommen ist, die
  // inline-Höhe entfernen (siehe applySheetHeight/clearSheetHeightOverride oben) - vorher hätte das
  // Entfernen für einen Frame die noch alte Zustands-Klasse (Höhe VOR dem Zug) greifen lassen, bevor
  // Vue die neue Klasse nachzieht: das Sheet sprang dadurch beim Loslassen sichtbar auf seine
  // Ausgangshöhe zurück, um erst danach zur echten Zielposition zu animieren (#99, v. a. bei
  // schnellem Swipe-and-Release auffällig, weil dort die Zeit zwischen Loslassen und Vue-Update am
  // knappsten ist).
  nextTick(() => {
    sheetDragHeightPx.value = null;
    clearSheetHeightOverride();
  });
}

// Wie Apple Maps: solange die Schublade nicht ganz oben ("voll") steht, ist die Liste selbst NICHT
// scrollbar (siehe .spots-col-body's overflow im CSS) - ein Zug irgendwo auf der Liste verschiebt
// stattdessen die ganze Schublade, genau wie ein Zug auf den dedizierten .sheet-handle-Anfasser
// oben. Ein reiner Tap (z. B. auf eine Spot-Karte) muss aber weiterhin normal durchklicken können -
// anders als beim Anfasser (der bei "kaum Bewegung" einen Zustand weiterschaltet) macht ein Tap
// hier deshalb bewusst NICHTS mit dem Sheet-Zustand, bevor sich per Bewegungs-Schwelle
// (SHEET_BODY_DRAG_THRESHOLD) überhaupt herausgestellt hat, dass es ein Zug statt eines Taps ist.
const SHEET_BODY_DRAG_THRESHOLD = 8;
let sheetBodyDragging = false;
let sheetBodyStartY = 0;
let sheetBodyStartHeight = 0;

function onSheetBodyPointerDown(event: PointerEvent) {
  // Maus-Drag auf Desktop unterdrücken - body-drag ist auf Desktop nicht vorgesehen (kein Sheet-Overlay).
  // Touch/Pen bleibt immer erlaubt.
  if (event.pointerType === 'mouse' && !isSheetOverlayMode.value) return;
  if (sheetState.value === 'full') return; // voll ausgeklappt: Liste scrollt ganz normal.
  // Eigene Zug-Ziele innerhalb der Liste (Kalender-/Touren-Anfasser einer Spot-Karte, siehe
  // SpotCard.vue's usePointerDrag-Wiring) haben ihre eigene Pointer-Drag-Logik - ohne diesen Ausstieg
  // würden beide gleichzeitig auf dieselbe Zugbewegung reagieren (Karte auf einen Kalendertag ziehen
  // UND gleichzeitig die Schublade verschieben).
  if (
    (event.target as HTMLElement).closest('button, a, input, textarea, select, [draggable="true"]')
  )
    return;
  sheetBodyDragging = false;
  sheetBodyStartY = event.clientY;
  sheetBodyStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
  resetDragSamples();
  recordDragSample(event.clientY);
  window.addEventListener('pointermove', onSheetBodyPointerMove);
  window.addEventListener('pointerup', onSheetBodyPointerUp);
}

function onSheetBodyPointerMove(event: PointerEvent) {
  const delta = sheetBodyStartY - event.clientY;
  if (!sheetBodyDragging) {
    // Erst ab der Schwelle als Zug werten - ein Tap zittert leicht, ohne echte Zugabsicht zu sein.
    if (Math.abs(delta) < SHEET_BODY_DRAG_THRESHOLD) return;
    sheetBodyDragging = true;
    sheetDragging.value = true;
  }
  const next = sheetBodyStartHeight + delta;
  const clamped = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
  sheetDragHeightPx.value = clamped;
  applySheetHeight(clamped);
  recordDragSample(event.clientY);
  event.preventDefault();
}

function onSheetBodyPointerUp() {
  window.removeEventListener('pointermove', onSheetBodyPointerMove);
  window.removeEventListener('pointerup', onSheetBodyPointerUp);
  if (!sheetBodyDragging) return; // reiner Tap - der Klick auf die Spot-Karte/den Inhalt lief bereits normal durch.
  sheetBodyDragging = false;
  sheetDragging.value = false;
  const current = sheetDragHeightPx.value;
  if (current != null) sheetState.value = resolveSheetTargetState(sheetState.value, current);
  // Reihenfolge wie in onSheetDragEnd oben: inline-Höhe erst NACH dem sheetState-Update entfernen
  // (per nextTick), sonst greift kurz die alte Zustands-Klasse und die Schublade springt sichtbar
  // zurück, bevor sie zur Zielposition animiert (#99).
  nextTick(() => {
    sheetDragHeightPx.value = null;
    clearSheetHeightOverride();
  });
}

// Buttons als Alternative zum Ziehen am Anfasser (weniger präzise auf kleinen Touch-Zielen) –
// schalten jeweils einen Rasterschritt weiter statt frei zu ziehen, genau wie ein Tap auf den
// Anfasser selbst (siehe onSheetDragEnd oben). SHEET_ORDER ist weiter oben (bei sheetState) deklariert.
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
const currentSheetHeightPx = computed(
  () => sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value)
);

// isDesktop (window.matchMedia, siehe useIsDesktop.ts) reicht hier NICHT: ob .spots-col als Sheet-
// Overlay über der Karte liegt oder als eigene Spalte daneben, entscheidet weiter unten im CSS ein
// @container app-main (min-width: 720px)-Query gegen die tatsächlich gerenderte Breite von
// .app-main - die kann schmaler als das Fenster sein (z. B. bei geöffneter Kalender-Schublade), auch
// bei Fensterbreiten oberhalb der isDesktop-Schwelle von 800px. Ohne dieses eigene Signal wurde
// mapCoveredBottomPx in genau dieser Konstellation fälschlich auf 0 gezwungen, obwohl das Sheet
// weiterhin als Overlay rendert - fokussierte Punkte/Routen landeten dann zu weit unten, teils
// hinter der Sheet-Kante.
const appMainWidth = ref<number | null>(null);
const spotsColRightPx = ref(0);
let appMainResizeObserver: ResizeObserver | null = null;
let spotsColResizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const appMainEl = document.querySelector('.app-main');
  if (appMainEl) {
    appMainResizeObserver = new ResizeObserver((entries) => {
      appMainWidth.value = entries[0]?.contentRect.width ?? null;
      updateSpotsColRight();
    });
    appMainResizeObserver.observe(appMainEl);
  }
  if (sheetEl.value) {
    spotsColResizeObserver = new ResizeObserver(() => {
      updateSpotsColRight();
    });
    spotsColResizeObserver.observe(sheetEl.value);
  }
  window.addEventListener('resize', updateSpotsColRight);
  updateSpotsColRight();
  nextTick(() => {
    updateSpotsColRight();
    setTimeout(updateSpotsColRight, 50);
    setTimeout(updateSpotsColRight, 300);
  });
});

onUnmounted(() => {
  appMainResizeObserver?.disconnect();
  spotsColResizeObserver?.disconnect();
  window.removeEventListener('resize', updateSpotsColRight);
});

// Spiegelt exakt die 720px-Schwelle des @container app-main-Queries weiter unten im <style> - beide
// Signale müssen übereinstimmen, sonst rechnet TripMap.vue mit einem falschen coveredBottomPx (siehe
// centerOnPoint()/fitBoundsWithCoveredBottom() dort). window.innerWidth dient nur als Fallback, bis
// der ResizeObserver beim Mounten seinen ersten Wert liefert. Absichtlich niedriger als die
// ursprünglichen 900px: bei geöffneter Kalender-Schublade (Standardbreite 360px, siehe
// stores/drawers.ts) reichte .app-main on gängigen Laptop-/Desktop-Breiten sonst oft nicht für die
// Desktop-Spalten-Ansicht, obwohl rechnerisch noch genug Platz für eine schmalere, aber weiterhin
// benutzbare Spots-Liste + Karte übrig war (siehe MIN_SPOTS_COL_WIDTH).
const isSheetOverlayMode = computed(() => (appMainWidth.value ?? window.innerWidth) < 720);
const mapCoveredBottomPx = computed(() =>
  isSheetOverlayMode.value ? currentSheetHeightPx.value : 0
);
const mapCoveredLeftPx = computed(() => (isSheetOverlayMode.value ? 0 : spotsColRightPx.value));

watch([isSheetOverlayMode, spotsColWidth, tripMapRef], () => nextTick(updateSpotsColRight));
watch(
  () => [drawers.calendarOpen, drawers.calendarWidth],
  () => {
    nextTick(updateSpotsColRight);
    setTimeout(updateSpotsColRight, 260);
  },
  { immediate: true }
);

// Ein Klick auf eine Spot-Karte klappt sie nur auf, ohne das Sheet anzurühren oder die Karte zu
// fokussieren (#109) – beides sind eigenständige Aktionen über den separaten "Auf Karte
// anzeigen"-Button (siehe onSpotShowOnMap unten), sonst konfligieren "Detail ansehen" und "auf der
// Karte zeigen" miteinander (ein voll ausgefahrenes Sheet schrumpfte zuvor bei jedem Karten-Klick
// ungewollt wieder auf "angeschnitten").
function onSpotCardOpen(spot: Spot) {
  expandedSpotId.value = spot.id;
}
function onSpotCardClose() {
  expandedSpotId.value = null;
}

// "Auf Karte anzeigen"-Button (Mini- wie aufgeklappte Karte, siehe SpotCard.vue) – schrumpft das
// Sheet auf "angeschnitten" (Google-Maps-Stil, genug sichtbare Kartenfläche für den fokussierten
// Punkt) UND zentriert/vergrößert den Pin (drawers.openMapAt), unabhängig vom Aufklapp-Zustand der
// Karte selbst.
function onSpotShowOnMap(spot: Spot) {
  sheetState.value = 'partial';
  drawers.openMapAt(`spot-${spot.id}`);
}

// Ein Tag-/Ausflug-Fokus (ScheduleView.vue's "🗺️ Tag auf Karte anzeigen" bzw. ExcursionCard.vue's
// "Auf Karte anzeigen") lässt TripMap.vue mobil die Stationen-Liste hierher in die Schublade
// teleportieren (siehe #map-focus-dock unten) statt sie als Overlay über die Karte zu legen – bei
// eingeklapptem Sheet wäre sie dann aber unsichtbar, deshalb hier automatisch mindestens
// "angeschnitten" aufklappen.
watch(
  () =>
    drawers.mapFocusDate ??
    (drawers.mapFocusExcursionId != null ? `excursion-${drawers.mapFocusExcursionId}` : null),
  (focus) => {
    if (focus != null && sheetState.value === 'collapsed') sheetState.value = 'partial';
  }
);

// Live-Vorschau (Titel/echtes Foto statt nur des Kartenausschnitts, siehe backend/src/utils/
// mapsLink.ts's fetchPlacePreview()) - Best-effort, überschreibt nie bereits eingetippte Werte
// (z. B. wenn der Titel schon vor dem Maps-Link gesetzt wurde). Keine Kategorie-Erkennung: dafür
// gibt es ohne kostenpflichtige Places-API kein verlässliches Signal.
async function fetchSpotPreview(mapsLink: string, form: Ref<ReturnType<typeof emptySpotForm>>) {
  if (!mapsLink) return;
  try {
    const preview = await api.get<{ name: string | null; imageUrl: string | null }>(
      `/spots/preview?maps_link=${encodeURIComponent(mapsLink)}`
    );
    if (preview.name && !form.value.title.trim()) form.value.title = preview.name;
    if (preview.imageUrl && !form.value.image_url.trim()) form.value.image_url = preview.imageUrl;
  } catch {
    // Vorschau fehlgeschlagen - Formular bleibt normal (ohne Vorschau) nutzbar.
  }
}

function checkSpotMapsLink() {
  spotMapsLinkResolved.value = spotForm.value.maps_link
    ? parseLatLngFromMapsLink(spotForm.value.maps_link) != null
    : null;
  if (spotForm.value.maps_link) fetchSpotPreview(spotForm.value.maps_link, spotForm);
}
function checkEditSpotMapsLink() {
  editSpotMapsLinkResolved.value = editSpotForm.value.maps_link
    ? parseLatLngFromMapsLink(editSpotForm.value.maps_link) != null
    : null;
  if (editSpotForm.value.maps_link) fetchSpotPreview(editSpotForm.value.maps_link, editSpotForm);
}

function spotToBody(
  f: ReturnType<typeof emptySpotForm>,
  manual?: { lat: number; lng: number } | null
) {
  const parsed = parseLatLngFromMapsLink(f.maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    image_url: f.image_url || undefined,
    category: f.category || undefined,
    note: f.note && !isEmptyRichText(f.note) ? f.note : undefined,
    note_format: 'html' as const,
    maps_link: f.maps_link || undefined,
    lat: manual?.lat ?? parsed?.lat,
    lng: manual?.lng ?? parsed?.lng,
    is_home: f.is_home,
    address: f.address || undefined,
    start_date: f.start_date || undefined,
    end_date: f.end_date || undefined,
    checkin: f.checkin || undefined,
    checkout: f.checkout || undefined,
    contact: f.contact || undefined,
    amount: f.amount ? Number(f.amount) : undefined,
    paid_by_user_id: f.paid_by_user_id
      ? Number(f.paid_by_user_id)
      : f.amount
        ? users.value.length === 1
          ? users.value[0].id
          : (auth.user?.id ?? undefined)
        : undefined,
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
  newSpotDraft.clear();
}

// Alle Tour-Titel als Vorschläge für die "Tour zuordnen"-Combobox (TourAssignPicker.vue).
const allTourTitles = computed(() => excursionsStore.excursions.map((e) => e.title));

function tourTitlesFor(spotId: number): string[] {
  return excursionsStore.excursions.filter((e) => e.spot_ids.includes(spotId)).map((e) => e.title);
}

// Gleicht die Tour-Zuordnung eines Spots mit den im Formular gewählten Titeln ab (TourAssignPicker.
// vue) – läuft NACH dem eigentlichen Spot-Speichern, braucht dessen id. Ein Titel, der zu einer
// bestehenden Tour passt (case-insensitiv), hängt den Spot dort an; ein neuer Titel legt beim
// Speichern eine neue Tour mit genau diesem einen Spot an (creatable, analog zur Kategorie-
// Combobox). Ein Titel, der entfernt wurde, löst nur die Zuordnung, nicht die Tour selbst.
async function syncSpotTours(spotId: number, desiredTitles: string[]) {
  const desiredLower = desiredTitles.map((t) => t.toLowerCase());
  for (const tour of excursionsStore.excursions.filter((e) => e.spot_ids.includes(spotId))) {
    if (!desiredLower.includes(tour.title.toLowerCase())) {
      await excursionsStore.update(tour.id, {
        title: tour.title,
        image_url: tour.image_url ?? undefined,
        note: tour.note ?? undefined,
        date: tour.date ?? undefined,
        spot_ids: tour.spot_ids.filter((id) => id !== spotId),
      });
    }
  }
  for (const title of desiredTitles) {
    const existing = excursionsStore.excursions.find(
      (e) => e.title.toLowerCase() === title.toLowerCase()
    );
    if (!existing) {
      await excursionsStore.create({ title, spot_ids: [spotId] });
    } else if (!existing.spot_ids.includes(spotId)) {
      await excursionsStore.update(existing.id, {
        title: existing.title,
        image_url: existing.image_url ?? undefined,
        note: existing.note ?? undefined,
        date: existing.date ?? undefined,
        spot_ids: [...existing.spot_ids, spotId],
      });
    }
  }
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
  await syncSpotTours(result.id, spotForm.value.tourTitles);
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
    is_home: !!spot.is_home,
    address: spot.address ?? '',
    start_date: spot.start_date ?? '',
    end_date: spot.end_date ?? '',
    checkin: spot.checkin ?? '',
    checkout: spot.checkout ?? '',
    contact: spot.contact ?? '',
    amount: spot.amount != null ? String(spot.amount) : '',
    paid_by_user_id: spot.paid_by_user_id != null ? String(spot.paid_by_user_id) : '',
    tourTitles: tourTitlesFor(spot.id),
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
  await syncSpotTours(editingSpot.value.id, editSpotForm.value.tourTitles);
  editSpotLocationError.value = false;
  editSpotDraft.clear();
  editingSpot.value = null;
}

function closeEditSpotForm() {
  editSpotDraft.clear();
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
    <h1 class="page-title" :ref="setPageTitleRef">
      <AppIcon :icon="SECTION_ICON_DEFS.map" :size="22" group="navigation" /> Karte
    </h1>
    <div class="layout" :style="{ '--spots-col-width': spotsColWidth + 'px' }">
      <div ref="sheetEl" class="spots-col" :class="[sheetState, { dragging: sheetDragging }]">
        <div class="sheet-handle-row">
          <IconButton
            variant="secondary"
            shape="circle"
            size="sm"
            class="sheet-step-btn"
            :disabled="!canExpandSheet"
            :icon="ACTION_ICONS.chevronUp"
            aria-label="Spots-Liste weiter hochschieben"
            title="Hochschieben"
            @click="stepSheet(1)"
          />
          <div
            class="sheet-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Spots-Liste ein-/ausklappen"
            @pointerdown="onSheetDragStart"
          >
            <span class="sheet-grip" aria-hidden="true"></span>
            <span class="sheet-summary">
              <AppIcon :icon="FORM_FIELD_ICONS.location" :size="13" group="formFields" />
              {{ filteredSpotItems.length }} {{ filteredSpotItems.length === 1 ? 'Ort' : 'Orte' }}
            </span>
          </div>
          <IconButton
            variant="secondary"
            shape="circle"
            size="sm"
            class="sheet-step-btn"
            :disabled="!canCollapseSheet"
            :icon="ACTION_ICONS.chevronDown"
            aria-label="Spots-Liste weiter runterschieben"
            title="Runterschieben"
            @click="stepSheet(-1)"
          />
        </div>
        <div
          class="spots-col-body"
          ref="spotsColBodyEl"
          :style="{ '--category-nav-clearance': `${categoryNavHeight}px` }"
          @pointerdown="onSheetBodyPointerDown"
        >
          <!-- Sprungziel für TripMap.vue's Tag-/Ausflug-Stationen-Liste: mobil (siehe TripMap.vue's
           Teleport) landet sie hier statt als Overlay über der Karte zu schweben (verdeckte dort
           Kartenausschnitt und teils die Zoom-Steuerung). Auf Desktop bleibt sie unverändert Teil
           der Karte-Spalte (Teleport dort deaktiviert), dieser Anker bleibt also leer. -->
          <div id="map-focus-dock" class="map-focus-dock"></div>
          <div class="header">
            <h2>
              <AnimatedText
                :text="groupMode === 'tours' ? 'Touren' : 'Spots'"
                :options="['Spots', 'Touren']"
                :direction="groupMode === 'tours' ? 'up' : 'down'"
              />
              <!-- Der frühere, immer sichtbare Erklärtext nahm spürbar Platz weg, v. a. auf mobile
               (Nutzer-Feedback) - jetzt hinter einem Info-Button versteckt, gleiches
               Popover-Muster (Backdrop + .picker-menu) wie die Kategorie-/Status-Filter unten statt
               eines neuen Tooltip-Mechanismus. -->
              <span class="dropdown info-dropdown">
                <button
                  ref="descriptionBtnRef"
                  type="button"
                  class="info-btn"
                  :title="groupMode === 'tours' ? 'Was sind Touren?' : 'Was sind Spots?'"
                  :aria-label="groupMode === 'tours' ? 'Was sind Touren?' : 'Was sind Spots?'"
                  @click="toggleDescription($event)"
                >
                  <AppIcon :icon="ACTION_ICONS.info" :size="16" group="actions" />
                </button>
                <Teleport to="body">
                  <template v-if="descriptionOpen">
                    <div class="picker-backdrop" @click="descriptionOpen = false"></div>
                    <div class="picker-menu description-popover" :style="descriptionMenuStyle">
                      <template v-if="groupMode === 'tours'">
                        <p>
                          <strong>Touren</strong> fassen mehrere Spots zu einer gemeinsamen Route
                          oder einem Tagesausflug zusammen. Eignet sich bspw. auch, um An- oder
                          Abreise auf der Karte zu visualisieren.
                        </p>
                        <p class="popover-tip">
                          💡 <strong>Tipp:</strong> Klicke auf eine Tour-Kachel, um deren Route und
                          Wege auf der Karte anzuzeigen.
                        </p>
                      </template>
                      <template v-else>
                        <p>
                          <strong>Spots</strong> sind einzelne Orte (Restaurants,
                          Sehenswürdigkeiten, Strände, …) – als Ideensammlung oder zur Reiseplanung.
                        </p>
                        <p class="popover-tip">
                          💡 <strong>Tipp:</strong> Ziehe eine Spot-Karte direkt auf einen
                          Kalendertag oder eine Tour, um sie einzutakten.
                        </p>
                      </template>
                    </div>
                  </template>
                </Teleport>
              </span>
              <!-- #155: der Spots/Touren-Umschalter saß bisher als "Gruppieren"-Zeile in der grünen
               .filter-bar weiter unten (siehe dortiger Kommentar-Rest) - direkt neben der
               Drawer-Überschrift ist er als primäre Weiche dieser Ansicht (bestimmt sowohl den
               Überschriftstext oben als auch den Hinzufügen-Button rechts) besser aufgehoben. -->
              <SegmentedToggle
                v-model="groupMode"
                :options="[
                  {
                    value: 'category',
                    label: 'Spots',
                    icon: FORM_FIELD_ICONS.category,
                    iconGroup: 'formFields',
                    dot: liveSync.hasUnseen('spots'),
                  },
                  {
                    value: 'tours',
                    label: 'Touren',
                    icon: SECTION_ICON_DEFS.excursions,
                    iconGroup: 'navigation',
                    dot: liveSync.hasUnseen('ideas'),
                  },
                ]"
              />
            </h2>
            <div class="header-actions">
              <Button
                class="add-button"
                :aria-label="groupMode === 'tours' ? 'Neue Tour' : 'Neuer Spot'"
                @click="groupMode === 'tours' ? openExcursionForm() : (showSpotForm = true)"
              >
                <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" />
                <span class="add-button__label">
                  <AnimatedText
                    :text="groupMode === 'tours' ? 'Neue Tour' : 'Neuer Spot'"
                    :options="['Neuer Spot', 'Neue Tour']"
                    :direction="groupMode === 'tours' ? 'up' : 'down'"
                  />
                </span>
              </Button>
            </div>
            <!-- Zweiter Einstiegspunkt zum ⏺️/⏹️-Button auf TripMap.vue (Start dort mit Sichtbarkeits-
               Auswahl/Tour-Kopplung): der Karten-Button steckt in einer bereits vollen
               Button-Spalte, die auf Mobil beim Standard-Sheet-Zustand teils vom Bottom-Sheet
               verdeckt wird (siehe dortiger CSS-Kommentar zu .share-location-btn) - "Standort
               aufzeichnen" ist aber gerade das unterwegs/mobil wichtigste neue Kern-Feature, braucht
               daher einen immer erreichbaren zweiten Zugang (siehe DESIGN.md, Abschnitt "Desktop UND
               Mobile"). Startet direkt privat/ungekoppelt statt eines eigenen Menüs - Teilen/Tour-
               Kopplung bleiben über den Karten-Button bzw. den Sichtbarkeits-Umschalter in der
               Aufzeichnungen-Liste erreichbar. -->
          </div>
          <div class="subheader">
            <Button
              type="button"
              variant="secondary"
              class="record-button"
              :class="{ recording: trackRecording.recording }"
              @click="onRecordButtonClick"
            >
              <AppIcon
                :icon="
                  trackRecording.recording ? ACTION_ICONS.recordStop : ACTION_ICONS.recordStart
                "
                :size="15"
                group="actions"
              />
              {{ trackRecording.recording ? 'Aufzeichnung beenden' : 'Weg Aufzeichnen' }}
            </Button>
          </div>

          <!-- Standort-Aufzeichnungen (stores/tracks.ts): eigene, geteilte und mit anderen geteilte
           Tracks - Start/Stop selbst passiert auf der Karte (TripMap.vue's ⏺️-Button), hier nur die
           Übersicht + nachträgliches Teilen/Löschen. Eingeklappt per Default, damit die für die
           meiste Zeit relevantere Spots-Liste nicht verdrängt wird - genau wie .filter-bar oben. -->
          <div class="tracks-section" v-if="tracksStore.tracks.length">
            <button
              type="button"
              class="tracks-toggle"
              :aria-expanded="tracksSectionOpen"
              @click="tracksSectionOpen = !tracksSectionOpen"
            >
              <span class="tracks-toggle-label">
                <AppIcon :icon="ACTION_ICONS.history" :size="15" group="actions" /> Aufzeichnungen
                ({{ tracksStore.tracks.length }})
              </span>
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !tracksSectionOpen }"
              />
            </button>
            <ul v-if="tracksSectionOpen" class="tracks-list">
              <li
                v-for="track in tracksStore.tracks"
                :key="track.id"
                class="track-row"
                :class="{ active: Number(drawers.mapFocusTrackId) === Number(track.id) }"
              >
                <button
                  type="button"
                  class="track-row-main"
                  @click="drawers.openMapForTrack(track.id)"
                >
                  <span class="track-row-title">{{ trackTitle(track) }}</span>
                  <span class="track-row-meta">
                    <span v-if="!track.ended_at">
                      <AppIcon :icon="ACTION_ICONS.recordStart" :size="12" group="actions" /> läuft
                    </span>
                    <span v-else-if="trackDurationLabel(track)">
                      <AppIcon :icon="ACTION_ICONS.duration" :size="12" group="actions" />
                      {{ trackDurationLabel(track) }}
                    </span>
                  </span>
                </button>
                <template v-if="track.user_id === auth.user?.id">
                  <button
                    type="button"
                    class="track-icon-btn"
                    :title="
                      track.visibility === 'shared'
                        ? 'Für alle Mitreisenden sichtbar – antippen, um wieder privat zu machen'
                        : 'Nur für dich sichtbar – antippen, um mit allen zu teilen'
                    "
                    :aria-label="
                      track.visibility === 'shared' ? 'Teilen zurücknehmen' : 'Mit allen teilen'
                    "
                    @click="toggleTrackVisibility(track)"
                  >
                    <AppIcon
                      :icon="
                        track.visibility === 'shared' ? ACTION_ICONS.shared : ACTION_ICONS.private
                      "
                      :size="15"
                      group="actions"
                    />
                  </button>
                  <button
                    type="button"
                    class="track-icon-btn"
                    title="Aufzeichnung löschen"
                    aria-label="Aufzeichnung löschen"
                    @click="removeTrack(track.id)"
                  >
                    <AppIcon :icon="ACTION_ICONS.delete" :size="15" group="actions" />
                  </button>
                </template>
              </li>
            </ul>
          </div>

          <!-- Touren-Formular: für BEIDE Gruppierungen ("Touren" und "Reise") dasselbe Modal/Modell -
           der aufklappbare Transportmittel-Abschnitt (#176) macht aus einer normalen Tour bei
           Bedarf eine ehemalige Reise-Etappe, siehe Konzept-Entscheidung in Issue #68/#176. -->
          <Modal
            :model-value="showExcursionForm"
            title="Neue Tour"
            full-height
            @update:model-value="(v) => !v && closeExcursionForm()"
          >
            <form class="edit-form" @submit.prevent="addExcursion">
              <CoverImagePicker
                v-model="excursionForm.image_url"
                :placeholder-icon="SECTION_ICON_DEFS.excursions"
                modal-title="Tour-Bild bearbeiten"
              />
              <FormField icon="title" label="Titel">
                <input v-model="excursionForm.title" type="text" placeholder="Titel" required />
              </FormField>
              <FormField icon="note" label="Notiz">
                <RichTextEditor
                  v-model="excursionForm.note"
                  placeholder="Notiz (optional)"
                  compact
                  expandable
                />
              </FormField>
              <FormField icon="date" label="Datum (optional – sonst „In Planung“)">
                <input v-model="excursionForm.date" type="date" />
              </FormField>
              <fieldset class="collapsible-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showExcursionTransportSection"
                    @click="showExcursionTransportSection = !showExcursionTransportSection"
                  >
                    <span>
                      <AppIcon :icon="ACTION_ICONS.recordStart" :size="14" group="actions" />
                      Transportmittel (Anreise/Abreise/Weiterreise/Fahrt)
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showExcursionTransportSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showExcursionTransportSection" class="collapsible-content">
                  <FormField icon="category" label="Art">
                    <select v-model="excursionForm.transport_type">
                      <option v-for="t in TRANSPORT_TYPE_OPTIONS" :key="t" :value="t">
                        {{ travelTypeIcon(t) }} {{ t }}
                      </option>
                    </select>
                  </FormField>
                  <FormField icon="tour" label="Rolle (für Karten-Urlaubsfokus)">
                    <select v-model="excursionForm.role">
                      <option value="">– keine (nur Transportmittel) –</option>
                      <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
                        {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{
                          TRAVEL_ROLE_META[r].hint
                        }})
                      </option>
                    </select>
                  </FormField>
                  <div class="row">
                    <FormField icon="location" label="Von">
                      <select v-model="excursionForm.from_spot_id">
                        <option value="">– wählen –</option>
                        <option v-for="s in spotsStore.spots" :key="s.id" :value="String(s.id)">
                          {{ spotCategoryMeta(s.category).icon }} {{ s.title }}
                        </option>
                      </select>
                    </FormField>
                    <FormField icon="location" label="Nach">
                      <select v-model="excursionForm.to_spot_id">
                        <option value="">– wählen –</option>
                        <option v-for="s in spotsStore.spots" :key="s.id" :value="String(s.id)">
                          {{ spotCategoryMeta(s.category).icon }} {{ s.title }}
                        </option>
                      </select>
                    </FormField>
                  </div>
                  <p
                    v-if="
                      excursionForm.role &&
                      (!excursionForm.from_spot_id || !excursionForm.to_spot_id)
                    "
                    class="hint error"
                  >
                    <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Für
                    Anreise/Abreise/Weiterreise werden Von und Nach benötigt (beide als Spot
                    anlegen, falls noch nicht vorhanden).
                  </p>
                  <div class="row">
                    <FormField icon="time" label="Abfahrt/Abflug">
                      <input v-model="excursionForm.departure_time" type="time" />
                    </FormField>
                    <FormField icon="time" label="Ankunft">
                      <input v-model="excursionForm.arrival_time" type="time" />
                    </FormField>
                  </div>
                  <FormField icon="note" label="Vorher da sein">
                    <input
                      v-model="excursionForm.checkin_info"
                      type="text"
                      placeholder="z. B. 2 Stunden vorher / Check-in ab 10:00"
                    />
                  </FormField>
                  <div class="row">
                    <FormField icon="amount" label="Kosten">
                      <input
                        v-model="excursionForm.amount"
                        type="number"
                        step="0.01"
                        placeholder="optional"
                      />
                    </FormField>
                    <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
                      <select v-model="excursionForm.paid_by_user_id">
                        <option value="">–</option>
                        <option v-for="u in users" :key="u.id" :value="String(u.id)">
                          {{ u.avatar }} {{ u.username }}
                        </option>
                      </select>
                    </FormField>
                  </div>
                  <p
                    v-if="
                      users.length > 1 && excursionForm.amount && !excursionForm.paid_by_user_id
                    "
                    class="hint"
                  >
                    Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
                  </p>
                  <div class="row">
                    <FormField icon="note" label="Gepäck">
                      <input
                        v-model="excursionForm.luggage"
                        type="text"
                        placeholder="z. B. 1x Koffer 23kg, 1x Handgepäck"
                      />
                    </FormField>
                    <FormField icon="note" label="Sitzplatz">
                      <input v-model="excursionForm.seat" type="text" placeholder="z. B. 12A" />
                    </FormField>
                  </div>
                  <FormField icon="link" label="Link (Buchung/Check-in)">
                    <input v-model="excursionForm.ticket_link" type="url" />
                  </FormField>
                </div>
              </fieldset>
              <fieldset
                v-if="!excursionForm.transportEnabled && spotsStore.spots.length"
                class="collapsible-fieldset"
              >
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showExcursionSpotsSection"
                    @click="showExcursionSpotsSection = !showExcursionSpotsSection"
                  >
                    <span>
                      <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
                      Spots zuordnen
                      <span v-if="excursionForm.spot_ids.length" class="picker-count">
                        ({{ excursionForm.spot_ids.length }} zugeordnet)</span
                      >
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showExcursionSpotsSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showExcursionSpotsSection" class="collapsible-content">
                  <SpotOrderPicker
                    v-model="excursionForm.spot_ids"
                    :spots="spotsStore.spots"
                    :like-count="spotsStore.likeCountFor"
                  />
                </div>
              </fieldset>
              <DraftStatusBar
                :status="newExcursionDraft.status.value"
                :restored="newExcursionDraft.restored.value"
              />
              <Button type="submit">Hinzufügen</Button>
            </form>
          </Modal>

          <Modal
            :model-value="editingExcursion !== null"
            title="Tour bearbeiten"
            full-height
            @update:model-value="(v) => !v && closeEditExcursionForm()"
          >
            <form class="edit-form" @submit.prevent="submitEditExcursion">
              <CoverImagePicker
                v-model="editExcursionForm.image_url"
                :placeholder-icon="SECTION_ICON_DEFS.excursions"
                modal-title="Tour-Bild bearbeiten"
              />
              <FormField icon="title" label="Titel">
                <input v-model="editExcursionForm.title" type="text" placeholder="Titel" required />
              </FormField>
              <FormField icon="note" label="Notiz">
                <RichTextEditor
                  v-model="editExcursionForm.note"
                  placeholder="Notiz (optional)"
                  compact
                  expandable
                />
              </FormField>
              <FormField icon="date" label="Datum (optional – sonst „In Planung“)">
                <input v-model="editExcursionForm.date" type="date" />
              </FormField>
              <fieldset class="collapsible-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showEditExcursionTransportSection"
                    @click="showEditExcursionTransportSection = !showEditExcursionTransportSection"
                  >
                    <span>
                      <AppIcon :icon="ACTION_ICONS.recordStart" :size="14" group="actions" />
                      Transportmittel (Anreise/Abreise/Weiterreise/Fahrt)
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showEditExcursionTransportSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showEditExcursionTransportSection" class="collapsible-content">
                  <FormField icon="category" label="Art">
                    <select v-model="editExcursionForm.transport_type">
                      <option v-for="t in TRANSPORT_TYPE_OPTIONS" :key="t" :value="t">
                        {{ travelTypeIcon(t) }} {{ t }}
                      </option>
                    </select>
                  </FormField>
                  <FormField icon="tour" label="Rolle (für Karten-Urlaubsfokus)">
                    <select v-model="editExcursionForm.role">
                      <option value="">– keine (nur Transportmittel) –</option>
                      <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
                        {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{
                          TRAVEL_ROLE_META[r].hint
                        }})
                      </option>
                    </select>
                  </FormField>
                  <div class="row">
                    <FormField icon="location" label="Von">
                      <select v-model="editExcursionForm.from_spot_id">
                        <option value="">– wählen –</option>
                        <option v-for="s in spotsStore.spots" :key="s.id" :value="String(s.id)">
                          {{ spotCategoryMeta(s.category).icon }} {{ s.title }}
                        </option>
                      </select>
                    </FormField>
                    <FormField icon="location" label="Nach">
                      <select v-model="editExcursionForm.to_spot_id">
                        <option value="">– wählen –</option>
                        <option v-for="s in spotsStore.spots" :key="s.id" :value="String(s.id)">
                          {{ spotCategoryMeta(s.category).icon }} {{ s.title }}
                        </option>
                      </select>
                    </FormField>
                  </div>
                  <p
                    v-if="
                      editExcursionForm.role &&
                      (!editExcursionForm.from_spot_id || !editExcursionForm.to_spot_id)
                    "
                    class="hint error"
                  >
                    <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Für
                    Anreise/Abreise/Weiterreise werden Von und Nach benötigt (beide als Spot
                    anlegen, falls noch nicht vorhanden).
                  </p>
                  <div class="row">
                    <FormField icon="time" label="Abfahrt/Abflug">
                      <input v-model="editExcursionForm.departure_time" type="time" />
                    </FormField>
                    <FormField icon="time" label="Ankunft">
                      <input v-model="editExcursionForm.arrival_time" type="time" />
                    </FormField>
                  </div>
                  <FormField icon="note" label="Vorher da sein">
                    <input
                      v-model="editExcursionForm.checkin_info"
                      type="text"
                      placeholder="z. B. 2 Stunden vorher / Check-in ab 10:00"
                    />
                  </FormField>
                  <div class="row">
                    <FormField icon="amount" label="Kosten">
                      <input
                        v-model="editExcursionForm.amount"
                        type="number"
                        step="0.01"
                        placeholder="optional"
                      />
                    </FormField>
                    <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
                      <select v-model="editExcursionForm.paid_by_user_id">
                        <option value="">–</option>
                        <option v-for="u in users" :key="u.id" :value="String(u.id)">
                          {{ u.avatar }} {{ u.username }}
                        </option>
                      </select>
                    </FormField>
                  </div>
                  <p
                    v-if="
                      users.length > 1 &&
                      editExcursionForm.amount &&
                      !editExcursionForm.paid_by_user_id
                    "
                    class="hint"
                  >
                    Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
                  </p>
                  <div class="row">
                    <FormField icon="note" label="Gepäck">
                      <input
                        v-model="editExcursionForm.luggage"
                        type="text"
                        placeholder="z. B. 1x Koffer 23kg, 1x Handgepäck"
                      />
                    </FormField>
                    <FormField icon="note" label="Sitzplatz">
                      <input v-model="editExcursionForm.seat" type="text" placeholder="z. B. 12A" />
                    </FormField>
                  </div>
                  <FormField icon="link" label="Link (Buchung/Check-in)">
                    <input v-model="editExcursionForm.ticket_link" type="url" />
                  </FormField>
                </div>
              </fieldset>
              <fieldset
                v-if="!editExcursionForm.transportEnabled && spotsStore.spots.length"
                class="collapsible-fieldset"
              >
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showEditExcursionSpotsSection"
                    @click="showEditExcursionSpotsSection = !showEditExcursionSpotsSection"
                  >
                    <span>
                      <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
                      Spots zuordnen
                      <span v-if="editExcursionForm.spot_ids.length" class="picker-count">
                        ({{ editExcursionForm.spot_ids.length }} zugeordnet)</span
                      >
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showEditExcursionSpotsSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showEditExcursionSpotsSection" class="collapsible-content">
                  <SpotOrderPicker
                    v-model="editExcursionForm.spot_ids"
                    :spots="spotsStore.spots"
                    :like-count="spotsStore.likeCountFor"
                  />
                </div>
              </fieldset>
              <FileAttachments
                v-if="editingExcursion"
                domain="ideas"
                :entity-id="editingExcursion"
              />
              <DraftStatusBar
                :status="editExcursionDraft.status.value"
                :restored="editExcursionDraft.restored.value"
              />
              <Button type="submit">Speichern</Button>
            </form>
          </Modal>

          <div class="filter-bar" v-if="filterCategoryOptions.length">
            <SearchFilterBar
              v-model:search-query="searchQuery"
              v-model:sort-mode="sortMode"
              v-model:category-filter="categoryFilter"
              v-model:status-filter="statusFilter"
              :category-options="filterCategoryOptions"
              search-placeholder="Spots oder Touren suchen..."
            />

            <div class="filter-chips" v-if="categoryFilter.length || statusFilter.length">
              <span v-for="cat in categoryFilter" :key="cat" class="filter-chip">
                <AppIcon :icon="groupIconDef(cat)" :size="13" group="categories" /> {{ cat }}
                <IconButton
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  aria-label="Filter entfernen"
                  title="Filter entfernen"
                  @click="removeCategoryFilter(cat)"
                />
              </span>
              <span v-for="status in statusFilter" :key="status" class="filter-chip">
                <AppIcon :icon="STATUS_FILTER_ICON[status]" :size="13" group="actions" />
                {{ STATUS_FILTER_LABEL[status] }}
                <IconButton
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  aria-label="Filter entfernen"
                  title="Filter entfernen"
                  @click="removeStatusFilter(status)"
                />
              </span>
            </div>
          </div>

          <Modal
            :model-value="showSpotForm"
            title="Neuer Spot"
            full-height
            @update:model-value="(v) => !v && closeSpotForm()"
          >
            <form class="edit-form" @submit.prevent="addSpot">
              <CoverImagePicker
                v-model="spotForm.image_url"
                :preview-image="spotPreviewImage"
                :placeholder-icon="groupIconDef(spotForm.category)"
                modal-title="Spot-Bild bearbeiten"
              />
              <FormField icon="title" label="Titel">
                <input v-model="spotForm.title" type="text" placeholder="Titel" required />
              </FormField>
              <FormField icon="category" label="Kategorie">
                <Combobox
                  v-model="spotForm.category"
                  :options="spotCategoryOptions"
                  :icon-def-for="(c) => spotCategoryMeta(c).tabler"
                  :color-for="(c) => spotCategoryMeta(c).color"
                  placeholder="Kategorie (optional, z. B. Restaurant – oder eigene erstellen)"
                />
              </FormField>
              <template v-if="spotForm.category === 'Unterkunft'">
                <FormField icon="location" label="Adresse">
                  <input v-model="spotForm.address" type="text" placeholder="Adresse (optional)" />
                </FormField>
                <div class="row">
                  <FormField icon="date" label="Check-in-Datum">
                    <input v-model="spotForm.start_date" type="date" />
                  </FormField>
                  <FormField icon="date" label="Check-out-Datum">
                    <input v-model="spotForm.end_date" type="date" />
                  </FormField>
                </div>
                <div class="row">
                  <FormField icon="time" label="Check-in-Zeit">
                    <input
                      v-model="spotForm.checkin"
                      type="text"
                      placeholder="Check-in (z. B. 15:00)"
                    />
                  </FormField>
                  <FormField icon="time" label="Check-out-Zeit">
                    <input
                      v-model="spotForm.checkout"
                      type="text"
                      placeholder="Check-out (z. B. 11:00)"
                    />
                  </FormField>
                </div>
                <FormField icon="contact" label="Kontakt">
                  <input
                    v-model="spotForm.contact"
                    type="text"
                    placeholder="Kontakt (Telefon/E-Mail/Text, optional)"
                  />
                </FormField>
                <div class="row">
                  <FormField icon="amount" label="Kosten">
                    <input
                      v-model="spotForm.amount"
                      type="number"
                      step="0.01"
                      placeholder="Kosten (€, optional)"
                    />
                  </FormField>
                  <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
                    <select v-model="spotForm.paid_by_user_id">
                      <option value="">Bezahlt von –</option>
                      <option v-for="u in users" :key="u.id" :value="String(u.id)">
                        {{ u.avatar }} {{ u.username }}
                      </option>
                    </select>
                  </FormField>
                </div>
              </template>
              <fieldset class="collapsible-fieldset location-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showSpotLocationSection"
                    @click="showSpotLocationSection = !showSpotLocationSection"
                  >
                    <span>
                      <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
                      Standort (optional)
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showSpotLocationSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showSpotLocationSection" class="collapsible-content">
                  <p class="hint">
                    Wird für die Position auf der Karte und ggf. das Wetter vor Ort verwendet.
                  </p>
                  <label class="checkbox-option">
                    <input type="checkbox" v-model="spotForm.is_home" />
                    <AppIcon :icon="ACTION_ICONS.home" :size="14" group="actions" /> Heimat-Seite
                    (z. B. der heimische Flughafen/Bahnhof/Zuhause für Reise-Etappen)
                  </label>
                  <FormField icon="maps" label="Maps-Link (Google/Apple)">
                    <input
                      v-model="spotForm.maps_link"
                      type="url"
                      placeholder="Maps-Link (Google/Apple) (optional)"
                      @blur="checkSpotMapsLink"
                    />
                  </FormField>
                  <p v-if="spotMapsLinkResolved === true" class="hint success">
                    <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort
                    erkannt – erscheint auf der Karte
                  </p>
                  <p v-if="spotMapsLinkResolved === false" class="hint">
                    Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks
                    funktionieren).
                  </p>
                  <p v-if="spotLocationError" class="hint error">
                    <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort
                    konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte,
                    um ihn manuell zu setzen.
                  </p>
                  <fieldset class="collapsible-fieldset">
                    <legend>
                      <Button
                        type="button"
                        variant="ghost"
                        class="collapsible-toggle picker-toggle"
                        :aria-expanded="spotPickerOpen"
                        @click="spotPickerOpen = !spotPickerOpen"
                      >
                        <span>
                          <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" />
                          Standort manuell setzen
                        </span>
                        <AppIcon
                          :icon="ACTION_ICONS.chevronDown"
                          :size="14"
                          group="actions"
                          class="caret"
                          :class="{ closed: !spotPickerOpen }"
                        />
                      </Button>
                    </legend>
                    <div v-if="spotPickerOpen" class="collapsible-content">
                      <LocationPicker
                        v-model="spotManualPin"
                        :center="spotPickerCenter"
                        :reference-points="spotReferencePoints"
                      />
                    </div>
                  </fieldset>
                </div>
              </fieldset>
              <FormField icon="note" label="Notiz">
                <RichTextEditor
                  v-model="spotForm.note"
                  placeholder="Notiz (optional)"
                  compact
                  expandable
                />
              </FormField>
              <fieldset class="collapsible-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showSpotToursSection"
                    @click="showSpotToursSection = !showSpotToursSection"
                  >
                    <span>
                      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" />
                      Touren zuordnen
                      <span v-if="spotForm.tourTitles.length" class="picker-count">
                        ({{ spotForm.tourTitles.length }} zugeordnet)</span
                      >
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showSpotToursSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showSpotToursSection" class="collapsible-content">
                  <TourAssignPicker
                    v-model="spotForm.tourTitles"
                    :tour-options="allTourTitles"
                    :category="spotForm.category"
                    :is-home="spotForm.is_home"
                  />
                </div>
              </fieldset>
              <DraftStatusBar
                :status="newSpotDraft.status.value"
                :restored="newSpotDraft.restored.value"
              />
              <Button type="submit">Hinzufügen</Button>
            </form>
          </Modal>

          <div
            v-if="spotGroups.length > 1"
            class="category-nav-sentinel"
            :ref="setCategoryNavSentinelRef"
          ></div>
          <div
            class="category-nav-wrap"
            v-if="spotGroups.length > 1"
            :class="{ 'is-stuck': isCategoryNavStuck }"
          >
            <nav
              class="category-nav"
              aria-label="Zu Kategorie springen"
              :ref="setCategoryNavRef"
              @scroll="updateNavArrows"
            >
              <button
                v-for="grp in spotGroups"
                :key="grp.category"
                type="button"
                class="category-nav-item"
                :class="{ active: activeCategory === grp.category }"
                :aria-current="activeCategory === grp.category ? 'true' : undefined"
                :ref="(el) => setNavItemRef(grp.category, el)"
                @click="scrollToCategory(grp.category)"
              >
                <AppIcon
                  class="category-nav-icon"
                  :icon="grp.iconDef"
                  group="categories"
                  :color="groupIconColor(grp)"
                />
                <span class="category-nav-label">{{ grp.category }}</span>
              </button>
              <span
                class="category-nav-underline"
                :style="{
                  transform: `translateX(${underlineLeft}px)`,
                  width: `${underlineWidth}px`,
                }"
                aria-hidden="true"
              ></span>
            </nav>
            <!-- Dezente Klick-Flächen statt eines sichtbaren nativen Scrollbalkens (#144, siehe
             .category-nav's scrollbar-width/::-webkit-scrollbar-Reset im CSS) - nur sichtbar, wenn in
             die jeweilige Richtung tatsächlich noch etwas zu scrollen ist (canScrollNavLeft/Right,
             live nachgeführt per @scroll/ResizeObserver/spotGroups-Watcher im Script). -->
            <button
              v-if="canScrollNavLeft"
              type="button"
              class="category-nav-arrow left"
              aria-label="Kategorien nach links scrollen"
              @click="scrollNavBy(-1)"
            >
              <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
            </button>
            <button
              v-if="canScrollNavRight"
              type="button"
              class="category-nav-arrow right"
              aria-label="Kategorien nach rechts scrollen"
              @click="scrollNavBy(1)"
            >
              <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
            </button>
          </div>

          <section class="group category-group" v-for="grp in spotGroups" :key="grp.category">
            <ExcursionCard
              v-if="grp.excursion"
              :ref="(el) => setCategoryRef(grp.category, el)"
              class="tour-group-card"
              :excursion="grp.excursion"
              :highlighted="highlightedIds.has(grp.excursion.id)"
              :creator-label="creatorLabel(grp.excursion.created_by)"
              :like-count="excursionLikesFor(grp.excursion.id).length"
              :liked="excursionLikedByMe(grp.excursion.id)"
              :comments="excursionCommentItemsFor(grp.excursion.id)"
              :stations="spotsStore.spots"
              :travel-items="travelItems"
              :expanded="expandedExcursionId === grp.excursion.id"
              @edit="startEditExcursion"
              @remove="removeExcursion"
              @toggle-like="toggleExcursionLike(grp.excursion.id)"
              @submit-comment="(content) => submitExcursionComment(grp.excursion!.id, content)"
              @remove-comment="removeExcursionComment"
              @drop-spot="(spotId) => addSpotToExcursion(grp.excursion!.id, spotId)"
              @show-on-map="drawers.openMapForExcursion(grp.excursion.id)"
              @open="expandedExcursionId = grp.excursion.id"
              @close="expandedExcursionId = null"
            />
            <h3 v-else class="category-heading" :ref="(el) => setCategoryRef(grp.category, el)">
              <AppIcon :icon="grp.iconDef" group="categories" :color="groupIconColor(grp)" />
              {{ grp.category }}
            </h3>
            <!-- Tour-Gruppe: eingerückte, per gebogener gestrichelter SVG-Linie verbundene vertikale Liste
             statt des normalen Karten-Grids (siehe .tour-station-wrap/.tour-station-line unten, #100)
             - die Reihenfolge entspricht spotGroups' Sortierung nach der echten Tour-Reihenfolge
             (spot_ids), macht den Rundgang direkt sichtbar. Ersetzt die früheren Mini-Stations-Chips
             auf der ExcursionCard selbst (redundant, sobald die echten Spot-Karten direkt darunter
             erscheinen). Das Wrapper-Div (nur bei Touren-Gruppierung gebraucht) ist position:relative
             und dadurch offsetParent der Spot-Karten - recomputeTourLine() liest deren offsetTop/
             offsetHeight direkt relativ dazu aus (siehe dortiger Kommentar). -->
            <div
              class="tour-station-accordion"
              :class="{ 'is-expanded': !grp.excursion || expandedExcursionId === grp.excursion.id }"
              :inert="!!(grp.excursion && expandedExcursionId !== grp.excursion.id)"
            >
              <div class="tour-station-accordion-inner">
                <div
                  class="tour-station-wrap"
                  :class="{ 'is-tour': grp.excursion }"
                  :ref="(el) => grp.excursion && setTourWrapRef(grp.excursion.id, el)"
                >
                  <svg
                    v-if="grp.excursion && tourLines.get(grp.excursion.id)"
                    class="tour-station-line"
                    :width="tourLines.get(grp.excursion.id)!.width"
                    :height="tourLines.get(grp.excursion.id)!.height"
                    aria-hidden="true"
                  >
                    <path :d="tourLines.get(grp.excursion.id)!.pathD" />
                    <circle
                      v-for="(dot, i) in tourLines.get(grp.excursion.id)!.dots"
                      :key="i"
                      :cx="dot.x"
                      :cy="dot.y"
                      r="5"
                    />
                  </svg>
                  <TransitionGroup
                    tag="div"
                    name="list"
                    :class="grp.excursion ? 'tour-station-list' : 'grid cards'"
                  >
                    <template v-for="(item, index) in grp.items" :key="`spot-${item.spot.id}`">
                      <SpotCard
                        :ref="(el) => setSpotRef(item.spot.id, el)"
                        class="staggered-spot"
                        :style="[{ '--stagger-idx': index, '--stagger-total': grp.items.length }]"
                        :spot="item.spot"
                        :highlighted="highlightedIds.has(item.spot.id)"
                        :expanded="expandedSpotId === item.spot.id"
                        :scheduled-date="spotScheduledDates.get(item.spot.id) ?? null"
                        :creator-label="creatorLabel(item.spot.created_by)"
                        :payer-label="creatorLabel(item.spot.paid_by_user_id)"
                        :like-count="spotsStore.likeCountFor(item.spot.id)"
                        :liked="spotsStore.likedByMe(item.spot.id, auth.user?.id)"
                        :comments="spotCommentItemsFor(item.spot.id)"
                        :group-mode="groupMode"
                        :tour-options="allTourTitles"
                        :has-multiple-members="users.length > 1"
                        @edit="startEditSpot"
                        @remove="removeSpot"
                        @toggle-like="toggleSpotLike(item.spot.id)"
                        @submit-comment="(content) => submitSpotComment(item.spot.id, content)"
                        @remove-comment="removeSpotComment"
                        @open="onSpotCardOpen(item.spot)"
                        @close="onSpotCardClose"
                        @show-on-map="onSpotShowOnMap(item.spot)"
                        @assign-tour="(title) => assignSpotToTourTitle(item.spot.id, title)"
                      />
                    </template>
                  </TransitionGroup>
                </div>
              </div>
            </div>
            <!-- Zwei unterschiedliche Gründe für eine leere Gruppe: entweder ist der Tour wirklich noch
             kein Spot zugeordnet (grp.excursion.spot_ids selbst leer, unabhängig von Kategorie-/
             Status-Filter), oder es sind welche zugeordnet, aber der aktive Filter blendet sie
             gerade alle aus (grp.items kommt aus filteredSpotItems, spot_ids aus der Excursion
             selbst bleibt dabei unangetastet) - ohne diese Unterscheidung wirkte eine reine
             Filter-Situation fälschlich wie eine leere Tour. -->
            <p
              v-if="
                grp.excursion &&
                !grp.items.length &&
                grp.excursion.spot_ids.length &&
                (categoryFilter.length || statusFilter.length)
              "
              class="empty"
            >
              Die zugeordneten Spots sind gerade durch den Kategorie-/Status-Filter ausgeblendet –
              Filter zurücksetzen, um sie wieder zu sehen.
            </p>
            <p v-else-if="grp.excursion && !grp.items.length" class="empty">
              Noch keine Spots zugeordnet – ziehe eine Spot-Karte hierher oder wähle diese Tour beim
              Bearbeiten eines Spots über "Tour zuordnen".
            </p>
          </section>
          <p v-if="!spotGroups.length" class="empty">Noch keine Spots angelegt.</p>

          <Modal
            :model-value="editingSpot !== null"
            title="Spot bearbeiten"
            full-height
            @update:model-value="(v) => !v && closeEditSpotForm()"
          >
            <form class="edit-form" @submit.prevent="submitEditSpot">
              <CoverImagePicker
                v-model="editSpotForm.image_url"
                :preview-image="editSpotPreviewImage"
                :placeholder-icon="groupIconDef(editSpotForm.category)"
                modal-title="Spot-Bild bearbeiten"
              />
              <FormField icon="title" label="Titel">
                <input v-model="editSpotForm.title" type="text" placeholder="Titel" required />
              </FormField>
              <FormField icon="category" label="Kategorie">
                <Combobox
                  v-model="editSpotForm.category"
                  :options="spotCategoryOptions"
                  :icon-def-for="(c) => spotCategoryMeta(c).tabler"
                  :color-for="(c) => spotCategoryMeta(c).color"
                  placeholder="Kategorie (optional, z. B. Restaurant – oder eigene erstellen)"
                />
              </FormField>
              <template v-if="editSpotForm.category === 'Unterkunft'">
                <FormField icon="location" label="Adresse">
                  <input
                    v-model="editSpotForm.address"
                    type="text"
                    placeholder="Adresse (optional)"
                  />
                </FormField>
                <div class="row">
                  <FormField icon="date" label="Check-in-Datum">
                    <input v-model="editSpotForm.start_date" type="date" />
                  </FormField>
                  <FormField icon="date" label="Check-out-Datum">
                    <input v-model="editSpotForm.end_date" type="date" />
                  </FormField>
                </div>
                <div class="row">
                  <FormField icon="time" label="Check-in-Zeit">
                    <input
                      v-model="editSpotForm.checkin"
                      type="text"
                      placeholder="Check-in (z. B. 15:00)"
                    />
                  </FormField>
                  <FormField icon="time" label="Check-out-Zeit">
                    <input
                      v-model="editSpotForm.checkout"
                      type="text"
                      placeholder="Check-out (z. B. 11:00)"
                    />
                  </FormField>
                </div>
                <FormField icon="contact" label="Kontakt">
                  <input
                    v-model="editSpotForm.contact"
                    type="text"
                    placeholder="Kontakt (Telefon/E-Mail/Text, optional)"
                  />
                </FormField>
                <div class="row">
                  <FormField icon="amount" label="Kosten">
                    <input
                      v-model="editSpotForm.amount"
                      type="number"
                      step="0.01"
                      placeholder="Kosten (€, optional)"
                    />
                  </FormField>
                  <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
                    <select v-model="editSpotForm.paid_by_user_id">
                      <option value="">Bezahlt von –</option>
                      <option v-for="u in users" :key="u.id" :value="String(u.id)">
                        {{ u.avatar }} {{ u.username }}
                      </option>
                    </select>
                  </FormField>
                </div>
              </template>
              <fieldset class="collapsible-fieldset location-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showEditSpotLocationSection"
                    @click="showEditSpotLocationSection = !showEditSpotLocationSection"
                  >
                    <span>
                      <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
                      Standort (optional)
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showEditSpotLocationSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showEditSpotLocationSection" class="collapsible-content">
                  <p class="hint">
                    Wird für die Position auf der Karte und ggf. das Wetter vor Ort verwendet.
                  </p>
                  <label class="checkbox-option">
                    <input type="checkbox" v-model="editSpotForm.is_home" />
                    <AppIcon :icon="ACTION_ICONS.home" :size="14" group="actions" /> Heimat-Seite
                    (z. B. der heimische Flughafen/Bahnhof/Zuhause für Reise-Etappen)
                  </label>
                  <FormField icon="maps" label="Maps-Link (Google/Apple)">
                    <input
                      v-model="editSpotForm.maps_link"
                      type="url"
                      placeholder="Maps-Link (Google/Apple) (optional)"
                      @blur="checkEditSpotMapsLink"
                    />
                  </FormField>
                  <p v-if="editSpotMapsLinkResolved === true" class="hint success">
                    <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort
                    erkannt – erscheint auf der Karte
                  </p>
                  <p v-if="editSpotMapsLinkResolved === false" class="hint">
                    Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks
                    funktionieren).
                  </p>
                  <p v-if="editSpotLocationError" class="hint error">
                    <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort
                    konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte,
                    um ihn manuell zu setzen.
                  </p>
                  <fieldset class="collapsible-fieldset">
                    <legend>
                      <Button
                        type="button"
                        variant="ghost"
                        class="collapsible-toggle picker-toggle"
                        :aria-expanded="editSpotPickerOpen"
                        @click="editSpotPickerOpen = !editSpotPickerOpen"
                      >
                        <span>
                          <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" />
                          Standort manuell setzen
                        </span>
                        <AppIcon
                          :icon="ACTION_ICONS.chevronDown"
                          :size="14"
                          group="actions"
                          class="caret"
                          :class="{ closed: !editSpotPickerOpen }"
                        />
                      </Button>
                    </legend>
                    <div v-if="editSpotPickerOpen" class="collapsible-content">
                      <LocationPicker
                        v-model="editSpotManualPin"
                        :center="spotPickerCenter"
                        :reference-points="editSpotReferencePoints"
                      />
                    </div>
                  </fieldset>
                </div>
              </fieldset>
              <FormField icon="note" label="Notiz">
                <RichTextEditor
                  v-model="editSpotForm.note"
                  placeholder="Notiz (optional)"
                  compact
                  expandable
                />
              </FormField>
              <fieldset class="collapsible-fieldset">
                <legend>
                  <Button
                    type="button"
                    variant="ghost"
                    class="collapsible-toggle"
                    :aria-expanded="showEditSpotToursSection"
                    @click="showEditSpotToursSection = !showEditSpotToursSection"
                  >
                    <span>
                      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" />
                      Touren zuordnen
                      <span v-if="editSpotForm.tourTitles.length" class="picker-count">
                        ({{ editSpotForm.tourTitles.length }} zugeordnet)</span
                      >
                    </span>
                    <AppIcon
                      :icon="ACTION_ICONS.chevronDown"
                      :size="14"
                      group="actions"
                      class="caret"
                      :class="{ closed: !showEditSpotToursSection }"
                    />
                  </Button>
                </legend>
                <div v-if="showEditSpotToursSection" class="collapsible-content">
                  <TourAssignPicker
                    v-model="editSpotForm.tourTitles"
                    :tour-options="allTourTitles"
                    :category="editSpotForm.category"
                    :is-home="editSpotForm.is_home"
                  />
                </div>
              </fieldset>
              <FileAttachments v-if="editingSpot" domain="spots" :entity-id="editingSpot.id" />
              <DraftStatusBar
                :status="editSpotDraft.status.value"
                :restored="editSpotDraft.restored.value"
              />
              <Button type="submit">Speichern</Button>
            </form>
          </Modal>

          <!-- Hinweis-Modal für Standort-Aufzeichnung (#230) -->
          <TrackRecordingWarningModal
            v-model="showTrackRecordingWarningModal"
            @confirm="startRecordingConfirmed"
          />
        </div>
      </div>

      <ResizeHandle
        label="Aufteilung zwischen Spots-Liste und Karte anpassen"
        :is-resizing="resizingCol"
        class="col-resize-handle"
        @pointerdown="onColResizeStart"
      />

      <div class="map-col">
        <TripMap
          ref="tripMapRef"
          :category-filter="categoryFilter"
          :status-filter="statusFilter"
          :covered-bottom-px="mapCoveredBottomPx"
          :covered-left-px="mapCoveredLeftPx"
          :sheet-overlay-mode="isSheetOverlayMode"
          @focus-spot="onFocusSpotFromMap"
          @focus-excursion="onFocusExcursionFromMap"
          @edit-excursion="startEditExcursion"
        />
      </div>
    </div>
  </div>
  <ViewLoadingState v-else />
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
   eine feste Höhe unterhalb von Kopfzeile und wird zum Positionierungsrahmen für Karte +
   Bottom-Sheet, die beide position:absolute (nicht mehr position:fixed) sind.
   WICHTIG für Issue #302/#303: Auf Mobil darf --navbar-bottom-offset NICHT von .page's Höhe
   abgezogen werden. .page muss sich bis ganz nach unten zum Bildschirmrand erstrecken, damit die
   Karten-View (.map-col) unter die schwebende/transparente Bottom-NavBar durchgezogen wird und keine
   harte opake Fläche dahinter entsteht. */
.page {
  position: relative;
  height: calc(100vh - var(--app-header-height, 56px) - var(--navbar-offset, 0px));
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
   während eines aktiven Ziehens, wird sie vom Script direkt aufs Element geschrieben (siehe
   applySheetHeight() im Script) statt über eine reaktive :style-Bindung, um jeden Vue-Render-Tick
   zu sparen. .dragging schaltet die Transition ab, damit das Ziehen nicht hinterherhinkt.
   BEWUSST height statt transform: translateY() (naheliegender für GPU-beschleunigtes Compositing,
   ohne Reflow/Repaint bei jedem Frame) – ein eigener Versuch damit zeigte ein nicht sauber
   eingrenzbares Race mit TripMap.vue's ResizeObserver/invalidateSize() (siehe dortiger Kommentar):
   ein transform auf .spots-col ließ die Karte (.map-col, Geschwisterelement) nach einem
   Fokus-Klick auf einen Spot in ca. 4 von 5 Läufen an eine falsche Position springen (per E2E
   reproduziert, Ursache trotz Analyse nicht abschließend gefunden). Nicht erneut versuchen, ohne
   dieses Race zuerst zuverlässig zu verstehen/zu beheben. */
.spots-col {
  /* Macht .spots-col selbst zum Container für die Kompakt-Zeile-Entscheidung in SpotCard.vue/
     .cards weiter unten (@container-Abfragen dort) – reagiert dadurch auf
     die TATSÄCHLICHE Breite dieser Spalte (auch beim Verschieben des Anfassers auf Desktop),
     unabhängig von Viewport/anderer-Container-Breite. Gilt unverändert in beiden Modi (Mobil
     fixed/Desktop sticky), da hier nicht zurückgesetzt. Benannt (statt anonym) und die Kompakt-
     Zeilen-Abfragen unten explizit "spots-col" statt unbenannt: sonst würden auch die unbenannten
     @container(min-width:720px)-Abfragen für Nachfahren wie .sheet-handle/.spots-col-body
     versehentlich gegen DIESEN (statt gegen .app-main, App.vue) ausgewertet – .spots-col ist selbst
     nie ≥720px breit, das "Desktop"-Zurücksetzen von .sheet-handle etc. hätte dadurch nie gegriffen. */
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
  /* Feste Randbreite als Skalierungsfaktor statt echter Breitenänderung (left/right/width) - ein
     schwankender Layout-Breite hatte SpotCard.vue/ExcursionCard.vue's Titelzeile (~16px zwischen
     eingeklappt/ausgefahren) knapp an ihrer Umbruch-Schwelle vorbei-/dagegenlaufen lassen, je
     nachdem in welchem Sheet-Zustand man gerade war - wirkte beim Ziehen wie ein hässlicher
     Layout-Sprung (Nutzer-Feedback), obwohl der tatsächlich verfügbare Platz sich kaum geändert
     hatte. 0.96 statt eines exakt aus --space-2 berechneten Faktors (der bräuchte die tatsächliche
     Elementbreite, die in reinem CSS ohne Container-Query-Units auf sich selbst nicht verfügbar
     ist) - 4% Schrumpfung liegt für die üblichen Mobil-Breiten (360-430px) nah genug an den
     früheren 8px/Seite dran, ohne sich auf einen bestimmten Gerätewert zu verlassen. */
  --sheet-collapsed-scale: 0.96;
  position: absolute;
  left: 0;
  right: 0;
  /* Wie bei Apple: solange nicht ganz hochgezogen (collapsed/partial, .full überschreibt unten auf
     0) schwebt das Sheet mit demselben Abstand nach unten wie zu den Seiten (--space-2, siehe
     transform:scaleX() weiter unten) plus dem Abstand der unteren NavBar (--navbar-bottom-offset).
     Dadurch liegt der zugeklappte Drawer immer oberhalb der unteren NavBar und wird nie von ihr verdeckt (#303). */
  bottom: calc(var(--space-2) + var(--navbar-bottom-offset, 0px));
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  /* Feiner Rand wie bei Apples schwebendem Sheet (siehe PR-Referenzscreenshot) - ohne ihn verlor
     sich die Kante der Karte gegen eine bunte Karte im Hintergrund, der box-shadow allein reicht
     dafür nicht. Gleiches --color-border-Muster wie z. B. Drawer.vue's/.picker-menu's Buttons. */
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  height: min(46vh, var(--sheet-max-height));
  /* Wie bei Apple Maps' Suchleisten-Schublade: solange nicht ganz hochgezogen (collapsed/partial,
     .full überschreibt beide Werte unten auf scaleX(1)/nur obere Ecken), schwebt das Sheet als
     eigene, rundum gerundete Karte mit sichtbarem Rand zum Bildschirmrand statt randlos - wirkte
     vorher im Vergleich zu eng an den Bildschirmrand gequetscht. transform:scaleX() (statt left/
     right, siehe --sheet-collapsed-scale oben) hält die tatsächliche Layout-Breite dabei konstant
     (transform wirkt nur beim Zeichnen/Compositing, nicht beim Layout) - genau das verhindert den
     Umbruch-Sprung oben. transform-origin bleibt beim Default (50% 50%): schrumpft dadurch
     symmetrisch von beiden Seiten, wie es die vorherigen gleich großen left/right-Werte auch taten.
     WICHTIG: .picker-backdrop/.picker-menu (Kategorie-/Status-/Info-Dropdowns, Template weiter
     unten) sind deshalb per <Teleport to="body"> aus diesem Element herausgelöst - jedes transform
     außer none macht ein Element sonst zum Containing Block für seine position:fixed-Nachfahren
     (CSS-Spezifikation), das hätte deren viewport-weites Backdrop auf die Sheet-Fläche eingeschränkt
     (siehe DESIGN.md, Abschnitt "Zieh-Interaktionen", für die ausführliche Begründung). */
  transform: scaleX(var(--sheet-collapsed-scale));
  /* Alle drei Eigenschaften mit derselben weicheren Einrast-Kurve (siehe DESIGN.md, "Zieh-
     Interaktionen") statt nur height - transform/border-radius wechseln beim Hoch-/Runterziehen
     gemeinsam mit der Höhe, sollen deshalb auch gleich smooth ankommen statt einzeln rauszustechen. */
  transition:
    height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    bottom 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
  /* Bekannter iOS-Safari-Bug: ein fixed/absolute positioniertes Element mit border-radius+box-shadow
     malt seinen Hintergrund beim allerersten Paint mitunter nicht korrekt (bleibt transparent, bis
     irgendeine Interaktion – z. B. das Ziehen am Griff – einen Repaint erzwingt). Der Fix (eigene
     Compositing-Ebene erzwingen) sitzt trotzdem weiterhin auf einem eigenen ::before statt direkt
     auf .spots-col, obwohl .spots-col jetzt selbst ein transform trägt - .spots-col::before hält so
     unabhängig von .spots-col selbst seine eigene Compositing-Ebene, ohne dass diese beiden
     transform-Werte sich gegenseitig überschreiben könnten. */
}

.spots-col::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: inherit;
  transform: translateZ(0);
}

/* Wie bei Apples eingeklapptem Suchleisten-Zustand: eine reine Pille (nur die Anfasser-Zeile ist
   groß genug, um sichtbar zu bleiben) statt einer 96px hohen Karte, in die vorher noch eine Zeile
   Inhalt hineinragte. .spots-col-body braucht dafür kein eigenes display:none - flex:1 auf einem
   Elternelement, dessen Höhe exakt auf die Anfasser-Zeile passt, lässt ihm ohnehin keinen Platz
   mehr; schrumpft dadurch während der height-Transition weich zusammen statt beim Klassenwechsel
   hart zu verschwinden. 999px + corner-shape:round (nicht squircle wie die Basis-Karte) - Pillen
   bekommen laut DESIGN.md, Abschnitt "Eckenrundung", immer einen echten Kreisbogen. 64px ergibt
   sich aus der Anfasser-Zeile selbst (~33px Inhalt + 16px Polster oben + 16px unten, siehe
   .sheet-handle-row unten) - kein willkürlicher Wert. */
.spots-col.collapsed {
  height: min(64px, var(--sheet-max-height));
  border-radius: 999px;
  corner-shape: round;
}

/* Ganz hochgezogen: wie bei Apple erst jetzt randlos volle Breite UND -höhe (kein Abstand mehr nach
   unten, sonst wie collapsed/partial), nur noch oben gerundete Ecken (statt der rundum gerundeten
   "schwebenden Karte" oben) - Übergang läuft über dieselben bottom/transform/border-radius-
   Transitions wie an .spots-col selbst. Reicht unten bis var(--navbar-bottom-offset, 0px) hoch,
   damit die Navbar nicht überfahren wird. */
.spots-col.full {
  bottom: 0;
  transform: scaleX(1);
  border-radius: var(--radius-lg-squircle) var(--radius-lg-squircle) 0 0;
  height: min(100vh, var(--sheet-max-height));

  .spots-col-body {
    padding-bottom: var(--navbar-bottom-offset, 0px);
  }
}

.spots-col.dragging {
  transition: none;
}

@container spots-col (max-width: 450px) {
  .add-button {
    padding: var(--btn-padding-y, 11px);
    border-radius: 999px;
  }

  .add-button__label {
    display: none;
  }
}

.sheet-handle-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  /* Seitliches/oberes Polster deutlich großzügiger als die alten 8px/4px - bei der jetzt sichtbar
     gerundeten Sheet-Ecke (--radius-lg-squircle, siehe .spots-col oben) saßen die Stufen-Buttons
     sonst fast in der Rundung selbst statt sichtbar davor (genau der von Apples "X"-Button
     abweichende Effekt aus dem PR-Review-Screenshot). Oben/seitlich identisch (var(--space-3)
     statt oben --space-3 und seitlich --space-4) - selbes Card-Innenabstand-Maß wie SpotCard.vue/
     ExcursionCard.vue u. a. (siehe DESIGN.md, Abschnitt "Abstände") statt
     eines eigens erfundenen asymmetrischen Werts. */
  padding: var(--space-3) var(--space-3) 0;
  /* Gilt für die ganze Zeile (nicht nur .sheet-handle): ein Zug, der knapp neben dem eigentlichen
     Anfasser beginnt (z. B. noch über den Stufen-Buttons), soll trotzdem nicht als Seiten-Scroll/
     Pull-to-Refresh interpretiert werden. */
  touch-action: none;
}

/* Im collapsed-Zustand ist die Anfasser-Zeile der komplette sichtbare Inhalt der Pille (siehe
   .spots-col.collapsed oben) - bekommt deshalb symmetrisches Polster (auch unten) statt der
   normalen 0, die davon ausgeht, dass darunter noch .spots-col-body folgt. */
.spots-col.collapsed .sheet-handle-row {
  padding-bottom: var(--space-3);
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
  /* Verhindert, dass der Browser die Scrollposition beim Auf-/Zuklappen einer Spot-Karte (SpotCard.vue,
     ändert ihre Höhe drastisch) eigenmächtig "korrigiert" (CSS Scroll Anchoring, standardmäßig an) -
     kollidiert hier mit der View-Transition (#90, siehe animateSpotExpand() im Script): während die
     transitionierende Karte kurzzeitig aus dem normalen Layout genommen wird (view-transition-name),
     kann der Browser den falschen Anker wählen und springt sichtbar zu einer völlig anderen Stelle in
     der Liste (#140 - "Details verschwinden", auf Safari/iOS deutlich ausgeprägter als auf Chrome). */
  overflow-anchor: none;
  padding: 0 var(--space-3) var(--space-3);
  /* Live gemessene Höhe der sticky .category-nav-Leiste (Icon+Label-Zeile plus Padding/Trennlinie,
     siehe dortiges CSS), per ResizeObserver im Script (setCategoryNavRef -> categoryNavHeight) als
     Inline-Style-Var auf dieses Element gebunden - der 44px-Wert hier ist nur ein Fallback für den
     Moment vor der ersten Messung (z. B. der allererste Sprung direkt nach dem Mounten). War früher
     ein starrer, ungemessener Schätzwert; wich dieser von der tatsächlich gerenderten Höhe ab, landete
     scrollToCategory() nicht weit genug gescrollt (#101). Verwendet von .category-heading/
     .tour-group-card/.spot-card (scroll-margin-top) unten sowie identisch im Script
     (rebuildCategorySectionObserver()s rootMargin – muss mit diesem Wert übereinstimmen, damit "aktiv"
     und "per Klick angesprungen" an derselben Stelle greifen). */
  --category-nav-clearance: 44px;
}

/* Wie bei Apple Maps: nur im "voll"-Zustand ist die Liste selbst scrollbar. In "angeschnitten"/
   eingeklappt übernimmt stattdessen ein Zug irgendwo auf der Liste das Verschieben der ganzen
   Schublade (siehe onSheetBodyPointerDown() im Script) statt sie zu scrollen. touch-action:none
   verhindert, dass der Browser hier von sich aus zu scrollen anfängt, bevor unser eigener
   Pointer-Handler die Zugbewegung übernehmen kann. */
.spots-col.collapsed .spots-col-body,
.spots-col.partial .spots-col-body {
  overflow-y: hidden;
  touch-action: none;
}

/* Leer (kein Fokus aktiv bzw. Desktop, siehe TripMap.vue), wenn nichts hineingeteleportet wurde –
   dann soll der Anker keinen Platz beanspruchen. */
.map-focus-dock:empty {
  display: none;
}

.map-focus-dock:not(:empty) {
  padding-top: var(--space-2);
  margin-bottom: var(--space-3);
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
/* 720px statt der ursprünglichen 900px (siehe isSheetOverlayMode im Script-Block für die exakt
   gespiegelte JS-Seite dieser Schwelle): bei geöffneter Kalender-Schublade (Standard 360px) blieb
   .app-main auf gängigen Desktop-/Laptop-Breiten sonst oft unter 900px und die Ansicht fiel auf den
   mobilen Sheet-Modus zurück, obwohl noch genug Platz für eine (wenn auch schmalere) Spots-Liste +
   Karte nebeneinander da war. */
@container app-main (min-width: 720px) {
  /* .page bleibt wie auf Mobil absolute und vollbild, Karte füllt den Bereich aus */
  .page {
    max-width: none;
    margin: 0;
    padding: 0;
    position: relative;
  }

  /* Auf Desktop ist der Titel visuell ausgeblendet, bleibt aber für Screenreader lesbar */
  .page-title {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .layout {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .map-col {
    position: fixed;
    top: calc(var(--app-header-height, 56px) + var(--navbar-offset, 0px));
    bottom: var(--navbar-bottom-offset, 0px);
    left: 0;
    right: 0;
    z-index: 1;
    pointer-events: auto;
  }

  .spots-col {
    position: absolute;
    left: var(--space-4);
    top: var(--space-4);
    bottom: var(--space-4);
    height: auto;
    max-height: none;
    z-index: 5;
    background: var(--color-surface);
    border-radius: var(--radius-md-squircle);
    box-shadow: var(--shadow-md);
    width: var(--spots-col-width);
    pointer-events: auto;

    display: flex;
    flex-direction: column;
    overflow: hidden;

    /* Override mobile transforms and bottom offsets */
    transform: none;
    transition: none;
  }

  /* .spots-col ist auf Desktop undurchsichtig, keine speziellen Hintergrundanpassungen nötig. */
  .spots-col .category-nav-wrap {
    background: var(--color-surface);
    --category-nav-bg: var(--color-surface);
  }

  .sheet-handle-row {
    display: none;
  }

  .spots-col-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3);
  }

  .spots-col.collapsed .spots-col-body,
  .spots-col.partial .spots-col-body {
    overflow-y: auto;
    touch-action: auto;
  }

  .col-resize-handle {
    display: flex;
    position: absolute;
    left: calc(
      var(--space-4) + var(--spots-col-width) + (var(--space-4) - var(--drawer-handle-gap, 12px)) /
        2
    );
    top: var(--space-4);
    bottom: var(--space-4);
    height: auto;
    z-index: 10;
    pointer-events: auto;
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

.subheader {
  margin-bottom: var(--space-3);
  display: flex;
  justify-content: flex-end;
}

.header h2 {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}

/* Feste/gleiche Breite für den "Spots"/"Touren"-Titel, damit der Umschalter beim Wechsel
   nicht hin und her springt, kombiniert mit einer vertikalen Swipe-Animation (#220). */

/* Etwas mehr Abstand als das straffe 4px-gap der Überschrift selbst (dort passend für Text+Info-
   Icon) - der Umschalter ist ein eigenständiges Steuerungselement, keine Ergänzung des Titels. */
.header h2 .segmented-toggle {
  margin-left: var(--space-2);
}

/* Ersetzt den früheren, immer sichtbaren Erklärtext (siehe .description-popover unten) - reines
   Info-Icon statt eines vollen Buttons, damit es sich der Überschrift unterordnet statt mit ihr zu
   konkurrieren. */
.info-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: none;
  /* #185: ohne explizite Farbe erbte das Icon (currentColor, AppIcon.vue) die weiße Textfarbe des
     globalen `button`-Basisstils (style.css) - auf der hellen Kopfzeile praktisch unsichtbar. Der
     globale box-shadow (--shadow-sm) blieb aus demselben Grund (kein Reset) ebenfalls fälschlich
     sichtbar. */
  color: var(--color-text-muted);
  box-shadow: none;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}

.info-btn:hover {
  opacity: 1;
}

.description-popover {
  min-width: 260px;
  max-width: min(340px, 80vw);
}

.description-popover p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.description-popover p + p {
  margin-top: var(--space-2);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

/* Gleicher Rec-Ton wie TrackRecordingIndicator.vue's .recording-pill, damit "läuft gerade" app-weit
   dieselbe Farbe trägt. */
.header-actions button.recording {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
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

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1;
  min-width: 140px;
}

.collapsible-fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-2) var(--space-3) var(--space-3);
  margin: var(--space-2) 0;
  background: var(--color-bg);
}

.collapsible-fieldset legend {
  padding: 0 var(--space-1);
  margin: 0;
}

.collapsible-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-surface) !important;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  box-shadow: none;
}

.collapsible-toggle:hover {
  background: var(--color-hover) !important;
}

.collapsible-toggle .picker-count {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.collapsible-content {
  margin-top: var(--space-2);
}

.track-warning-modal .track-warning-intro {
  margin-bottom: var(--space-3);
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--color-text);
}

.track-warning-modal .track-warning-points {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.track-warning-modal .track-warning-point h4 {
  margin: 0 0 4px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.track-warning-modal .track-warning-point p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.track-warning-modal .warning-dismiss {
  margin-top: var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
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

.caret {
  flex-shrink: 0;
}

.filter-bar-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Stationen einer Tour: eingerückte, vertikale Liste statt des normalen Karten-Grids (siehe
   Template). Wrapper ist bei Nicht-Touren-Gruppen ein reines display:contents-Passepartout (kein
   zusätzliches Layout-Element), bei Touren-Gruppen position:relative - dadurch offsetParent der
   Spot-Karten (recomputeTourLine() im Script liest offsetTop/offsetHeight direkt relativ dazu) und
   Bezugsrahmen für die absolut positionierte .tour-station-line (#100: statt einer starren,
   geraden CSS-border-left-Linie über die volle Container-Höhe eine per SVG berechnete, gebogene
   Linie, die exakt an den Kreis-Punkten auf Höhe jeder Spot-Karte endet/startet). Gleiche
   Akzentfarbe/Bogen-Idee wie die Tour-Route auf der Karte (TripMap.vue's renderRoutes()/
   utils/mapRoute.ts's arcPoints()) und wie ExcursionDetailDialog.vue's .station-connector, nur
   vertikal statt horizontal. */
.tour-station-wrap {
  display: contents;
}

.tour-station-wrap.is-tour {
  display: block;
  position: relative;
  margin-left: 18px;
}

.tour-station-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.tour-station-accordion.is-expanded {
  grid-template-rows: 1fr;
}

.tour-station-accordion-inner {
  overflow: hidden;
}

.tour-station-accordion .staggered-spot {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
  opacity: 0;
  transform: translateY(-20px) scale(0.97);
  transition-delay: calc((var(--stagger-total) - var(--stagger-idx) - 1) * 30ms);
}

.tour-station-accordion.is-expanded .staggered-spot {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx) * 50ms);
}

.tour-station-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 12px 24px var(--space-4);
}

.tour-station-line {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.tour-station-line path {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 3;
  stroke-dasharray: 6 6;
}

.tour-station-line circle {
  fill: var(--color-primary);
  stroke: var(--color-surface);
  stroke-width: 2;
}

/* Auf schmalen .spots-col-Breiten (Bottom-Sheet auf Mobil, ODER auf Desktop, wenn der Anfasser sehr
   weit zur Karte hin gezogen wurde) immer eine einzelne Spalte statt auto-fill – bei knapper, aber
   nicht ganz ausreichender Breite für zwei 240px-Spalten schnitt auto-fill die zweite Karte sonst
   am rechten Rand ab, statt sie in eine neue Zeile umbrechen zu lassen. Container-Query statt
   @media (siehe container-type auf .spots-col oben) – reagiert dadurch auf die tatsächliche
   Spalten-Breite, nicht auf die Fenster-/Viewport-Breite. Derselbe Schwellenwert wie in
   SpotCard.vue (muss übereinstimmen, sonst driftet die Kompakt-Zeile dort
   von der Ein-Spalten-Entscheidung hier auseinander). Explizit "spots-col" statt unbenannt, damit
   eindeutig gegen diesen (statt versehentlich gegen .app-main) ausgewertet wird. */
@container spots-col (max-width: 480px) {
  .cards {
    /* minmax(0, 1fr) statt nacktem 1fr (= minmax(auto, 1fr)): eine bloße 1fr-Spalte bleibt trotz
       Ein-Spalten-Rasters implizit mindestens so breit wie ihr Inhalt (z. B. ein langer, per
       white-space:nowrap+ellipsis eigentlich kürzbarer Spot-Titel in SpotCard.vue), was auf schmalen
       Mobilbreiten eine horizontale Scrollleiste der ganzen Liste erzeugte statt den Titel zu
       kürzen. Die explizite 0-Untergrenze erlaubt der Spalte, echt auf die verfügbare Breite zu
       schrumpfen. */
    grid-template-columns: minmax(0, 1fr);
  }
}

.dropdown {
  position: relative;
  flex: 0 0 auto;
}

.category-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

/* Per Teleport nach <body> gerendert (siehe computeMenuStyle()/toggle*()-Funktionen im Script) -
   position:fixed übers ganze Sichtfeld statt wie zuvor relativ zu .spots-col positioniert, das wäre
   sobald .spots-col selbst ein transform bekommt nicht mehr zuverlässig (siehe Kommentar dort).
   z-index deutlich höher als die bisherigen 20/21: als Teleport-Kind von <body> konkurriert das
   jetzt mit AppHeader.vue (25) statt nur innerhalb von .spots-col (dort z-index:5) - gleiches Maß
   wie MapsAppPicker.vue's Teleport-Menü (110/111, bewusst über Modal.vue's 100). */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
}

.picker-menu {
  position: fixed;
  min-width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 111;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu button {
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  color: var(--color-text);
  font-size: 0.85rem;
  white-space: nowrap;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
  /* #183: der globale `button`-Basisstil (style.css) setzt box-shadow: var(--shadow-sm) - ohne
     Reset trug jeder Menüpunkt hier zusätzlich zum eigenen .picker-menu-Container-Schatten einen
     eigenen "erhobenen" Schatten (v. a. auf iOS Safari sichtbar). */
  box-shadow: none;
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
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
}

.category-option:hover {
  background: var(--color-hover);
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.85rem;
  cursor: pointer;
}

/* Eigene, dezente "Werkzeugleisten"-Box (heller/kleinerer Radius als .card, damit sie sich klar den
   eigentlichen Inhalts-Cards darunter unterordnet) statt frei im Seitenfluss stehender Buttons -
   fasst Gruppieren/Sortieren/Filtern als ein zusammengehöriges, klar abgegrenztes Werkzeug
   optisch zusammen (Nutzer-Feedback: wirkte vorher "gebastelt"). */
/* --color-primary-tint (leichtes Markengrün) statt des neutralen --color-hover: dieser Bereich ist
   ein Steuerungs-/Werkzeug-Element (Gruppieren/Sortieren/Filtern), keine Dateninhalt-Fläche - siehe
   DESIGN.md, Abschnitt "Farben" für die Unterscheidung Steuerungselement (leicht eingefärbt) vs.
   Karte mit Dateninhalt (weiß/--color-surface, z. B. SpotCard.vue). */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

/* Steuerung (Ein-/Ausklappen), daher --color-primary-tint statt --color-surface - gleiches Prinzip
   wie .filter-bar oben (siehe DESIGN.md, Abschnitt "Steuerungselement vs. Dateninhalt"). */
.tracks-section {
  margin: 0 0 var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
  overflow: hidden;
}

.tracks-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  background: none;
  border: none;
  /* Gleiches Muster/derselbe Fix wie .filter-toggle-row oben (#139) - auch hier überschreibt der
     globale button-Selektor sonst mit seinem Grund-Schatten. */
  box-shadow: none;
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  cursor: pointer;
  text-align: left;
}

.tracks-toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Dateninhalt (je eine echte Aufzeichnung), daher --color-surface statt der Steuerungsfarbe der
   umgebenden .tracks-section - gleiches Prinzip wie SpotCard.vue/ExcursionCard.vue. */
.tracks-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0 var(--space-2) var(--space-2);
  list-style: none;
}

.track-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-surface);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.track-row.active {
  outline: 2px solid var(--color-primary);
}

.track-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  text-align: left;
  cursor: pointer;
}

.track-row-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.track-icon-btn {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  padding: 0;
  margin-right: var(--space-1);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.95rem;
  cursor: pointer;
}

.track-icon-btn:hover {
  background: var(--color-hover);
}

/* Je eine Zeile für Sortieren und Filtern, statt einer gemeinsamen umbrechenden Reihe – siehe
   Kommentar am Template. flex-wrap:wrap (nicht nowrap): die Kategorie-/Status-Dropdowns behalten
   immer ihre volle Beschriftung (Nutzer:innen-Feedback, siehe @media weiter unten) - reicht der
   Platz neben dem (auf Mobil auf ein Icon reduzierten) Zeilen-Label nicht, bricht der Rest der
   Zeile innerhalb der GRÜNEN BOX in eine zweite Zeile um, statt seitlich über die Box
   hinauszuragen (Issue #170: "Dropdown ragt über die grüne Box hinaus - das darf nicht
   passieren"). */
.tool-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
}

/* Feste Breite statt nur flex-shrink:0 - richtet die Steuerelemente beider Zeilen (Sortieren/
   Filtern) an derselben gedachten vertikalen Linie aus, tabellenartig statt mit je nach
   Label-Länge unterschiedlich weit eingerücktem Inhalt (Issue #170, erste Lösungsidee). */
.tool-label {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
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

/* display:inline-flex/align-items:center kommen inzwischen aus style.css's globaler button-Regel
   (#95 "Eingabe Elemente cleanup" - vorher hier lokal als Fix für genau dieses Icon+Label+Caret-
   Ausrichtungsproblem nachgezogen, jetzt app-weit für jeden Button gelöst). Nur die kleinere
   Schriftgröße bleibt als lokale Abweichung.
   #156: bewusst OHNE eigenes box-shadow/border-color-Override mehr - button.secondary's Schatten
   (--shadow-sm) und kräftigerer Rahmen (--color-border-strong) gleichen diese Filter-Dropdowns damit
   optisch an die Sortieren-/Gruppieren-<select>-Felder in dieser und den anderen Listen-Views an
   (ShoppingListView.vue/TodoView.vue), statt wie zuvor dezenter/flacher zu wirken. */
.category-btn {
  font-size: 0.85rem;
}

.tool-label-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Kleiner Auf-/Zu-Pfeil rechts neben dem Label, macht auf einen Blick klarer, dass ein Klick ein
   Dropdown-Menü öffnet/schließt statt z. B. direkt eine Aktion auszulösen (Nutzer:innen-Feedback) -
   dasselbe Auf/Zu-Chevron wie SettingsView.vue's "Einzeln anpassen". */
.dropdown-caret {
  margin-left: 4px;
  opacity: 0.6;
  color: var(--color-primary);
}

.dropdown-caret.open {
  transform: rotate(180deg);
}

.category-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  /* scrollToCategory() landet sonst mit der Überschrift teilweise unter der sticky Kategorie-Nav.
     Bewusst OHNE --app-header-height/--navbar-offset (anders als .spots-col/.map-col weiter oben
     und Drawer.vue, wo tatsächlich das Fenster/eine eigene Overlay-Ebene relativ zur AppHeader
     scrollt): .category-heading scrollt dagegen innerhalb von .spots-col bzw. .spots-col-body, die
     schon selbst unterhalb von AppHeader/NavBar sitzen (Desktop per position:sticky mit
     entsprechendem top; Mobil als eigenständig positioniertes Sheet ohnehin unabhängig von der
     AppHeader) - ein zusätzliches Abziehen von deren Höhe landete den Sprung dadurch systematisch zu
     weit unten (per E2E-Test verifiziert, ursprünglich fälschlich von .spots-col/Drawer.vue
     übernommen, siehe Git-Historie #101). --category-nav-clearance (siehe .spots-col-body oben)
     reserviert weiterhin Platz für die sticky Kategorie-/Touren-Nav-Leiste selbst. */
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
}

/* Tour-Gruppen-Überschrift bei Touren-Gruppierung (ExcursionCard statt reinem Text, siehe Template)
   – gleicher scroll-margin-top wie .category-heading oben (dieselbe scrollToCategory()-Zielgruppe),
   plus Abstand zur darunterliegenden Spot-Card-Grid, die .category-heading dort bereits über ihren
   eigenen margin-bottom bekommt (h3-Element-Default reicht bei einer Card nicht). */
.tour-group-card {
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
  margin-bottom: var(--space-3);
}

/* Zero-height Sentinel direkt vor .category-nav, per IntersectionObserver beobachtet (siehe
   setCategoryNavSentinelRef im Script) - sobald es aus dem sichtbaren Bereich scrollt, "klebt" die
   Nav gerade wirklich (position:sticky "stuck"), und .is-stuck unten greift. */
.category-nav-sentinel {
  height: 0;
}

/* Horizontale Kategorie-Navigation, Wolt-Stil: eine flache Tab-Leiste (gleitende Unterstreichung,
   gleiches Grundprinzip wie ListenView.vue's .tab-bar) statt einer schwebenden "Liquid Glass"-Pille
   wie in einer früheren Version dieser Nav (siehe Git-Historie) – dadurch unterscheidet sie sich
   klarer von der App-weiten NavBar (die IST eine schwebende Pille) und bleibt optisch eine
   sekundäre, dem Inhalt untergeordnete Werkzeugleiste. Icon links neben statt über dem Label
   (Wolt-Vorbild), ganze Leiste scrollt bei Bedarf horizontal statt umzubrechen (viele Kategorien
   nebeneinander) und hält die aktive Kategorie dabei per JS automatisch im sichtbaren Bereich
   (siehe watch(activeCategory) im Script). Vertikal sticky innerhalb von .spots-col-body (dem
   tatsächlich scrollenden Vorfahren, siehe dortige overflow-y) mit top:0, sitzt also im
   "stuck"-Zustand direkt an der Oberkante der Liste – anders als die frühere Pille bleibt die Höhe
   dabei konstant (kein Zustand mit größerem Padding mehr), daher ist keine zusätzliche
   Abstands-Kompensation für die erste sichtbare Gruppe mehr nötig.
   --color-primary-tint statt --color-surface + Squircle-Rundung statt eckiger Ecken: dieselbe
   "Steuerungselement statt Dateninhalt"-Behandlung wie .filter-bar oben (siehe DESIGN.md, Abschnitt
   "Farben") – diese Navi ist ein Werkzeug zum Springen zwischen Kategorien, kein Dateninhalt. Ein
   weißer, eckiger Balken sah hier speziell im "stuck"-Zustand sichtbar falsch aus: auf Desktop wird
   .spots-col dort komplett transparent (siehe dortiges background:none), ein weißes Rechteck mit
   90°-Ecken hätte scharf gegen den beigen Seitenhintergrund abgesetzt gewirkt – siehe DESIGN.md,
   Abschnitt "Eckenrundung", "nie ganz eckige Ecken"-Grundsatz. */
/* Sticky-/Hintergrund-/Schatten-Zustand sitzt jetzt am Wrapper statt an .category-nav selbst (#144)
   - .category-nav bleibt das reine Scroll-Element (overflow-x), die beiden Klick-Pfeile (Template)
   sind absolut positionierte Geschwister innerhalb desselben Wrappers, brauchen also dieselbe
   Sticky-Positionierung/denselben Hintergrund wie die Leiste, ohne selbst mitzuscrollen. */
.category-nav-wrap {
  position: sticky;
  /* -1px statt 0 + 1px zusätzliches Padding oben (kompensiert die Verschiebung, sichtbare Position
     bleibt gleich): schließt eine von Nutzer:innen gemeldete 1-2px-Lücke, durch die beim Scrollen
     kurz Spot-Inhalt hinter der Leiste durchschimmerte (#144) - bekanntes Sub-Pixel-Rundungsproblem
     von position:sticky mit top:0 bei fraktionaler Geräte-Pixel-Skalierung, dieser 1px-Vorzieh-Trick
     ist die gängige Lösung dafür. */
  top: -1px;
  padding-top: 1px;
  z-index: 2;
  margin-bottom: var(--space-3);

  /* Die Leiste auf die volle Breite der Schublade aufziehen, um auch das seitliche Scroll-Padding
     abzudecken, falls Inhalte drunterscrollen. */
  margin-left: calc(var(--space-3) * -1);
  margin-right: calc(var(--space-3) * -1);
  padding-left: var(--space-3);
  padding-right: var(--space-3);

  /* Eigene Variable statt direkt --color-surface, weil die Desktop-Regel weiter unten
     (.spots-col .category-nav-wrap) sie auf --color-bg umschaltet - Pfeile/Verlauf unten nutzen
     denselben Wert, damit beide Stellen bei einer künftigen Änderung nicht auseinanderlaufen. */
  --category-nav-bg: var(--color-surface);
  /* Gleiche Farbe wie der dahinterliegende Untergrund statt eines eigenen Tons (vorher
     --color-primary-tint mit eigener Rundung) - sieht dadurch "transparent" aus wie die anderen
     Tab-/Nav-Leisten der App (NavBar.vue, TabBar.vue), muss aber wegen position:sticky tatsächlich
     blickdicht bleiben, sonst schiene der darunter wegscrollende Inhalt durch. Mobil liegt dahinter
     das Bottom-Sheet (.spots-col mit --color-surface, s. u.), nicht der Seitenhintergrund - erst ab
     der Desktop-Breakpoint-Regel unten (.spots-col wird dort background:none) passt --color-bg. */
  background: var(--category-nav-bg);
  border-bottom: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease;
}

/* Sobald tatsächlich "stuck" (siehe Sentinel/IntersectionObserver oben): ein dezenter Schatten
   zeigt an, dass die Leiste jetzt über scrollendem Inhalt schwebt, statt (wie die frühere Pille) die
   Form komplett zu wechseln. 
   Zusätzlich deckt ein solider Schatten nach oben den padding-top Bereich von .spots-col-body ab,
   damit die drunterscrollenden Karten dort nicht sichtbar werden. */
.category-nav-wrap.is-stuck {
  box-shadow:
    0 calc(var(--space-3) * -1) 0 0 var(--category-nav-bg),
    var(--shadow-sm);
}

.category-nav {
  /* Bleibt selbst positioniert (früher implizit durch position:sticky, das jetzt auf dem Wrapper
     sitzt) - .category-nav-underline unten ist ein absolut positioniertes Kind INNERHALB dieses
     scrollenden Elements und muss mit dessen Inhalt mitscrollen (dieselbe Logik wie
     activeEl.offsetLeft im Script, das ebenfalls relativ zu diesem Element misst). Wäre .category-nav
     selbst nicht positioniert, würde die Unterstreichung stattdessen relativ zum sticky Wrapper
     verankert und beim horizontalen Scrollen der Kategorien nicht mitwandern. */
  position: relative;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  /* Nativer Scrollbalken wirkte zusammen mit der gleitenden Unterstreichung (.category-nav-underline
     unten) unruhig/doppelt gemoppelt (#144, Nutzer-Feedback) - die beiden Klick-Pfeile (Template)
     übernehmen die Scrollbarkeit stattdessen sichtbar/bedienbar, ohne den permanent sichtbaren
     Balken. scrollbar-width für Firefox, ::-webkit-scrollbar für Chrome/Safari - kein Standard-CSS
     für beide zugleich. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-nav::-webkit-scrollbar {
  display: none;
}

/* Dezente Klick-Fläche mit Verlauf statt eines vollflächigen, hart abgesetzten Buttons (#144) - der
   Farbverlauf zum jeweiligen Rand hin lässt das letzte teils sichtbare Kategorie-Label unter dem
   Pfeil sanft ausblenden statt hart abzuschneiden. Volle Höhe des Wrappers (top/bottom:0) statt nur
   Icon-Größe, damit die Klickfläche nicht winzig ausfällt. */
.category-nav-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  width: 32px;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
}

.category-nav-arrow:hover {
  color: var(--color-primary-dark);
}

.category-nav-arrow.left {
  left: 0;
  justify-content: flex-start;
  padding-left: 4px;
  background: linear-gradient(to right, var(--category-nav-bg) 45%, transparent);
}

.category-nav-arrow.right {
  right: 0;
  justify-content: flex-end;
  padding-right: 4px;
  background: linear-gradient(to left, var(--category-nav-bg) 45%, transparent);
}

.category-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  /* Explizit zurückgesetzt statt sich auf style.css's globale button-Regel zu verlassen (#95 gab
     jedem <button> per Default Schatten + Squircle-Rundung) - ein flaches Tab-Item einer
     Tab-Unterstreichungs-Leiste (wie TabBar.vue's .tab) braucht beides nicht, sonst wirkt jedes
     einzelne Item wie eine eigene erhobene Karte statt Teil einer gemeinsamen Leiste. */
  box-shadow: none;
  border-radius: 0;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
}

.category-nav-item:hover {
  color: var(--color-primary-dark);
}

.category-nav-item.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.category-nav-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.category-nav-label {
  font-size: 0.85rem;
}

/* Gleitet per transform/width zur jeweils aktiven Kategorie statt die Farbe hart umzuschalten -
   identisches Prinzip wie ListenView.vue's .tab-underline (dortiger Kommentar für die Begründung,
   warum JS-gemessene Positionen statt eines starren CSS-Grids nötig sind: unterschiedlich breite
   Kategorie-Labels). Aktualisiert sowohl bei Klick als auch beim Scrollspy-getriebenen Wechsel der
   aktiven Kategorie (siehe activeCategory im Script) - funktioniert dadurch "in beide Richtungen". */
.category-nav-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  transition:
    transform 0.2s ease,
    width 0.2s ease;
  pointer-events: none;
}
</style>
