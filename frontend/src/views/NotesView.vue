<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Note, User } from '../api/types';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const notes = ref<Note[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);

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
  await api.delete(`/notes/${id}`);
  notes.value = notes.value.filter((n) => n.id !== id);
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

    <form v-if="showForm" class="card add-form" @submit.prevent="submit">
      <input v-model="form.title" type="text" placeholder="Titel (optional)" />
      <textarea v-model="form.content" placeholder="Inhalt" rows="4" required></textarea>
      <button type="submit">{{ editingId ? 'Speichern' : 'Hinzufügen' }}</button>
    </form>

    <div class="grid cards">
      <div class="card note-card" v-for="note in notes" :key="note.id">
        <div class="note-head">
          <h3 v-if="note.title">{{ note.title }}</h3>
          <button class="secondary" @click="startEdit(note)">✎</button>
          <button class="secondary" @click="remove(note.id)">✕</button>
        </div>
        <p class="content">{{ note.content }}</p>
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

.content {
  white-space: pre-wrap;
  margin: 0;
  color: var(--color-text);
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
