<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { LocationTrack, TrackVisibility, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Button from './primitives/Button.vue';
import TabBar from './TabBar.vue';
import TourAssignDropdown from './TourAssignDropdown.vue';
import ItemVisibilitySettings from './ItemVisibilitySettings.vue';
import TrackShareWarningModal from './TrackShareWarningModal.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { toLocalDatetimeInputValue, fromLocalDatetimeInputValue } from '../utils/dateFormat';
import { useTracksStore } from '../stores/tracks';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useExcursionsStore } from '../stores/excursions';

const props = defineProps<{
  track: LocationTrack | null;
  users: User[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:track', track: LocationTrack | null): void;
}>();

const tracksStore = useTracksStore();
const trackRecording = useTrackRecordingStore();
const excursionsStore = useExcursionsStore();

const activeTrackEditTab = ref<'general' | 'permissions'>('general');
const trackEditTabs = computed(() => [
  { key: 'general', label: 'Allgemein', icon: ACTION_ICONS.edit },
  {
    key: 'permissions',
    label: 'Berechtigungen',
    icon: ACTION_ICONS.shared,
    unseen: isEditTrackVisibilityModified.value,
  },
]);

const editTrackTitle = ref('');
const editTrackStartedAt = ref('');
const editTrackVisibility = ref<TrackVisibility>('private');
const editTrackExcursionId = ref<number | null>(null);

const showTrackShareWarningModal = ref(false);
const shareWarningTrackTitle = ref('');
const shareWarningTourTitle = ref('');
const pendingTrackTourId = ref<number | null>(null);

watch(
  () => props.track,
  (trk) => {
    if (trk) {
      editTrackTitle.value = trk.title ?? '';
      editTrackStartedAt.value = toLocalDatetimeInputValue(trk.started_at);
      editTrackVisibility.value = trk.visibility;
      editTrackExcursionId.value = trk.excursion_id ?? null;
      activeTrackEditTab.value = 'general';
    }
  },
  { immediate: true }
);

const isEditTrackTitleModified = computed(() => {
  if (!props.track) return false;
  return editTrackTitle.value.trim() !== (props.track.title ?? '').trim();
});

const isEditTrackStartedAtModified = computed(() => {
  if (!props.track) return false;
  return editTrackStartedAt.value !== toLocalDatetimeInputValue(props.track.started_at);
});

const isEditTrackVisibilityModified = computed(() => {
  if (!props.track) return false;
  return editTrackVisibility.value !== props.track.visibility;
});

const isEditTrackTourModified = computed(() => {
  if (!props.track) return false;
  return editTrackExcursionId.value !== (props.track.excursion_id ?? null);
});

const trackTourAssignments = computed(() => {
  return excursionsStore.excursions.map((e) => ({
    id: e.id,
    title: e.title,
    assigned: editTrackExcursionId.value === e.id,
  }));
});

const editTrackExcursionTitle = computed(() => {
  if (editTrackExcursionId.value == null) return null;
  const exc = excursionsStore.excursions.find((e) => e.id === editTrackExcursionId.value);
  return exc?.title ?? null;
});

function handleClose() {
  emit('update:track', null);
  emit('close');
}

function onToggleTrackTour(tourId: number) {
  if (editTrackExcursionId.value === tourId) {
    editTrackExcursionId.value = null;
    return;
  }
  const tour = excursionsStore.excursions.find((e) => e.id === tourId);
  const isPrivate =
    editTrackVisibility.value === 'private' || props.track?.visibility === 'private';
  if (isPrivate && props.users.length > 1) {
    pendingTrackTourId.value = tourId;
    shareWarningTrackTitle.value =
      editTrackTitle.value.trim() || props.track?.title || 'Aufzeichnung';
    shareWarningTourTitle.value = tour?.title || 'Tour';
    showTrackShareWarningModal.value = true;
  } else {
    editTrackExcursionId.value = tourId;
  }
}

async function onCreateTourFromTrack(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const newExcursion = await excursionsStore.create({
    title: trimmed,
  });
  onToggleTrackTour(newExcursion.id);
}

function onConfirmShareModal() {
  if (pendingTrackTourId.value != null) {
    editTrackExcursionId.value = pendingTrackTourId.value;
    editTrackVisibility.value = 'shared';
    pendingTrackTourId.value = null;
  }
  showTrackShareWarningModal.value = false;
}

async function submitEditTrack() {
  if (!props.track) return;
  const rawTitle = editTrackTitle.value.trim();
  const title = rawTitle ? rawTitle : null;
  const startedAt = fromLocalDatetimeInputValue(editTrackStartedAt.value) ?? props.track.started_at;
  await tracksStore.update(props.track.id, {
    title,
    started_at: startedAt,
    visibility: editTrackVisibility.value,
    excursion_id: editTrackExcursionId.value,
  });
  handleClose();
}

async function stopEditingTrack() {
  if (!props.track) return;
  const id = props.track.id;
  if (trackRecording.recording && trackRecording.track?.id === id) {
    await trackRecording.stop();
  } else {
    await tracksStore.stopTrack(id);
  }
  const updated = tracksStore.tracks.find((t) => t.id === id);
  if (updated) {
    emit('update:track', updated);
  }
}

async function deleteEditingTrack() {
  if (!props.track) return;
  await tracksStore.remove(props.track.id);
  handleClose();
}
</script>

<template>
  <Modal
    :model-value="track !== null"
    title="Aufzeichnung bearbeiten"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form track-edit-form" @submit.prevent="submitEditTrack">
      <TabBar
        :tabs="trackEditTabs"
        :active-key="activeTrackEditTab"
        class="track-tab-bar"
        @select="(key) => (activeTrackEditTab = key as 'general' | 'permissions')"
      />

      <div v-show="activeTrackEditTab === 'general'" class="tab-content">
        <div
          v-if="track?.end_reason === 'aborted'"
          class="track-status-alert track-status-alert--aborted"
          role="status"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="16" group="actions" />
          <div class="track-status-alert__content">
            <span class="track-status-alert__title">Automatisch abgebrochen</span>
            <p class="track-status-alert__desc">
              Die Aufzeichnung wurde vom System beendet (z. B. durch Bildschirmsperre oder
              GPS-Abbruch).
            </p>
          </div>
        </div>
        <div
          v-else-if="track && !track.ended_at"
          class="track-status-alert track-status-alert--running"
          role="status"
        >
          <span class="recording-pulse-dot" aria-hidden="true"></span>
          <div class="track-status-alert__content">
            <span class="track-status-alert__title">Aufzeichnung läuft</span>
            <p class="track-status-alert__desc">Diese Aufzeichnung ist aktuell noch aktiv.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            :icon="ACTION_ICONS.recordStop"
            @click="stopEditingTrack"
          >
            Aufzeichnung beenden
          </Button>
        </div>

        <FormField
          icon="title"
          label="Name"
          :modified="isEditTrackTitleModified"
          v-slot="{ modified }"
        >
          <Input
            v-model="editTrackTitle"
            type="text"
            placeholder="z. B. Wanderung zur Berghütte"
            :maxlength="100"
            :modified="modified"
          />
        </FormField>
        <FormField
          icon="date"
          label="Aufzeichnungszeitpunkt"
          :modified="isEditTrackStartedAtModified"
          v-slot="{ modified }"
        >
          <Input v-model="editTrackStartedAt" type="datetime-local" required :modified="modified" />
        </FormField>
        <FormField icon="tour" label="Zugeordnete Tour" :modified="isEditTrackTourModified">
          <div class="track-tour-assign-field">
            <TourAssignDropdown
              :tours="trackTourAssignments"
              @toggle-tour="onToggleTrackTour"
              @create-tour="onCreateTourFromTrack"
            />
            <span v-if="editTrackExcursionTitle" class="track-tour-selected-badge">
              <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="13" group="navigation" />
              {{ editTrackExcursionTitle }}
              <button
                type="button"
                class="remove-tour-btn"
                title="Zuordnung entfernen"
                aria-label="Zuordnung entfernen"
                @click="editTrackExcursionId = null"
              >
                <AppIcon :icon="ACTION_ICONS.close" :size="12" group="actions" />
              </button>
            </span>
          </div>
        </FormField>
      </div>

      <div v-show="activeTrackEditTab === 'permissions'" class="tab-content permissions-tab">
        <ItemVisibilitySettings
          v-model="editTrackVisibility"
          item-label="Aufzeichnung"
          :modified="isEditTrackVisibilityModified"
        />
      </div>

      <div class="actions-row">
        <Button
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          @click="deleteEditingTrack"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  </Modal>

  <!-- Datenschutz-Hinweis bei Zuordnung einer privaten Aufzeichnung zur Tour -->
  <TrackShareWarningModal
    v-model="showTrackShareWarningModal"
    :track-title="shareWarningTrackTitle"
    :tour-title="shareWarningTourTitle"
    @confirm="onConfirmShareModal"
  />
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.track-tab-bar {
  margin-bottom: var(--space-2);
}

.track-edit-form .tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.track-status-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

.track-status-alert--aborted {
  background: var(--color-warning-tint);
  border: 1px solid var(--color-warning);
  color: var(--color-warning-dark);
}

.track-status-alert--running {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  color: var(--color-text);
  align-items: center;
}

.track-status-alert__content {
  flex: 1;
  min-width: 0;
}

.track-status-alert__title {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.track-status-alert__desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.recording-pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }
  100% {
    transform: scale(0.95);
    opacity: 1;
  }
}

.track-tour-assign-field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.track-tour-selected-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px var(--space-2);
  background: var(--color-primary-tint);
  color: var(--color-primary);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.remove-tour-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
}

.remove-tour-btn:hover {
  color: var(--color-text);
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.spacer {
  flex: 1;
}

@media (prefers-reduced-motion: reduce) {
  .recording-pulse-dot {
    animation: none;
  }
}
</style>
