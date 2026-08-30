<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, Excursion, Spot, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
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
import DeleteButton from '../components/DeleteButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import DraftBadge from '../components/DraftBadge.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
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
  images: [] as string[],
  excursion_ids: [] as number[],
  spot_ids: [] as number[],
  date: localDateStr(new Date()),
});
const form = ref(emptyForm());
const uploading = ref(false);
const uploadError = ref('');

const editingEntry = ref<DiaryEntry | null>(null);
const editForm = ref(emptyForm());
const editUploading = ref(false);
const editUploadError = ref('');

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

function hasEntryContent(f: { title: string; content: string; images: string[] }) {
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
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}

/** Komprimiert ausgewählte Bilder im Browser (Canvas-API) und lädt sie hoch – spart Traffic
 *  und vermeidet serverseitige Bildverarbeitung auf dem ressourcenschwachen Pi. */
async function uploadFiles(
  fileList: FileList | null,
  target: { images: string[] },
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
      const { url } = await api.post<{ url: string }>('/diary/images', { data: compressed });
      target.images.push(url);
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

function removeImage(target: { images: string[] }, index: number) {
  target.images.splice(index, 1);
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

async function removeEntry(id: number) {
  await api.delete(`/diary/${id}`);
  entries.value = entries.value.filter((e) => e.id !== id);
  showToast({ message: 'Tagebucheintrag gelöscht. Er befindet sich nun im Papierkorb.', type: 'info' });
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
        <FormField icon="date" label="Datum">
          <input v-model="form.date" type="date" required />
        </FormField>
        <FormField icon="title" label="Titel">
          <input v-model="form.title" type="text" placeholder="Titel (optional)" />
        </FormField>
        <RichTextEditor v-model="form.content" placeholder="Was ist heute passiert?" />
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <label v-else class="upload-label">
          <AppIcon :icon="FORM_FIELD_ICONS.image" :size="14" group="formFields" /> Bilder hinzufügen
          <input
            type="file"
            accept="image/*"
            multiple
            :disabled="uploading"
            @change="onNewFilesSelected"
          />
        </label>
        <p v-if="uploading" class="hint">Bilder werden komprimiert & hochgeladen…</p>
        <p v-if="uploadError" class="hint error">{{ uploadError }}</p>
        <div class="image-preview" v-if="form.images.length">
          <div class="preview-thumb" v-for="(img, i) in form.images" :key="img">
            <img :src="img" :alt="`Bild ${i + 1}`" />
            <IconButton
              size="sm"
              :icon="ACTION_ICONS.close"
              class="remove-thumb"
              title="Bild entfernen"
              aria-label="Bild entfernen"
              @click="removeImage(form, i)"
            />
          </div>
        </div>
        <fieldset v-if="excursionsStore.excursions.length" class="excursion-picker">
          <legend>
            <Button
              type="button"
              variant="ghost"
              class="picker-toggle"
              :aria-expanded="showExcursionPicker"
              @click="showExcursionPicker = !showExcursionPicker"
            >
              <span
                ><AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" />
                Touren zuordnen<span v-if="form.excursion_ids.length" class="picker-count">
                  ({{ form.excursion_ids.length }} ausgewählt)</span
                ></span
              >
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !showExcursionPicker }"
              />
            </Button>
          </legend>
          <template v-if="showExcursionPicker">
            <label v-for="ex in pickerExcursions(form.date)" :key="ex.id" class="excursion-option">
              <input type="checkbox" :value="ex.id" v-model="form.excursion_ids" />
              <span class="excursion-option-title">{{ ex.title }}</span>
              <span v-if="ex.date === form.date" class="excursion-option-badge recommended"
                ><AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen –
                an diesem Tag geplant</span
              >
            </label>
          </template>
        </fieldset>
        <fieldset v-if="spotsStore.spots.length" class="excursion-picker">
          <legend>
            <Button
              type="button"
              variant="ghost"
              class="picker-toggle"
              :aria-expanded="showSpotPicker"
              @click="showSpotPicker = !showSpotPicker"
            >
              <span
                ><AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" /> Spots
                zuordnen<span v-if="form.spot_ids.length" class="picker-count">
                  ({{ form.spot_ids.length }} ausgewählt)</span
                ></span
              >
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !showSpotPicker }"
              />
            </Button>
          </legend>
          <template v-if="showSpotPicker">
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
              <span v-if="form.spot_ids.includes(spot.id)" class="excursion-option-badge"
                ><AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt</span
              >
              <span
                v-else-if="spotAlreadyPlanned(spot.id, form.date)"
                class="excursion-option-badge recommended"
                ><AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen –
                an diesem Tag geplant</span
              >
            </Button>
          </template>
        </fieldset>
        <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
        <Button type="submit">Eintragen</Button>
      </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="entries">
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="card entry"
        :class="{ 'new-highlight': highlightedIds.has(entry.id) }"
      >
        <header class="entry-head">
          <span class="avatar">{{ author(entry.author_id)?.avatar ?? '❓' }}</span>
          <div class="entry-meta">
            <strong>{{ author(entry.author_id)?.username ?? '?' }}</strong>
            <span class="date">
              {{ formatDate(entry.date) }}
              <span v-if="coEditorsFor(entry).length" class="edited-by">
                · bearbeitet von
                <span v-for="(u, i) in coEditorsFor(entry)" :key="u.id" class="edited-by-user">
                  <span class="edited-by-avatar">{{ u.avatar }}</span
                  >{{ u.username
                  }}<template v-if="i < coEditorsFor(entry).length - 1">, </template>
                </span>
              </span>
              <span v-else-if="entry.updated_at"> (bearbeitet)</span>
            </span>
          </div>
          <PendingSyncBadge v-if="entry._pending" />
          <div class="entry-actions">
            <EditButton small @click="startEdit(entry)" />
            <DeleteButton
              v-if="entry.author_id === auth.user?.id"
              small
              @click="removeEntry(entry.id)"
            />
          </div>
        </header>

        <h3 v-if="entry.title">{{ entry.title }}</h3>
        <DraftBadge v-if="entry.is_draft" />
        <RichTextDisplay
          class="content"
          :content="entry.content"
          :format="entry.content_format"
        />

        <div class="gallery" v-if="entry.images.length">
          <a v-for="(img, i) in entry.images" :key="i" :href="img" target="_blank" rel="noopener">
            <img :src="img" :alt="`Bild ${i + 1}`" loading="lazy" />
          </a>
        </div>

        <SocialRow
          :like-count="likesFor(entry.id).length"
          :liked="likedByMe(entry.id)"
          :comment-count="commentsFor(entry.id).length"
          @toggle-like="toggleLike(entry.id)"
          @toggle-comments="toggleComments(entry.id)"
        />

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
          <Button type="button" variant="card-action" @click="showEntryDayOnMap(entry)">
            <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
            anzeigen
          </Button>
          <Button
            v-for="ex in excursionsForEntry(entry)"
            :key="ex.id"
            type="button"
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

        <Comments
          v-if="openComments.has(entry.id)"
          :comments="commentItemsFor(entry.id)"
          @submit="(content) => submitComment(entry.id, content)"
          @remove="removeComment"
        />
      </article>
    </TransitionGroup>
    <p v-if="!entries.length" class="empty">Noch keine Tagebuch-Einträge.</p>

    <Modal
      :model-value="editingEntry !== null"
      title="Eintrag bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="add-form" @submit.prevent="submitEditEntry">
        <FormField icon="date" label="Datum">
          <input v-model="editForm.date" type="date" required />
        </FormField>
        <FormField icon="title" label="Titel">
          <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        </FormField>
        <RichTextEditor v-model="editForm.content" />
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <label v-else class="upload-label">
          <AppIcon :icon="FORM_FIELD_ICONS.image" :size="14" group="formFields" /> Bilder hinzufügen
          <input
            type="file"
            accept="image/*"
            multiple
            :disabled="editUploading"
            @change="onEditFilesSelected"
          />
        </label>
        <p v-if="editUploading" class="hint">Bilder werden komprimiert & hochgeladen…</p>
        <p v-if="editUploadError" class="hint error">{{ editUploadError }}</p>
        <div class="image-preview" v-if="editForm.images.length">
          <div class="preview-thumb" v-for="(img, i) in editForm.images" :key="img">
            <img :src="img" :alt="`Bild ${i + 1}`" />
            <IconButton
              size="sm"
              :icon="ACTION_ICONS.close"
              class="remove-thumb"
              title="Bild entfernen"
              aria-label="Bild entfernen"
              @click="removeImage(editForm, i)"
            />
          </div>
        </div>
        <fieldset v-if="excursionsStore.excursions.length" class="excursion-picker">
          <legend>
            <Button
              type="button"
              variant="ghost"
              class="picker-toggle"
              :aria-expanded="editShowExcursionPicker"
              @click="editShowExcursionPicker = !editShowExcursionPicker"
            >
              <span
                ><AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" />
                Touren zuordnen<span v-if="editForm.excursion_ids.length" class="picker-count">
                  ({{ editForm.excursion_ids.length }} ausgewählt)</span
                ></span
              >
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !editShowExcursionPicker }"
              />
            </Button>
          </legend>
          <template v-if="editShowExcursionPicker">
            <label
              v-for="ex in pickerExcursions(editForm.date)"
              :key="ex.id"
              class="excursion-option"
            >
              <input type="checkbox" :value="ex.id" v-model="editForm.excursion_ids" />
              <span class="excursion-option-title">{{ ex.title }}</span>
              <span v-if="ex.date === editForm.date" class="excursion-option-badge recommended"
                ><AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen –
                an diesem Tag geplant</span
              >
            </label>
          </template>
        </fieldset>
        <fieldset v-if="spotsStore.spots.length" class="excursion-picker">
          <legend>
            <Button
              type="button"
              variant="ghost"
              class="picker-toggle"
              :aria-expanded="editShowSpotPicker"
              @click="editShowSpotPicker = !editShowSpotPicker"
            >
              <span
                ><AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" /> Spots
                zuordnen<span v-if="editForm.spot_ids.length" class="picker-count">
                  ({{ editForm.spot_ids.length }} ausgewählt)</span
                ></span
              >
              <AppIcon
                :icon="ACTION_ICONS.chevronDown"
                :size="14"
                group="actions"
                class="caret"
                :class="{ closed: !editShowSpotPicker }"
              />
            </Button>
          </legend>
          <template v-if="editShowSpotPicker">
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
              <span v-if="editForm.spot_ids.includes(spot.id)" class="excursion-option-badge"
                ><AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt</span
              >
              <span
                v-else-if="spotAlreadyPlanned(spot.id, editForm.date)"
                class="excursion-option-badge recommended"
                ><AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen –
                an diesem Tag geplant</span
              >
            </Button>
          </template>
        </fieldset>
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <Button type="submit">{{
          editingEntry?.is_draft ? 'Veröffentlichen' : 'Speichern'
        }}</Button>
      </form>
    </Modal>
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
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.upload-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.excursion-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.excursion-picker legend {
  width: 100%;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0;
}

/* Klickbarer Legend-Ersatz statt reinem Text (siehe showExcursionPicker/showSpotPicker im Script) -
   Standard-Button-Look zurückgesetzt, damit er wie eine Legend statt wie ein Button wirkt, volle
   Breite als Klick-/Tap-Fläche. */
.picker-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  background: none;
  border: none;
  /* Gleiches Muster/derselbe Fix wie ExcursionsView.vue's .tracks-toggle/.filter-toggle-row (#139) -
     der globale button-Selektor überschreibt sonst mit seinem Grund-Schatten. */
  box-shadow: none;
  padding: 4px;
  margin: 0;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  text-align: left;
}

.picker-count {
  font-weight: 400;
}

.caret {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.caret.closed {
  transform: rotate(-90deg);
}

.excursion-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 400;
}

.excursion-option-title {
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
  border-radius: 999px;
  corner-shape: round;
  font-weight: 600;
}

/* Verknüpfte Ausflüge am unteren Rand der Kachel (nach dem Inhalt, vor den Kommentaren) – Bild +
   Titel wie bei anderen "Sprung"-Links in der App (Architekturregel: nur Sprung-Button, kein
   Inline-Entfernen hier). */
.excursion-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.excursion-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
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
  border-radius: 999px;
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

.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-thumb {
  position: relative;
  width: 80px;
  height: 80px;
}

.preview-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.remove-thumb {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  corner-shape: round;
  border: none;
  background: var(--color-danger);
  color: white;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

.gallery {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  margin-bottom: var(--space-2);
}

.gallery img {
  height: 140px;
  width: auto;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}
</style>
