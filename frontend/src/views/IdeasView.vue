<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Idea } from '../api/types';
import IdeaCard from '../components/IdeaCard.vue';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const ideas = ref<Idea[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ title: '', image_url: '', link: '', maps_link: '', note: '' });
const mapsLinkResolved = ref<boolean | null>(null);

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

async function toggleStatus(idea: Idea) {
  const updated = await api.put<Idea>(`/ideas/${idea.id}`, {
    title: idea.title,
    image_url: idea.image_url ?? undefined,
    link: idea.link ?? undefined,
    maps_link: idea.maps_link ?? undefined,
    note: idea.note ?? undefined,
    status: idea.status === 'planned' ? 'idea' : 'planned',
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
        v-for="idea in ideas"
        :key="idea.id"
        :idea="idea"
        @toggle-status="toggleStatus"
        @remove="remove"
      />
    </div>
    <p v-if="!ideas.length" class="empty">Noch keine Ideen gesammelt.</p>
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
