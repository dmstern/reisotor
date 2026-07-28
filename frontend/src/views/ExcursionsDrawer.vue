<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { Accommodation, ExcursionComment, ExcursionLike, TravelItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import ExcursionCard from '../components/ExcursionCard.vue';
import SpotOrderPicker from '../components/SpotOrderPicker.vue';
import Modal from '../components/Modal.vue';
import type { DerivedLocation } from '../utils/derivedLocation';

// Eigenständig gemountete Schublade (App.vue, rechter Platz) statt Teil der Karte-Hauptsicht –
// dadurch lassen sich Kalender- und Ausflüge-Schublade unabhängig voneinander auf-/zuklappen,
// während Spots/Karte immer sichtbar bleiben (siehe ExcursionsView.vue). Lädt deshalb ihre eigenen
// Daten (Unterkunft/Reise/Nutzer/Ausflug-Likes+Kommentare) unabhängig von der Karte-Hauptsicht,
// analog zur bereits bestehenden Duplikation zwischen der früheren MapView.vue und dieser View.
const auth = useAuthStore();
const router = useRouter();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const drawers = useDrawersStore();

const users = ref<User[]>([]);
const likes = ref<ExcursionLike[]>([]);
const comments = ref<ExcursionComment[]>([]);
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [usersRes, likesRes, commentsRes, accommodationRes, travelRes] = await Promise.all([
    api.get<User[]>('/users'),
    api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
    api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    excursionsStore.load(),
    spotsStore.load(),
  ]);
  users.value = usersRes;
  likes.value = likesRes;
  comments.value = commentsRes;
  accommodations.value = accommodationRes;
  travelItems.value = travelRes;
  loading.value = false;
});

function creatorLabel(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}

// --- Likes/Kommentare Ausflüge (weiterhin an ideas/idea_likes/idea_comments gebunden) ---
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
    avatar: users.value.find((u) => u.id === c.author_id)?.avatar ?? '❓',
    username: users.value.find((u) => u.id === c.author_id)?.username ?? '?',
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

const showExcursionForm = ref(false);
const emptyExcursionForm = () => ({ title: '', image_url: '', note: '', date: '', station_keys: [] as string[] });
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
    station_keys: excursionForm.value.station_keys,
  });
  closeExcursionForm();
}

function startEditExcursion(excursion: { id: number; title: string; image_url: string | null; note: string | null; date: string | null; station_keys: string[] }) {
  editingExcursion.value = excursion.id;
  editExcursionForm.value = {
    title: excursion.title,
    image_url: excursion.image_url ?? '',
    note: excursion.note ?? '',
    date: excursion.date ?? '',
    station_keys: [...excursion.station_keys],
  };
}

async function submitEditExcursion() {
  if (editingExcursion.value == null || !editExcursionForm.value.title.trim()) return;
  await excursionsStore.update(editingExcursion.value, {
    title: editExcursionForm.value.title.trim(),
    image_url: editExcursionForm.value.image_url || undefined,
    note: editExcursionForm.value.note || undefined,
    date: editExcursionForm.value.date || undefined,
    station_keys: editExcursionForm.value.station_keys,
  });
  editingExcursion.value = null;
}

async function removeExcursion(id: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === id);
  if (excursion?.date) {
    const confirmed = window.confirm(
      'Diese Tour ist bereits im Kalender eingeplant. Wirklich löschen? Die zugeordneten Spots bleiben erhalten und werden nicht mitgelöscht.',
    );
    if (!confirmed) return;
  }
  await excursionsStore.remove(id);
}

// Spot per Drag&Drop aus der Spots-Sicht auf eine Ausflug-Karte fallen lassen: als Station
// hinzufügen (ExcursionCard.vue ist die Drop-Zone, emittiert die abgelegte Spot-Id).
async function addSpotToExcursion(excursionId: number, spotId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  const key = `spot-${spotId}`;
  if (!excursion || excursion.station_keys.includes(key)) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    station_keys: [...excursion.station_keys, key],
  });
}

// --- Abgeleitete Orte (Unterkunft, Reise-Start-/Zielorte) ---
// Wählbar wie ein Spot im SpotOrderPicker, ohne dafür einen anzulegen (loc.key ist bereits der
// fertige Stations-Schlüssel, siehe utils/excursionStations.ts).
const derivedLocations = computed<DerivedLocation[]>(() => {
  const result: DerivedLocation[] = [];
  for (const a of accommodations.value) {
    if (a.lat != null && a.lng != null) {
      result.push({ key: `accommodation-${a.id}`, title: a.name, icon: '🛏️', category: 'Unterkunft', maps_link: a.maps_link, lat: a.lat, lng: a.lng });
    }
  }
  for (const t of travelItems.value) {
    if (t.from_lat != null && t.from_lng != null) {
      result.push({
        key: `travel-from-${t.id}`,
        title: `${t.title} (Abflug/Abfahrt)`,
        icon: '🛫',
        category: 'Reise',
        maps_link: t.from_maps_link,
        lat: t.from_lat,
        lng: t.from_lng,
      });
    }
    if (t.to_lat != null && t.to_lng != null) {
      result.push({
        key: `travel-to-${t.id}`,
        title: `${t.title} (Ankunft)`,
        icon: '🛬',
        category: 'Reise',
        maps_link: t.to_maps_link,
        lat: t.to_lat,
        lng: t.to_lng,
      });
    }
  }
  return result;
});

// Beim Ablegen auf einer Ausflug-Karte (Drag&Drop außerhalb des Dialogs): sofort speichern, gleiches
// Duplikat-Check-Muster wie addSpotToExcursion.
async function addDerivedLocationToExcursion(excursionId: number, loc: DerivedLocation) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion || excursion.station_keys.includes(loc.key)) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    station_keys: [...excursion.station_keys, loc.key],
  });
}

// Auswahl im Anlege-/Bearbeiten-Dialog (SpotOrderPicker): landet erstmal nur lokal im Formular, bis
// "Speichern" gedrückt wird.
function pickDerivedLocationForNewForm(loc: DerivedLocation) {
  excursionForm.value.station_keys.push(loc.key);
}
function pickDerivedLocationForEditForm(loc: DerivedLocation) {
  editExcursionForm.value.station_keys.push(loc.key);
}

// Drop-Zone, um die Kalender-Einplanung rückgängig zu machen: ein geplanter Ausflug kann aus dem
// "Geplant"-Bereich (oder direkt aus der Kalender-Schublade) hierher zurückgezogen werden.
// Zähler statt Boolean, da dragenter/dragleave beim Überqueren von Kind-Elementen mehrfach feuern.
const unplannedDragOverCount = ref(0);
const unplannedDragOver = computed(() => unplannedDragOverCount.value > 0);

function isExcursionDrag(event: DragEvent) {
  return !!event.dataTransfer?.types.includes('text/excursion-id');
}

function onUnplannedDragEnter(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  unplannedDragOverCount.value++;
}
function onUnplannedDragLeave(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  unplannedDragOverCount.value = Math.max(0, unplannedDragOverCount.value - 1);
}
function onUnplannedDrop(event: DragEvent) {
  unplannedDragOverCount.value = 0;
  const raw = event.dataTransfer?.getData('text/excursion-id');
  if (!raw) return;
  excursionsStore.setDate(Number(raw), null);
}

const plannedDragOverCount = ref(0);
const plannedDragOver = computed(() => plannedDragOverCount.value > 0);

function onPlannedDragEnter(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  plannedDragOverCount.value++;
}
function onPlannedDragLeave(event: DragEvent) {
  if (!isExcursionDrag(event)) return;
  plannedDragOverCount.value = Math.max(0, plannedDragOverCount.value - 1);
}
function onPlannedDrop() {
  plannedDragOverCount.value = 0;
}

// Bearbeiten einer Station (Spot) braucht das echte Formular, das nur die Karte-Hauptsicht besitzt
// (eigenständig gemountete Schublade, kein gemeinsamer Eltern-Scope) – Sprung statt Emit
// (Architekturregel: fremde Objekte nur lesend/verknüpfend, Bearbeitung in der Ursprungssicht).
function editStationSpot() {
  router.push('/excursions');
}
</script>

<template>
  <div class="excursions-drawer" v-if="!loading">
    <div class="header">
      <h2>🎒 Touren</h2>
      <button @click="showExcursionForm = true">+ Neue Tour</button>
    </div>

    <Modal :model-value="showExcursionForm" title="Neue Tour" @update:model-value="(v) => !v && closeExcursionForm()">
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
        <SpotOrderPicker
          v-if="spotsStore.spots.length || derivedLocations.length"
          v-model="excursionForm.station_keys"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
          :derived-locations="derivedLocations"
          @pick-derived-location="pickDerivedLocationForNewForm"
        />
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
      <h3>📝 In Planung</h3>
      <TransitionGroup v-if="unplannedExcursions.length" tag="div" name="list" class="entries">
        <ExcursionCard
          v-for="excursion in unplannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="spotsStore.spots"
          :accommodations="accommodations"
          :travel-items="travelItems"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
          @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
          @drop-derived-location="(loc) => addDerivedLocationToExcursion(excursion.id, loc as DerivedLocation)"
          @show-on-map="drawers.openMapForExcursion(excursion.id)"
          @edit-station-spot="editStationSpot"
        />
      </TransitionGroup>
      <p v-else class="empty dropzone-hint">
        Noch keine Touren in Planung – geplante Touren kannst du hierher ziehen, um die
        Einplanung rückgängig zu machen.
      </p>
    </section>

    <section
      class="group dropzone"
      :class="{ 'drag-over': plannedDragOver }"
      v-if="plannedExcursions.length"
      @dragover.prevent
      @dragenter.prevent="onPlannedDragEnter"
      @dragleave="onPlannedDragLeave"
      @drop.prevent="onPlannedDrop"
    >
      <h3>📅 Geplant</h3>
      <TransitionGroup tag="div" name="list" class="entries">
        <ExcursionCard
          v-for="excursion in plannedExcursions"
          :key="excursion.id"
          :excursion="excursion"
          :creator-label="creatorLabel(excursion.created_by)"
          :like-count="likesFor(excursion.id).length"
          :liked="likedByMe(excursion.id)"
          :comments="commentItemsFor(excursion.id)"
          :stations="spotsStore.spots"
          :accommodations="accommodations"
          :travel-items="travelItems"
          @edit="startEditExcursion"
          @remove="removeExcursion"
          @toggle-like="toggleLike(excursion.id)"
          @submit-comment="(content) => submitComment(excursion.id, content)"
          @remove-comment="removeComment"
          @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
          @drop-derived-location="(loc) => addDerivedLocationToExcursion(excursion.id, loc as DerivedLocation)"
          @show-on-map="drawers.openMapForExcursion(excursion.id)"
          @edit-station-spot="editStationSpot"
        />
      </TransitionGroup>
    </section>
    <p v-if="!excursionsStore.excursions.length" class="empty">Noch keine Touren angelegt.</p>

    <Modal
      :model-value="editingExcursion !== null"
      title="Tour bearbeiten"
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
        <SpotOrderPicker
          v-if="spotsStore.spots.length || derivedLocations.length"
          v-model="editExcursionForm.station_keys"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
          :derived-locations="derivedLocations"
          @pick-derived-location="pickDerivedLocationForEditForm"
        />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.excursions-drawer {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.excursions-drawer h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

/* Nur auf Desktop nötig: Drawer.vue schwebt dort den Maximieren-/Schließen-Button-Block
   (28px hoch, ab top:8px, endet also bei 36px) über den Panel-Inhalt – ohne diesen Abstand
   überlagerte er den rechts stehenden "+ Neue Tour"-Button in dieser Kopfzeile. Auf Mobil gibt es
   diese schwebenden Buttons nicht (siehe Drawer.vue), daher hier keine zusätzliche Distanz nötig. */
@media (min-width: 800px) {
  .header {
    margin-top: 32px;
  }
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

.group {
  margin-bottom: 0;
}

.group h3 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin: 0 0 var(--space-3);
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

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty {
  color: var(--color-text-muted);
}
</style>
