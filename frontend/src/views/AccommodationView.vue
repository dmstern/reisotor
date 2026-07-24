<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation } from '../api/types';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const accommodations = ref<Accommodation[]>([]);
const loading = ref(true);
const showForm = ref(false);
const mapsLinkResolved = ref<boolean | null>(null);

const emptyForm = () => ({
  name: '',
  address: '',
  link: '',
  maps_link: '',
  start_date: '',
  end_date: '',
  checkin: '',
  checkout: '',
  contact: '',
  note: '',
});

const form = ref(emptyForm());

onMounted(async () => {
  accommodations.value = await api.get<Accommodation[]>('/accommodation');
  loading.value = false;
});

function checkMapsLink() {
  if (!form.value.maps_link) {
    mapsLinkResolved.value = null;
    return;
  }
  mapsLinkResolved.value = parseLatLngFromMapsLink(form.value.maps_link) != null;
}

async function addAccommodation() {
  if (!form.value.name.trim()) return;
  const parsed = parseLatLngFromMapsLink(form.value.maps_link);
  const created = await api.post<Accommodation>('/accommodation', {
    name: form.value.name.trim(),
    address: form.value.address || undefined,
    link: form.value.link || undefined,
    maps_link: form.value.maps_link || undefined,
    start_date: form.value.start_date || undefined,
    end_date: form.value.end_date || undefined,
    checkin: form.value.checkin || undefined,
    checkout: form.value.checkout || undefined,
    contact: form.value.contact || undefined,
    note: form.value.note || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  });
  accommodations.value.push(created);
  form.value = emptyForm();
  mapsLinkResolved.value = null;
  showForm.value = false;
}

async function remove(id: number) {
  await api.delete(`/accommodation/${id}`);
  accommodations.value = accommodations.value.filter((a) => a.id !== id);
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Unterkunft</h1>
      <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Neue Unterkunft' }}</button>
    </div>

    <form v-if="showForm" class="card form" @submit.prevent="addAccommodation">
      <label>
        Name
        <input v-model="form.name" type="text" required />
      </label>
      <label>
        Adresse
        <input v-model="form.address" type="text" />
      </label>
      <div class="row">
        <label>
          Von
          <input v-model="form.start_date" type="date" />
        </label>
        <label>
          Bis
          <input v-model="form.end_date" type="date" />
        </label>
      </div>
      <div class="row">
        <label>
          Check-in
          <input v-model="form.checkin" type="text" placeholder="z. B. 15:00" />
        </label>
        <label>
          Check-out
          <input v-model="form.checkout" type="text" placeholder="z. B. 11:00" />
        </label>
      </div>
      <label>
        Link (Buchungsseite o. Ä.)
        <input v-model="form.link" type="url" />
      </label>
      <label>
        Google-Maps-Link
        <input v-model="form.maps_link" type="url" @blur="checkMapsLink" />
      </label>
      <p v-if="mapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
      <p v-if="mapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
      <label>
        Kontakt
        <input v-model="form.contact" type="text" />
      </label>
      <label>
        Notizen
        <textarea v-model="form.note" rows="3"></textarea>
      </label>

      <button type="submit">Speichern</button>
    </form>

    <div class="grid cards">
      <div class="card acc-card" v-for="acc in accommodations" :key="acc.id">
        <div class="acc-head">
          <h3>{{ acc.name }}</h3>
          <button class="secondary" @click="remove(acc.id)">✕</button>
        </div>
        <p v-if="acc.start_date || acc.end_date">
          🗓️ {{ formatDate(acc.start_date) || '?' }} – {{ formatDate(acc.end_date) || '?' }}
        </p>
        <p v-if="acc.address">{{ acc.address }}</p>
        <p v-if="acc.checkin || acc.checkout">
          Check-in {{ acc.checkin || '–' }} · Check-out {{ acc.checkout || '–' }}
        </p>
        <p v-if="acc.contact">📞 {{ acc.contact }}</p>
        <p v-if="acc.note">{{ acc.note }}</p>
        <div class="links">
          <a v-if="acc.link" :href="acc.link" target="_blank" rel="noopener">Buchung ↗</a>
          <a v-if="acc.maps_link" :href="acc.maps_link" target="_blank" rel="noopener">📍 Maps ↗</a>
        </div>
      </div>
    </div>
    <p v-if="!accommodations.length" class="empty">Noch keine Unterkunft eingetragen.</p>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 520px;
  margin-bottom: var(--space-4);
}

label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}

.row {
  display: flex;
  gap: var(--space-3);
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

.acc-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.acc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.acc-head h3 {
  margin: 0;
  font-size: 1rem;
}

.acc-head button {
  font-size: 0.8rem;
  padding: 4px 10px;
}

.links {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.empty {
  color: var(--color-text-muted);
}
</style>
