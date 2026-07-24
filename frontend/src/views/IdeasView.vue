<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Idea } from '../api/types';
import IdeaCard from '../components/IdeaCard.vue';

const ideas = ref<Idea[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ title: '', image_url: '', link: '', note: '' });

onMounted(async () => {
  ideas.value = await api.get<Idea[]>('/ideas');
  loading.value = false;
});

async function addIdea() {
  if (!form.value.title.trim()) return;
  const created = await api.post<Idea>('/ideas', {
    title: form.value.title.trim(),
    image_url: form.value.image_url || undefined,
    link: form.value.link || undefined,
    note: form.value.note || undefined,
  });
  ideas.value.unshift(created);
  form.value = { title: '', image_url: '', link: '', note: '' };
  showForm.value = false;
}

async function toggleStatus(idea: Idea) {
  const updated = await api.put<Idea>(`/ideas/${idea.id}`, {
    title: idea.title,
    image_url: idea.image_url ?? undefined,
    link: idea.link ?? undefined,
    note: idea.note ?? undefined,
    status: idea.status === 'planned' ? 'idea' : 'planned',
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

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.empty {
  color: var(--color-text-muted);
}
</style>
