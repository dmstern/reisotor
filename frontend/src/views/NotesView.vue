<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { Note, NoteComment, NoteLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { renderRichText } from '../utils/richText';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import LikeButton from '../components/LikeButton.vue';
import Comments from '../components/Comments.vue';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const notes = ref<Note[]>([]);
const users = ref<User[]>([]);
const likes = ref<NoteLike[]>([]);
const comments = ref<NoteComment[]>([]);
const loading = ref(true);
const showForm = ref(false);
const error = ref('');
const openComments = ref<Set<number>>(new Set());

const emptyForm = () => ({ title: '', content: '' });
const form = ref(emptyForm());

const editingNote = ref<Note | null>(null);
const editForm = ref(emptyForm());

onMounted(async () => {
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
  loading.value = false;
});

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
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function submit() {
  if (!form.value.content.trim()) return;
  const created = await api.post<Note>('/notes', {
    trip_id: tripId,
    title: form.value.title || undefined,
    content: form.value.content.trim(),
  });
  notes.value.unshift(created);
  form.value = emptyForm();
  showForm.value = false;
}

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
}

function startEdit(note: Note) {
  editingNote.value = note;
  editForm.value = { title: note.title ?? '', content: note.content };
}

async function submitEdit() {
  if (!editingNote.value || !editForm.value.content.trim()) return;
  const updated = await api.put<Note>(`/notes/${editingNote.value.id}`, {
    title: editForm.value.title || undefined,
    content: editForm.value.content.trim(),
  });
  const idx = notes.value.findIndex((n) => n.id === updated.id);
  if (idx !== -1) notes.value[idx] = updated;
  editingNote.value = null;
}

async function remove(id: number) {
  error.value = '';
  try {
    await api.delete(`/notes/${id}`);
    notes.value = notes.value.filter((n) => n.id !== id);
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Notiz konnte nicht gelöscht werden.';
  }
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Notizen</h1>
      <button @click="showForm = true">+ Neue Notiz</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <Modal :model-value="showForm" title="Neue Notiz" @update:model-value="(v) => !v && closeForm()">
    <form class="add-form" @submit.prevent="submit">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Inhalt" rows="8" required></textarea>
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
        <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
        <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
      </p>
      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="grid cards">
      <div class="card note-card" v-for="note in notes" :key="note.id">
        <div class="note-head">
          <h3 v-if="note.title">{{ note.title }}</h3>
          <div class="note-actions">
            <EditButton small @click="startEdit(note)" />
            <DeleteButton small @click="remove(note.id)" />
          </div>
        </div>
        <div class="content richtext" v-html="renderRichText(note.content)"></div>
        <p class="meta">{{ authorLabel(note.created_by) }} · {{ formatDate(note.updated_at ?? note.created_at) }}</p>
        <div class="social-row">
          <LikeButton :count="likesFor(note.id).length" :liked="likedByMe(note.id)" @toggle="toggleLike(note.id)" />
          <button class="secondary" @click="toggleComments(note.id)">💬 {{ commentsFor(note.id).length || '' }}</button>
        </div>
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
      @update:model-value="(v) => !v && (editingNote = null)"
    >
      <form class="add-form" @submit.prevent="submitEdit">
        <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        <textarea v-model="editForm.content" rows="8" required></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
          <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
          <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
        </p>
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

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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

.social-row {
  display: flex;
  gap: var(--space-2);
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

.empty {
  color: var(--color-text-muted);
}
</style>
