<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { TravelItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const items = ref<TravelItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);

const TYPE_OPTIONS = ['Flug', 'Zug', 'Bus', 'Auto', 'Fähre', 'Sonstiges'];

const emptyForm = () => ({
  title: '',
  type: 'Flug',
  from_location: '',
  to_location: '',
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

const editingItem = ref<TravelItem | null>(null);
const editForm = ref(emptyForm());

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
  return {
    trip_id: tripId,
    title: f.title.trim(),
    type: f.type || undefined,
    from_location: f.from_location || undefined,
    to_location: f.to_location || undefined,
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

async function submit() {
  if (!form.value.title.trim()) return;
  const created = await api.post<TravelItem>('/travel', toBody(form.value));
  items.value.push(created);
  form.value = emptyForm();
  showForm.value = false;
}

function startEdit(item: TravelItem) {
  editingItem.value = item;
  editForm.value = {
    title: item.title,
    type: item.type ?? 'Flug',
    from_location: item.from_location ?? '',
    to_location: item.to_location ?? '',
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
      <button
        @click="
          showForm = !showForm;
          if (!showForm) form = emptyForm();
        "
      >
        {{ showForm ? 'Abbrechen' : '+ Neuer Eintrag' }}
      </button>
    </div>

    <Transition name="fade">
    <form v-if="showForm" class="card form" @submit.prevent="submit">
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
    </Transition>

    <TransitionGroup tag="div" name="list" class="grid cards">
      <div class="card travel-card" v-for="item in items" :key="item.id">
        <div class="travel-head">
          <h3>{{ typeIcon(item.type) }} {{ item.title }}</h3>
          <div class="actions">
            <EditButton small @click="startEdit(item)" />
            <DeleteButton small @click="remove(item.id)" />
          </div>
        </div>
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

.cards {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.travel-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
