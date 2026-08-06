<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, Excursion, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { renderRichText } from '../utils/richText';
import { compressImage } from '../utils/imageCompression';
import { spotCategoryMeta } from '../utils/spotCategory';
import { formatDateTime } from '../utils/dateFormat';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const entries = ref<DiaryEntry[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const likes = ref<DiaryLike[]>([]);
const comments = ref<DiaryComment[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

const showForm = ref(false);
const emptyForm = () => ({ title: '', content: '', images: [] as string[], excursion_ids: [] as number[] });
const form = ref(emptyForm());
const uploading = ref(false);
const uploadError = ref('');

const editingEntry = ref<DiaryEntry | null>(null);
const editForm = ref(emptyForm());
const editUploading = ref(false);
const editUploadError = ref('');

// Rein lokale, flüchtige Markierung "in dieser Formular-Sitzung bereits per Spot-Picker
// hinzugefügt" (siehe pickSpot unten) – dient nur der visuellen Rückmeldung (Häkchen), kein
// Zurück-Mapping von excursion_ids auf Spots nötig, da ein Spot immer nur einmal angeklickt wird.
const pickedSpotIds = ref<Set<number>>(new Set());
const editPickedSpotIds = ref<Set<number>>(new Set());

const openComments = ref<Set<number>>(new Set());

// Lokales Datum (nicht toISOString, das ist UTC) im selben "YYYY-MM-DD"-Format wie
// Excursion.date (aus <input type="date">), damit sich beide direkt vergleichen lassen.
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateStrOf(iso: string) {
  return localDateStr(new Date(iso));
}

const todayDateStr = computed(() => localDateStr(new Date()));
const editEntryDateStr = computed(() => (editingEntry.value ? dateStrOf(editingEntry.value.created_at) : ''));

// Ausflüge, die am angegebenen Tag geplant sind, zuerst (Vorschlag) – der Rest bleibt in
// Store-Reihenfolge dahinter, damit man bei Bedarf auch einen Ausflug an einem anderen Tag
// zuordnen kann (z. B. ein Rückblick, der erst am Folgetag geschrieben wird).
function pickerExcursions(dateStr: string) {
  const matching = excursionsStore.excursions.filter((e) => e.date === dateStr);
  const rest = excursionsStore.excursions.filter((e) => e.date !== dateStr);
  return [...matching, ...rest];
}

function excursionsForEntry(entry: DiaryEntry): Excursion[] {
  return entry.excursion_ids
    .map((id) => excursionsStore.excursions.find((e) => e.id === id))
    .filter((e): e is Excursion => !!e);
}

// Ob ein Spot an diesem Tag bereits (über irgendeinen Ausflug) geplant ist – analog zum
// bestehenden "📅 heute geplant"-Badge bei Ausflügen, hier direkt über spot_ids geprüft (kein
// voller Stations-Resolver nötig).
function spotAlreadyPlanned(spotId: number, dateStr: string) {
  return excursionsStore.excursions.some((e) => e.date === dateStr && e.spot_ids.includes(spotId));
}

// Spot direkt zuordnen, ohne vorher einen Ausflug anzulegen: legt im Hintergrund einen
// Ein-Spot-Ausflug für den Tag des Eintrags an (oder findet einen bereits bestehenden,
// idempotent, siehe excursionsStore.planSpotOnDate) und fügt ihn wie einen normal
// ausgewählten Ausflug zu excursion_ids hinzu – der bestehende diary_excursions-Mechanismus
// bleibt dadurch unverändert.
async function pickSpot(spotId: number, dateStr: string, target: { excursion_ids: number[] }, picked: Set<number>) {
  const excursion = await excursionsStore.planSpotOnDate(spotId, dateStr);
  if (!target.excursion_ids.includes(excursion.id)) target.excursion_ids.push(excursion.id);
  picked.add(spotId);
}

async function load() {
  try {
    const [entriesRes, likesRes, commentsRes, usersRes] = await Promise.all([
      api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
      api.get<DiaryLike[]>(`/diary/likes?trip_id=${tripId}`),
      api.get<DiaryComment[]>(`/diary/comments?trip_id=${tripId}`),
      api.get<User[]>('/users'),
      excursionsStore.load(),
      spotsStore.load(),
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
});

function author(id: number) {
  return users.value.find((u) => u.id === id);
}

function formatDate(iso: string) {
  return formatDateTime(iso);
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
async function uploadFiles(fileList: FileList | null, target: { images: string[] }, uploadingRef: typeof uploading, errorRef: typeof uploadError) {
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

function openNewForm() {
  form.value = emptyForm();
  pickedSpotIds.value = new Set();
  // Vorschlag: an diesem Tag geplante Ausflüge direkt vorauswählen, statt sie nur anzuzeigen –
  // meist wird ein Eintrag ja am selben Tag über genau diesen Ausflug geschrieben.
  form.value.excursion_ids = excursionsStore.excursions.filter((e) => e.date === todayDateStr.value).map((e) => e.id);
  showForm.value = true;
}

async function submitEntry() {
  if (!form.value.content.trim()) return;
  const body = {
    trip_id: tripId,
    title: form.value.title || undefined,
    content: form.value.content.trim(),
    images: form.value.images,
    excursion_ids: form.value.excursion_ids,
  };
  const created = await api.post<DiaryEntry>('/diary', body);
  entries.value.unshift(created);
  form.value = emptyForm();
  showForm.value = false;
}

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
}

function startEdit(entry: DiaryEntry) {
  editingEntry.value = entry;
  editForm.value = {
    title: entry.title ?? '',
    content: entry.content,
    images: [...entry.images],
    excursion_ids: [...entry.excursion_ids],
  };
  editPickedSpotIds.value = new Set();
}

async function submitEditEntry() {
  if (!editingEntry.value || !editForm.value.content.trim()) return;
  const body = {
    title: editForm.value.title || undefined,
    content: editForm.value.content.trim(),
    images: editForm.value.images,
    excursion_ids: editForm.value.excursion_ids,
  };
  const updated = await api.put<DiaryEntry>(`/diary/${editingEntry.value.id}`, body);
  const idx = entries.value.findIndex((e) => e.id === updated.id);
  if (idx !== -1) entries.value[idx] = updated;
  editingEntry.value = null;
}

// Weicher Löschvorgang serverseitig (siehe routes/diary.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts).
async function removeEntry(id: number) {
  await api.delete(`/diary/${id}`);
  markPendingDelete(id, () => {
    entries.value = entries.value.filter((e) => e.id !== id);
  });
}

async function restoreEntry(id: number) {
  clearPending(id);
  await api.post(`/trash/diary_entry/${id}/restore`);
}

async function toggleLike(entryId: number) {
  const result = await api.post<{ liked: boolean }>(`/diary/${entryId}/like`);
  if (result.liked) {
    likes.value.push({ id: Date.now(), entry_id: entryId, user_id: auth.user!.id });
  } else {
    likes.value = likes.value.filter((l) => !(l.entry_id === entryId && l.user_id === auth.user!.id));
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
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Tagebuch</h1>
      <button @click="openNewForm">+ Neuer Eintrag</button>
    </div>

    <Modal :model-value="showForm" title="Neuer Tagebucheintrag" full-height @update:model-value="(v) => !v && closeForm()">
    <form class="add-form" @submit.prevent="submitEntry">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Was ist heute passiert?" rows="10" required></textarea>
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
        <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
        <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
      </p>
      <label class="upload-label">
        📷 Bilder hinzufügen
        <input type="file" accept="image/*" multiple :disabled="uploading" @change="onNewFilesSelected" />
      </label>
      <p v-if="uploading" class="hint">Bilder werden komprimiert & hochgeladen…</p>
      <p v-if="uploadError" class="hint error">{{ uploadError }}</p>
      <div class="image-preview" v-if="form.images.length">
        <div class="preview-thumb" v-for="(img, i) in form.images" :key="img">
          <img :src="img" :alt="`Bild ${i + 1}`" />
          <button type="button" class="remove-thumb" @click="removeImage(form, i)">✕</button>
        </div>
      </div>
      <fieldset v-if="excursionsStore.excursions.length" class="excursion-picker">
        <legend>🎒 Touren zuordnen</legend>
        <label v-for="ex in pickerExcursions(todayDateStr)" :key="ex.id" class="excursion-option">
          <input type="checkbox" :value="ex.id" v-model="form.excursion_ids" />
          <span class="excursion-option-title">{{ ex.title }}</span>
          <span v-if="ex.date === todayDateStr" class="excursion-option-badge">📅 heute geplant</span>
        </label>
      </fieldset>
      <fieldset v-if="spotsStore.spots.length" class="excursion-picker">
        <legend>📍 Spots zuordnen</legend>
        <button
          v-for="spot in spotsStore.spots"
          :key="spot.id"
          type="button"
          class="excursion-option spot-option-btn"
          @click="pickSpot(spot.id, todayDateStr, form, pickedSpotIds)"
        >
          <span class="excursion-option-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
          <span v-if="pickedSpotIds.has(spot.id)" class="excursion-option-badge">✓ hinzugefügt</span>
          <span v-else-if="spotAlreadyPlanned(spot.id, todayDateStr)" class="excursion-option-badge">📅 heute geplant</span>
        </button>
      </fieldset>
      <button type="submit">Eintragen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="entries">
      <template v-for="entry in entries" :key="entry.id">
        <UndoDeleteRow v-if="isPending(entry.id)" :label="entry.title ?? undefined" @undo="restoreEntry(entry.id)" />
        <article v-else class="card entry" :class="{ 'new-highlight': highlightedIds.has(entry.id) }">
          <header class="entry-head">
            <span class="avatar">{{ author(entry.author_id)?.avatar ?? '❓' }}</span>
            <div class="entry-meta">
              <strong>{{ author(entry.author_id)?.username ?? '?' }}</strong>
              <span class="date">{{ formatDate(entry.created_at) }}<span v-if="entry.updated_at"> (bearbeitet)</span></span>
            </div>
            <div v-if="entry.author_id === auth.user?.id" class="entry-actions">
              <EditButton small @click="startEdit(entry)" />
              <DeleteButton small @click="removeEntry(entry.id)" />
            </div>
          </header>

          <h3 v-if="entry.title">{{ entry.title }}</h3>
          <div class="content richtext" v-html="renderRichText(entry.content)"></div>

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

          <div class="excursion-links" v-if="excursionsForEntry(entry).length">
            <button
              v-for="ex in excursionsForEntry(entry)"
              :key="ex.id"
              type="button"
              class="excursion-chip"
              @click="drawers.openExcursions()"
            >
              <span
                class="excursion-chip-img"
                :style="ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : {}"
              >
                <span v-if="!ex.image_url">🎒</span>
              </span>
              <span class="excursion-chip-title">{{ ex.title }}</span>
            </button>
          </div>

          <Comments
            v-if="openComments.has(entry.id)"
            :comments="commentItemsFor(entry.id)"
            @submit="(content) => submitComment(entry.id, content)"
            @remove="removeComment"
          />
        </article>
      </template>
    </TransitionGroup>
    <p v-if="!entries.length" class="empty">Noch keine Tagebuch-Einträge.</p>

    <Modal
      :model-value="editingEntry !== null"
      title="Eintrag bearbeiten"
      full-height
      @update:model-value="(v) => !v && (editingEntry = null)"
    >
      <form class="add-form" @submit.prevent="submitEditEntry">
        <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        <textarea v-model="editForm.content" rows="10" required></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
          <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
          <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
        </p>
        <label class="upload-label">
          📷 Bilder hinzufügen
          <input type="file" accept="image/*" multiple :disabled="editUploading" @change="onEditFilesSelected" />
        </label>
        <p v-if="editUploading" class="hint">Bilder werden komprimiert & hochgeladen…</p>
        <p v-if="editUploadError" class="hint error">{{ editUploadError }}</p>
        <div class="image-preview" v-if="editForm.images.length">
          <div class="preview-thumb" v-for="(img, i) in editForm.images" :key="img">
            <img :src="img" :alt="`Bild ${i + 1}`" />
            <button type="button" class="remove-thumb" @click="removeImage(editForm, i)">✕</button>
          </div>
        </div>
        <fieldset v-if="excursionsStore.excursions.length" class="excursion-picker">
          <legend>🎒 Touren zuordnen</legend>
          <label v-for="ex in pickerExcursions(editEntryDateStr)" :key="ex.id" class="excursion-option">
            <input type="checkbox" :value="ex.id" v-model="editForm.excursion_ids" />
            <span class="excursion-option-title">{{ ex.title }}</span>
            <span v-if="ex.date === editEntryDateStr" class="excursion-option-badge">📅 an diesem Tag geplant</span>
          </label>
        </fieldset>
        <fieldset v-if="spotsStore.spots.length" class="excursion-picker">
          <legend>📍 Spots zuordnen</legend>
          <button
            v-for="spot in spotsStore.spots"
            :key="spot.id"
            type="button"
            class="excursion-option spot-option-btn"
            @click="pickSpot(spot.id, editEntryDateStr, editForm, editPickedSpotIds)"
          >
            <span class="excursion-option-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
            <span v-if="editPickedSpotIds.has(spot.id)" class="excursion-option-badge">✓ hinzugefügt</span>
            <span v-else-if="spotAlreadyPlanned(spot.id, editEntryDateStr)" class="excursion-option-badge">📅 an diesem Tag geplant</span>
          </button>
        </fieldset>
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
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
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.excursion-picker legend {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0 4px;
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

/* Spot-Picker nutzt Buttons statt Checkbox-Labels (jeder Klick löst sofort das
   Hintergrund-Einplanen aus, siehe pickSpot) – Button-Grundstil zurücksetzen, damit er optisch
   zu den Checkbox-Zeilen der Ausflüge darüber passt. */
.spot-option-btn {
  background: none;
  border: none;
  padding: 2px 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
}

.excursion-option-badge {
  font-size: 0.78rem;
  color: var(--color-success);
  white-space: nowrap;
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
