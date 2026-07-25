<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Excursion, ScheduleItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import ExcursionCard from '../components/ExcursionCard.vue';
import Modal from '../components/Modal.vue';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursions = ref<Excursion[]>([]);
const users = ref<User[]>([]);
const scheduleItems = ref<ScheduleItem[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ title: '', image_url: '', link: '', maps_link: '', note: '', suggested_by_user_id: '' });
const mapsLinkResolved = ref<boolean | null>(null);

const editingExcursion = ref<Excursion | null>(null);
const editForm = ref({ title: '', image_url: '', link: '', maps_link: '', note: '', suggested_by_user_id: '' });
const editMapsLinkResolved = ref<boolean | null>(null);

onMounted(async () => {
  const [excursionsRes, usersRes, scheduleRes] = await Promise.all([
    api.get<Excursion[]>(`/ideas?trip_id=${tripId}`),
    api.get<User[]>('/users'),
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
  ]);
  excursions.value = excursionsRes;
  users.value = usersRes;
  scheduleItems.value = scheduleRes;
  loading.value = false;
});

function checkMapsLink() {
  if (!form.value.maps_link) {
    mapsLinkResolved.value = null;
    return;
  }
  mapsLinkResolved.value = parseLatLngFromMapsLink(form.value.maps_link) != null;
}

async function addExcursion() {
  if (!form.value.title.trim()) return;
  const parsed = parseLatLngFromMapsLink(form.value.maps_link);
  const created = await api.post<Excursion>('/ideas', {
    trip_id: tripId,
    title: form.value.title.trim(),
    image_url: form.value.image_url || undefined,
    link: form.value.link || undefined,
    maps_link: form.value.maps_link || undefined,
    note: form.value.note || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
    suggested_by_user_id: form.value.suggested_by_user_id ? Number(form.value.suggested_by_user_id) : undefined,
  });
  excursions.value.unshift(created);
  form.value = { title: '', image_url: '', link: '', maps_link: '', note: '', suggested_by_user_id: '' };
  mapsLinkResolved.value = null;
  showForm.value = false;
}

const STATUS_GROUPS: { status: Excursion['status']; heading: string }[] = [
  { status: 'idea', heading: '💡 Idee' },
  { status: 'planned', heading: '✅ Geplant' },
  { status: 'discarded', heading: '❌ Verworfen' },
];

const groupedExcursions = computed(() =>
  STATUS_GROUPS.map((group) => ({
    ...group,
    excursions: excursions.value.filter((e) => e.status === group.status),
  })).filter((group) => group.excursions.length > 0),
);

function linkedScheduleItems(excursionId: number) {
  return scheduleItems.value.filter((s) => s.idea_id === excursionId);
}

async function setStatus(excursion: Excursion, status: Excursion['status']) {
  // Ein bereits geplanter, mit dem Kalender verknüpfter Ausflug entfernt beim Statuswechsel weg von
  // "geplant" auch den verknüpften Kalender-Termin – das ist nicht rückgängig zu machen, deshalb
  // vorher bestätigen lassen (Batch 10). Ohne Bestätigung bleibt alles unverändert.
  const linked = excursion.status === 'planned' && status !== 'planned' ? linkedScheduleItems(excursion.id) : [];
  if (linked.length) {
    const confirmed = window.confirm('Ausflug wirklich aus dem Kalender entfernen?');
    if (!confirmed) return;
    for (const item of linked) {
      await api.delete(`/schedule/${item.id}`);
    }
    scheduleItems.value = scheduleItems.value.filter((s) => s.idea_id !== excursion.id);
  }

  const updated = await api.put<Excursion>(`/ideas/${excursion.id}`, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    link: excursion.link ?? undefined,
    maps_link: excursion.maps_link ?? undefined,
    note: excursion.note ?? undefined,
    status,
    lat: excursion.lat ?? undefined,
    lng: excursion.lng ?? undefined,
    suggested_by_user_id: excursion.suggested_by_user_id ?? undefined,
  });
  const idx = excursions.value.findIndex((i) => i.id === excursion.id);
  if (idx !== -1) excursions.value[idx] = updated;
}

async function remove(id: number) {
  await api.delete(`/ideas/${id}`);
  excursions.value = excursions.value.filter((i) => i.id !== id);
}

function startEdit(excursion: Excursion) {
  editingExcursion.value = excursion;
  editForm.value = {
    title: excursion.title,
    image_url: excursion.image_url ?? '',
    link: excursion.link ?? '',
    maps_link: excursion.maps_link ?? '',
    note: excursion.note ?? '',
    suggested_by_user_id: excursion.suggested_by_user_id != null ? String(excursion.suggested_by_user_id) : '',
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
  if (!editingExcursion.value || !editForm.value.title.trim()) return;
  const parsed = parseLatLngFromMapsLink(editForm.value.maps_link);
  const updated = await api.put<Excursion>(`/ideas/${editingExcursion.value.id}`, {
    title: editForm.value.title.trim(),
    image_url: editForm.value.image_url || undefined,
    link: editForm.value.link || undefined,
    maps_link: editForm.value.maps_link || undefined,
    note: editForm.value.note || undefined,
    status: editingExcursion.value.status,
    lat: parsed?.lat ?? editingExcursion.value.lat ?? undefined,
    lng: parsed?.lng ?? editingExcursion.value.lng ?? undefined,
    suggested_by_user_id: editForm.value.suggested_by_user_id ? Number(editForm.value.suggested_by_user_id) : undefined,
  });
  const idx = excursions.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) excursions.value[idx] = updated;
  editingExcursion.value = null;
}

function userLabel(id: number | null) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : null;
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Ausflüge</h1>
      <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Neuer Ausflug' }}</button>
    </div>

    <Transition name="fade">
      <form v-if="showForm" class="card add-form" @submit.prevent="addExcursion">
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
        <select v-model="form.suggested_by_user_id">
          <option value="">Vorschlagende Person (optional)</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <textarea v-model="form.note" placeholder="Notiz (optional)" rows="2"></textarea>
        <button type="submit">Speichern</button>
      </form>
    </Transition>

    <section v-for="group in groupedExcursions" :key="group.status" class="status-group">
      <h2>{{ group.heading }}</h2>
      <TransitionGroup tag="div" name="list" class="grid cards">
        <ExcursionCard
          v-for="excursion in group.excursions"
          :key="excursion.id"
          :excursion="excursion"
          :suggested-by-label="userLabel(excursion.suggested_by_user_id)"
          @set-status="setStatus"
          @remove="remove"
          @edit="startEdit"
        />
      </TransitionGroup>
    </section>
    <p v-if="!excursions.length" class="empty">Noch keine Ausflüge gesammelt.</p>

    <Modal
      :model-value="editingExcursion !== null"
      title="Ausflug bearbeiten"
      @update:model-value="(v) => !v && (editingExcursion = null)"
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
        <select v-model="editForm.suggested_by_user_id">
          <option value="">Vorschlagende Person (optional)</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <textarea v-model="editForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
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

.status-group {
  margin-bottom: var(--space-4);
}

.status-group h2 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-4);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.empty {
  color: var(--color-text-muted);
}
</style>
