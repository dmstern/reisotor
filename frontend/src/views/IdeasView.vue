<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Idea } from '../api/types';
import IdeaCard from '../components/IdeaCard.vue';
import Modal from '../components/Modal.vue';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const ideas = ref<Idea[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ title: '', image_url: '', link: '', maps_link: '', note: '' });
const mapsLinkResolved = ref<boolean | null>(null);

const editingIdea = ref<Idea | null>(null);
const editForm = ref({ title: '', image_url: '', link: '', maps_link: '', note: '' });
const editMapsLinkResolved = ref<boolean | null>(null);

onMounted(async () => {
  ideas.value = await api.get<Idea[]>('/ideas');
  loading.value = false;
});

function checkMapsLink() {
  if (!form.value.maps_link) {
    mapsLinkResolved.value = null;
    return;
  }
  mapsLinkResolved.value = parseLatLngFromMapsLink(form.value.maps_link) != null;
}

async function addIdea() {
  if (!form.value.title.trim()) return;
  const parsed = parseLatLngFromMapsLink(form.value.maps_link);
  const created = await api.post<Idea>('/ideas', {
    title: form.value.title.trim(),
    image_url: form.value.image_url || undefined,
    link: form.value.link || undefined,
    maps_link: form.value.maps_link || undefined,
    note: form.value.note || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  });
  ideas.value.unshift(created);
  form.value = { title: '', image_url: '', link: '', maps_link: '', note: '' };
  mapsLinkResolved.value = null;
  showForm.value = false;
}

const STATUS_ORDER: Record<Idea['status'], number> = { idea: 0, planned: 1, discarded: 2 };

const sortedIdeas = computed(() =>
  [...ideas.value].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
);

async function setStatus(idea: Idea, status: Idea['status']) {
  const updated = await api.put<Idea>(`/ideas/${idea.id}`, {
    title: idea.title,
    image_url: idea.image_url ?? undefined,
    link: idea.link ?? undefined,
    maps_link: idea.maps_link ?? undefined,
    note: idea.note ?? undefined,
    status,
    lat: idea.lat ?? undefined,
    lng: idea.lng ?? undefined,
  });
  const idx = ideas.value.findIndex((i) => i.id === idea.id);
  if (idx !== -1) ideas.value[idx] = updated;
}

async function remove(id: number) {
  await api.delete(`/ideas/${id}`);
  ideas.value = ideas.value.filter((i) => i.id !== id);
}

function startEdit(idea: Idea) {
  editingIdea.value = idea;
  editForm.value = {
    title: idea.title,
    image_url: idea.image_url ?? '',
    link: idea.link ?? '',
    maps_link: idea.maps_link ?? '',
    note: idea.note ?? '',
  };
  editMapsLinkResolved.value = null;
}

function checkEditMapsLink() {
  if (!editForm.value.maps_link) {
    editMapsLinkResolved.value = null;
    return;
  }
  editMapsLinkResolved.value = parseLatLngFromMapsLink(editForm.value.maps_link) != null;
}

async function submitEdit() {
  if (!editingIdea.value || !editForm.value.title.trim()) return;
  const parsed = parseLatLngFromMapsLink(editForm.value.maps_link);
  const updated = await api.put<Idea>(`/ideas/${editingIdea.value.id}`, {
    title: editForm.value.title.trim(),
    image_url: editForm.value.image_url || undefined,
    link: editForm.value.link || undefined,
    maps_link: editForm.value.maps_link || undefined,
    note: editForm.value.note || undefined,
    status: editingIdea.value.status,
    lat: parsed?.lat ?? editingIdea.value.lat ?? undefined,
    lng: parsed?.lng ?? editingIdea.value.lng ?? undefined,
  });
  const idx = ideas.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) ideas.value[idx] = updated;
  editingIdea.value = null;
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Ausflugsideen</h1>
      <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Neue Idee' }}</button>
    </div>

    <form v-if="showForm" class="card add-form" @submit.prevent="addIdea">
      <input v-model="form.title" type="text" placeholder="Titel" required />
      <input v-model="form.image_url" type="url" placeholder="Bild-URL (optional)" />
      <input v-model="form.link" type="url" placeholder="Link (optional)" />
      <input
        v-model="form.maps_link"
        type="url"
        placeholder="Google-Maps-Link (optional)"
        @blur="checkMapsLink"
      />
      <p v-if="mapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
      <p v-if="mapsLinkResolved === false" class="hint">
        Standort konnte nicht automatisch erkannt werden (Kurzlinks werden nicht unterstützt). Der Link
        bleibt trotzdem klickbar.
      </p>
      <textarea v-model="form.note" placeholder="Notiz (optional)" rows="2"></textarea>
      <button type="submit">Speichern</button>
    </form>

    <div class="grid cards">
      <IdeaCard
        v-for="idea in sortedIdeas"
        :key="idea.id"
        :idea="idea"
        @set-status="setStatus"
        @remove="remove"
        @edit="startEdit"
      />
    </div>
    <p v-if="!ideas.length" class="empty">Noch keine Ideen gesammelt.</p>

    <Modal
      :model-value="editingIdea !== null"
      title="Idee bearbeiten"
      @update:model-value="(v) => !v && (editingIdea = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.title" type="text" placeholder="Titel" required />
        <input v-model="editForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <input v-model="editForm.link" type="url" placeholder="Link (optional)" />
        <input
          v-model="editForm.maps_link"
          type="url"
          placeholder="Google-Maps-Link (optional)"
          @blur="checkEditMapsLink"
        />
        <p v-if="editMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
        <p v-if="editMapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
        <textarea v-model="editForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.add-form,
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.edit-form {
  margin-bottom: 0;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.empty {
  color: var(--color-text-muted);
}
</style>
