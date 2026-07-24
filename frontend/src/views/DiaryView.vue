<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { DiaryComment, DiaryEntry, DiaryLike, User } from '../api/types';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const entries = ref<DiaryEntry[]>([]);
const likes = ref<DiaryLike[]>([]);
const comments = ref<DiaryComment[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

const showForm = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ title: '', content: '', imagesText: '' });

const commentDrafts = ref<Record<number, string>>({});
const openComments = ref<Set<number>>(new Set());

onMounted(async () => {
  const [entriesRes, likesRes, commentsRes, usersRes] = await Promise.all([
    api.get<DiaryEntry[]>('/diary'),
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

function resetForm() {
  form.value = { title: '', content: '', imagesText: '' };
  editingId.value = null;
}

function startEdit(entry: DiaryEntry) {
  editingId.value = entry.id;
  form.value = { title: entry.title ?? '', content: entry.content, imagesText: entry.images.join('\n') };
  showForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitEntry() {
  if (!form.value.content.trim()) return;
  const images = form.value.imagesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const body = { title: form.value.title || undefined, content: form.value.content.trim(), images };

  if (editingId.value) {
    const updated = await api.put<DiaryEntry>(`/diary/${editingId.value}`, body);
    const idx = entries.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) entries.value[idx] = updated;
  } else {
    const created = await api.post<DiaryEntry>('/diary', body);
    entries.value.unshift(created);
  }
  resetForm();
  showForm.value = false;
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

async function submitComment(entryId: number) {
  const content = commentDrafts.value[entryId]?.trim();
  if (!content) return;
  const created = await api.post<DiaryComment>(`/diary/${entryId}/comments`, { content });
  comments.value.push(created);
  commentDrafts.value[entryId] = '';
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
      <button
        @click="
          showForm = !showForm;
          if (!showForm) resetForm();
        "
      >
        {{ showForm ? 'Abbrechen' : '+ Neuer Eintrag' }}
      </button>
    </div>

    <form v-if="showForm" class="card add-form" @submit.prevent="submitEntry">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Was ist heute passiert?" rows="5" required></textarea>
      <textarea
        v-model="form.imagesText"
        placeholder="Bild-URLs (optional, eine pro Zeile)"
        rows="2"
      ></textarea>
      <button type="submit">{{ editingId ? 'Speichern' : 'Veröffentlichen' }}</button>
    </form>

    <div class="entries">
      <article class="card entry" v-for="entry in entries" :key="entry.id">
        <header class="entry-head">
          <span class="avatar">{{ author(entry.author_id)?.avatar ?? '❓' }}</span>
          <div class="entry-meta">
            <strong>{{ author(entry.author_id)?.username ?? '?' }}</strong>
            <span class="date">{{ formatDate(entry.created_at) }}<span v-if="entry.updated_at"> (bearbeitet)</span></span>
          </div>
          <div v-if="entry.author_id === auth.user?.id" class="entry-actions">
            <button class="secondary" @click="startEdit(entry)">✎</button>
            <button class="secondary" @click="removeEntry(entry.id)">✕</button>
          </div>
        </header>

        <h3 v-if="entry.title">{{ entry.title }}</h3>
        <p class="content">{{ entry.content }}</p>

        <div class="gallery" v-if="entry.images.length">
          <a v-for="(img, i) in entry.images" :key="i" :href="img" target="_blank" rel="noopener">
            <img :src="img" :alt="`Bild ${i + 1}`" loading="lazy" />
          </a>
        </div>

        <div class="entry-footer">
          <button class="secondary like-btn" :class="{ liked: likedByMe(entry.id) }" @click="toggleLike(entry.id)">
            {{ likedByMe(entry.id) ? '❤️' : '🤍' }} {{ likesFor(entry.id).length || '' }}
          </button>
          <button class="secondary" @click="toggleComments(entry.id)">
            💬 {{ commentsFor(entry.id).length || '' }}
          </button>
        </div>

        <div class="comments" v-if="openComments.has(entry.id)">
          <div class="comment" v-for="c in commentsFor(entry.id)" :key="c.id">
            <span class="avatar-sm">{{ author(c.author_id)?.avatar ?? '❓' }}</span>
            <div class="comment-body">
              <strong>{{ author(c.author_id)?.username ?? '?' }}</strong>
              <span>{{ c.content }}</span>
            </div>
            <button v-if="c.author_id === auth.user?.id" class="secondary" @click="removeComment(c.id)">✕</button>
          </div>

          <form class="comment-form" @submit.prevent="submitComment(entry.id)">
            <input v-model="commentDrafts[entry.id]" type="text" placeholder="Kommentar schreiben…" />
            <button type="submit">Senden</button>
          </form>
        </div>
      </article>
    </div>
    <p v-if="!entries.length" class="empty">Noch keine Tagebuch-Einträge.</p>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
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

.entry-actions button {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.entry h3 {
  margin: 0 0 var(--space-1);
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.content {
  white-space: pre-wrap;
  margin: 0 0 var(--space-2);
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

.like-btn.liked {
  border-color: var(--color-danger);
}

.comments {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.comment {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.avatar-sm {
  font-size: 1.1rem;
}

.comment-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  font-size: 0.88rem;
}

.comment button {
  padding: 2px 6px;
  font-size: 0.75rem;
}

.comment-form {
  display: flex;
  gap: var(--space-2);
}

.comment-form input {
  flex: 1;
}

.empty {
  color: var(--color-text-muted);
}
</style>
