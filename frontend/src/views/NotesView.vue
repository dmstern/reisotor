<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, ApiError } from '../api/client';
import type { Note, NoteComment, NoteLike, User, Attachment } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import RichTextEditor from '../components/RichTextEditor.vue';
import FormField from '../components/FormField.vue';
import RichTextDisplay from '../components/RichTextDisplay.vue';
import { isEmptyRichText } from '../utils/richText';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import FileAttachments from '../components/FileAttachments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import DraftBadge from '../components/DraftBadge.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { formatDateTime } from '../utils/dateFormat';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const auth = useAuthStore();
const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const notes = ref<Note[]>([]);
const { showToast } = useToast();
const users = ref<User[]>([]);
const likes = ref<NoteLike[]>([]);
const comments = ref<NoteComment[]>([]);
const loading = ref(true);
const error = ref('');
const openComments = ref<Set<number>>(new Set());
const highlightedIds = ref<Set<number>>(new Set());

const emptyForm = () => ({ title: '', content: '' });

const editingNote = ref<Note | null>(null);
const editForm = ref(emptyForm());

// Entwurfs-Zwischenspeicherung (Nutzer-Feedback: Eingaben sollen bei einem App-Absturz nicht
// verloren gehen) - siehe composables/useDraftAutosave.ts. draftKey der Edit-Instanz wird erst beim
// Öffnen ausgewertet (editingNote ist zu dem Zeitpunkt bereits gesetzt), daher als Getter statt
// eines statischen Strings.
// Entwurfs-Zwischenspeicherung (Nutzer-Feedback: Eingaben sollen bei einem App-Absturz nicht
const editDraft = useDraftAutosave(
  () => `notes:edit:${editingNote.value?.id}`,
  editForm,
  computed(() => editingNote.value !== null)
);

// Bereits als Entwurf gesicherte, aber noch nicht veröffentlichte eigene Notiz (#89) - höchstens
// eine gleichzeitig, siehe openNew()/closeForm() unten, die genau diesen Entwurf statt eines
// zusätzlichen zweiten wiederverwenden.
const myDraft = computed(
  () => notes.value.find((n) => n.is_draft && n.created_by === auth.user?.id) ?? null
);

function hasFormContent(f: { title: string; content: string }) {
  return f.title.trim().length > 0 || !isEmptyRichText(f.content);
}

async function load() {
  try {
    const [notesRes, usersRes, likesRes, commentsRes] = await Promise.all([
      api.get<Note[]>(`/notes?trip_id=${tripId}`),
      api.get<User[]>(`/trips/${tripId}/members`),
      api.get<NoteLike[]>(`/notes/likes?trip_id=${tripId}`),
      api.get<NoteComment[]>(`/notes/comments?trip_id=${tripId}`),
    ]);
    notes.value = notesRes;
    users.value = usersRes;
    likes.value = likesRes;
    comments.value = commentsRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  highlightedIds.value = liveSync.markSeen('notes');
  load();
});

watch(() => liveSync.domainVersion.notes, load);

function author(id: number) {
  return users.value.find((u) => u.id === id);
}
function likesFor(noteId: number) {
  return likes.value.filter((l) => l.note_id === noteId);
}
function likedByMe(noteId: number) {
  return likesFor(noteId).some((l) => l.user_id === auth.user?.id);
}
function commentsFor(noteId: number) {
  return comments.value
    .filter((c) => c.note_id === noteId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function commentItemsFor(noteId: number) {
  return commentsFor(noteId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}

function toggleComments(noteId: number) {
  if (openComments.value.has(noteId)) openComments.value.delete(noteId);
  else openComments.value.add(noteId);
}

async function toggleLike(noteId: number) {
  const result = await api.post<{ liked: boolean }>(`/notes/${noteId}/like`);
  if (result.liked) {
    likes.value.push({ id: Date.now(), note_id: noteId, user_id: auth.user!.id });
  } else {
    likes.value = likes.value.filter((l) => !(l.note_id === noteId && l.user_id === auth.user!.id));
  }
}

async function submitComment(noteId: number, content: string) {
  const created = await api.post<NoteComment>(`/notes/${noteId}/comments`, { content });
  comments.value.push(created);
}

async function removeComment(id: number) {
  await api.delete(`/notes/comments/${id}`);
  comments.value = comments.value.filter((c) => c.id !== id);
}

function authorLabel(id: number | null) {
  if (id == null) return '';
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '';
}

function formatDate(iso: string) {
  return formatDateTime(iso);
}

// "+ Neue Notiz": ein bereits gesicherter eigener Entwurf wird weiterbearbeitet statt einen
// zweiten, parallelen Entwurf anzulegen (#89). Ansonsten wird direkt ein neuer Entwurf in
// der Datenbank angelegt, damit sofort Anhänge (Bilder/Dateien) hochgeladen werden können.
async function openNew() {
  if (myDraft.value) {
    startEdit(myDraft.value);
  } else {
    try {
      const created = await api.post<Note>('/notes', {
        trip_id: tripId,
        title: undefined,
        content: '',
        content_format: 'html',
        is_draft: true,
      });
      notes.value.unshift(created);
      startEdit(created);
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : 'Fehler beim Anlegen der Notiz.';
    }
  }
}

function startEdit(note: Note) {
  editingNote.value = note;
  editForm.value = { title: note.title ?? '', content: note.content };
}

// Explizites "Speichern"/"Veröffentlichen" macht aus einem Entwurf immer eine veröffentlichte Notiz
// (is_draft:false) - für bereits veröffentlichte Notizen ist das ein No-op, da dort schon 0.
async function submitEdit() {
  if (!editingNote.value || isEmptyRichText(editForm.value.content)) return;
  const updated = await api.put<Note>(`/notes/${editingNote.value.id}`, {
    title: editForm.value.title || undefined,
    content: editForm.value.content,
    content_format: 'html',
    is_draft: false,
  });
  const idx = notes.value.findIndex((n) => n.id === updated.id);
  if (idx !== -1) notes.value[idx] = updated;
  editDraft.clear();
  editingNote.value = null;
}

// Schließen ohne "Speichern" bei einem noch unveröffentlichten Entwurf sichert den aktuellen Stand
// weiterhin als Entwurf (statt die Änderungen zu verwerfen) - bei einer bereits veröffentlichten
// Notiz bleibt es wie bisher beim reinen Verwerfen des Bearbeitungs-Zwischenstands.
// Leere Entwürfe (ohne Titel/Inhalt und ohne Anhänge) werden automatisch wieder gelöscht,
// um die Übersicht nicht mit Dateileichen zu füllen.
async function closeEditForm() {
  if (editingNote.value?.is_draft) {
    if (hasFormContent(editForm.value)) {
      const updated = await api.put<Note>(`/notes/${editingNote.value.id}`, {
        title: editForm.value.title || undefined,
        content: editForm.value.content,
        content_format: 'html',
        is_draft: true,
      });
      const idx = notes.value.findIndex((n) => n.id === updated.id);
      if (idx !== -1) notes.value[idx] = updated;
    } else {
      // Prüfen, ob Dateianhänge existieren - wenn nein, den leeren Entwurf löschen.
      try {
        const attachments = await api.get<Attachment[]>(`/trips/${tripId}/attachments?domain=notes&entity_id=${editingNote.value.id}`);
        if (attachments.length === 0) {
          await api.delete(`/notes/${editingNote.value.id}`);
          notes.value = notes.value.filter((n) => n.id !== editingNote.value!.id);
        }
      } catch (e) {
        console.error('Fehler beim Aufräumen des leeren Entwurfs', e);
      }
    }
  }
  editDraft.clear();
  editingNote.value = null;
}

async function remove(id: number) {
  error.value = '';
  try {
    await api.delete(`/notes/${id}`);
    notes.value = notes.value.filter((n) => n.id !== id);
    showToast({ message: 'Notiz gelöscht. Sie befindet sich nun im Papierkorb.', type: 'info' });
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Notiz konnte nicht gelöscht werden.';
  }
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Notizen</h1>
      <Button @click="openNew"
        ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neue Notiz</Button
      >
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <TransitionGroup tag="div" name="list" class="masonry cards">
      <div
        v-for="note in notes"
        :key="note.id"
        class="card note-card"
        :class="{ 'new-highlight': highlightedIds.has(note.id) }"
      >
        <div class="note-head">
          <h3 v-if="note.title">{{ note.title }}</h3>
          <DraftBadge v-if="note.is_draft" />
          <PendingSyncBadge v-if="note._pending" />
          <div class="note-actions">
            <EditButton small @click="startEdit(note)" />
            <DeleteButton small @click="remove(note.id)" />
          </div>
        </div>
        <RichTextDisplay class="content" :content="note.content" :format="note.content_format" />
        <p class="meta">
          {{ authorLabel(note.created_by) }} ·
          {{ formatDate(note.updated_at ?? note.created_at) }}
        </p>
        <FileAttachments domain="notes" :entity-id="note.id" :editable="false" />
        <SocialRow
          :like-count="likesFor(note.id).length"
          :liked="likedByMe(note.id)"
          :comment-count="commentsFor(note.id).length"
          @toggle-like="toggleLike(note.id)"
          @toggle-comments="toggleComments(note.id)"
        />
        <Comments
          v-if="openComments.has(note.id)"
          :comments="commentItemsFor(note.id)"
          @submit="(content) => submitComment(note.id, content)"
          @remove="removeComment"
        />
      </div>
    </TransitionGroup>
    <p v-if="!notes.length" class="empty">Noch keine Notizen.</p>

    <Modal
      :model-value="editingNote !== null"
      title="Notiz bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="add-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Titel">
          <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        </FormField>
        <RichTextEditor v-model="editForm.content" />
        <FileAttachments v-if="editingNote" domain="notes" :entity-id="editingNote.id" />
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <Button type="submit">{{ editingNote?.is_draft ? 'Veröffentlichen' : 'Speichern' }}</Button>
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

.cards {
  column-width: 240px;
}

.note-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.note-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.note-head h3 {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  color: var(--color-primary-dark);
}

.note-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  /* Rückt die Buttons auch dann ans rechte Zeilenende, wenn kein h3 (flex:1) daneben steht, das
     sie von selbst dorthin schiebt - z. B. bei einem Entwurf ohne Titel, wo nur DraftBadge.vue's
     Pille (white-space:nowrap, kein flex:1) davor sitzt. Ohne das drängten Badge+Buttons auf
     schmalen Karten/Screens ungebremst über den rechten Card-Rand hinaus (siehe flex-wrap oben,
     das genau für diesen Fall zusätzlich einen Zeilenumbruch statt Überlauf erlaubt). */
  margin-left: auto;
}

.error {
  color: var(--color-danger);
  margin: 0 0 var(--space-3);
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

.content {
  margin: 0;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.meta {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
</style>
