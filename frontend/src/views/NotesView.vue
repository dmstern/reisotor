<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, ApiError } from '../api/client';
import type { Note, NoteComment, NoteLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import RichTextEditor from '../components/RichTextEditor.vue';
import RichTextDisplay from '../components/RichTextDisplay.vue';
import { isEmptyRichText } from '../utils/richText';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import FileAttachments from '../components/FileAttachments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { formatDateTime } from '../utils/dateFormat';
import { useUndoableDelete } from '../composables/useUndoableDelete';
import { useDraftAutosave } from '../composables/useDraftAutosave';

const auth = useAuthStore();
const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const notes = ref<Note[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const users = ref<User[]>([]);
const likes = ref<NoteLike[]>([]);
const comments = ref<NoteComment[]>([]);
const loading = ref(true);
const showForm = ref(false);
const error = ref('');
const openComments = ref<Set<number>>(new Set());
const highlightedIds = ref<Set<number>>(new Set());

const emptyForm = () => ({ title: '', content: '' });
const form = ref(emptyForm());

const editingNote = ref<Note | null>(null);
const editForm = ref(emptyForm());

// Entwurfs-Zwischenspeicherung (Nutzer-Feedback: Eingaben sollen bei einem App-Absturz nicht
// verloren gehen) - siehe composables/useDraftAutosave.ts. draftKey der Edit-Instanz wird erst beim
// Öffnen ausgewertet (editingNote ist zu dem Zeitpunkt bereits gesetzt), daher als Getter statt
// eines statischen Strings.
const newDraft = useDraftAutosave('notes:new', form, showForm);
const editDraft = useDraftAutosave(
  () => `notes:edit:${editingNote.value?.id}`,
  editForm,
  computed(() => editingNote.value !== null),
);

async function load() {
  try {
    const [notesRes, usersRes, likesRes, commentsRes] = await Promise.all([
      api.get<Note[]>(`/notes?trip_id=${tripId}`),
      api.get<User[]>('/users'),
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
  return comments.value.filter((c) => c.note_id === noteId).sort((a, b) => a.created_at.localeCompare(b.created_at));
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

async function submit() {
  if (isEmptyRichText(form.value.content)) return;
  const created = await api.post<Note>('/notes', {
    trip_id: tripId,
    title: form.value.title || undefined,
    content: form.value.content,
    content_format: 'html',
  });
  notes.value.unshift(created);
  form.value = emptyForm();
  showForm.value = false;
  newDraft.clear();
}

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
  newDraft.clear();
}

function startEdit(note: Note) {
  editingNote.value = note;
  editForm.value = { title: note.title ?? '', content: note.content };
}

async function submitEdit() {
  if (!editingNote.value || isEmptyRichText(editForm.value.content)) return;
  const updated = await api.put<Note>(`/notes/${editingNote.value.id}`, {
    title: editForm.value.title || undefined,
    content: editForm.value.content,
    content_format: 'html',
  });
  const idx = notes.value.findIndex((n) => n.id === updated.id);
  if (idx !== -1) notes.value[idx] = updated;
  editDraft.clear();
  editingNote.value = null;
}

function closeEditForm() {
  editDraft.clear();
  editingNote.value = null;
}

// Weicher Löschvorgang serverseitig (siehe routes/notes.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts).
async function remove(id: number) {
  error.value = '';
  try {
    await api.delete(`/notes/${id}`);
    markPendingDelete(id, () => {
      notes.value = notes.value.filter((n) => n.id !== id);
    });
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Notiz konnte nicht gelöscht werden.';
  }
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/note/${id}/restore`);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Notizen</h1>
      <button @click="showForm = true">+ Neue Notiz</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <Modal :model-value="showForm" title="Neue Notiz" full-height @update:model-value="(v) => !v && closeForm()">
    <form class="add-form" @submit.prevent="submit">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <RichTextEditor v-model="form.content" placeholder="Inhalt" />
      <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="masonry cards">
      <template v-for="note in notes" :key="note.id">
        <UndoDeleteRow v-if="isPending(note.id)" :label="note.title ?? undefined" @undo="restore(note.id)" />
        <div v-else class="card note-card" :class="{ 'new-highlight': highlightedIds.has(note.id) }">
          <div class="note-head">
            <h3 v-if="note.title">{{ note.title }}</h3>
            <PendingSyncBadge v-if="note._pending" />
            <div class="note-actions">
              <EditButton small @click="startEdit(note)" />
              <DeleteButton small @click="remove(note.id)" />
            </div>
          </div>
          <RichTextDisplay class="content" :content="note.content" :format="note.content_format" />
          <p class="meta">{{ authorLabel(note.created_by) }} · {{ formatDate(note.updated_at ?? note.created_at) }}</p>
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
      </template>
    </TransitionGroup>
    <p v-if="!notes.length" class="empty">Noch keine Notizen.</p>

    <Modal
      :model-value="editingNote !== null"
      title="Notiz bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="add-form" @submit.prevent="submitEdit">
        <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        <RichTextEditor v-model="editForm.content" />
        <FileAttachments v-if="editingNote" domain="notes" :entity-id="editingNote.id" />
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <button type="submit">Speichern</button>
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
