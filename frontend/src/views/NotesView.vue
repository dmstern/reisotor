<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { Note, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { renderRichText } from '../utils/richText';

const auth = useAuthStore();
const notes = ref<Note[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);
const error = ref('');

const form = ref({ title: '', content: '' });
const editingId = ref<number | null>(null);

onMounted(async () => {
  const [notesRes, usersRes] = await Promise.all([
    api.get<Note[]>('/notes'),
    api.get<User[]>('/users'),
  ]);
  notes.value = notesRes;
  users.value = usersRes;
  loading.value = false;
});

function authorLabel(id: number | null) {
  if (id == null) return '';
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function startEdit(note: Note) {
  editingId.value = note.id;
  form.value = { title: note.title ?? '', content: note.content };
  showForm.value = true;
}

function resetForm() {
  form.value = { title: '', content: '' };
  editingId.value = null;
}

async function submit() {
  if (!form.value.content.trim()) return;
  const body = { title: form.value.title || undefined, content: form.value.content.trim() };

  if (editingId.value) {
    const updated = await api.put<Note>(`/notes/${editingId.value}`, body);
    const idx = notes.value.findIndex((n) => n.id === updated.id);
    if (idx !== -1) notes.value[idx] = updated;
  } else {
    const created = await api.post<Note>('/notes', body);
    notes.value.unshift(created);
  }
  resetForm();
  showForm.value = false;
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
      <button
        @click="
          showForm = !showForm;
          if (!showForm) resetForm();
        "
      >
        {{ showForm ? 'Abbrechen' : '+ Neue Notiz' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="showForm" class="card add-form" @submit.prevent="submit">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Inhalt" rows="4" required></textarea>
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
        automatisch erkannt
      </p>
      <button type="submit">{{ editingId ? 'Speichern' : 'Hinzufügen' }}</button>
    </form>

    <div class="grid cards">
      <div class="card note-card" v-for="note in notes" :key="note.id">
        <div class="note-head">
          <h3 v-if="note.title">{{ note.title }}</h3>
          <button class="secondary" @click="startEdit(note)">✎</button>
          <button class="secondary" @click="remove(note.id)">🗑️</button>
        </div>
        <div class="content" v-html="renderRichText(note.content)"></div>
        <p class="meta">{{ authorLabel(note.created_by) }} · {{ formatDate(note.updated_at ?? note.created_at) }}</p>
      </div>
    </div>
    <p v-if="!notes.length" class="empty">Noch keine Notizen.</p>
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

.note-head button {
  padding: 4px 8px;
  font-size: 0.8rem;
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

.content :deep(a) {
  color: var(--color-primary);
}

.content :deep(ul) {
  margin: 4px 0;
  padding-left: 1.3em;
}

.content :deep(br:last-child) {
  display: none;
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
