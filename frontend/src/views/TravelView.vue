<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { TravelItem, User } from '../api/types';

const items = ref<TravelItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<number | null>(null);

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

onMounted(async () => {
  const [itemsRes, usersRes] = await Promise.all([
    api.get<TravelItem[]>('/travel'),
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

function resetForm() {
  form.value = emptyForm();
  editingId.value = null;
}

function startEdit(item: TravelItem) {
  editingId.value = item.id;
  form.value = {
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
  showForm.value = true;
}

async function submit() {
  if (!form.value.title.trim()) return;
  const body = {
    title: form.value.title.trim(),
    type: form.value.type || undefined,
    from_location: form.value.from_location || undefined,
    to_location: form.value.to_location || undefined,
    date: form.value.date || undefined,
    departure_time: form.value.departure_time || undefined,
    checkin_info: form.value.checkin_info || undefined,
    amount: form.value.amount ? Number(form.value.amount) : undefined,
    paid_by_user_id: form.value.paid_by_user_id ? Number(form.value.paid_by_user_id) : undefined,
    luggage: form.value.luggage || undefined,
    seat: form.value.seat || undefined,
    link: form.value.link || undefined,
    note: form.value.note || undefined,
  };

  if (editingId.value) {
    const updated = await api.put<TravelItem>(`/travel/${editingId.value}`, body);
    const idx = items.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) items.value[idx] = updated;
  } else {
    const created = await api.post<TravelItem>('/travel', body);
    items.value.push(created);
  }
  resetForm();
  showForm.value = false;
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
          if (!showForm) resetForm();
        "
      >
        {{ showForm ? 'Abbrechen' : '+ Neuer Eintrag' }}
      </button>
    </div>

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

      <button type="submit">{{ editingId ? 'Speichern' : 'Hinzufügen' }}</button>
    </form>

    <div class="grid cards">
      <div class="card travel-card" v-for="item in items" :key="item.id">
        <div class="travel-head">
          <h3>{{ typeIcon(item.type) }} {{ item.title }}</h3>
          <div class="actions">
            <button class="secondary" @click="startEdit(item)">✎</button>
            <button class="secondary" @click="remove(item.id)">✕</button>
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
    </div>
    <p v-if="!items.length" class="empty">Noch keine Reise-Infos eingetragen.</p>
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
  gap: var(--space-3);
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

.actions button {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.empty {
  color: var(--color-text-muted);
}
</style>
