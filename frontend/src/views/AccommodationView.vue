<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Accommodation, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import Modal from '../components/Modal.vue';
import AccommodationDetailDialog from '../components/AccommodationDetailDialog.vue';
import LocationPicker from '../components/LocationPicker.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';

const tripStore = useTripStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const accommodations = ref<Accommodation[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());
const showForm = ref(false);
const mapsLinkResolved = ref<boolean | null>(null);
const editMapsLinkResolved = ref<boolean | null>(null);
const manualPin = ref<{ lat: number; lng: number } | null>(null);
const pickerOpen = ref(false);
const locationError = ref(false);
// Bleibt gesetzt, solange nach dem Anlegen die Standort-Auflösung fehlschlägt – ein erneuter
// Speicherversuch (manuell gesetzter Pin) muss dann die bereits angelegte Unterkunft AKTUALISIEREN
// statt eine zweite anzulegen (gleiches Muster wie TripSwitcher.vue's pendingFixTripId).
const pendingFixId = ref<number | null>(null);
const manualPinEdit = ref<{ lat: number; lng: number } | null>(null);
const pickerOpenEdit = ref(false);
const locationErrorEdit = ref(false);

// Öffnet die Karte des manuellen Pickers direkt im Urlaubsgebiet statt einer leeren Weltkarte.
const pickerCenter = computed(() => {
  const t = tripStore.currentTrip;
  return t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : undefined;
});

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

async function load() {
  const [accRes, usersRes] = await Promise.all([
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  accommodations.value = accRes;
  users.value = usersRes;
  loading.value = false;
}

onMounted(() => {
  highlightedIds.value = liveSync.markSeen('accommodation');
  load();
});

watch(() => liveSync.domainVersion.accommodation, load);

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

function toBody(f: ReturnType<typeof emptyForm>, manual?: { lat: number; lng: number } | null) {
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
    lat: manual?.lat ?? parsed?.lat,
    lng: manual?.lng ?? parsed?.lng,
    amount: f.amount ? Number(f.amount) : undefined,
    paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : undefined,
  };
}

async function submit() {
  if (!form.value.name.trim()) return;
  const body = toBody(form.value, manualPin.value);
  const created =
    pendingFixId.value != null
      ? await api.put<Accommodation>(`/accommodation/${pendingFixId.value}`, body)
      : await api.post<Accommodation>('/accommodation', body);
  const idx = accommodations.value.findIndex((a) => a.id === created.id);
  if (idx !== -1) accommodations.value[idx] = created;
  else accommodations.value.push(created);
  drawers.touchLocations();
  // Serverseitige Auflösung (backend/src/utils/mapsLink.ts) ebenfalls fehlgeschlagen, z. B. weil
  // Google einen Maps-Kurzlink per Bot-Erkennung blockt – Dialog offen lassen, manuellen Picker
  // automatisch aufklappen (LocationPicker.vue).
  if (body.maps_link && created.lat == null && !manualPin.value) {
    pendingFixId.value = created.id;
    locationError.value = true;
    pickerOpen.value = true;
    return;
  }
  closeForm();
}

watch(manualPin, (pin) => {
  if (pin && locationError.value) submit();
});

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
  mapsLinkResolved.value = null;
  manualPin.value = null;
  pickerOpen.value = false;
  locationError.value = false;
  pendingFixId.value = null;
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
  manualPinEdit.value = null;
  pickerOpenEdit.value = false;
  locationErrorEdit.value = false;
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.name.trim()) return;
  const body = toBody(editForm.value, manualPinEdit.value);
  const updated = await api.put<Accommodation>(`/accommodation/${editingItem.value.id}`, body);
  const idx = accommodations.value.findIndex((a) => a.id === updated.id);
  if (idx !== -1) accommodations.value[idx] = updated;
  drawers.touchLocations();
  if (body.maps_link && updated.lat == null && !manualPinEdit.value) {
    locationErrorEdit.value = true;
    pickerOpenEdit.value = true;
    return;
  }
  locationErrorEdit.value = false;
  editingItem.value = null;
}

watch(manualPinEdit, (pin) => {
  if (pin && locationErrorEdit.value) submitEdit();
});

// Weicher Löschvorgang serverseitig (siehe routes/accommodation.ts) + 60s Rückgängig-Fenster
// clientseitig (useUndoableDelete.ts): die Zeile bleibt in `accommodations` bestehen (Template
// zeigt an ihrer Stelle einen "Löschen rückgängig machen"-Platzhalter, siehe isPending), erst nach
// Ablauf des Fensters verschwindet sie endgültig aus der lokalen Liste.
async function remove(id: number) {
  await api.delete(`/accommodation/${id}`);
  markPendingDelete(id, () => {
    accommodations.value = accommodations.value.filter((a) => a.id !== id);
  });
  drawers.touchLocations();
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/accommodation/${id}/restore`);
  drawers.touchLocations();
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Ein einziger Detail-Dialog außerhalb des v-for statt einer pro Karte (gleiches Muster wie der
// bestehende Bearbeiten-Modal mit editingItem/editForm). "welche Unterkunft" (detailItem) und "ist
// der Dialog offen" (detailDialogOpen) bewusst getrennt: AccommodationDetailDialog.vue braucht ein
// echtes Accommodation-Objekt als Prop (nicht nullable), müsste beim Schließen also sonst komplett
// aus dem DOM entfernt werden (v-if) statt nur unsichtbar zu werden – das würde Modal.vue's eigene
// Fade-Out-Transition abschneiden, da sie nie zum Abspielen kommt.
const detailItem = ref<Accommodation | null>(null);
const detailDialogOpen = ref(false);
function openDetail(acc: Accommodation) {
  detailItem.value = acc;
  detailDialogOpen.value = true;
}
function closeDetail() {
  detailDialogOpen.value = false;
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

    <Modal :model-value="showForm" title="Neue Unterkunft" full-height @update:model-value="(v) => !v && closeForm()">
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
      <p v-if="locationError" class="hint error">
        ⚠️ Der Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
      </p>
      <button type="button" class="secondary picker-toggle" @click="pickerOpen = !pickerOpen">
        📍 Standort manuell setzen {{ pickerOpen ? '▲' : '▼' }}
      </button>
      <LocationPicker v-if="pickerOpen" v-model="manualPin" :center="pickerCenter" />
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
        <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
        <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
        <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
      </p>

      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="masonry cards">
      <template v-for="acc in accommodations" :key="acc.id">
        <UndoDeleteRow v-if="isPending(acc.id)" :label="acc.name" @undo="restore(acc.id)" />
        <div v-else class="card acc-card" :class="{ 'new-highlight': highlightedIds.has(acc.id) }" @click="openDetail(acc)">
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
          <p v-if="acc.address" class="acc-meta">📍 {{ acc.address }}</p>
          <p v-if="acc.checkin || acc.checkout" class="acc-meta">🕒 {{ acc.checkin || '–' }} · {{ acc.checkout || '–' }}</p>
          <p v-if="acc.note" class="acc-note">{{ acc.note }}</p>
        </div>
      </template>
    </TransitionGroup>
    <p v-if="!accommodations.length" class="empty">Noch keine Unterkunft eingetragen.</p>

    <AccommodationDetailDialog
      v-if="detailItem"
      v-model="detailDialogOpen"
      :accommodation="detailItem"
      :payer-label="detailItem.paid_by_user_id != null ? userLabel(detailItem.paid_by_user_id) : null"
      @edit="editFromDetail"
      @show-on-map="showDetailOnMap"
    />

    <Modal
      :model-value="editingItem !== null"
      title="Unterkunft bearbeiten"
      full-height
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
        <p v-if="locationErrorEdit" class="hint error">
          ⚠️ Der Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
        </p>
        <button type="button" class="secondary picker-toggle" @click="pickerOpenEdit = !pickerOpenEdit">
          📍 Standort manuell setzen {{ pickerOpenEdit ? '▲' : '▼' }}
        </button>
        <LocationPicker v-if="pickerOpenEdit" v-model="manualPinEdit" :center="pickerCenter" />
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
          <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
          <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
          <code>---</code> für Trennlinie · <code>`Code`</code> · Links werden automatisch erkannt
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

.hint.error {
  color: var(--color-danger);
}

.picker-toggle {
  align-self: flex-start;
  padding: 6px 12px;
  font-size: 0.85rem;
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
  column-width: 240px;
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

.acc-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.acc-note {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
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

</style>
