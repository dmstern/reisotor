<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Spot } from '../api/types';
import SpotCard from '../components/SpotCard.vue';

const spots = ref<Spot[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ name: '', category: '', link: '', note: '', lat: '', lng: '' });

onMounted(async () => {
  spots.value = await api.get<Spot[]>('/spots');
  loading.value = false;
});

async function addSpot() {
  if (!form.value.name.trim()) return;
  const created = await api.post<Spot>('/spots', {
    name: form.value.name.trim(),
    category: form.value.category || undefined,
    link: form.value.link || undefined,
    note: form.value.note || undefined,
    lat: form.value.lat ? Number(form.value.lat) : undefined,
    lng: form.value.lng ? Number(form.value.lng) : undefined,
  });
  spots.value.unshift(created);
  form.value = { name: '', category: '', link: '', note: '', lat: '', lng: '' };
  showForm.value = false;
}

async function remove(id: number) {
  await api.delete(`/spots/${id}`);
  spots.value = spots.value.filter((s) => s.id !== id);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Spots</h1>
      <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Neuer Spot' }}</button>
    </div>

    <form v-if="showForm" class="card add-form" @submit.prevent="addSpot">
      <input v-model="form.name" type="text" placeholder="Name" required />
      <input v-model="form.category" type="text" placeholder="Kategorie (z. B. Restaurant)" />
      <input v-model="form.link" type="url" placeholder="Link (z. B. Google Maps)" />
      <textarea v-model="form.note" placeholder="Notiz (optional)" rows="2"></textarea>
      <div class="coords-row">
        <input v-model="form.lat" type="number" step="any" placeholder="Lat" />
        <input v-model="form.lng" type="number" step="any" placeholder="Lng" />
      </div>
      <button type="submit">Speichern</button>
    </form>

    <div class="grid cards">
      <SpotCard v-for="spot in spots" :key="spot.id" :spot="spot" @remove="remove" />
    </div>
    <p v-if="!spots.length" class="empty">Noch keine Spots eingetragen.</p>
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

.coords-row {
  display: flex;
  gap: var(--space-2);
}

.coords-row input {
  flex: 1;
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.empty {
  color: var(--color-text-muted);
}
</style>
