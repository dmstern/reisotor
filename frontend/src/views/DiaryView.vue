<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type {
  DiaryComment,
  DiaryEntry,
  DiaryImage,
  DiaryLike,
  Excursion,
  Spot,
  User,
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { buildDayStations } from '../utils/dayStations';
import { useLiveSyncStore } from '../stores/liveSync';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import { isEmptyRichText } from '../utils/richText';
import { fetchMergedWeather, weatherCodeMeta, type DailyWeather } from '../utils/weather';
import RichTextEditor from '../components/RichTextEditor.vue';
import FormField from '../components/FormField.vue';
import RichTextDisplay from '../components/RichTextDisplay.vue';
import { compressImage } from '../utils/imageCompression';
import { spotCategoryMeta } from '../utils/spotCategory';
import { formatDate } from '../utils/dateFormat';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import DraftBadge from '../components/DraftBadge.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import AppIcon from '../components/AppIcon.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import Input from '../components/primitives/Input.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal.vue';
import AttachmentThumbnails from '../components/AttachmentThumbnails.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import PolaroidStack from '../components/primitives/PolaroidStack.vue';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));
const liveSync = useLiveSyncStore();
const weatherProvider = useWeatherProviderStore();
const trip = computed(() => tripStore.currentTrip);
const entries = ref<DiaryEntry[]>([]);
const { showToast } = useToast();
const likes = ref<DiaryLike[]>([]);
const comments = ref<DiaryComment[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

const showForm = ref(false);
// date: vorausgewählt mit dem heutigen Tag (siehe localDateStr() weiter unten - als Funktions-
// deklaration bereits hier aufrufbar, auch wenn sie textuell später im Modul steht), aber frei
// änderbar - z. B. für einen rückblickend erst am Folgetag geschriebenen Eintrag über den Vortag.
const emptyForm = () => ({
  title: '',
  content: '',
  images: [] as DiaryImage[],
  excursion_ids: [] as number[],
  spot_ids: [] as number[],
  date: localDateStr(new Date()),
});
const form = ref(emptyForm());
const uploading = ref(false);
const uploadError = ref('');
const newFileInputRef = ref<HTMLInputElement | null>(null);

const editingEntry = ref<DiaryEntry | null>(null);
const editForm = ref(emptyForm());
const editUploading = ref(false);
const editUploadError = ref('');
const editFileInputRef = ref<HTMLInputElement | null>(null);

const diaryPreviewOpen = ref(false);
const diaryPreviewImages = ref<DiaryImage[]>([]);
const diaryPreviewIndex = ref(0);
const diaryPreviewEditable = ref(false);
const diaryPreviewOnRemove = ref<((idx: number) => void) | null>(null);

function openDiaryPreview(
  images: DiaryImage[],
  index: number,
  editable = false,
  onRemove?: (idx: number) => void
) {
  diaryPreviewImages.value = images;
  diaryPreviewIndex.value = index;
  diaryPreviewEditable.value = editable;
  diaryPreviewOnRemove.value = onRemove ?? null;
  diaryPreviewOpen.value = true;
}

function handleDiaryPreviewRemove(index: number) {
  if (diaryPreviewOnRemove.value) {
    diaryPreviewOnRemove.value(index);
  }
}

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts) - images/excursion_ids/
// spot_ids sind bereits gespeicherte Bild-URLs bzw. ids, nicht der flüchtige Upload-Fortschritt
// (uploading/uploadError bleiben bewusst außen vor, kommen nicht in `form`/`editForm`).
const newDraft = useDraftAutosave('diary:new', form, showForm);
const editDraft = useDraftAutosave(
  () => `diary:edit:${editingEntry.value?.id}`,
  editForm,
  computed(() => editingEntry.value !== null)
);

// Bereits als Entwurf gesicherter, aber noch nicht veröffentlichter eigener Eintrag (#89) - höchstens
// einer gleichzeitig, siehe openNewForm()/closeForm() unten, die genau diesen statt eines
// zusätzlichen zweiten Entwurfs weiterverwenden.
const myDraft = computed(
  () => entries.value.find((e) => e.is_draft && e.author_id === auth.user?.id) ?? null
);

function hasEntryContent(f: { title: string; content: string; images: DiaryImage[] }) {
  return f.title.trim().length > 0 || !isEmptyRichText(f.content) || f.images.length > 0;
}

// Standardmäßig eingeklappt (siehe Konsistenz-Check-Anlass: die Auswahllisten nahmen auf mobile so
// viel Platz weg, dass das RichTextEditor-Haupttextfeld nicht mehr sichtbar war) - Zurücksetzen in
// openNewForm()/startEdit() unten, damit ein neuer Formular-Aufruf nicht die zuletzt aufgeklappte
// Liste des vorherigen Eintrags übernimmt.
const showExcursionPicker = ref(false);
const showSpotPicker = ref(false);
const editShowExcursionPicker = ref(false);
const editShowSpotPicker = ref(false);

const openComments = ref<Set<number>>(new Set());

// Lokales Datum (nicht toISOString, das ist UTC) im selben "YYYY-MM-DD"-Format wie
// Excursion.date (aus <input type="date">), damit sich beide direkt vergleichen lassen.
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Sortiert nach dem (frei änderbaren) Eintrags-Datum statt nur nach created_at - ein rückblickend
// nachgetragener oder auf einen anderen Tag verschobener Eintrag muss auch optisch an seine neue
// chronologische Stelle wandern statt an der Position seines tatsächlichen Speicherzeitpunkts
// hängen zu bleiben. created_at/id bleiben als Tiebreaker für mehrere Einträge am selben Tag.
function sortEntries() {
  entries.value.sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.id - a.id
  );
}

// Ausflüge, die am angegebenen Tag geplant sind, zuerst (Vorschlag, "⭐ Empfohlen" im Template) –
// der Rest bleibt in Store-Reihenfolge dahinter, damit man bei Bedarf auch einen Ausflug an einem
// anderen Tag zuordnen kann (z. B. ein Rückblick, der erst am Folgetag geschrieben wird).
function pickerExcursions(dateStr: string) {
  const matching = excursionsStore.excursions.filter((e) => e.date === dateStr);
  const rest = excursionsStore.excursions.filter((e) => e.date !== dateStr);
  return [...matching, ...rest];
}

// Analog zu pickerExcursions oben: an diesem Tag bereits geplante Spots (siehe spotAlreadyPlanned
// unten) zuerst, damit die "⭐ Empfohlen"-Markierung nicht in der übrigen Liste untergeht.
function pickerSpots(dateStr: string) {
  const matching = spotsStore.spots.filter((s) => spotAlreadyPlanned(s.id, dateStr));
  const rest = spotsStore.spots.filter((s) => !spotAlreadyPlanned(s.id, dateStr));
  return [...matching, ...rest];
}

function excursionsForEntry(entry: DiaryEntry): Excursion[] {
  return entry.excursion_ids
    .map((id) => excursionsStore.excursions.find((e) => e.id === id))
    .filter((e): e is Excursion => !!e);
}

function spotsForEntry(entry: DiaryEntry): Spot[] {
  return entry.spot_ids
    .map((id) => spotsStore.spots.find((s) => s.id === id))
    .filter((s): s is Spot => !!s);
}

// Wetter am jeweiligen Eintrags-Tag in der Urlaubsregion - eigenständig geladen (wie das Dashboard-
// Wetter-Widget), ein Fehlschlag soll das restliche Tagebuch nicht blockieren. Nutzt dieselbe
// gemergte Quelle (Live-Vorhersage + dauerhaft gespeicherte Ist-Werte, siehe utils/weather.ts) wie
// DashboardView.vue - funktioniert dadurch auch für Einträge aus lange vergangenen Urlauben.
const weatherDays = ref<DailyWeather[] | null>(null);
async function loadDiaryWeather() {
  if (trip.value?.lat == null || trip.value?.lng == null) return;
  try {
    weatherDays.value = await fetchMergedWeather(
      tripId,
      trip.value.lat,
      trip.value.lng,
      weatherProvider.model
    );
  } catch {
    weatherDays.value = null;
  }
}
function weatherForEntry(entry: DiaryEntry): DailyWeather | null {
  return weatherDays.value?.find((d) => d.date === entry.date) ?? null;
}

// Ob ein Spot an diesem Tag bereits geplant ist – entweder direkt (schedule_items.spot_id, z. B.
// über den Kalender/die Karte eingeplant) oder als Station eines an diesem Tag geplanten Ausflugs.
// Nur dieser bereits VOR dem Öffnen des Formulars bestehende Zustand zählt als "⭐ Empfohlen" (#216)
// - anders als früher wird das Zuordnen eines Spots hier selbst nicht mehr sofort zu einer eigenen
// Planung (siehe toggleSpot unten), verfälscht die Empfehlung also nicht mehr rückwirkend.
function spotAlreadyPlanned(spotId: number, dateStr: string) {
  return (
    scheduleStore.items.some((i) => i.spot_id === spotId && i.date === dateStr) ||
    excursionsStore.excursions.some((e) => e.date === dateStr && e.spot_ids.includes(spotId))
  );
}

// Spot einem Tagebucheintrag zu-/aberkennen: rein lokales Umschalten in spot_ids (#216) - anders
// als früher (excursionsStore.planSpotOnDate) legt das HIER noch keinen Kalendertermin/Ausflug an,
// das passiert erst beim tatsächlichen Speichern des Eintrags (siehe markLinkedAsDone unten), genau
// wie bei den Touren-Checkboxen daneben. Dadurch entstehen auch keine Karteileichen mehr, wenn das
// Formular ohne Speichern geschlossen wird.
function toggleSpot(spotId: number, target: { spot_ids: number[] }) {
  const idx = target.spot_ids.indexOf(spotId);
  if (idx === -1) target.spot_ids.push(spotId);
  else target.spot_ids.splice(idx, 1);
}

// Setzt automatisch gemacht=true (mit dem Datum des Eintrags, falls noch nicht anderweitig
// geplant) auf jede Tour/jeden Spot, die/der beim Speichern dieses Eintrags per Checkbox/Spot-
// Picker verknüpft wurde (Nutzer-Entscheidung: explizites Zuordnen soll zusätzlich zur Verknüpfung
// auch den "gemacht"-Status setzen) – ein Tagebucheintrag dokumentiert per Definition etwas
// tatsächlich Erlebtes. Bewusst best-effort/nicht blockierend für den Save-Erfolg – ein einzelner
// fehlgeschlagener Toggle soll den bereits gespeicherten Tagebucheintrag nicht als fehlgeschlagen
// erscheinen lassen.
async function markLinkedAsDone(excursionIds: number[], spotIds: number[], date: string) {
  const tripId = tripStore.currentTripId;
  try {
    await Promise.all([
      ...excursionIds.map(async (id) => {
        const excursion = excursionsStore.excursions.find((e) => e.id === id);
        if (excursion && !excursion.date) await excursionsStore.setDate(id, date);
        await excursionsStore.setDone(id, true);
      }),
      ...spotIds.map(async (id) => {
        if (tripId != null && !spotAlreadyPlanned(id, date)) {
          const spot = spotsStore.spots.find((s) => s.id === id);
          if (spot) await scheduleStore.setSpotDate(id, tripId, spot.title, date);
        }
        await spotsStore.setDone(id, true);
      }),
    ]);
  } catch {
    // Best effort - der Tagebucheintrag selbst ist bereits gespeichert, siehe Kommentar oben.
  }
}

async function load() {
  try {
    const [entriesRes, likesRes, commentsRes, usersRes] = await Promise.all([
      api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
      api.get<DiaryLike[]>(`/diary/likes?trip_id=${tripId}`),
      api.get<DiaryComment[]>(`/diary/comments?trip_id=${tripId}`),
      api.get<User[]>(`/trips/${tripId}/members`),
      excursionsStore.load(),
      spotsStore.load(),
      scheduleStore.load(),
    ]);
    entries.value = entriesRes;
    likes.value = likesRes;
    comments.value = commentsRes;
    users.value = usersRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

watch(() => liveSync.domainVersion.diary, load);

onMounted(async () => {
  highlightedIds.value = liveSync.markSeen('diary');
  await load();
  loadDiaryWeather();
});

function author(id: number) {
  return users.value.find((u) => u.id === id);
}

// Mit-Bearbeiter:innen für die "bearbeitet von"-Zeile (#93) - author_id selbst zählt nicht als
// Mit-Bearbeiter:in, auch wenn die Haupt-Autorin/der Haupt-Autor den eigenen Eintrag erneut speichert.
function coEditorsFor(entry: DiaryEntry): User[] {
  return entry.editor_ids
    .filter((id) => id !== entry.author_id)
    .map((id) => author(id))
    .filter((u): u is User => !!u);
}

function likesFor(entryId: number) {
  return likes.value.filter((l) => l.entry_id === entryId);
}
function likedByMe(entryId: number) {
  return likesFor(entryId).some((l) => l.user_id === auth.user?.id);
}
function commentsFor(entryId: number) {
  return comments.value
    .filter((c) => c.entry_id === entryId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function commentItemsFor(entryId: number) {
  return commentsFor(entryId).map((c) => ({
    id: c.id,
    avatar: c.author_avatar ?? author(c.author_id)?.avatar ?? '❓',
    username: c.author_username ?? author(c.author_id)?.username ?? '?',
    content: c.content,
    created_at: c.created_at,
    updated_at: c.updated_at,
    canRemove: c.author_id === auth.user?.id,
    canEdit: c.author_id === auth.user?.id,
    likeCount: c.like_count ?? 0,
    liked: Boolean(c.liked),
  }));
}

/** Komprimiert ausgewählte Bilder im Browser (Canvas-API) und lädt sie hoch – spart Traffic
 *  und vermeidet serverseitige Bildverarbeitung auf dem ressourcenschwachen Pi. */
async function uploadFiles(
  fileList: FileList | null,
  target: { images: DiaryImage[] },
  uploadingRef: typeof uploading,
  errorRef: typeof uploadError
) {
  const files = fileList ? Array.from(fileList) : [];
  if (!files.length) return;
  uploadingRef.value = true;
  errorRef.value = '';
  try {
    for (const file of files) {
      const compressed = await compressImage(file);
      const res = await api.post<{ url: string; original_name?: string }>('/diary/images', {
        data: compressed,
        filename: file.name,
      });
      target.images.push({
        url: res.url,
        original_name: res.original_name || file.name,
      });
    }
  } catch {
    errorRef.value = 'Bild-Upload fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    uploadingRef.value = false;
  }
}

function onNewFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadFiles(input.files, form.value, uploading, uploadError);
  input.value = '';
}

function onEditFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadFiles(input.files, editForm.value, editUploading, editUploadError);
  input.value = '';
}

function removeImage(target: { images: DiaryImage[] }, index: number) {
  target.images.splice(index, 1);
}

async function removeImageFromEntry(entry: DiaryEntry, index: number) {
  if (auth.user?.restricted) return;
  const removed = entry.images[index];
  entry.images.splice(index, 1);
  const body = {
    title: entry.title || undefined,
    content: entry.content,
    content_format: entry.content_format || 'html',
    images: entry.images,
    excursion_ids: entry.excursion_ids ?? [],
    spot_ids: entry.spot_ids ?? [],
    date: entry.date,
    is_draft: Boolean(entry.is_draft),
  };
  try {
    const updated = await api.put<DiaryEntry>(`/diary/${entry.id}`, body);
    const idx = entries.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) entries.value[idx] = updated;
    sortEntries();
  } catch (err) {
    entry.images.splice(index, 0, removed);
    console.error('Fehler beim Entfernen des Bildes aus dem Tagebucheintrag:', err);
  }
}

// "+ Neuer Eintrag": ein bereits gesicherter eigener Entwurf wird weiterbearbeitet statt einen
// zweiten, parallelen Entwurf anzulegen (#89).
function openNewForm() {
  if (myDraft.value) {
    startEdit(myDraft.value);
    return;
  }
  form.value = emptyForm();
  showSpotPicker.value = false;
  // Vorschlag: an diesem Tag geplante Ausflüge direkt vorauswählen, statt sie nur anzuzeigen –
  // meist wird ein Eintrag ja am selben Tag über genau diesen Ausflug geschrieben.
  form.value.excursion_ids = excursionsStore.excursions
    .filter((e) => e.date === form.value.date)
    .map((e) => e.id);
  // Picker bei einer Vorauswahl direkt aufklappen, damit die "Empfohlen"-Markierung sichtbar ist
  // (Standard sonst eingeklappt, siehe showExcursionPicker oben).
  showExcursionPicker.value = form.value.excursion_ids.length > 0;
  showForm.value = true;
}

async function submitEntry() {
  if (isEmptyRichText(form.value.content)) return;
  const body = {
    trip_id: tripId,
    title: form.value.title || undefined,
    content: form.value.content,
    content_format: 'html',
    images: form.value.images,
    excursion_ids: form.value.excursion_ids,
    spot_ids: form.value.spot_ids,
    date: form.value.date,
  };
  const created = await api.post<DiaryEntry>('/diary', body);
  entries.value.unshift(created);
  sortEntries();
  markLinkedAsDone(form.value.excursion_ids, form.value.spot_ids, form.value.date);
  form.value = emptyForm();
  showForm.value = false;
  newDraft.clear();
}

// Schließen ohne "Eintragen" verwirft nicht mehr kommentarlos den eingegebenen Inhalt (#89) -
// stattdessen wird ein echter, für andere Trip-Mitglieder unsichtbarer Entwurfs-Eintrag angelegt
// (is_draft:true), sichtbar/weiterbearbeitbar über die Tagebuch-Liste. Ganz leere Formulare erzeugen
// weiterhin keinen Eintrag; markLinkedAsDone() läuft bewusst nicht mit - das "gemacht"-Setzen soll
// erst beim tatsächlichen Veröffentlichen greifen.
async function closeForm() {
  showForm.value = false;
  if (hasEntryContent(form.value)) {
    const body = {
      trip_id: tripId,
      title: form.value.title || undefined,
      content: form.value.content,
      content_format: 'html',
      images: form.value.images,
      excursion_ids: form.value.excursion_ids,
      spot_ids: form.value.spot_ids,
      date: form.value.date,
      is_draft: true,
    };
    const created = await api.post<DiaryEntry>('/diary', body);
    entries.value.unshift(created);
    sortEntries();
  }
  form.value = emptyForm();
  newDraft.clear();
}

function startEdit(entry: DiaryEntry) {
  editingEntry.value = entry;
  editForm.value = {
    title: entry.title ?? '',
    content: entry.content,
    images: [...entry.images],
    excursion_ids: [...entry.excursion_ids],
    spot_ids: [...entry.spot_ids],
    date: entry.date,
  };
  editShowExcursionPicker.value = editForm.value.excursion_ids.length > 0;
  editShowSpotPicker.value = editForm.value.spot_ids.length > 0;
}

// Explizites "Speichern"/"Veröffentlichen" macht aus einem Entwurf immer einen veröffentlichten
// Eintrag (is_draft:false) - für bereits veröffentlichte Einträge ist das ein No-op, da dort schon 0.
async function submitEditEntry() {
  if (!editingEntry.value || isEmptyRichText(editForm.value.content)) return;
  const body = {
    title: editForm.value.title || undefined,
    content: editForm.value.content,
    content_format: 'html',
    images: editForm.value.images,
    excursion_ids: editForm.value.excursion_ids,
    spot_ids: editForm.value.spot_ids,
    date: editForm.value.date,
    is_draft: false,
  };
  const updated = await api.put<DiaryEntry>(`/diary/${editingEntry.value.id}`, body);
  const idx = entries.value.findIndex((e) => e.id === updated.id);
  if (idx !== -1) entries.value[idx] = updated;
  sortEntries();
  markLinkedAsDone(editForm.value.excursion_ids, editForm.value.spot_ids, editForm.value.date);
  editDraft.clear();
  editingEntry.value = null;
}

// Schließen ohne "Speichern" bei einem noch unveröffentlichten Entwurf sichert den aktuellen Stand
// weiterhin als Entwurf (statt die Änderungen zu verwerfen) - bei einem bereits veröffentlichten
// Eintrag bleibt es wie bisher beim reinen Verwerfen des Bearbeitungs-Zwischenstands.
async function closeEditForm() {
  if (editingEntry.value?.is_draft && hasEntryContent(editForm.value)) {
    const body = {
      title: editForm.value.title || undefined,
      content: editForm.value.content,
      content_format: 'html',
      images: editForm.value.images,
      excursion_ids: editForm.value.excursion_ids,
      spot_ids: editForm.value.spot_ids,
      date: editForm.value.date,
      is_draft: true,
    };
    const updated = await api.put<DiaryEntry>(`/diary/${editingEntry.value.id}`, body);
    const idx = entries.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) entries.value[idx] = updated;
    sortEntries();
  }
  editDraft.clear();
  editingEntry.value = null;
}

async function deleteEditingEntry() {
  if (!editingEntry.value) return;
  const id = editingEntry.value.id;
  editDraft.clear();
  editingEntry.value = null;
  await removeEntry(id);
}

async function removeEntry(id: number) {
  await api.delete(`/diary/${id}`);
  entries.value = entries.value.filter((e) => e.id !== id);
  showToast({
    message: 'Tagebucheintrag gelöscht. Er befindet sich nun im Papierkorb.',
    type: 'info',
  });
}

async function toggleLike(entryId: number) {
  const result = await api.post<{ liked: boolean }>(`/diary/${entryId}/like`);
  if (result.liked) {
    likes.value.push({ id: Date.now(), entry_id: entryId, user_id: auth.user!.id });
  } else {
    likes.value = likes.value.filter(
      (l) => !(l.entry_id === entryId && l.user_id === auth.user!.id)
    );
  }
}

function toggleComments(entryId: number) {
  if (openComments.value.has(entryId)) openComments.value.delete(entryId);
  else openComments.value.add(entryId);
}

async function submitComment(entryId: number, content: string) {
  const created = await api.post<DiaryComment>(`/diary/${entryId}/comments`, { content });
  comments.value.push(created);
}

async function removeComment(id: number) {
  await api.delete(`/diary/comments/${id}`);
  comments.value = comments.value.filter((c) => c.id !== id);
}

async function updateComment(id: number, content: string) {
  const updated = await api.put<DiaryComment>(`/diary/comments/${id}`, { content });
  const idx = comments.value.findIndex((c) => c.id === id);
  if (idx !== -1) {
    comments.value[idx] = updated;
  }
}

async function toggleCommentLike(commentId: number) {
  const c = comments.value.find((item) => item.id === commentId);
  if (c) {
    const wasLiked = Boolean(c.liked);
    c.liked = !wasLiked;
    c.like_count = Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1));
  }
  try {
    const result = await api.post<{ liked: boolean; like_count: number }>(
      `/diary/comments/${commentId}/like`
    );
    if (c) {
      c.liked = result.liked;
      c.like_count = result.like_count;
    }
  } catch (err) {
    if (c) {
      const wasLiked = Boolean(c.liked);
      c.liked = !wasLiked;
      c.like_count = Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1));
    }
    throw err;
  }
}

function hasMapContent(entry: DiaryEntry): boolean {
  if (entry.spot_ids && entry.spot_ids.length > 0) return true;
  if (entry.excursion_ids && entry.excursion_ids.length > 0) return true;
  const stations = buildDayStations(
    entry.date,
    scheduleStore.items,
    excursionsStore.excursions,
    travelItems.value,
    spotsStore.spots
  );
  return stations.length > 0;
}

// Neuer Button (#216): den Tag des Eintrags (inkl. aller an diesem Tag geplanten Touren/Spots) auf
// der Karte zeigen - gleiches Muster wie ScheduleView.vue's "Tag auf Karte anzeigen".
function showEntryDayOnMap(entry: DiaryEntry) {
  drawers.focusMapOnDate(entry.date);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Tagebuch</h1>
      <Button @click="openNewForm"
        ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neuer Eintrag</Button
      >
    </div>

    <Modal
      :model-value="showForm"
      title="Neuer Tagebucheintrag"
      full-height
      @update:model-value="(v) => !v && closeForm()"
    >
      <form class="add-form" @submit.prevent="submitEntry">
        <FormField icon="date" label="Datum" v-slot="{ id }">
          <Input :id="id" v-model="form.date" type="date" required />
        </FormField>
        <FormField icon="title" label="Titel" v-slot="{ id }">
          <Input :id="id" v-model="form.title" type="text" placeholder="Titel (optional)" />
        </FormField>
        <RichTextEditor v-model="form.content" placeholder="Was ist heute passiert?" />
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <div v-else class="upload-control">
          <input
            ref="newFileInputRef"
            type="file"
            class="file-input-hidden"
            accept="image/*"
            multiple
            aria-label="Bilder auswählen"
            :disabled="uploading"
            @change="onNewFilesSelected"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :icon="FORM_FIELD_ICONS.image"
            :disabled="uploading"
            @click="newFileInputRef?.click()"
          >
            {{ uploading ? 'Bilder werden hochgeladen …' : 'Bilder hinzufügen' }}
          </Button>
        </div>
        <p v-if="uploadError" class="hint error">{{ uploadError }}</p>
        <AttachmentThumbnails
          v-if="form.images.length"
          :items="form.images"
          remove-title="Bild entfernen"
          remove-aria-label="Bild entfernen"
          @click="(idx) => openDiaryPreview(form.images, idx, true, (i) => removeImage(form, i))"
          @remove="(idx) => removeImage(form, idx)"
        />
        <CollapsibleFieldset
          v-if="excursionsStore.excursions.length"
          v-model="showExcursionPicker"
          label="Touren zuordnen"
          :count="
            form.excursion_ids.length ? `(${form.excursion_ids.length} ausgewählt)` : undefined
          "
          :icon="SECTION_ICON_DEFS.excursions"
          icon-group="navigation"
        >
          <label
            :for="`diary-excursion-${ex.id}`"
            v-for="ex in pickerExcursions(form.date)"
            :key="ex.id"
            class="excursion-option"
          >
            <Checkbox
              :id="`diary-excursion-${ex.id}`"
              :value="ex.id"
              v-model="form.excursion_ids"
            />
            <span class="excursion-option-title">{{ ex.title }}</span>
            <span v-if="ex.date === form.date" class="excursion-option-badge recommended">
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </label>
        </CollapsibleFieldset>

        <CollapsibleFieldset
          v-if="spotsStore.spots.length"
          v-model="showSpotPicker"
          label="Spots zuordnen"
          :count="form.spot_ids.length ? `(${form.spot_ids.length} ausgewählt)` : undefined"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <Button
            v-for="spot in pickerSpots(form.date)"
            :key="spot.id"
            type="button"
            class="excursion-option spot-option-btn"
            @click="toggleSpot(spot.id, form)"
          >
            <span class="excursion-option-title">
              <AppIcon
                :icon="spotCategoryMeta(spot.category).tabler"
                :size="14"
                group="categories"
              />
              {{ spot.title }}
            </span>
            <span v-if="form.spot_ids.includes(spot.id)" class="excursion-option-badge">
              <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
            </span>
            <span
              v-else-if="spotAlreadyPlanned(spot.id, form.date)"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </Button>
        </CollapsibleFieldset>
        <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button type="submit">Eintragen</Button>
        </div>
      </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="entries">
      <Card
        tag="article"
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="entry animate-cascade"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
        :highlight="highlightedIds.has(entry.id)"
      >
        <header class="entry-head">
          <span class="avatar">{{
            entry.author_avatar ?? author(entry.author_id)?.avatar ?? '❓'
          }}</span>
          <div class="entry-meta">
            <strong>{{ entry.author_username ?? author(entry.author_id)?.username ?? '?' }}</strong>
            <span class="date">
              {{ formatDate(entry.date) }}
              <span v-if="coEditorsFor(entry).length" class="edited-by">
                · bearbeitet von
                <span v-for="(u, i) in coEditorsFor(entry)" :key="u.id" class="edited-by-user">
                  <span class="edited-by-avatar">{{ u.avatar }}</span
                  >{{ u.username }}<template v-if="i < coEditorsFor(entry).length - 1">, </template>
                </span>
              </span>
              <span v-else-if="entry.updated_at"> (bearbeitet)</span>
            </span>
          </div>
          <PendingSyncBadge v-if="entry._pending" />
          <div class="entry-actions">
            <EditButton small @click="startEdit(entry)" />
          </div>
        </header>

        <h3 v-if="entry.title">{{ entry.title }}</h3>
        <DraftBadge v-if="entry.is_draft" />
        <RichTextDisplay class="content" :content="entry.content" :format="entry.content_format" />

        <div class="diary-polaroid-wrap" v-if="entry.images.length">
          <PolaroidStack
            :items="entry.images"
            clipped
            @click="
              (idx) =>
                openDiaryPreview(entry.images, idx, !auth.user?.restricted, (i) =>
                  removeImageFromEntry(entry, i)
                )
            "
          />
        </div>

        <div class="card-actions-wrapper">
          <div class="excursion-links">
            <div
              v-if="weatherForEntry(entry)"
              class="diary-weather"
              :title="weatherCodeMeta(weatherForEntry(entry)!.weatherCode).label"
            >
              <WeatherIcon
                class="weather-icon"
                :size="16"
                :code="weatherForEntry(entry)!.weatherCode"
              />
              <span class="weather-temp"
                >{{ Math.round(weatherForEntry(entry)!.tempMax) }}° /
                {{ Math.round(weatherForEntry(entry)!.tempMin) }}°</span
              >
            </div>
            <Button
              type="button"
              variant="card-action"
              v-if="hasMapContent(entry)"
              @click="showEntryDayOnMap(entry)"
            >
              <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
              anzeigen
            </Button>
            <Button
              v-for="ex in excursionsForEntry(entry)"
              :key="ex.id"
              type="button"
              variant="ghost"
              class="excursion-chip"
              @click="drawers.openMapForExcursion(ex.id)"
            >
              <span
                class="excursion-chip-img"
                :style="ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : {}"
              >
                <AppIcon
                  v-if="!ex.image_url"
                  :icon="SECTION_ICON_DEFS.excursions"
                  :size="16"
                  group="navigation"
                />
              </span>
              <span class="excursion-chip-title">{{ ex.title }}</span>
            </Button>
            <Button
              v-for="spot in spotsForEntry(entry)"
              :key="spot.id"
              type="button"
              variant="ghost"
              class="excursion-chip"
              @click="drawers.openMapAt(`spot-${spot.id}`)"
            >
              <span
                class="excursion-chip-img"
                :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}"
              >
                <AppIcon
                  v-if="!spot.image_url"
                  :icon="spotCategoryMeta(spot.category).tabler"
                  :size="16"
                  group="categories"
                />
              </span>
              <span class="excursion-chip-title">{{ spot.title }}</span>
            </Button>
          </div>

          <SocialRow
            :like-count="likesFor(entry.id).length"
            :liked="likedByMe(entry.id)"
            :comment-count="commentsFor(entry.id).length"
            :comments-open="openComments.has(entry.id)"
            @toggle-like="toggleLike(entry.id)"
            @toggle-comments="toggleComments(entry.id)"
          />
        </div>

        <Accordion :expanded="openComments.has(entry.id)">
          <Comments
            :comments="commentItemsFor(entry.id)"
            @submit="(content) => submitComment(entry.id, content)"
            @remove="removeComment"
            @update="updateComment"
            @toggle-like="toggleCommentLike"
          />
        </Accordion>
      </Card>
    </TransitionGroup>
    <EmptyState v-if="!entries.length">Noch keine Tagebuch-Einträge.</EmptyState>

    <Modal
      :model-value="editingEntry !== null"
      title="Eintrag bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="add-form" @submit.prevent="submitEditEntry">
        <FormField icon="date" label="Datum" v-slot="{ id }">
          <Input :id="id" v-model="editForm.date" type="date" required />
        </FormField>
        <FormField icon="title" label="Titel" v-slot="{ id }">
          <Input :id="id" v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        </FormField>
        <RichTextEditor v-model="editForm.content" />
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <div v-else class="upload-control">
          <input
            ref="editFileInputRef"
            type="file"
            class="file-input-hidden"
            accept="image/*"
            multiple
            aria-label="Bilder auswählen"
            :disabled="editUploading"
            @change="onEditFilesSelected"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :icon="FORM_FIELD_ICONS.image"
            :disabled="editUploading"
            @click="editFileInputRef?.click()"
          >
            {{ editUploading ? 'Bilder werden hochgeladen …' : 'Bilder hinzufügen' }}
          </Button>
        </div>
        <p v-if="editUploadError" class="hint error">{{ editUploadError }}</p>
        <AttachmentThumbnails
          v-if="editForm.images.length"
          :items="editForm.images"
          remove-title="Bild entfernen"
          remove-aria-label="Bild entfernen"
          @click="
            (idx) => openDiaryPreview(editForm.images, idx, true, (i) => removeImage(editForm, i))
          "
          @remove="(idx) => removeImage(editForm, idx)"
        />
        <CollapsibleFieldset
          v-if="excursionsStore.excursions.length"
          v-model="editShowExcursionPicker"
          label="Touren zuordnen"
          :count="
            editForm.excursion_ids.length
              ? `(${editForm.excursion_ids.length} ausgewählt)`
              : undefined
          "
          :icon="SECTION_ICON_DEFS.excursions"
          icon-group="navigation"
        >
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label
            v-for="ex in pickerExcursions(editForm.date)"
            :key="ex.id"
            class="excursion-option"
          >
            <Checkbox :value="ex.id" v-model="editForm.excursion_ids" />
            <span class="excursion-option-title">{{ ex.title }}</span>
            <span v-if="ex.date === editForm.date" class="excursion-option-badge recommended">
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </label>
        </CollapsibleFieldset>

        <CollapsibleFieldset
          v-if="spotsStore.spots.length"
          v-model="editShowSpotPicker"
          label="Spots zuordnen"
          :count="editForm.spot_ids.length ? `(${editForm.spot_ids.length} ausgewählt)` : undefined"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <Button
            v-for="spot in pickerSpots(editForm.date)"
            :key="spot.id"
            type="button"
            class="excursion-option spot-option-btn"
            @click="toggleSpot(spot.id, editForm)"
          >
            <span class="excursion-option-title">
              <AppIcon
                :icon="spotCategoryMeta(spot.category).tabler"
                :size="14"
                group="categories"
              />
              {{ spot.title }}
            </span>
            <span v-if="editForm.spot_ids.includes(spot.id)" class="excursion-option-badge">
              <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
            </span>
            <span
              v-else-if="spotAlreadyPlanned(spot.id, editForm.date)"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </Button>
        </CollapsibleFieldset>
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <div class="actions-row">
          <Button
            v-if="editingEntry?.author_id === auth.user?.id"
            type="button"
            variant="danger"
            size="sm"
            :icon="ACTION_ICONS.delete"
            @click="deleteEditingEntry"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="submit">{{
            editingEntry?.is_draft ? 'Veröffentlichen' : 'Speichern'
          }}</Button>
        </div>
      </form>
    </Modal>
    <AttachmentPreviewModal
      v-model="diaryPreviewOpen"
      :attachments="diaryPreviewImages"
      :initial-index="diaryPreviewIndex"
      :editable="diaryPreviewEditable"
      @remove="handleDiaryPreviewRemove"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.file-input-hidden {
  display: none;
}

.excursion-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 400;
}

.excursion-option-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

/* Spot-Picker nutzt Buttons statt Checkbox-Labels (Klick schaltet die Zuordnung um, siehe
   toggleSpot) – Button-Grundstil zurücksetzen, damit er optisch zu den Checkbox-Zeilen der
   Ausflüge darüber passt. box-shadow explizit entfernen (#216) - der globale button-Grundstil
   (style.css) hängt sonst jedem Listeneintrag den Standard-Button-Schatten an, den Touren-Zeilen
   (echte <label>s, keine <Button>s) nicht haben. */
.spot-option-btn {
  background: none;
  border: none;
  box-shadow: none;
  padding: 2px 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
}

.spot-option-btn:active {
  box-shadow: none;
}

.excursion-option-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-success);
  white-space: nowrap;
}

/* Hebt die für den Tag des Eintrags tatsächlich geplanten Vorschläge zusätzlich optisch hervor
   (eigener Hintergrund-Chip statt nur eingefärbtem Text wie beim generischen Badge oben) - unter
   ggf. weiteren wählbaren Einträgen sollen sie sofort als die wahrscheinlich gemeinten erkennbar
   sein (siehe auch pickerExcursions/pickerSpots, die sie zusätzlich an den Listenanfang sortieren). */
.excursion-option-badge.recommended {
  background: var(--color-primary-tint);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

/* Aktionsleiste am unteren Rand der Kachel (Ausflugslinks links, Social-Actions rechts) */
.card-actions-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.excursion-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.excursion-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-hover);
  border: none;
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 4px 12px 4px 4px;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
}

.excursion-chip:hover {
  background: var(--color-primary-tint);
}

.excursion-chip-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
}

/* Gleiche Pillen-Dichte wie .excursion-chip daneben, aber kompakter (nur Icon + Temp, ohne
   Regenwahrscheinlichkeit) - reine Zusatzinfo, kein anklickbares Element. */
.diary-weather {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 4px 12px;
  font-size: 0.82rem;
  color: var(--color-text);
}

.diary-weather .weather-icon {
  font-size: 1rem;
}

.hint {
  margin: -4px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.hint.error {
  color: var(--color-danger);
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 800px;
  margin: 0 auto;
}

.entry-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.avatar {
  font-size: 1.6rem;
}

.entry-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.date {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.edited-by-avatar {
  font-size: 0.9em;
}

.entry-actions {
  display: flex;
  gap: 4px;
}

.entry h3 {
  margin: 0 0 var(--space-1);
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.content {
  margin: 0 0 var(--space-2);
  overflow-wrap: anywhere;
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

.diary-polaroid-wrap {
  margin: var(--space-2) 0;
  padding: 4px 0 6px 4px;
}
</style>
