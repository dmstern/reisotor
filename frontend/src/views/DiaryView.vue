<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { renderRichText } from '../utils/richText';
import { compressImage } from '../utils/imageCompression';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import LikeButton from '../components/LikeButton.vue';
import Comments from '../components/Comments.vue';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const entries = ref<DiaryEntry[]>([]);
const likes = ref<DiaryLike[]>([]);
const comments = ref<DiaryComment[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

const showForm = ref(false);
const emptyForm = () => ({ title: '', content: '', images: [] as string[] });
const form = ref(emptyForm());
const uploading = ref(false);
const uploadError = ref('');

const editingEntry = ref<DiaryEntry | null>(null);
const editForm = ref(emptyForm());
const editUploading = ref(false);
const editUploadError = ref('');

const openComments = ref<Set<number>>(new Set());

onMounted(async () => {
  const [entriesRes, likesRes, commentsRes, usersRes] = await Promise.all([
    api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
    api.get<DiaryLike[]>('/diary/likes'),
    api.get<DiaryComment[]>('/diary/comments'),
    api.get<User[]>('/users'),
  ]);
  entries.value = entriesRes;
  likes.value = likesRes;
  comments.value = commentsRes;
  users.value = usersRes;
  loading.value = false;
});

function author(id: number) {
  return users.value.find((u) => u.id === id);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

async function submitEntry() {
  if (!form.value.content.trim()) return;
  const body = {
    trip_id: tripId,
    title: form.value.title || undefined,
    content: form.value.content.trim(),
    images: form.value.images,
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
  editForm.value = { title: entry.title ?? '', content: entry.content, images: [...entry.images] };
}

async function submitEditEntry() {
  if (!editingEntry.value || !editForm.value.content.trim()) return;
  const body = {
    title: editForm.value.title || undefined,
    content: editForm.value.content.trim(),
    images: editForm.value.images,
  };
  const updated = await api.put<DiaryEntry>(`/diary/${editingEntry.value.id}`, body);
  const idx = entries.value.findIndex((e) => e.id === updated.id);
  if (idx !== -1) entries.value[idx] = updated;
  editingEntry.value = null;
}

async function removeEntry(id: number) {
  await api.delete(`/diary/${id}`);
  entries.value = entries.value.filter((e) => e.id !== id);
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
      <button @click="showForm = true">+ Neuer Eintrag</button>
    </div>

    <Modal :model-value="showForm" title="Neuer Tagebucheintrag" @update:model-value="(v) => !v && closeForm()">
    <form class="add-form" @submit.prevent="submitEntry">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Was ist heute passiert?" rows="10" required></textarea>
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
        automatisch erkannt
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
      <button type="submit">Veröffentlichen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="entries">
      <article class="card entry" v-for="entry in entries" :key="entry.id">
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
        <div class="content" v-html="renderRichText(entry.content)"></div>

        <div class="gallery" v-if="entry.images.length">
          <a v-for="(img, i) in entry.images" :key="i" :href="img" target="_blank" rel="noopener">
            <img :src="img" :alt="`Bild ${i + 1}`" loading="lazy" />
          </a>
        </div>

        <div class="entry-footer">
          <LikeButton :count="likesFor(entry.id).length" :liked="likedByMe(entry.id)" @toggle="toggleLike(entry.id)" />
          <button class="secondary" @click="toggleComments(entry.id)">
            💬 {{ commentsFor(entry.id).length || '' }}
          </button>
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
      @update:model-value="(v) => !v && (editingEntry = null)"
    >
      <form class="add-form" @submit.prevent="submitEditEntry">
        <input v-model="editForm.title" type="text" placeholder="Titel (optional)" />
        <textarea v-model="editForm.content" rows="10" required></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
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

.content :deep(ul) {
  margin: 4px 0;
  padding-left: 1.3em;
}

.content :deep(br:last-child) {
  display: none;
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

.entry-footer {
  display: flex;
  gap: var(--space-2);
}

.empty {
  color: var(--color-text-muted);
}
</style>
