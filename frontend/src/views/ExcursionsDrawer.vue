<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { ExcursionComment, ExcursionLike, TravelItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useTourSettingsStore } from '../stores/tourSettings';
import ExcursionCard from '../components/ExcursionCard.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import SpotOrderPicker from '../components/SpotOrderPicker.vue';
import SpotTogglePicker from '../components/SpotTogglePicker.vue';
import Modal from '../components/Modal.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import { isEmptyRichText } from '../utils/richText';
import { useDraftAutosave } from '../composables/useDraftAutosave';

// ExcursionsDrawer.vue ist (wie ScheduleView.vue) statisch in App.vue eingebunden, läuft also im
// Hauptbundle - RichTextEditor.vue zieht Tiptap nach sich (~400 kB), das soll nicht JEDEN Seitenaufruf
// treffen, sondern nur das tatsächliche Öffnen des Ausflug-Formulars. Restliche Views (Notizen,
// Tagebuch, Reise, ...) sind ohnehin schon per Route lazy geladen, dort reicht ein normaler Import.
const RichTextEditor = defineAsyncComponent(() => import('../components/RichTextEditor.vue'));

// Auf Desktop weiterhin eigenständig gemountete Schublade (App.vue, rechter Platz) statt Teil der
// Karte-Hauptsicht – dadurch lassen sich Kalender- und Ausflüge-Schublade unabhängig voneinander
// auf-/zuklappen, während Spots/Karte immer sichtbar bleiben (siehe ExcursionsView.vue). Lädt
// deshalb ihre eigenen Daten (Unterkunft/Reise/Nutzer/Ausflug-Likes+Kommentare) unabhängig von der
// Karte-Hauptsicht, analog zur bereits bestehenden Duplikation zwischen der früheren MapView.vue
// und dieser View. Auf Mobil dagegen dieselbe Komponente als eigenständige Seite (Route /tours,
// siehe router/index.ts) statt in einer kaum bedienbaren Schublade – standalone (per Route-Prop
// gesetzt) schaltet dafür den nur im Schubladen-Kontext nötigen Abstand zu den dort schwebenden
// Maximieren-/Schließen-Buttons ab (siehe .header unten).
defineProps<{ standalone?: boolean }>();
const auth = useAuthStore();
const router = useRouter();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const tourSettings = useTourSettingsStore();

const users = ref<User[]>([]);
const likes = ref<ExcursionLike[]>([]);
const comments = ref<ExcursionComment[]>([]);
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

onMounted(async () => {
  highlightedIds.value = liveSync.markSeen('ideas');
  try {
    const [usersRes, likesRes, commentsRes, travelRes] = await Promise.all([
      api.get<User[]>('/users'),
      api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
      api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
      api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
      excursionsStore.load(),
      spotsStore.load(),
    ]);
    users.value = usersRes;
    likes.value = likesRes;
    comments.value = commentsRes;
    travelItems.value = travelRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
});

// Wie ScheduleView.vue: diese Ansicht ist auf Desktop dauerhaft in der Schublade gemountet, daher
// zusätzlich beim Öffnen erneut als "gesehen" markieren (frische Hervorhebung für inzwischen
// hinzugekommene Touren).
watch(
  () => drawers.excursionsOpen,
  (open) => {
    if (open) highlightedIds.value = liveSync.markSeen('ideas');
  },
);

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
const emptyExcursionForm = () => ({ title: '', image_url: '', note: '', date: '', spot_ids: [] as number[] });
const excursionForm = ref(emptyExcursionForm());

const editingExcursion = ref<number | null>(null);
const editExcursionForm = ref(emptyExcursionForm());

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts).
const newExcursionDraft = useDraftAutosave('excursions:new', excursionForm, showExcursionForm);
const editExcursionDraft = useDraftAutosave(
  () => `excursions:edit:${editingExcursion.value}`,
  editExcursionForm,
  computed(() => editingExcursion.value !== null),
);

const unplannedExcursions = computed(() => excursionsStore.excursions.filter((e) => !e.date));
const plannedExcursions = computed(() =>
  [...excursionsStore.excursions].filter((e) => e.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
);

function closeExcursionForm() {
  showExcursionForm.value = false;
  excursionForm.value = emptyExcursionForm();
  newExcursionDraft.clear();
}

async function addExcursion() {
  if (!excursionForm.value.title.trim()) return;
  await excursionsStore.create({
    title: excursionForm.value.title.trim(),
    image_url: excursionForm.value.image_url || undefined,
    note: excursionForm.value.note && !isEmptyRichText(excursionForm.value.note) ? excursionForm.value.note : undefined,
    note_format: 'html',
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
    note:
      editExcursionForm.value.note && !isEmptyRichText(editExcursionForm.value.note) ? editExcursionForm.value.note : undefined,
    note_format: 'html',
    date: editExcursionForm.value.date || undefined,
    spot_ids: editExcursionForm.value.spot_ids,
  });
  editExcursionDraft.clear();
  editingExcursion.value = null;
}

function closeEditExcursionForm() {
  editExcursionDraft.clear();
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

// Spot per Drag&Drop aus der Spots-Sicht auf eine Ausflug-Karte fallen lassen (nur "Erweiterte
// Touren-Bearbeitung", siehe stores/tourSettings.ts/ExcursionCard.vue): als Station hinzufügen
// (ExcursionCard.vue ist die Drop-Zone, emittiert die abgelegte Spot-Id).
async function addSpotToExcursion(excursionId: number, spotId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    spot_ids: [...excursion.spot_ids, spotId],
  });
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
  <div class="excursions-drawer" :class="{ standalone }" v-if="!loading">
    <div class="header">
      <h2>🎒 Touren</h2>
      <button @click="showExcursionForm = true">+ Neue Tour</button>
    </div>

    <Modal :model-value="showExcursionForm" title="Neue Tour" full-height @update:model-value="(v) => !v && closeExcursionForm()">
      <form class="edit-form" @submit.prevent="addExcursion">
        <input v-model="excursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="excursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <RichTextEditor v-model="excursionForm.note" placeholder="Notiz (optional)" />
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="excursionForm.date" type="date" />
        </label>
        <SpotOrderPicker
          v-if="tourSettings.advancedEditing && spotsStore.spots.length"
          v-model="excursionForm.spot_ids"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
        />
        <SpotTogglePicker
          v-else-if="spotsStore.spots.length"
          v-model="excursionForm.spot_ids"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
        />
        <DraftStatusBar :status="newExcursionDraft.status.value" :restored="newExcursionDraft.restored.value" />
        <button type="submit">Hinzufügen</button>
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
        <template v-for="excursion in unplannedExcursions" :key="excursion.id">
          <UndoDeleteRow
            v-if="excursionsStore.isPending(excursion.id)"
            :label="excursion.title"
            @undo="excursionsStore.restore(excursion.id)"
          />
          <ExcursionCard
            v-else
            :excursion="excursion"
            :highlighted="highlightedIds.has(excursion.id)"
            :creator-label="creatorLabel(excursion.created_by)"
            :like-count="likesFor(excursion.id).length"
            :liked="likedByMe(excursion.id)"
            :comments="commentItemsFor(excursion.id)"
            :stations="spotsStore.spots"
            :travel-items="travelItems"
            @edit="startEditExcursion"
            @remove="removeExcursion"
            @toggle-like="toggleLike(excursion.id)"
            @submit-comment="(content) => submitComment(excursion.id, content)"
            @remove-comment="removeComment"
            @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
            @show-on-map="drawers.openMapForExcursion(excursion.id)"
            @edit-station-spot="editStationSpot"
          />
        </template>
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
        <template v-for="excursion in plannedExcursions" :key="excursion.id">
          <UndoDeleteRow
            v-if="excursionsStore.isPending(excursion.id)"
            :label="excursion.title"
            @undo="excursionsStore.restore(excursion.id)"
          />
          <ExcursionCard
            v-else
            :excursion="excursion"
            :highlighted="highlightedIds.has(excursion.id)"
            :creator-label="creatorLabel(excursion.created_by)"
            :like-count="likesFor(excursion.id).length"
            :liked="likedByMe(excursion.id)"
            :comments="commentItemsFor(excursion.id)"
            :stations="spotsStore.spots"
            :travel-items="travelItems"
            @edit="startEditExcursion"
            @remove="removeExcursion"
            @toggle-like="toggleLike(excursion.id)"
            @submit-comment="(content) => submitComment(excursion.id, content)"
            @remove-comment="removeComment"
            @drop-spot="(spotId) => addSpotToExcursion(excursion.id, spotId)"
            @show-on-map="drawers.openMapForExcursion(excursion.id)"
            @edit-station-spot="editStationSpot"
          />
        </template>
      </TransitionGroup>
    </section>
    <p v-if="!excursionsStore.excursions.length" class="empty">Noch keine Touren angelegt.</p>

    <Modal
      :model-value="editingExcursion !== null"
      title="Tour bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditExcursionForm()"
    >
      <form class="edit-form" @submit.prevent="submitEditExcursion">
        <input v-model="editExcursionForm.title" type="text" placeholder="Titel" required />
        <input v-model="editExcursionForm.image_url" type="url" placeholder="Bild-URL (optional)" />
        <RichTextEditor v-model="editExcursionForm.note" placeholder="Notiz (optional)" />
        <label class="date-label">
          Datum (optional – ansonsten "In Planung")
          <input v-model="editExcursionForm.date" type="date" />
        </label>
        <SpotOrderPicker
          v-if="tourSettings.advancedEditing && spotsStore.spots.length"
          v-model="editExcursionForm.spot_ids"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
        />
        <SpotTogglePicker
          v-else-if="spotsStore.spots.length"
          v-model="editExcursionForm.spot_ids"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
        />
        <DraftStatusBar :status="editExcursionDraft.status.value" :restored="editExcursionDraft.restored.value" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.excursions-drawer {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Als eigenständige Seite (Route /tours) reserviert kein schwebender Maximieren-/Schließen-Button-
   Block mehr Platz oben (siehe .header unten) – dafür braucht es hier wie bei jeder anderen Seite
   unten Platz für eine unten fixierte mobile NavBar (siehe .page-Pendant in style.css). */
.excursions-drawer.standalone {
  padding-bottom: var(--navbar-bottom-offset, 88px);
}

.excursions-drawer h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

/* Drawer.vue schwebt den Maximieren-/Schließen-Button-Block (28px hoch, ab top:8px, endet also bei
   36px) über den Panel-Inhalt – ohne diesen Abstand überlagerte er den rechts stehenden
   "+ Neue Tour"-Button in dieser Kopfzeile. Gilt nur im Schubladen-Kontext (Desktop, App.vue) –
   als eigenständige Seite (.standalone, Route /tours) gibt es diese schwebenden Buttons nicht. */
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: 32px;
}

.excursions-drawer.standalone .header {
  margin-top: 0;
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

</style>
