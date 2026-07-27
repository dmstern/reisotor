<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { renderRichText } from '../utils/richText';
import { parseContact } from '../utils/contact';
import Modal from '../components/Modal.vue';
import DetailModal from '../components/DetailModal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const drawers = useDrawersStore();
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
  drawers.touchLocations();
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
  drawers.touchLocations();
  editingItem.value = null;
}

async function remove(id: number) {
  await api.delete(`/accommodation/${id}`);
  accommodations.value = accommodations.value.filter((a) => a.id !== id);
  drawers.touchLocations();
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Ein einziger Detail-Dialog außerhalb des v-for statt einer pro Karte (gleiches Muster wie der
// bestehende Bearbeiten-Modal mit editingItem/editForm).
const detailItem = ref<Accommodation | null>(null);
function openDetail(acc: Accommodation) {
  detailItem.value = acc;
}
function closeDetail() {
  detailItem.value = null;
}
function editFromDetail() {
  if (!detailItem.value) return;
  startEdit(detailItem.value);
  closeDetail();
}
function showDetailOnMap() {
  if (!detailItem.value) return;
  drawers.openMapAt(`accommodation-${detailItem.value.id}`);
  closeDetail();
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
        Maps-Link (Google/Apple)
        <input v-model="form.maps_link" type="url" @blur="checkMapsLink" />
      </label>
      <p v-if="mapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
      <p v-if="mapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
      <label>
        Kontakt
        <input v-model="form.contact" type="text" placeholder="Telefon, E-Mail oder Text – wird automatisch erkannt" />
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
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
        automatisch erkannt
      </p>

      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="grid cards">
      <div class="card acc-card" v-for="acc in accommodations" :key="acc.id" @click="openDetail(acc)">
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
      </div>
    </TransitionGroup>
    <p v-if="!accommodations.length" class="empty">Noch keine Unterkunft eingetragen.</p>

    <DetailModal
      :model-value="detailItem !== null"
      @update:model-value="(v) => !v && closeDetail()"
      :title="detailItem?.name ?? ''"
      placeholder-icon="🛏️"
    >
      <template v-if="detailItem">
        <p v-if="detailItem.start_date || detailItem.end_date" class="detail-row">
          <span class="detail-label">Zeitraum</span>
          🗓️ {{ formatDate(detailItem.start_date) || '?' }} – {{ formatDate(detailItem.end_date) || '?' }}
        </p>
        <p v-if="detailItem.address" class="detail-row">
          <span class="detail-label">Adresse</span>{{ detailItem.address }}
        </p>
        <p v-if="detailItem.checkin || detailItem.checkout" class="detail-row">
          <span class="detail-label">Check-in/-out</span>
          {{ detailItem.checkin || '–' }} · {{ detailItem.checkout || '–' }}
        </p>
        <p v-if="detailItem.contact && parseContact(detailItem.contact).kind === 'phone'" class="detail-row">
          <span class="detail-label">Kontakt</span>
          📞 <a :href="parseContact(detailItem.contact).href">{{ detailItem.contact }}</a>
        </p>
        <p v-else-if="detailItem.contact && parseContact(detailItem.contact).kind === 'email'" class="detail-row">
          <span class="detail-label">Kontakt</span>
          📧 <a :href="parseContact(detailItem.contact).href">{{ detailItem.contact }}</a>
        </p>
        <p v-else-if="detailItem.contact" class="detail-row">
          <span class="detail-label">Kontakt</span>
          <span class="contact-text" v-html="renderRichText(detailItem.contact)"></span>
        </p>
        <p v-if="detailItem.amount != null" class="detail-row">
          <span class="detail-label">Kosten</span>
          💶 {{ detailItem.amount.toFixed(2) }} €
          <span v-if="detailItem.paid_by_user_id"> · bezahlt von {{ userLabel(detailItem.paid_by_user_id) }}</span>
        </p>
        <div v-if="detailItem.note" class="detail-row note" v-html="renderRichText(detailItem.note)"></div>
        <div class="detail-actions">
          <button type="button" class="card-action-btn" @click="editFromDetail">✎ Bearbeiten</button>
          <button v-if="detailItem.lat != null && detailItem.lng != null" type="button" class="card-action-btn" @click="showDetailOnMap">
            🗺️ Auf Karte anzeigen
          </button>
        </div>
      </template>
    </DetailModal>

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
          Maps-Link (Google/Apple)
          <input v-model="editForm.maps_link" type="url" @blur="checkEditMapsLink" />
        </label>
        <p v-if="editMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
        <p v-if="editMapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
        <label>
          Kontakt
          <input v-model="editForm.contact" type="text" placeholder="Telefon, E-Mail oder Text – wird automatisch erkannt" />
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
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
        </p>
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

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  /* Ohne das streckt CSS Grid (Default: stretch) jede Karte einer Reihe auf die Höhe der
     vollsten Nachbar-Karte – bei sehr unterschiedlich befüllten Unterkünften (eine mit viel
     Text, eine fast leer) sah die leere Karte dadurch unschön aufgebläht aus. */
  align-items: start;
}

.acc-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
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

.note {
  overflow-wrap: anywhere;
}

.contact-text :deep(br:last-child) {
  display: none;
}

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.empty {
  color: var(--color-text-muted);
}
</style>
