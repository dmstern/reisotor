<script setup lang="ts">
import { ref, toRef, watch } from 'vue';
import type { Excursion, LocationTrack, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import SpotOrderPicker from './SpotOrderPicker.vue';
import Checkbox from './primitives/Checkbox.vue';
import FileAttachments from './FileAttachments.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import RichTextEditor from './RichTextEditor.vue';
import TrackShareWarningModal from './TrackShareWarningModal.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { formatDateTime } from '../utils/dateFormat';
import { TRAVEL_ROLE_OPTIONS, TRAVEL_ROLE_META } from '../utils/travelRole';
import { useSpotsStore } from '../stores/spots';
import { useTracksStore } from '../stores/tracks';
import { useTourForm } from '../composables/useTourForm';

const props = defineProps<{
  show: boolean;
  excursion?: Excursion | null;
  users: User[];
  excursionForGroupTitle?: (title: string) => Excursion | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:excursion', value: Excursion | null): void;
}>();

const spotsStore = useSpotsStore();
const tracksStore = useTracksStore();
const usersRef = toRef(props, 'users');

const tracksToShareOnSave = ref(new Set<number>());
const showTrackShareWarningModal = ref(false);
const shareWarningTrackTitle = ref('');
const shareWarningTourTitle = ref('');
const pendingShareTrack = ref<LocationTrack | null>(null);

const tourFormComposable = useTourForm({
  users: usersRef,
  tracksToShareOnSave,
  onTrackPrivateWarning: (trk, title) => {
    pendingShareTrack.value = trk;
    shareWarningTrackTitle.value = trk.title || 'Aufzeichnung';
    shareWarningTourTitle.value = title;
    showTrackShareWarningModal.value = true;
  },
  excursionForGroupTitle: props.excursionForGroupTitle,
});

const {
  showExcursionForm,
  showExcursionTracksSection,
  showEditExcursionTracksSection,
  showExcursionSpotsSection,
  showEditExcursionSpotsSection,
  editingExcursion,
  isExcursionUploadingAttachments,
  activeExcursionForm,
  excursionTitleTouched,
  showExcursionTitleError,
  canSaveExcursion,
  excursionSaveTooltip,
  newExcursionDraft,
  editExcursionDraft,
  isEditTourTitleModified,
  isEditTourDateModified,
  isEditTourNoteModified,
  isEditTourRoleModified,
  isExcursionModalDirty,
  selectableTracksForTour,
  onToggleTourTrack,
  openExcursionForm,
  closeExcursionForm,
  discardNewExcursionDraft,
  addExcursion,
  startEditExcursion,
  submitEditExcursion,
  closeEditExcursionForm,
  discardEditExcursionDraft,
  deleteEditingExcursion,
} = tourFormComposable;

watch(
  () => [props.show, props.excursion],
  ([show, exc]) => {
    if (show) {
      if (exc) {
        startEditExcursion(exc as Excursion);
      } else {
        openExcursionForm();
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  if (editingExcursion.value !== null) {
    closeEditExcursionForm();
  } else {
    closeExcursionForm();
  }
  emit('update:show', false);
  emit('update:excursion', null);
}

async function handleAddExcursion() {
  await addExcursion();
  if (!showExcursionForm.value) {
    emit('update:show', false);
    emit('update:excursion', null);
  }
}

async function handleSubmitEditExcursion() {
  await submitEditExcursion();
  if (editingExcursion.value === null) {
    emit('update:show', false);
    emit('update:excursion', null);
  }
}

async function handleDeleteExcursion() {
  await deleteEditingExcursion();
  if (editingExcursion.value === null) {
    emit('update:show', false);
    emit('update:excursion', null);
  }
}

function onConfirmShareModal() {
  if (pendingShareTrack.value) {
    if (!activeExcursionForm.value.track_ids.includes(pendingShareTrack.value.id)) {
      activeExcursionForm.value.track_ids.push(pendingShareTrack.value.id);
      tracksToShareOnSave.value.add(pendingShareTrack.value.id);
    }
    pendingShareTrack.value = null;
  }
  showTrackShareWarningModal.value = false;
}

function trackTitle(track: LocationTrack): string {
  if (track.title && track.title.trim()) return track.title;
  return `Aufzeichnung vom ${formatDateTime(track.started_at)}`;
}

function trackDurationLabel(track: LocationTrack): string | null {
  if (!track.started_at || !track.ended_at) return null;
  const startMs = new Date(track.started_at).getTime();
  const endMs = new Date(track.ended_at).getTime();
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (diffSec < 60) return `${diffSec}\u00A0s`;
  const mins = Math.floor(diffSec / 60);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours > 0) return `${hours}\u00A0h ${remMins}\u00A0min`;
  return `${mins}\u00A0min`;
}
</script>

<template>
  <Modal
    :model-value="show || editingExcursion !== null"
    :title="editingExcursion !== null ? 'Tour bearbeiten' : 'Neue Tour'"
    full-height
    :confirm-close="isExcursionModalDirty"
    :confirm-close-title="
      editingExcursion !== null ? 'Ungespeicherte Änderungen verwerfen?' : 'Entwurf verwerfen?'
    "
    :confirm-close-message="
      editingExcursion !== null
        ? 'Du hast ungespeicherte Änderungen an dieser Tour vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?'
        : 'Du hast bereits Eingaben für diese Tour gemacht. Möchtest du den Entwurf verwerfen?'
    "
    :confirm-close-confirm-label="
      editingExcursion !== null ? 'Änderungen verwerfen' : 'Entwurf verwerfen'
    "
    @update:model-value="(v) => !v && handleClose()"
  >
    <form
      class="edit-form"
      @submit.prevent="
        editingExcursion !== null ? handleSubmitEditExcursion() : handleAddExcursion()
      "
    >
      <FormField
        icon="title"
        label="Titel"
        required
        :invalid="showExcursionTitleError"
        :modified="isEditTourTitleModified"
        :error="showExcursionTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
        v-slot="{ id, invalid, modified }"
      >
        <Input
          :id="id"
          v-model="activeExcursionForm.title"
          type="text"
          placeholder="Titel"
          required
          :invalid="invalid"
          :modified="modified"
          @blur="excursionTitleTouched = true"
        />
      </FormField>
      <FormField icon="note" label="Notiz" :modified="isEditTourNoteModified">
        <RichTextEditor v-model="activeExcursionForm.note" placeholder="Notiz" compact expandable />
      </FormField>
      <FormField
        icon="date"
        label="Datum (sonst „In Planung“)"
        :modified="isEditTourDateModified"
        v-slot="{ modified }"
      >
        <Input v-model="activeExcursionForm.date" type="date" :modified="modified" />
      </FormField>
      <FormField icon="tour" label="Rolle" :modified="isEditTourRoleModified" v-slot="{ modified }">
        <Select v-model="activeExcursionForm.role" :modified="modified">
          <option value="">🎒 Ausflug</option>
          <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
            {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{
              TRAVEL_ROLE_META[r].hint
            }})
          </option>
        </Select>
      </FormField>
      <p
        v-if="activeExcursionForm.role && activeExcursionForm.spot_ids.length < 2"
        class="hint error"
      >
        <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Für
        Anreise/Abreise/Weiterreise werden mindestens Start- und Zielstation benötigt.
      </p>
      <CollapsibleFieldset
        v-if="spotsStore.spots.length"
        :model-value="
          editingExcursion !== null ? showEditExcursionSpotsSection : showExcursionSpotsSection
        "
        label="Stationen & Route"
        :count="
          activeExcursionForm.spot_ids.length
            ? `(${activeExcursionForm.spot_ids.length} zugeordnet)`
            : undefined
        "
        :icon="FORM_FIELD_ICONS.location"
        icon-group="formFields"
        @update:model-value="
          (val) => {
            if (editingExcursion !== null) {
              showEditExcursionSpotsSection = val;
            } else {
              showExcursionSpotsSection = val;
            }
          }
        "
      >
        <SpotOrderPicker
          v-model="activeExcursionForm.spot_ids"
          v-model:legs="activeExcursionForm.legs"
          v-model:destination="activeExcursionForm.destination_spot_id"
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
          :users="users"
        />
      </CollapsibleFieldset>
      <CollapsibleFieldset
        v-if="tracksStore.tracks.length"
        :model-value="
          editingExcursion !== null ? showEditExcursionTracksSection : showExcursionTracksSection
        "
        label="Aufzeichnungen"
        :count="
          activeExcursionForm.track_ids.length
            ? `(${activeExcursionForm.track_ids.length} zugeordnet)`
            : undefined
        "
        :icon="ACTION_ICONS.recordStart"
        icon-group="actions"
        @update:model-value="
          (val) => {
            if (editingExcursion !== null) {
              showEditExcursionTracksSection = val;
            } else {
              showExcursionTracksSection = val;
            }
          }
        "
      >
        <div class="excursion-tracks-picker">
          <p v-if="!selectableTracksForTour.length" class="empty-subtext">
            Keine verfügbaren Aufzeichnungen für diesen Urlaub vorhanden.
          </p>
          <ul v-else class="excursion-tracks-list">
            <li
              v-for="trk in selectableTracksForTour"
              :key="trk.id"
              class="excursion-track-item"
              :class="{ 'is-selected': activeExcursionForm.track_ids.includes(trk.id) }"
            >
              <label class="excursion-track-label" :for="`tour-track-${trk.id}`">
                <Checkbox
                  :id="`tour-track-${trk.id}`"
                  :checked="activeExcursionForm.track_ids.includes(trk.id)"
                  @change="onToggleTourTrack(trk)"
                />
                <div class="excursion-track-info">
                  <span class="excursion-track-name">{{ trackTitle(trk) }}</span>
                  <span class="excursion-track-meta">
                    <span>{{ formatDateTime(trk.started_at) }}</span>
                    <template v-if="trackDurationLabel(trk)">
                      · <span>{{ trackDurationLabel(trk) }}</span>
                    </template>
                    <span
                      v-if="trk.visibility === 'private'"
                      class="privacy-pill privacy-pill--private"
                      title="Aktuell nur für dich sichtbar"
                    >
                      <AppIcon :icon="ACTION_ICONS.private" :size="11" group="actions" />
                      Privat
                    </span>
                  </span>
                </div>
              </label>
            </li>
          </ul>
        </div>
      </CollapsibleFieldset>
      <FileAttachments
        v-if="editingExcursion"
        domain="ideas"
        :entity-id="editingExcursion"
        v-model:uploading="isExcursionUploadingAttachments"
      />
      <DraftStatusBar
        :status="
          editingExcursion !== null
            ? editExcursionDraft.status.value
            : newExcursionDraft.status.value
        "
        :restored="
          editingExcursion !== null
            ? editExcursionDraft.restored.value
            : newExcursionDraft.restored.value
        "
        :mode="editingExcursion !== null ? 'edit' : 'create'"
        :can-discard="true"
        @discard="
          editingExcursion !== null ? discardEditExcursionDraft() : discardNewExcursionDraft()
        "
      />
      <div class="actions-row">
        <Button
          v-if="editingExcursion !== null"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :disabled="isExcursionUploadingAttachments"
          @click="handleDeleteExcursion"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="!canSaveExcursion" :title="excursionSaveTooltip">
          {{ editingExcursion !== null ? 'Speichern' : 'Hinzufügen' }}
        </Button>
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

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.spacer {
  flex: 1;
}

.hint.error {
  color: var(--color-danger);
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-1);
}

.excursion-tracks-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.excursion-tracks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.excursion-track-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.excursion-track-item:hover {
  background: var(--color-hover);
}

.excursion-track-item.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.excursion-track-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  width: 100%;
}

.excursion-track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.excursion-track-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.excursion-track-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.privacy-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.privacy-pill--private {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.empty-subtext {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .excursion-track-item {
    transition: none;
  }
}
</style>
