<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { ExcursionComment, ExcursionLike, Spot, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import ExcursionCard from '../components/ExcursionCard.vue';
import SpotCard from '../components/SpotCard.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();

const users = ref<User[]>([]);
const likes = ref<ExcursionLike[]>([]);
const comments = ref<ExcursionComment[]>([]);
const spots = ref<Spot[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [usersRes, likesRes, commentsRes, spotsRes] = await Promise.all([
    api.get<User[]>('/users'),
    api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
    api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
    api.get<Spot[]>(`/spots?trip_id=${tripId}`),
    excursionsStore.load(),
  ]);
  users.value = usersRes;
  likes.value = likesRes;
  comments.value = commentsRes;
  spots.value = spotsRes;
  loading.value = false;
});

function creatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function author(id: number) {
  return users.value.find((u) => u.id === id);
}

function stationsFor(spotIds: number[]) {
  return spots.value.filter((s) => spotIds.includes(s.id));
}

// --- Likes/Kommentare (unverändert, weiterhin an ideas/idea_likes/idea_comments gebunden) ---
function likesFor(ideaId: number) {
  return likes.value.filter((l) => l.idea_id === ideaId);
}
function likedByMe(ideaId: number) {
  return likesFor(ideaId).some((l) => l.user_id === auth.user?.id);
}
function commentsFor(ideaId: number) {
  return comments.value.filter((c) => c.idea_id === ideaId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function commentItemsFor(ideaId: number) {
  return commentsFor(ideaId).map((c) => ({
    id: c.id,
    avatar: author(c.author_id)?.avatar ?? '❓',
    username: author(c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}
async function toggleLike(ideaId: number) {
  const result = await api.post<{ liked: boolean }>(`/ideas/${ideaId}/like`);
  if (result.liked) {
    likes.value.push({ id: Date.now(), idea_id: ideaId, user_id: auth.user!.id });
  } else {
    likes.value = likes.value.filter((l) => !(l.idea_id === ideaId && l.user_id === auth.user!.id));
  }
}
async function submitComment(ideaId: number, content: string) {
  const created = await api.post<ExcursionComment>(`/ideas/${ideaId}/comments`, { content });
  comments.value.push(created);
}
async function removeComment(id: number) {
  await api.delete(`/ideas/comments/${id}`);
  comments.value = comments.value.filter((c) => c.id !== id);
}

// --- Ausflüge ---
const showExcursionForm = ref(false);
const emptyExcursionForm = () => ({ title: '', image_url: '', note: '', date: '', spot_ids: [] as number[] });
const excursionForm = ref(emptyExcursionForm());

const editingExcursion = ref<number | null>(null);
const editExcursionForm = ref(emptyExcursionForm());

const unplannedExcursions = computed(() => excursionsStore.excursions.filter((e) => !e.date));
const plannedExcursions = computed(() =>
  [...excursionsStore.excursions].filter((e) => e.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
);

function closeExcursionForm() {
  showExcursionForm.value = false;
  excursionForm.value = emptyExcursionForm();
}

async function addExcursion() {
  if (!excursionForm.value.title.trim()) return;
  await excursionsStore.create({
    title: excursionForm.value.title.trim(),
    image_url: excursionForm.value.image_url || undefined,
    note: excursionForm.value.note || undefined,
    date: excursionForm.value.date || undefined,
    spot_ids: excursionForm.value.spot_ids,
  });
  closeExcursionForm();
}

function startEditExcursion(excursion: { id: number; title: string; image_url: string | null; note: string | null; date: string | null; spot_ids: number[] }) {
  editingExcursion.value = excursion.id;
  editExcursionForm.value = {
    title: excursion.title,
    image_url: excursion.image_url ?? '',
    note: excursion.note ?? '',
    date: excursion.date ?? '',
    spot_ids: [...excursion.spot_ids],
  };
}

async function submitEditExcursion() {
  if (editingExcursion.value == null || !editExcursionForm.value.title.trim()) return;
  await excursionsStore.update(editingExcursion.value, {
    title: editExcursionForm.value.title.trim(),
    image_url: editExcursionForm.value.image_url || undefined,
    note: editExcursionForm.value.note || undefined,
    date: editExcursionForm.value.date || undefined,
    spot_ids: editExcursionForm.value.spot_ids,
  });
  editingExcursion.value = null;
}

async function removeExcursion(id: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === id);
  if (excursion?.date) {
    const confirmed = window.confirm(
      'Dieser Ausflug ist bereits im Kalender eingeplant. Wirklich löschen? Die zugeordneten Spots bleiben erhalten und werden nicht mitgelöscht.',
    );
    if (!confirmed) return;
  }
  await excursionsStore.remove(id);
}

// Drop-Zone, um die Kalender-Einplanung rückgängig zu machen: ein geplanter Ausflug kann aus dem
// "Geplant"-Bereich (oder direkt aus der Kalender-Schublade) hierher zurückgezogen werden.
// Zähler statt Boolean, da dragenter/dragleave beim Überqueren von Kind-Elementen mehrfach feuern.
const unplannedDragOverCount = ref(0);
const unplannedDragOver = computed(() => unplannedDragOverCount.value > 0);

function onUnplannedDragEnter() {
  unplannedDragOverCount.value++;
}
function onUnplannedDragLeave() {
  unplannedDragOverCount.value = Math.max(0, unplannedDragOverCount.value - 1);
}
function onUnplannedDrop(event: DragEvent) {
  unplannedDragOverCount.value = 0;
  const raw = event.dataTransfer?.getData('text/excursion-id');
  if (!raw) return;
  excursionsStore.setDate(Number(raw), null);
}

// --- Spots ---
const showSpotForm = ref(false);
const emptySpotForm = () => ({ title: '', image_url: '', maps_link: '', note: '', category: '' });
const spotForm = ref(emptySpotForm());
const spotMapsLinkResolved = ref<boolean | null>(null);

const editingSpot = ref<Spot | null>(null);
const editSpotForm = ref(emptySpotForm());
const editSpotMapsLinkResolved = ref<boolean | null>(null);

const activeSpots = computed(() => spots.value.filter((s) => !s.discarded));
const discardedSpots = computed(() => spots.value.filter((s) => s.discarded));

const spotCategoryOptions = computed(() => {
  const used = spots.value.map((s) => s.category).filter((c): c is string => !!c);
  return [...new Set([...SPOT_CATEGORY_SUGGESTIONS, ...used])];
});

function checkSpotMapsLink() {
  spotMapsLinkResolved.value = spotForm.value.maps_link ? parseLatLngFromMapsLink(spotForm.value.maps_link) != null : null;
}
function checkEditSpotMapsLink() {
  editSpotMapsLinkResolved.value = editSpotForm.value.maps_link
    ? parseLatLngFromMapsLink(editSpotForm.value.maps_link) != null
    : null;
}

function spotToBody(f: ReturnType<typeof emptySpotForm>) {
  const parsed = parseLatLngFromMapsLink(f.maps_link);
  return {
    trip_id: tripId,
    title: f.title.trim(),
    image_url: f.image_url || undefined,
    category: f.category || undefined,
    note: f.note || undefined,
    maps_link: f.maps_link || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  };
}

function closeSpotForm() {
  showSpotForm.value = false;
  spotForm.value = emptySpotForm();
  spotMapsLinkResolved.value = null;
}

async function addSpot() {
  if (!spotForm.value.title.trim()) return;
  const created = await api.post<Spot>('/spots', spotToBody(spotForm.value));
  spots.value.unshift(created);
  drawers.touchLocations();
  closeSpotForm();
}

function startEditSpot(spot: Spot) {
  editingSpot.value = spot;
  editSpotForm.value = {
    title: spot.title,
    image_url: spot.image_url ?? '',
    maps_link: spot.maps_link ?? '',
    note: spot.note ?? '',
    category: spot.category ?? '',
  };
  editSpotMapsLinkResolved.value = null;
}

async function submitEditSpot() {
  if (!editingSpot.value || !editSpotForm.value.title.trim()) return;
  const updated = await api.put<Spot>(`/spots/${editingSpot.value.id}`, spotToBody(editSpotForm.value));
  const idx = spots.value.findIndex((s) => s.id === updated.id);
  if (idx !== -1) spots.value[idx] = updated;
  drawers.touchLocations();
  editingSpot.value = null;
}

async function removeSpot(id: number) {
  await api.delete(`/spots/${id}`);
  spots.value = spots.value.filter((s) => s.id !== id);
  drawers.touchLocations();
}

async function toggleDiscarded(spot: Spot) {
  const updated = await api.put<Spot>(`/spots/${spot.id}`, {
    title: spot.title,
    image_url: spot.image_url ?? undefined,
    category: spot.category ?? undefined,
    note: spot.note ?? undefined,
    maps_link: spot.maps_link ?? undefined,
    lat: spot.lat ?? undefined,
    lng: spot.lng ?? undefined,
    discarded: !spot.discarded,
  });
  const idx = spots.value.findIndex((s) => s.id === spot.id);
  if (idx !== -1) spots.value[idx] = updated;
}

function showSpotOnMap(spot: Spot) {
  drawers.openMapAt(`spot-${spot.id}`);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Ausflüge</h1>
      <button @click="showExcursionForm = true">+ Neuer Ausflug</button>
    </div>

    <Modal :model-value="showExcursionForm" title="Neuer Ausflug" @update:model-value="(v) => !v && closeExcursionForm()">
      <form class="edit-form" @submit.prevent="addExcursion">
        <input v-model="excursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="excursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <textarea v-model="excursionForm.note" placeholder="Notiz (optional)" rows="4"></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
        </p>
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="excursionForm.date" type="date" />
        </label>
        <fieldset v-if="spots.length" class="spot-picker">
          <legend>Stationen (Spots)</legend>
          <label v-for="spot in spots" :key="spot.id" class="spot-option">
            <input type="checkbox" :value="spot.id" v-model="excursionForm.spot_ids" />
            {{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}
          </label>
        </fieldset>
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <section
      class="group dropzone"
      :class="{ 'drag-over': unplannedDragOver }"
      @dragover.prevent
      @dragenter.prevent="onUnplannedDragEnter"
      @dragleave="onUnplannedDragLeave"
      @drop.prevent="onUnplannedDrop"
    >
      <h2>In Planung</h2>
      <TransitionGroup v-if="unplannedExcursions.length" tag="div" name="list" class="grid cards">
        <ExcursionCard
          v-for="excursion in unplannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="stationsFor(excursion.spot_ids)"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
        />
      </TransitionGroup>
      <p v-else class="empty dropzone-hint">
        Noch keine Ausflüge in Planung – geplante Ausflüge kannst du hierher ziehen, um die
        Einplanung rückgängig zu machen.
      </p>
    </section>

    <section class="group" v-if="plannedExcursions.length">
      <h2>Geplant</h2>
      <TransitionGroup tag="div" name="list" class="grid cards">
        <ExcursionCard
          v-for="excursion in plannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="stationsFor(excursion.spot_ids)"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
        />
      </TransitionGroup>
    </section>
    <p v-if="!excursionsStore.excursions.length" class="empty">Noch keine Ausflüge angelegt.</p>

    <Modal
      :model-value="editingExcursion !== null"
      title="Ausflug bearbeiten"
      @update:model-value="(v) => !v && (editingExcursion = null)"
    >
      <form class="edit-form" @submit.prevent="submitEditExcursion">
        <input v-model="editExcursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="editExcursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <textarea v-model="editExcursionForm.note" placeholder="Notiz (optional)" rows="4"></textarea>
        <p class="syntax-hint">
          <code>**fett**</code> · <code>_kursiv_</code> · <code>* Punkt</code> für Listen · Links werden
          automatisch erkannt
        </p>
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="editExcursionForm.date" type="date" />
        </label>
        <fieldset v-if="spots.length" class="spot-picker">
          <legend>Stationen (Spots)</legend>
          <label v-for="spot in spots" :key="spot.id" class="spot-option">
            <input type="checkbox" :value="spot.id" v-model="editExcursionForm.spot_ids" />
            {{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}
          </label>
        </fieldset>
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <hr class="divider" />

    <div class="header">
      <h2>Spots</h2>
      <button @click="showSpotForm = true">+ Neuer Spot</button>
    </div>
    <p class="hint">
      Orte (Restaurant, Sehenswürdigkeit, Strand, …), die du als Stationen bei Ausflügen zuordnen kannst –
      auch unabhängig von einem Ausflug.
    </p>

    <Modal :model-value="showSpotForm" title="Neuer Spot" @update:model-value="(v) => !v && closeSpotForm()">
      <form class="edit-form" @submit.prevent="addSpot">
        <input v-model="spotForm.title" type="text" placeholder="Titel" required />
        <input v-model="spotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <Combobox v-model="spotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional)" />
        <input
          v-model="spotForm.maps_link"
          type="url"
          placeholder="Maps-Link (Google/Apple) (optional)"
          @blur="checkSpotMapsLink"
        />
        <p v-if="spotMapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
        <p v-if="spotMapsLinkResolved === false" class="hint">
          Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
        </p>
        <textarea v-model="spotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <section class="group" v-if="activeSpots.length">
      <TransitionGroup tag="div" name="list" class="grid cards">
        <SpotCard
          v-for="spot in activeSpots"
          :key="spot.id"
          :spot="spot"
          :creator-label="creatorLabel(spot.created_by)"
          @edit="startEditSpot"
          @remove="removeSpot"
          @toggle-discarded="toggleDiscarded"
          @show-on-map="showSpotOnMap"
        />
      </TransitionGroup>
    </section>
    <p v-if="!spots.length" class="empty">Noch keine Spots angelegt.</p>

    <section class="group" v-if="discardedSpots.length">
      <h3>Verworfen</h3>
      <TransitionGroup tag="div" name="list" class="grid cards">
        <SpotCard
          v-for="spot in discardedSpots"
          :key="spot.id"
          :spot="spot"
          :creator-label="creatorLabel(spot.created_by)"
          @edit="startEditSpot"
          @remove="removeSpot"
          @toggle-discarded="toggleDiscarded"
          @show-on-map="showSpotOnMap"
        />
      </TransitionGroup>
    </section>

    <Modal
      :model-value="editingSpot !== null"
      title="Spot bearbeiten"
      @update:model-value="(v) => !v && (editingSpot = null)"
    >
      <form class="edit-form" @submit.prevent="submitEditSpot">
        <input v-model="editSpotForm.title" type="text" placeholder="Titel" required />
        <input v-model="editSpotForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <Combobox v-model="editSpotForm.category" :options="spotCategoryOptions" placeholder="Kategorie (optional)" />
        <input
          v-model="editSpotForm.maps_link"
          type="url"
          placeholder="Maps-Link (Google/Apple) (optional)"
          @blur="checkEditSpotMapsLink"
        />
        <p v-if="editSpotMapsLinkResolved === true" class="hint success">📍 Standort erkannt</p>
        <p v-if="editSpotMapsLinkResolved === false" class="hint">
          Standort wird beim Speichern serverseitig aufgelöst (auch Kurzlinks funktionieren).
        </p>
        <textarea v-model="editSpotForm.note" placeholder="Notiz (optional)" rows="3"></textarea>
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
  margin-bottom: var(--space-2);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

.date-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.spot-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.spot-picker legend {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0 4px;
}

.spot-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 400;
}

.group {
  margin-bottom: var(--space-4);
}

.dropzone {
  border: 2px dashed transparent;
  border-radius: var(--radius-md);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dropzone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.dropzone-hint {
  font-size: 0.85rem;
}

.group h2,
.group h3 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-3);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-4) 0;
}

.empty {
  color: var(--color-text-muted);
}
</style>
