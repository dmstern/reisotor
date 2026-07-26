<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { TravelItem, TravelRole, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { TRAVEL_ROLE_META, TRAVEL_ROLE_OPTIONS } from '../utils/travelRole';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const drawers = useDrawersStore();
const tripId = tripStore.currentTripId as number;
const items = ref<TravelItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);

const TYPE_OPTIONS = ['Flug', 'Zug', 'Bus', 'Auto', 'Fähre', 'Sonstiges'];

const emptyForm = () => ({
  title: '',
  type: 'Flug',
  role: '' as TravelRole | '',
  from_location: '',
  to_location: '',
  from_maps_link: '',
  to_maps_link: '',
  date: '',
  departure_time: '',
  checkin_info: '',
  amount: '',
  paid_by_user_id: '',
  luggage: '',
  seat: '',
  link: '',
  note: '',
});

const form = ref(emptyForm());
const fromMapsLinkResolved = ref<boolean | null>(null);
const toMapsLinkResolved = ref<boolean | null>(null);

const editingItem = ref<TravelItem | null>(null);
const editForm = ref(emptyForm());
const editFromMapsLinkResolved = ref<boolean | null>(null);
const editToMapsLinkResolved = ref<boolean | null>(null);

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  users.value = usersRes;
  loading.value = false;
});

function userLabel(id: number | null) {
  if (id == null) return '';
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '';
}

function toBody(f: ReturnType<typeof emptyForm>) {
  const fromParsed = parseLatLngFromMapsLink(f.from_maps_link);
  const toParsed = parseLatLngFromMapsLink(f.to_maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    type: f.type || undefined,
    role: f.role || undefined,
    from_location: f.from_location || undefined,
    to_location: f.to_location || undefined,
    from_maps_link: f.from_maps_link || undefined,
    from_lat: fromParsed?.lat,
    from_lng: fromParsed?.lng,
    to_maps_link: f.to_maps_link || undefined,
    to_lat: toParsed?.lat,
    to_lng: toParsed?.lng,
    date: f.date || undefined,
    departure_time: f.departure_time || undefined,
    checkin_info: f.checkin_info || undefined,
    amount: f.amount ? Number(f.amount) : undefined,
    paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : undefined,
    luggage: f.luggage || undefined,
    seat: f.seat || undefined,
    link: f.link || undefined,
    note: f.note || undefined,
  };
}

function checkFromMapsLink() {
  fromMapsLinkResolved.value = form.value.from_maps_link ? parseLatLngFromMapsLink(form.value.from_maps_link) != null : null;
}
function checkToMapsLink() {
  toMapsLinkResolved.value = form.value.to_maps_link ? parseLatLngFromMapsLink(form.value.to_maps_link) != null : null;
}
function checkEditFromMapsLink() {
  editFromMapsLinkResolved.value = editForm.value.from_maps_link
    ? parseLatLngFromMapsLink(editForm.value.from_maps_link) != null
    : null;
}
function checkEditToMapsLink() {
  editToMapsLinkResolved.value = editForm.value.to_maps_link
    ? parseLatLngFromMapsLink(editForm.value.to_maps_link) != null
    : null;
}

async function submit() {
  if (!form.value.title.trim()) return;
  const created = await api.post<TravelItem>('/travel', toBody(form.value));
  items.value.push(created);
  closeForm();
}

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
  fromMapsLinkResolved.value = null;
  toMapsLinkResolved.value = null;
}

function startEdit(item: TravelItem) {
  editingItem.value = item;
  editForm.value = {
    title: item.title,
    type: item.type ?? 'Flug',
    role: item.role ?? '',
    from_location: item.from_location ?? '',
    to_location: item.to_location ?? '',
    from_maps_link: item.from_maps_link ?? '',
    to_maps_link: item.to_maps_link ?? '',
    date: item.date ?? '',
    departure_time: item.departure_time ?? '',
    checkin_info: item.checkin_info ?? '',
    amount: item.amount != null ? String(item.amount) : '',
    paid_by_user_id: item.paid_by_user_id != null ? String(item.paid_by_user_id) : '',
    luggage: item.luggage ?? '',
    seat: item.seat ?? '',
    link: item.link ?? '',
    note: item.note ?? '',
  };
  editFromMapsLinkResolved.value = null;
  editToMapsLinkResolved.value = null;
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim()) return;
  const updated = await api.put<TravelItem>(`/travel/${editingItem.value.id}`, toBody(editForm.value));
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
}

async function remove(id: number) {
  await api.delete(`/travel/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}

function typeIcon(type: string | null) {
  if (type === 'Flug') return '✈️';
  if (type === 'Zug') return '🚆';
  if (type === 'Bus') return '🚌';
  if (type === 'Auto') return '🚗';
  if (type === 'Fähre') return '⛴️';
  return '🎫';
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Reise</h1>
      <button @click="showForm = true">+ Neuer Eintrag</button>
    </div>

    <Modal :model-value="showForm" title="Neuer Reise-Eintrag" @update:model-value="(v) => !v && closeForm()">
    <form class="form" @submit.prevent="submit">
      <label>
        Titel
        <input v-model="form.title" type="text" placeholder="z. B. Hinflug nach Wien" required />
      </label>
      <label>
        Art
        <select v-model="form.type">
          <option v-for="t in TYPE_OPTIONS" :key="t" :value="t">{{ typeIcon(t) }} {{ t }}</option>
        </select>
      </label>
      <label>
        Rolle (für Karten-Urlaubsfokus)
        <select v-model="form.role">
          <option value="">– nicht festgelegt –</option>
          <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
            {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{ TRAVEL_ROLE_META[r].hint }})
          </option>
        </select>
      </label>
      <div class="row">
        <label>
          Von
          <input v-model="form.from_location" type="text" />
        </label>
        <label>
          Nach
          <input v-model="form.to_location" type="text" />
        </label>
      </div>
      <div class="row">
        <label>
          Standort Abflug/Abfahrt (Maps-Link (Google/Apple), optional)
          <input v-model="form.from_maps_link" type="url" @blur="checkFromMapsLink" />
        </label>
        <label>
          Standort Ankunft (Maps-Link (Google/Apple), optional)
          <input v-model="form.to_maps_link" type="url" @blur="checkToMapsLink" />
        </label>
      </div>
      <p v-if="fromMapsLinkResolved === true || toMapsLinkResolved === true" class="hint success">
        📍 Standort erkannt – erscheint auf der Karte
      </p>
      <p v-if="fromMapsLinkResolved === false || toMapsLinkResolved === false" class="hint">
        Ein Standort konnte nicht automatisch erkannt werden.
      </p>
      <div class="row">
        <label>
          Datum
          <input v-model="form.date" type="date" />
        </label>
        <label>
          Abflug/Abfahrt
          <input v-model="form.departure_time" type="time" />
        </label>
      </div>
      <label>
        Vorher da sein
        <input v-model="form.checkin_info" type="text" placeholder="z. B. 2 Stunden vorher / Check-in ab 10:00" />
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
      <div class="row">
        <label>
          Gepäck
          <input v-model="form.luggage" type="text" placeholder="z. B. 1x Koffer 23kg, 1x Handgepäck" />
        </label>
        <label>
          Sitzplatz
          <input v-model="form.seat" type="text" placeholder="z. B. 12A" />
        </label>
      </div>
      <label>
        Link (Buchung/Check-in)
        <input v-model="form.link" type="url" />
      </label>
      <label>
        Weitere Infos
        <textarea v-model="form.note" rows="2"></textarea>
      </label>

      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="grid cards">
      <div class="card travel-card" v-for="item in items" :key="item.id">
        <div class="travel-head">
          <h3>{{ typeIcon(item.type) }} {{ item.title }}</h3>
          <div class="actions">
            <EditButton small @click="startEdit(item)" />
            <DeleteButton small @click="remove(item.id)" />
          </div>
        </div>
        <span v-if="item.role" class="role-badge">
          {{ TRAVEL_ROLE_META[item.role].icon }} {{ TRAVEL_ROLE_META[item.role].label }}
        </span>
        <p v-if="item.from_location || item.to_location">
          {{ item.from_location || '?' }} → {{ item.to_location || '?' }}
        </p>
        <p v-if="item.date || item.departure_time">
          🗓️ {{ item.date || '' }}<span v-if="item.departure_time"> · {{ item.departure_time }} Uhr</span>
        </p>
        <p v-if="item.checkin_info">⏱️ {{ item.checkin_info }}</p>
        <p v-if="item.luggage">🧳 {{ item.luggage }}</p>
        <p v-if="item.seat">💺 {{ item.seat }}</p>
        <p v-if="item.amount != null">
          💶 {{ item.amount.toFixed(2) }} €
          <span v-if="item.paid_by_user_id"> · bezahlt von {{ userLabel(item.paid_by_user_id) }}</span>
        </p>
        <p v-if="item.note">{{ item.note }}</p>
        <a v-if="item.link" :href="item.link" target="_blank" rel="noopener">Details/Check-in ↗</a>
        <button
          v-if="item.from_lat != null && item.from_lng != null"
          type="button"
          class="secondary map-btn"
          @click="drawers.openMapAt(`travel-from-${item.id}`)"
        >
          🗺️ Abflug auf Karte anzeigen
        </button>
        <button
          v-if="item.to_lat != null && item.to_lng != null"
          type="button"
          class="secondary map-btn"
          @click="drawers.openMapAt(`travel-to-${item.id}`)"
        >
          🗺️ Ankunft auf Karte anzeigen
        </button>
      </div>
    </TransitionGroup>
    <p v-if="!items.length" class="empty">Noch keine Reise-Infos eingetragen.</p>

    <Modal
      :model-value="editingItem !== null"
      title="Reise-Eintrag bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="form" @submit.prevent="submitEdit">
        <label>
          Titel
          <input v-model="editForm.title" type="text" required />
        </label>
        <label>
          Art
          <select v-model="editForm.type">
            <option v-for="t in TYPE_OPTIONS" :key="t" :value="t">{{ typeIcon(t) }} {{ t }}</option>
          </select>
        </label>
        <label>
          Rolle (für Karten-Urlaubsfokus)
          <select v-model="editForm.role">
            <option value="">– nicht festgelegt –</option>
            <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
              {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{ TRAVEL_ROLE_META[r].hint }})
            </option>
          </select>
        </label>
        <div class="row">
          <label>
            Von
            <input v-model="editForm.from_location" type="text" />
          </label>
          <label>
            Nach
            <input v-model="editForm.to_location" type="text" />
          </label>
        </div>
        <div class="row">
          <label>
            Standort Abflug/Abfahrt (Maps-Link (Google/Apple), optional)
            <input v-model="editForm.from_maps_link" type="url" @blur="checkEditFromMapsLink" />
          </label>
          <label>
            Standort Ankunft (Maps-Link (Google/Apple), optional)
            <input v-model="editForm.to_maps_link" type="url" @blur="checkEditToMapsLink" />
          </label>
        </div>
        <p v-if="editFromMapsLinkResolved === true || editToMapsLinkResolved === true" class="hint success">
          📍 Standort erkannt
        </p>
        <p v-if="editFromMapsLinkResolved === false || editToMapsLinkResolved === false" class="hint">
          Ein Standort konnte nicht automatisch erkannt werden.
        </p>
        <div class="row">
          <label>
            Datum
            <input v-model="editForm.date" type="date" />
          </label>
          <label>
            Abflug/Abfahrt
            <input v-model="editForm.departure_time" type="time" />
          </label>
        </div>
        <label>
          Vorher da sein
          <input v-model="editForm.checkin_info" type="text" />
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
        <div class="row">
          <label>
            Gepäck
            <input v-model="editForm.luggage" type="text" />
          </label>
          <label>
            Sitzplatz
            <input v-model="editForm.seat" type="text" />
          </label>
        </div>
        <label>
          Link (Buchung/Check-in)
          <input v-model="editForm.link" type="url" />
        </label>
        <label>
          Weitere Infos
          <textarea v-model="editForm.note" rows="2"></textarea>
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
  max-width: 560px;
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
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.travel-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-btn {
  align-self: flex-start;
  font-size: 0.85rem;
  padding: 4px 10px;
}

.role-badge {
  align-self: flex-start;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}

.travel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.travel-head h3 {
  margin: 0;
  font-size: 1rem;
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
