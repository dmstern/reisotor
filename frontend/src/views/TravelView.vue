<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { TravelItem, TravelPlace, TravelRole, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { TRAVEL_ROLE_META, TRAVEL_ROLE_OPTIONS } from '../utils/travelRole';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';
import Modal from '../components/Modal.vue';
import TravelDetailDialog from '../components/TravelDetailDialog.vue';
import LocationPicker from '../components/LocationPicker.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';

const tripStore = useTripStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const items = ref<TravelItem[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const places = ref<TravelPlace[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const showForm = ref(false);
const highlightedIds = ref<Set<number>>(new Set());

const TYPE_OPTIONS = ['Flug', 'Zug', 'Bus', 'Auto', 'Fähre', 'Sonstiges'];
// Sentinel-Wert für "kein Ort ausgewählt, Freitext eingeben" – ein leerer String wäre auch möglich,
// aber als eigene Konstante an einer Stelle klarer als verstreute '' -Vergleiche.
const MANUAL = '';

const emptyForm = () => ({
  title: '',
  type: 'Flug',
  role: '' as TravelRole | '',
  from_place_id: MANUAL,
  to_place_id: MANUAL,
  from_location: '',
  to_location: '',
  from_maps_link: '',
  to_maps_link: '',
  date: '',
  departure_time: '',
  arrival_time: '',
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
const manualFromPin = ref<{ lat: number; lng: number } | null>(null);
const manualToPin = ref<{ lat: number; lng: number } | null>(null);
const fromPickerOpen = ref(false);
const toPickerOpen = ref(false);
const fromLocationError = ref(false);
const toLocationError = ref(false);
// Bleibt gesetzt, solange nach dem Anlegen mindestens ein Standort nicht auflösbar ist – ein
// erneuter Speicherversuch (manuell gesetzter Pin) muss dann den bereits angelegten Eintrag
// AKTUALISIEREN statt einen zweiten anzulegen (gleiches Muster wie TripSwitcher.vue's pendingFixTripId).
const pendingFixId = ref<number | null>(null);

const editingItem = ref<TravelItem | null>(null);
const editForm = ref(emptyForm());
const editFromMapsLinkResolved = ref<boolean | null>(null);
const editToMapsLinkResolved = ref<boolean | null>(null);
const manualFromPinEdit = ref<{ lat: number; lng: number } | null>(null);
const manualToPinEdit = ref<{ lat: number; lng: number } | null>(null);
const fromPickerOpenEdit = ref(false);
const toPickerOpenEdit = ref(false);
const fromLocationErrorEdit = ref(false);
const toLocationErrorEdit = ref(false);

// Öffnet die Karte des manuellen Pickers direkt im Urlaubsgebiet statt einer leeren Weltkarte.
const pickerCenter = computed(() => {
  const t = tripStore.currentTrip;
  return t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : undefined;
});

async function load() {
  const [itemsRes, placesRes, usersRes] = await Promise.all([
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    api.get<TravelPlace[]>(`/travel/places?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  items.value = itemsRes;
  places.value = placesRes;
  users.value = usersRes;
  loading.value = false;
}

watch(() => liveSync.domainVersion.travel, load);

onMounted(async () => {
  highlightedIds.value = liveSync.markSeen('travel');
  await load();
});

function userLabel(id: number | null) {
  if (id == null) return '';
  const u = users.value.find((u) => u.id === id);
  return u ? `${u.avatar} ${u.username}` : '';
}

function placeLabel(id: number | null) {
  if (id == null) return null;
  const p = places.value.find((p) => p.id === id);
  return p ? `${p.is_home ? '🏠' : '📍'} ${p.name}` : null;
}

function toBody(
  f: ReturnType<typeof emptyForm>,
  manualFrom?: { lat: number; lng: number } | null,
  manualTo?: { lat: number; lng: number } | null,
) {
  const fromParsed = parseLatLngFromMapsLink(f.from_maps_link);
  const toParsed = parseLatLngFromMapsLink(f.to_maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    type: f.type || undefined,
    role: f.role || undefined,
    from_place_id: f.from_place_id ? Number(f.from_place_id) : undefined,
    to_place_id: f.to_place_id ? Number(f.to_place_id) : undefined,
    from_location: f.from_location || undefined,
    to_location: f.to_location || undefined,
    from_maps_link: f.from_maps_link || undefined,
    from_lat: manualFrom?.lat ?? fromParsed?.lat,
    from_lng: manualFrom?.lng ?? fromParsed?.lng,
    to_maps_link: f.to_maps_link || undefined,
    to_lat: manualTo?.lat ?? toParsed?.lat,
    to_lng: manualTo?.lng ?? toParsed?.lng,
    date: f.date || undefined,
    departure_time: f.departure_time || undefined,
    arrival_time: f.arrival_time || undefined,
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
  const body = toBody(form.value, manualFromPin.value, manualToPin.value);
  const created =
    pendingFixId.value != null
      ? await api.put<TravelItem>(`/travel/${pendingFixId.value}`, body)
      : await api.post<TravelItem>('/travel', body);
  const idx = items.value.findIndex((i) => i.id === created.id);
  if (idx !== -1) items.value[idx] = created;
  else items.value.push(created);
  drawers.touchLocations();
  // Serverseitige Auflösung (backend/src/utils/mapsLink.ts) ebenfalls fehlgeschlagen, z. B. weil
  // Google einen Maps-Kurzlink per Bot-Erkennung blockt – Dialog offen lassen, den betroffenen
  // manuellen Picker (Abflug/Abfahrt und/oder Ankunft) automatisch aufklappen. Nur relevant, wenn
  // die jeweilige Etappe überhaupt per Freitext-Link läuft (nicht bei gewähltem gespeicherten Ort).
  const fromFailed = !form.value.from_place_id && !!body.from_maps_link && created.from_lat == null && !manualFromPin.value;
  const toFailed = !form.value.to_place_id && !!body.to_maps_link && created.to_lat == null && !manualToPin.value;
  if (fromFailed || toFailed) {
    pendingFixId.value = created.id;
    fromLocationError.value = fromFailed;
    toLocationError.value = toFailed;
    if (fromFailed) fromPickerOpen.value = true;
    if (toFailed) toPickerOpen.value = true;
    return;
  }
  closeForm();
}

watch(manualFromPin, (pin) => {
  if (pin && fromLocationError.value) submit();
});
watch(manualToPin, (pin) => {
  if (pin && toLocationError.value) submit();
});

function closeForm() {
  showForm.value = false;
  form.value = emptyForm();
  fromMapsLinkResolved.value = null;
  toMapsLinkResolved.value = null;
  manualFromPin.value = null;
  manualToPin.value = null;
  fromPickerOpen.value = false;
  toPickerOpen.value = false;
  fromLocationError.value = false;
  toLocationError.value = false;
  pendingFixId.value = null;
}

function startEdit(item: TravelItem) {
  editingItem.value = item;
  editForm.value = {
    title: item.title,
    type: item.type ?? 'Flug',
    role: item.role ?? '',
    from_place_id: item.from_place_id != null ? String(item.from_place_id) : MANUAL,
    to_place_id: item.to_place_id != null ? String(item.to_place_id) : MANUAL,
    from_location: item.from_location ?? '',
    to_location: item.to_location ?? '',
    from_maps_link: item.from_maps_link ?? '',
    to_maps_link: item.to_maps_link ?? '',
    date: item.date ?? '',
    departure_time: item.departure_time ?? '',
    arrival_time: item.arrival_time ?? '',
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
  manualFromPinEdit.value = null;
  manualToPinEdit.value = null;
  fromPickerOpenEdit.value = false;
  toPickerOpenEdit.value = false;
  fromLocationErrorEdit.value = false;
  toLocationErrorEdit.value = false;
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim()) return;
  const body = toBody(editForm.value, manualFromPinEdit.value, manualToPinEdit.value);
  const updated = await api.put<TravelItem>(`/travel/${editingItem.value.id}`, body);
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  drawers.touchLocations();
  const fromFailed =
    !editForm.value.from_place_id && !!body.from_maps_link && updated.from_lat == null && !manualFromPinEdit.value;
  const toFailed = !editForm.value.to_place_id && !!body.to_maps_link && updated.to_lat == null && !manualToPinEdit.value;
  if (fromFailed || toFailed) {
    fromLocationErrorEdit.value = fromFailed;
    toLocationErrorEdit.value = toFailed;
    if (fromFailed) fromPickerOpenEdit.value = true;
    if (toFailed) toPickerOpenEdit.value = true;
    return;
  }
  fromLocationErrorEdit.value = false;
  toLocationErrorEdit.value = false;
  editingItem.value = null;
}

watch(manualFromPinEdit, (pin) => {
  if (pin && fromLocationErrorEdit.value) submitEdit();
});
watch(manualToPinEdit, (pin) => {
  if (pin && toLocationErrorEdit.value) submitEdit();
});

// Weicher Löschvorgang serverseitig (siehe routes/travel.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts) – siehe gleiches Muster in AccommodationView.vue.
async function remove(id: number) {
  await api.delete(`/travel/${id}`);
  markPendingDelete(id, () => {
    items.value = items.value.filter((i) => i.id !== id);
  });
  drawers.touchLocations();
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/travel_item/${id}/restore`);
  drawers.touchLocations();
}

function typeIcon(type: string | null) {
  if (type === 'Flug') return '✈️';
  if (type === 'Zug') return '🚆';
  if (type === 'Bus') return '🚌';
  if (type === 'Auto') return '🚗';
  if (type === 'Fähre') return '⛴️';
  return '🎫';
}

function travelDuration(item: TravelItem) {
  const minutes = travelDurationMinutes(item.departure_time, item.arrival_time);
  return minutes == null ? null : formatTravelDuration(minutes);
}

// "🔄 Rückreise anlegen": statt Von/Nach (samt Orten) für den Rückweg erneut einzutippen, öffnet
// das ohnehin vorhandene Anlegen-Formular vorausgefüllt mit vertauschten Orten – nur Datum/Zeiten
// (und ggf. Kosten) sind für die Rückreise ja typischerweise ohnehin andere und bleiben leer.
const ROLE_SWAP: Record<TravelRole, TravelRole> = { arrival: 'departure', departure: 'arrival', onward: 'onward' };

function swapTitle(title: string): string {
  if (/hin/i.test(title)) {
    return title.replace(/hin/i, (m) => (m === m.toUpperCase() ? 'RÜCK' : m[0] === m[0].toUpperCase() ? 'Rück' : 'rück'));
  }
  return `Rückreise: ${title}`;
}

function createReturnLeg(item: TravelItem) {
  form.value = {
    ...emptyForm(),
    title: swapTitle(item.title),
    type: item.type ?? 'Flug',
    role: item.role ? ROLE_SWAP[item.role] : '',
    from_place_id: item.to_place_id != null ? String(item.to_place_id) : MANUAL,
    to_place_id: item.from_place_id != null ? String(item.from_place_id) : MANUAL,
    from_location: item.to_location ?? '',
    to_location: item.from_location ?? '',
    from_maps_link: item.to_maps_link ?? '',
    to_maps_link: item.from_maps_link ?? '',
    luggage: item.luggage ?? '',
  };
  fromMapsLinkResolved.value = null;
  toMapsLinkResolved.value = null;
  manualFromPin.value = null;
  manualToPin.value = null;
  fromPickerOpen.value = false;
  toPickerOpen.value = false;
  fromLocationError.value = false;
  toLocationError.value = false;
  pendingFixId.value = null;
  showForm.value = true;
}

// --- Orte (wiederverwendbare Start-/Zielpunkte für Etappen) ---
const emptyPlaceForm = () => ({ name: '', is_home: false, maps_link: '' });
const newPlaceForm = ref(emptyPlaceForm());
const newPlaceMapsLinkResolved = ref<boolean | null>(null);
const editingPlace = ref<TravelPlace | null>(null);
const editPlaceForm = ref(emptyPlaceForm());

function checkNewPlaceMapsLink() {
  newPlaceMapsLinkResolved.value = newPlaceForm.value.maps_link
    ? parseLatLngFromMapsLink(newPlaceForm.value.maps_link) != null
    : null;
}

async function addPlace() {
  if (!newPlaceForm.value.name.trim()) return;
  const created = await api.post<TravelPlace>('/travel/places', {
    trip_id: tripId,
    name: newPlaceForm.value.name.trim(),
    is_home: newPlaceForm.value.is_home,
    maps_link: newPlaceForm.value.maps_link || undefined,
  });
  places.value.push(created);
  drawers.touchLocations();
  newPlaceForm.value = emptyPlaceForm();
  newPlaceMapsLinkResolved.value = null;
}

function startEditPlace(place: TravelPlace) {
  editingPlace.value = place;
  editPlaceForm.value = { name: place.name, is_home: !!place.is_home, maps_link: place.maps_link ?? '' };
}

async function submitEditPlace() {
  if (!editingPlace.value || !editPlaceForm.value.name.trim()) return;
  const updated = await api.put<TravelPlace>(`/travel/places/${editingPlace.value.id}`, {
    trip_id: tripId,
    name: editPlaceForm.value.name.trim(),
    is_home: editPlaceForm.value.is_home,
    maps_link: editPlaceForm.value.maps_link || undefined,
  });
  const idx = places.value.findIndex((p) => p.id === updated.id);
  if (idx !== -1) places.value[idx] = updated;
  drawers.touchLocations();
  editingPlace.value = null;
}

async function removePlace(id: number) {
  await api.delete(`/travel/places/${id}`);
  places.value = places.value.filter((p) => p.id !== id);
  // Etappen, die diesen Ort referenzierten, verlieren serverseitig nur die Verknüpfung (ON DELETE
  // SET NULL) – ihre zuletzt materialisierten Von/Nach-Angaben bleiben als Freitext erhalten, ein
  // Reload hält from_place_id/to_place_id in der Liste damit konsistent zum Server.
  items.value = await api.get<TravelItem[]>(`/travel?trip_id=${tripId}`);
}

// Ein einziger Detail-Dialog außerhalb des v-for statt einer pro Karte (gleiches Muster wie der
// bestehende Bearbeiten-Modal mit editingItem/editForm). "welcher Eintrag" (detailItem) und "ist
// der Dialog offen" (detailDialogOpen) bewusst getrennt: TravelDetailDialog.vue braucht ein echtes
// TravelItem-Objekt als Prop (nicht nullable), müsste beim Schließen also sonst komplett aus dem
// DOM entfernt werden (v-if) statt nur unsichtbar zu werden – das würde Modal.vue's eigene
// Fade-Out-Transition abschneiden.
const detailItem = ref<TravelItem | null>(null);
const detailDialogOpen = ref(false);
function openDetail(item: TravelItem) {
  detailItem.value = item;
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
function showDetailFromOnMap() {
  if (!detailItem.value) return;
  drawers.openMapAt(`travel-from-${detailItem.value.id}`);
  closeDetail();
}
function showDetailToOnMap() {
  if (!detailItem.value) return;
  drawers.openMapAt(`travel-to-${detailItem.value.id}`);
  closeDetail();
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Reise</h1>
      <button @click="showForm = true">+ Neue Fahrt/Flug</button>
    </div>

    <section class="card places-card">
      <h2>📍 Orte</h2>
      <p class="hint">
        Einmal angelegt, lassen sich Orte in Etappen als Von/Nach auswählen, statt sie erneut
        eintippen zu müssen – z. B. "Zuhause" für Hin- und Rückreise.
      </p>
      <form class="place-form" @submit.prevent="addPlace">
        <input v-model="newPlaceForm.name" type="text" placeholder="Name, z. B. Zuhause oder Hotel Meeresblick" required />
        <label class="home-check">
          <input v-model="newPlaceForm.is_home" type="checkbox" />
          🏠 Zuhause
        </label>
        <input v-model="newPlaceForm.maps_link" type="url" placeholder="Maps-Link (optional)" @blur="checkNewPlaceMapsLink" />
        <button type="submit">Hinzufügen</button>
      </form>
      <p v-if="newPlaceMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
      <p v-if="newPlaceMapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
      <ul class="places-list" v-if="places.length">
        <li v-for="place in places" :key="place.id" class="place-row">
          <span class="place-name">{{ place.is_home ? '🏠' : '📍' }} {{ place.name }}</span>
          <div class="row-actions">
            <EditButton small @click="startEditPlace(place)" />
            <DeleteButton small @click="removePlace(place.id)" />
          </div>
        </li>
      </ul>
      <p v-else class="empty">Noch keine Orte angelegt.</p>
    </section>

    <Modal :model-value="showForm" title="Neuer Reise-Eintrag" full-height @update:model-value="(v) => !v && closeForm()">
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
          <option value="">– automatisch anhand der Orte / nicht festgelegt –</option>
          <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
            {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{ TRAVEL_ROLE_META[r].hint }})
          </option>
        </select>
      </label>
      <div class="row">
        <label>
          Von
          <select v-model="form.from_place_id">
            <option :value="MANUAL">✏️ Manuell eingeben</option>
            <option v-for="p in places" :key="p.id" :value="String(p.id)">{{ p.is_home ? '🏠' : '📍' }} {{ p.name }}</option>
          </select>
        </label>
        <label>
          Nach
          <select v-model="form.to_place_id">
            <option :value="MANUAL">✏️ Manuell eingeben</option>
            <option v-for="p in places" :key="p.id" :value="String(p.id)">{{ p.is_home ? '🏠' : '📍' }} {{ p.name }}</option>
          </select>
        </label>
      </div>
      <div class="row" v-if="!form.from_place_id || !form.to_place_id">
        <label v-if="!form.from_place_id">
          Von (Freitext)
          <input v-model="form.from_location" type="text" />
        </label>
        <label v-if="!form.to_place_id">
          Nach (Freitext)
          <input v-model="form.to_location" type="text" />
        </label>
      </div>
      <div class="row" v-if="!form.from_place_id || !form.to_place_id">
        <label v-if="!form.from_place_id">
          Standort Abflug/Abfahrt (Maps-Link, optional)
          <input v-model="form.from_maps_link" type="url" @blur="checkFromMapsLink" />
        </label>
        <label v-if="!form.to_place_id">
          Standort Ankunft (Maps-Link, optional)
          <input v-model="form.to_maps_link" type="url" @blur="checkToMapsLink" />
        </label>
      </div>
      <p v-if="fromMapsLinkResolved === true || toMapsLinkResolved === true" class="hint success">
        📍 Standort erkannt – erscheint auf der Karte
      </p>
      <p v-if="fromMapsLinkResolved === false || toMapsLinkResolved === false" class="hint">
        Ein Standort konnte nicht automatisch erkannt werden.
      </p>
      <template v-if="!form.from_place_id">
        <p v-if="fromLocationError" class="hint error">
          ⚠️ Der Abflug/Abfahrt-Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
        </p>
        <button type="button" class="secondary picker-toggle" @click="fromPickerOpen = !fromPickerOpen">
          📍 Abflug/Abfahrt manuell setzen {{ fromPickerOpen ? '▲' : '▼' }}
        </button>
        <LocationPicker v-if="fromPickerOpen" v-model="manualFromPin" :center="pickerCenter" />
      </template>
      <template v-if="!form.to_place_id">
        <p v-if="toLocationError" class="hint error">
          ⚠️ Der Ankunft-Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
        </p>
        <button type="button" class="secondary picker-toggle" @click="toPickerOpen = !toPickerOpen">
          📍 Ankunft manuell setzen {{ toPickerOpen ? '▲' : '▼' }}
        </button>
        <LocationPicker v-if="toPickerOpen" v-model="manualToPin" :center="pickerCenter" />
      </template>
      <label>
        Datum
        <input v-model="form.date" type="date" />
      </label>
      <div class="row">
        <label>
          Abflug/Abfahrt
          <input v-model="form.departure_time" type="time" />
        </label>
        <label>
          Ankunft
          <input v-model="form.arrival_time" type="time" />
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
      <p class="syntax-hint">
        <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
        <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
        <code>---</code> für Trennlinie · <code>`Code`</code> · Links/E-Mails/Telefonnummern werden
        automatisch erkannt
      </p>

      <button type="submit">Hinzufügen</button>
    </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="masonry cards">
      <template v-for="item in items" :key="item.id">
        <UndoDeleteRow v-if="isPending(item.id)" :label="item.title" @undo="restore(item.id)" />
        <div v-else class="card travel-card" :class="{ 'new-highlight': highlightedIds.has(item.id) }" @click="openDetail(item)">
          <div class="travel-head">
            <h3>{{ typeIcon(item.type) }} {{ item.title }}</h3>
            <div class="actions">
              <EditButton small @click.stop="startEdit(item)" />
              <DeleteButton small @click.stop="remove(item.id)" />
            </div>
          </div>
          <span v-if="item.role" class="role-badge">
            {{ TRAVEL_ROLE_META[item.role].icon }} {{ TRAVEL_ROLE_META[item.role].label }}
          </span>
          <p v-if="item.from_location || item.to_location" class="route">
            {{ placeLabel(item.from_place_id) ?? item.from_location ?? '?' }} → {{ placeLabel(item.to_place_id) ?? item.to_location ?? '?' }}
          </p>
          <p v-if="item.date || item.departure_time">
            🗓️ {{ item.date || '' }}
            <span v-if="item.departure_time">
              · {{ item.departure_time }}<span v-if="item.arrival_time">–{{ item.arrival_time }}</span> Uhr
            </span>
            <span v-if="travelDuration(item)" class="duration">({{ travelDuration(item) }})</span>
          </p>
          <button type="button" class="card-action-btn return-btn" @click.stop="createReturnLeg(item)">
            🔄 Rückreise anlegen
          </button>
        </div>
      </template>
    </TransitionGroup>
    <p v-if="!items.length" class="empty">Noch keine Reise-Infos eingetragen.</p>

    <TravelDetailDialog
      v-if="detailItem"
      v-model="detailDialogOpen"
      :item="detailItem"
      :payer-label="detailItem.paid_by_user_id != null ? userLabel(detailItem.paid_by_user_id) : null"
      @edit="editFromDetail"
      @show-on-map-from="showDetailFromOnMap"
      @show-on-map-to="showDetailToOnMap"
    />

    <Modal
      :model-value="editingItem !== null"
      title="Reise-Eintrag bearbeiten"
      full-height
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
            <option value="">– automatisch anhand der Orte / nicht festgelegt –</option>
            <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
              {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{ TRAVEL_ROLE_META[r].hint }})
            </option>
          </select>
        </label>
        <div class="row">
          <label>
            Von
            <select v-model="editForm.from_place_id">
              <option :value="MANUAL">✏️ Manuell eingeben</option>
              <option v-for="p in places" :key="p.id" :value="String(p.id)">{{ p.is_home ? '🏠' : '📍' }} {{ p.name }}</option>
            </select>
          </label>
          <label>
            Nach
            <select v-model="editForm.to_place_id">
              <option :value="MANUAL">✏️ Manuell eingeben</option>
              <option v-for="p in places" :key="p.id" :value="String(p.id)">{{ p.is_home ? '🏠' : '📍' }} {{ p.name }}</option>
            </select>
          </label>
        </div>
        <div class="row" v-if="!editForm.from_place_id || !editForm.to_place_id">
          <label v-if="!editForm.from_place_id">
            Von (Freitext)
            <input v-model="editForm.from_location" type="text" />
          </label>
          <label v-if="!editForm.to_place_id">
            Nach (Freitext)
            <input v-model="editForm.to_location" type="text" />
          </label>
        </div>
        <div class="row" v-if="!editForm.from_place_id || !editForm.to_place_id">
          <label v-if="!editForm.from_place_id">
            Standort Abflug/Abfahrt (Maps-Link, optional)
            <input v-model="editForm.from_maps_link" type="url" @blur="checkEditFromMapsLink" />
          </label>
          <label v-if="!editForm.to_place_id">
            Standort Ankunft (Maps-Link, optional)
            <input v-model="editForm.to_maps_link" type="url" @blur="checkEditToMapsLink" />
          </label>
        </div>
        <p v-if="editFromMapsLinkResolved === true || editToMapsLinkResolved === true" class="hint success">
          📍 Standort erkannt
        </p>
        <p v-if="editFromMapsLinkResolved === false || editToMapsLinkResolved === false" class="hint">
          Ein Standort konnte nicht automatisch erkannt werden.
        </p>
        <template v-if="!editForm.from_place_id">
          <p v-if="fromLocationErrorEdit" class="hint error">
            ⚠️ Der Abflug/Abfahrt-Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
          </p>
          <button type="button" class="secondary picker-toggle" @click="fromPickerOpenEdit = !fromPickerOpenEdit">
            📍 Abflug/Abfahrt manuell setzen {{ fromPickerOpenEdit ? '▲' : '▼' }}
          </button>
          <LocationPicker v-if="fromPickerOpenEdit" v-model="manualFromPinEdit" :center="pickerCenter" />
        </template>
        <template v-if="!editForm.to_place_id">
          <p v-if="toLocationErrorEdit" class="hint error">
            ⚠️ Der Ankunft-Standort konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell zu setzen.
          </p>
          <button type="button" class="secondary picker-toggle" @click="toPickerOpenEdit = !toPickerOpenEdit">
            📍 Ankunft manuell setzen {{ toPickerOpenEdit ? '▲' : '▼' }}
          </button>
          <LocationPicker v-if="toPickerOpenEdit" v-model="manualToPinEdit" :center="pickerCenter" />
        </template>
        <label>
          Datum
          <input v-model="editForm.date" type="date" />
        </label>
        <div class="row">
          <label>
            Abflug/Abfahrt
            <input v-model="editForm.departure_time" type="time" />
          </label>
          <label>
            Ankunft
            <input v-model="editForm.arrival_time" type="time" />
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
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>~~durch~~</code> · <code># Titel</code> ·
          <code>&gt; Zitat</code> · <code>* Punkt</code> / <code>1. Punkt</code> für Listen ·
          <code>---</code> für Trennlinie · <code>`Code`</code> · Links/E-Mails/Telefonnummern werden
          automatisch erkannt
        </p>
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <Modal
      :model-value="editingPlace !== null"
      title="Ort bearbeiten"
      @update:model-value="(v) => !v && (editingPlace = null)"
    >
      <form class="edit-form" @submit.prevent="submitEditPlace">
        <input v-model="editPlaceForm.name" type="text" placeholder="Name" required />
        <label class="home-check">
          <input v-model="editPlaceForm.is_home" type="checkbox" />
          🏠 Zuhause
        </label>
        <input v-model="editPlaceForm.maps_link" type="url" placeholder="Maps-Link (optional)" />
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

.places-card {
  margin-bottom: var(--space-4);
}

.places-card h2 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: 4px;
}

.places-card .hint {
  margin-bottom: var(--space-2);
}

/* Grid statt flex-wrap: bei flex-wrap landete die Checkbox (.home-check) auf schmalen Mobile-
   Breiten unvorhersehbar allein auf einer Zeile (isoliert zwischen den beiden min-width:160px-
   Textfeldern), da keins der Felder eine eigene volle Zeile beanspruchte. Mobil (< 560px) bekommt
   dadurch jetzt jedes Feld eine eigene Zeile, ab 560px wieder eine gemeinsame Reihe wie zuvor. */
.place-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

@media (min-width: 560px) {
  .place-form {
    grid-template-columns: 1fr auto 1fr auto;
    align-items: center;
  }
}

.home-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.places-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.place-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}

.place-row:last-child {
  border-bottom: none;
}

.place-name {
  font-size: 0.9rem;
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

.hint.error {
  color: var(--color-danger);
}

.picker-toggle {
  align-self: flex-start;
  padding: 6px 12px;
  font-size: 0.85rem;
}

.cards {
  column-width: 260px;
}

.travel-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.route {
  overflow-wrap: anywhere;
}

.note {
  overflow-wrap: anywhere;
}

.note :deep(br:last-child) {
  display: none;
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

.role-badge {
  align-self: flex-start;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}

.duration {
  color: var(--color-text-muted);
  font-size: 0.85rem;
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

.return-btn {
  align-self: flex-start;
  margin-top: 4px;
}

</style>
