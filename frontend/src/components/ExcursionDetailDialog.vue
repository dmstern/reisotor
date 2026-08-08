<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Excursion, Spot, TravelItem, User } from '../api/types';
import { excursionStationKeys, resolveStations, type ExcursionStation } from '../utils/excursionStations';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import DetailModal from './DetailModal.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MiniStationCard from './MiniStationCard.vue';
import ExcursionMiniMap from './ExcursionMiniMap.vue';
import SpotDetailDialog from './SpotDetailDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  stations: Spot[];
  travelItems: TravelItem[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'show-on-map'): void;
  // Bearbeiten einer Station (Spot) braucht das echte Anlege-/Bearbeiten-Formular, das nur
  // ExcursionsView.vue besitzt – anders als Like/Kommentar/"Auf Karte anzeigen" (siehe unten),
  // die direkt über die globalen Stores laufen, muss dieser eine Fall über ExcursionCard.vue
  // nach oben durchgereicht werden. Unterkunft/Reise-Stationen haben dagegen kein eigenes
  // Formular in dieser Sicht (siehe editStationLocation unten) – dafür genügt ein echter Sprung.
  (e: 'edit-station-spot', spot: Spot): void;
}>();

const auth = useAuthStore();
const spotsStore = useSpotsStore();
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();

// Eigener kleiner users-Fetch statt Prop-Durchreichung durch ExcursionCard.vue: wird nur für die
// Autor-/Zahler-Anzeige einer Station gebraucht, falls man ihren Detail-Dialog öffnet (siehe
// unten) – ein zusätzlicher /users-Aufruf ist hier billiger als den gesamten Prop-Pfad umzubauen
// (gleiches Vorgehen wie in vielen anderen Views dieser App, die /users unabhängig voneinander
// laden).
const users = ref<User[]>([]);
onMounted(async () => {
  users.value = await api.get<User[]>('/users');
});
function creatorLabelFor(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}
function commentItemsFor(spotId: number) {
  return spotsStore.commentsFor(spotId).map((c) => ({
    id: c.id,
    avatar: users.value.find((u) => u.id === c.author_id)?.avatar ?? '❓',
    username: users.value.find((u) => u.id === c.author_id)?.username ?? '?',
    content: c.content,
    canRemove: c.author_id === auth.user?.id,
  }));
}

// Stationen in der definierten Tour-Reihenfolge (spot_ids), nicht in der Reihenfolge von
// props.stations (kommt vom Spots-Store und kann anders sortiert sein) – bestimmt sowohl die
// Timeline-/Mini-Karten-Reihenfolge als auch die auf der Mini-Karte gezeichnete Route. Eine
// Tour-Station ist immer ein echter Spot (siehe utils/excursionStations.ts).
const orderedStations = computed(() =>
  resolveStations(excursionStationKeys(props.excursion.spot_ids), props.stations, props.travelItems),
);
const mappedStations = computed(() => orderedStations.value.filter((s) => s.lat != null && s.lng != null));

// Fallback-Bild fürs Banner, falls der Ausflug selbst kein Bild hat – dieselbe Collage-Logik wie
// auf der Miniatur-Karte (ExcursionCard.vue), hier separat berechnet statt als Prop durchgereicht,
// da beide Komponenten dieselben Ausgangsdaten (excursion + stations) bereits selbst bekommen.
const fallbackImages = computed(() =>
  orderedStations.value.map((s) => s.imageUrl).filter((url): url is string => !!url),
);

function formatDate(d: string) {
  return formatDateShared(d);
}

// Klick auf eine Stationen-Mini-Karte öffnet den Spot-Detail-Dialog – Like/Kommentar/"Auf Karte
// anzeigen" laufen dort direkt über die globalen Stores bzw. drawers.openMapAt(), nur das
// Bearbeiten wird nach oben durchgereicht (ExcursionsView.vue besitzt das echte Formular).
// openStationSpotId wird beim Schließen bewusst NICHT zurückgesetzt – sonst würde Modal.vue's
// Fade-Out-Transition abgeschnitten, da das Objekt sonst per v-if sofort aus dem DOM verschwände.
const openStationSpotId = ref<number | null>(null);
const stationDialogOpen = ref(false);
const openStationSpot = computed(() => props.stations.find((s) => s.id === openStationSpotId.value) ?? null);

function openStationDetail(station: ExcursionStation) {
  openStationSpotId.value = station.id;
  stationDialogOpen.value = true;
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="excursion.title"
    :image-url="excursion.image_url"
    :collage-images="fallbackImages"
    placeholder-icon="🎒"
    @edit="emit('edit')"
  >
    <template #meta>
      <span v-if="creatorLabel">{{ creatorLabel }}</span>
      <span>{{ excursion.date ? `📅 ${formatDate(excursion.date)}` : '📝 In Planung' }}</span>
      <span v-if="excursion.done" class="done-meta">✅ Gemacht</span>
    </template>

    <button
      type="button"
      class="done-toggle"
      :class="{ active: !!excursion.done }"
      :aria-pressed="!!excursion.done"
      @click="excursionsStore.setDone(excursion.id, !excursion.done)"
    >
      {{ excursion.done ? '✅ Gemacht' : '⬜️ Als gemacht markieren' }}
    </button>

    <RichTextDisplay v-if="excursion.note" class="detail-row note" :content="excursion.note" :format="excursion.note_format" />

    <template v-if="orderedStations.length">
      <span class="detail-label">Stationen</span>
      <div class="station-timeline">
        <template v-for="(station, index) in orderedStations" :key="index">
          <button type="button" class="station-node" @click="openStationDetail(station)">
            <span class="station-order">{{ index + 1 }}</span>
            <MiniStationCard :station="station" />
          </button>
          <div v-if="index < orderedStations.length - 1" class="station-connector" aria-hidden="true"></div>
        </template>
      </div>
    </template>

    <template v-if="mappedStations.length">
      <span class="detail-label">Route</span>
      <ExcursionMiniMap :stations="mappedStations" />
      <div class="map-actions">
        <button type="button" class="card-action-btn" @click="emit('show-on-map')">🗺️ Auf Karte anzeigen</button>
      </div>
    </template>
    <p v-else class="hint">Noch keine Station mit Standort hinterlegt.</p>

    <div class="social-row">
      <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    </div>
    <Comments
      :comments="comments"
      @submit="(content) => emit('submit-comment', content)"
      @remove="(id) => emit('remove-comment', id)"
    />

    <SpotDetailDialog
      v-if="openStationSpot"
      v-model="stationDialogOpen"
      :spot="openStationSpot"
      :creator-label="creatorLabelFor(openStationSpot.created_by)"
      :payer-label="creatorLabelFor(openStationSpot.paid_by_user_id)"
      :like-count="spotsStore.likeCountFor(openStationSpot.id)"
      :liked="spotsStore.likedByMe(openStationSpot.id, auth.user?.id)"
      :comments="commentItemsFor(openStationSpot.id)"
      @edit="stationDialogOpen = false; emit('edit-station-spot', openStationSpot)"
      @toggle-like="spotsStore.toggleLike(openStationSpot.id, auth.user!.id)"
      @submit-comment="(content) => spotsStore.submitComment(openStationSpot!.id, content)"
      @remove-comment="spotsStore.removeComment"
      @show-on-map="stationDialogOpen = false; drawers.openMapAt(`spot-${openStationSpot.id}`)"
    />
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}

.done-meta {
  color: var(--color-success);
  font-weight: 600;
}

/* Gleicher Chip-Grundstil wie ExcursionCard.vue's .done-toggle für optische Konsistenz zwischen
   Miniatur-Karte und Detail-Ansicht. */
.done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  corner-shape: round;
  padding: 4px 12px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.done-toggle.active {
  color: var(--color-success);
  font-weight: 600;
}

.station-timeline {
  display: flex;
  align-items: center;
  overflow-x: auto;
  /* Oben/links großzügiger als unten/rechts: die Nummern-Badges (.station-order) ragen mit
     negativem Versatz über den Rand jeder Mini-Karte hinaus – ohne genug Platz hier würden sie am
     Container-Rand abgeschnitten (v. a. das erste Badge ganz links, da overflow-x:auto Padding
     als sichtbaren Rand am Scroll-Anfang behandelt). */
  padding: 12px 10px 8px 14px;
  margin-bottom: var(--space-1);
}

.station-node {
  position: relative;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.station-order {
  position: absolute;
  top: -6px;
  left: -6px;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Gestrichelte Verbindung zwischen den Stationen – visualisiert die Abklapper-Reihenfolge, statt
   die Mini-Karten einfach unverbunden nebeneinander zu zeigen. */
.station-connector {
  flex: 0 0 24px;
  height: 0;
  border-top: 3px dashed var(--color-primary);
  margin: 0 4px;
  align-self: center;
}

.map-actions {
  display: flex;
  margin: var(--space-2) 0 var(--space-1);
}

.hint {
  margin: 0 0 var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.social-row {
  margin-top: var(--space-2);
}
</style>
