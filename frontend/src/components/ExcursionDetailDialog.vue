<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { Accommodation, Excursion, Spot, TravelItem, User } from '../api/types';
import { renderRichText } from '../utils/richText';
import { resolveStations, type ExcursionStation } from '../utils/excursionStations';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import DetailModal from './DetailModal.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MiniStationCard from './MiniStationCard.vue';
import ExcursionMiniMap from './ExcursionMiniMap.vue';
import SpotDetailDialog from './SpotDetailDialog.vue';
import AccommodationDetailDialog from './AccommodationDetailDialog.vue';
import TravelDetailDialog from './TravelDetailDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  stations: Spot[];
  accommodations: Accommodation[];
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

const router = useRouter();
const auth = useAuthStore();
const spotsStore = useSpotsStore();
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

// Stationen in der definierten Ausflugsreihenfolge (station_keys), nicht in der Reihenfolge von
// props.stations (kommt vom Spots-Store und kann anders sortiert sein) – bestimmt sowohl die
// Timeline-/Mini-Karten-Reihenfolge als auch die auf der Mini-Karte gezeichnete Route. Eine
// Station ist nicht zwingend ein echter Spot (siehe utils/excursionStations.ts).
const orderedStations = computed(() =>
  resolveStations(props.excursion.station_keys, props.stations, props.accommodations, props.travelItems),
);
const mappedStations = computed(() => orderedStations.value.filter((s) => s.lat != null && s.lng != null));

// Fallback-Bild fürs Banner, falls der Ausflug selbst kein Bild hat – dieselbe Collage-Logik wie
// auf der Miniatur-Karte (ExcursionCard.vue), hier separat berechnet statt als Prop durchgereicht,
// da beide Komponenten dieselben Ausgangsdaten (excursion + stations) bereits selbst bekommen.
// Unterkunft-/Reise-Stationen liefern kein eigenes Bild (imageUrl null) und fallen automatisch raus.
const fallbackImages = computed(() =>
  orderedStations.value.map((s) => s.imageUrl).filter((url): url is string => !!url),
);

function formatDate(d: string) {
  return formatDateShared(d);
}

// Klick auf eine Stationen-Mini-Karte öffnet je nach Art den passenden verschachtelten Detail-
// Dialog (Spot/Unterkunft/Reise) – Like/Kommentar/"Auf Karte anzeigen" laufen dort direkt über die
// globalen Stores bzw. drawers.openMapAt(), nur das Bearbeiten eines Spots wird nach oben
// durchgereicht (ExcursionsView.vue besitzt das echte Formular). Für Unterkunft/Reise gibt es hier
// kein Formular, daher bei "Bearbeiten" ein echter Sprung zur jeweiligen Sicht (Architekturregel:
// fremde Objekte sind hier nur lesend/verknüpfend). "welche Station"/"ist der Dialog offen" jeweils
// bewusst getrennt (openStation*Id nie zurückgesetzt) – sonst würde Modal.vue's Fade-Out-Transition
// beim Schließen abgeschnitten, da das Objekt sonst per v-if sofort aus dem DOM verschwände.
const openStationSpotId = ref<number | null>(null);
const stationDialogOpen = ref(false);
const openStationSpot = computed(() => props.stations.find((s) => s.id === openStationSpotId.value) ?? null);

const openStationAccommodationId = ref<number | null>(null);
const stationAccommodationDialogOpen = ref(false);
const openStationAccommodation = computed(
  () => props.accommodations.find((a) => a.id === openStationAccommodationId.value) ?? null,
);

const openStationTravelId = ref<number | null>(null);
const stationTravelDialogOpen = ref(false);
const openStationTravel = computed(() => props.travelItems.find((t) => t.id === openStationTravelId.value) ?? null);

function openStationDetail(station: ExcursionStation) {
  if (station.kind === 'spot') {
    openStationSpotId.value = station.id;
    stationDialogOpen.value = true;
  } else if (station.kind === 'accommodation') {
    openStationAccommodationId.value = station.id;
    stationAccommodationDialogOpen.value = true;
  } else {
    openStationTravelId.value = station.id;
    stationTravelDialogOpen.value = true;
  }
}
// Hash-Sprung (#accommodation-<id>/#travel-<id>) statt bloß der Ziel-Route – gleicher Grund wie
// TripMap.vue's editOpenAccommodation()/editOpenTravel(): die Ziel-Ansicht hebt das referenzierte
// Element hervor und der Router scrollt automatisch dorthin (siehe hashHighlight.ts).
function editStationLocation(target: 'accommodation' | 'travel') {
  const id = target === 'accommodation' ? openStationAccommodationId.value : openStationTravelId.value;
  stationAccommodationDialogOpen.value = false;
  stationTravelDialogOpen.value = false;
  router.push(`/${target}#${target}-${id}`);
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
    </template>

    <div v-if="excursion.note" class="detail-row note richtext" v-html="renderRichText(excursion.note)"></div>

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
      :like-count="spotsStore.likeCountFor(openStationSpot.id)"
      :liked="spotsStore.likedByMe(openStationSpot.id, auth.user?.id)"
      :comments="commentItemsFor(openStationSpot.id)"
      @edit="stationDialogOpen = false; emit('edit-station-spot', openStationSpot)"
      @toggle-like="spotsStore.toggleLike(openStationSpot.id, auth.user!.id)"
      @submit-comment="(content) => spotsStore.submitComment(openStationSpot!.id, content)"
      @remove-comment="spotsStore.removeComment"
      @show-on-map="stationDialogOpen = false; drawers.openMapAt(`spot-${openStationSpot.id}`)"
    />

    <AccommodationDetailDialog
      v-if="openStationAccommodation"
      v-model="stationAccommodationDialogOpen"
      :accommodation="openStationAccommodation"
      :payer-label="creatorLabelFor(openStationAccommodation.paid_by_user_id)"
      @edit="editStationLocation('accommodation')"
      @show-on-map="stationAccommodationDialogOpen = false; drawers.openMapAt(`accommodation-${openStationAccommodation.id}`)"
    />

    <TravelDetailDialog
      v-if="openStationTravel"
      v-model="stationTravelDialogOpen"
      :item="openStationTravel"
      :payer-label="creatorLabelFor(openStationTravel.paid_by_user_id)"
      @edit="editStationLocation('travel')"
      @show-on-map-from="stationTravelDialogOpen = false; drawers.openMapAt(`travel-from-${openStationTravel.id}`)"
      @show-on-map-to="stationTravelDialogOpen = false; drawers.openMapAt(`travel-to-${openStationTravel.id}`)"
    />
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
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
