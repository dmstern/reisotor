<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const accommodations = ref<Accommodation[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);
const mapsLinkResolved = ref<boolean | null>(null);
const editMapsLinkResolved = ref<boolean | null>(null);

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
  amount: '',
  paid_by_user_id: '',
});

const form = ref(emptyForm());
const editingItem = ref<Accommodation | null>(null);
const editForm = ref(emptyForm());

onMounted(async () => {
  const [accRes, usersRes] = await Promise.all([
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  accommodations.value = accRes;
  users.value = usersRes;
  loading.value = false;
});

function userLabel(id: number | null) {
  if (id == null) return '';
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '';
}

function checkMapsLink() {
  mapsLinkResolved.value = form.value.maps_link ? parseLatLngFromMapsLink(form.value.maps_link) != null : null;
}

function checkEditMapsLink() {
  editMapsLinkResolved.value = editForm.value.maps_link
    ? parseLatLngFromMapsLink(editForm.value.maps_link) != null
    : null;
}

function toBody(f: ReturnType<typeof emptyForm>) {
  const parsed = parseLatLngFromMapsLink(f.maps_link);
  return {
    trip_id: tripId,
    name: f.name.trim(),
    address: f.address || undefined,
    link: f.link || undefined,
    maps_link: f.maps_link || undefined,
    start_date: f.start_date || undefined,
    end_date: f.end_date || undefined,
    checkin: f.checkin || undefined,
    checkout: f.checkout || undefined,
    contact: f.contact || undefined,
    note: f.note || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
    amount: f.amount ? Number(f.amount) : undefined,
    paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : undefined,
  };
}

async function submit() {
  if (!form.value.name.trim()) return;
  const created = await api.post<Accommodation>('/accommodation', toBody(form.value));
  accommodations.value.push(created);
  form.value = emptyForm();
  mapsLinkResolved.value = null;
  showForm.value = false;
}

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
  mapsLinkResolved.value = null;
}

function startEdit(acc: Accommodation) {
  editingItem.value = acc;
  editForm.value = {
    name: acc.name,
    address: acc.address ?? '',
    link: acc.link ?? '',
    maps_link: acc.maps_link ?? '',
    start_date: acc.start_date ?? '',
    end_date: acc.end_date ?? '',
    checkin: acc.checkin ?? '',
    checkout: acc.checkout ?? '',
    contact: acc.contact ?? '',
    note: acc.note ?? '',
    amount: acc.amount != null ? String(acc.amount) : '',
    paid_by_user_id: acc.paid_by_user_id != null ? String(acc.paid_by_user_id) : '',
  };
  editMapsLinkResolved.value = null;
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.name.trim()) return;
  const updated = await api.put<Accommodation>(`/accommodation/${editingItem.value.id}`, toBody(editForm.value));
  const idx = accommodations.value.findIndex((a) => a.id === updated.id);
  if (idx !== -1) accommodations.value[idx] = updated;
  editingItem.value = null;
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
      <button @click="showForm = true">+ Neue Unterkunft</button>
    </div>

    <Modal :model-value="showForm" title="Neue Unterkunft" @update:model-value="(v) => !v && closeForm()">
    <form class="form" @submit.prevent="submit">
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
      <div class="row">
        <label>
          Kosten (€)
          <input v-model="form.amount" type="number" step="0.01" placeholder="optional" />
        </label>
        <label>
          Bezahlt von
          <select v-model="form.paid_by_user_id">
            <option value="">–</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
        </label>
      </div>
      <p v-if="form.amount && !form.paid_by_user_id" class="hint">
        Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
      </p>
      <label>
        Notizen
        <textarea v-model="form.note" rows="3"></textarea>
      </label>

      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="grid cards">
      <div class="card acc-card" v-for="acc in accommodations" :key="acc.id">
        <div class="acc-head">
          <h3>{{ acc.name }}</h3>
          <div class="actions">
            <EditButton small @click="startEdit(acc)" />
            <DeleteButton small @click="remove(acc.id)" />
          </div>
        </div>
        <p v-if="acc.start_date || acc.end_date">
          🗓️ {{ formatDate(acc.start_date) || '?' }} – {{ formatDate(acc.end_date) || '?' }}
        </p>
        <p v-if="acc.address">{{ acc.address }}</p>
        <p v-if="acc.checkin || acc.checkout">
          Check-in {{ acc.checkin || '–' }} · Check-out {{ acc.checkout || '–' }}
        </p>
        <p v-if="acc.contact">📞 {{ acc.contact }}</p>
        <p v-if="acc.amount != null">
          💶 {{ acc.amount.toFixed(2) }} €
          <span v-if="acc.paid_by_user_id"> · bezahlt von {{ userLabel(acc.paid_by_user_id) }}</span>
        </p>
        <p v-if="acc.note">{{ acc.note }}</p>
        <div class="links">
          <a v-if="acc.link" :href="acc.link" target="_blank" rel="noopener">Buchung ↗</a>
          <a v-if="acc.maps_link" :href="acc.maps_link" target="_blank" rel="noopener">📍 Extern öffnen ↗</a>
          <router-link
            v-if="acc.lat != null && acc.lng != null"
            :to="{ path: '/map', query: { focus: `accommodation-${acc.id}` } }"
          >
            🗺️ Auf Karte anzeigen
          </router-link>
        </div>
      </div>
    </TransitionGroup>
    <p v-if="!accommodations.length" class="empty">Noch keine Unterkunft eingetragen.</p>

    <Modal
      :model-value="editingItem !== null"
      title="Unterkunft bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="form" @submit.prevent="submitEdit">
        <label>
          Name
          <input v-model="editForm.name" type="text" required />
        </label>
        <label>
          Adresse
          <input v-model="editForm.address" type="text" />
        </label>
        <div class="row">
          <label>
            Von
            <input v-model="editForm.start_date" type="date" />
          </label>
          <label>
            Bis
            <input v-model="editForm.end_date" type="date" />
          </label>
        </div>
        <div class="row">
          <label>
            Check-in
            <input v-model="editForm.checkin" type="text" />
          </label>
          <label>
            Check-out
            <input v-model="editForm.checkout" type="text" />
          </label>
        </div>
        <label>
          Link (Buchungsseite o. Ä.)
          <input v-model="editForm.link" type="url" />
        </label>
        <label>
          Google-Maps-Link
          <input v-model="editForm.maps_link" type="url" @blur="checkEditMapsLink" />
        </label>
        <p v-if="editMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
        <p v-if="editMapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
        <label>
          Kontakt
          <input v-model="editForm.contact" type="text" />
        </label>
        <div class="row">
          <label>
            Kosten (€)
            <input v-model="editForm.amount" type="number" step="0.01" />
          </label>
          <label>
            Bezahlt von
            <select v-model="editForm.paid_by_user_id">
              <option value="">–</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
          </label>
        </div>
        <p v-if="editForm.amount && !editForm.paid_by_user_id" class="hint">
          Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
        </p>
        <label>
          Notizen
          <textarea v-model="editForm.note" rows="3"></textarea>
        </label>
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
  flex-wrap: wrap;
  gap: var(--space-3);
}

.row > label {
  min-width: 140px;
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

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
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
