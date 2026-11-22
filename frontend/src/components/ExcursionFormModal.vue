<script setup lang="ts">
import { ref, toRef, useId, watch } from 'vue';
import type { Excursion, IdeaRole, LocationTrack, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
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
import DiaryEntryPicker from './DiaryEntryPicker.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { formatDateTime } from '../utils/dateFormat';
import { formatDurationShort } from '../utils/trackGeometry';
import { getTrackTitle } from '../utils/trackTitles';
import { TRAVEL_ROLE_OPTIONS, TRAVEL_ROLE_META } from '../utils/travelRole';
import { useSpotsStore } from '../stores/spots';
import { useTracksStore } from '../stores/tracks';
import { useTourForm } from '../composables/useTourForm';

const props = defineProps<{
  show: boolean;
  excursion?: Excursion | null;
  defaultRole?: IdeaRole | '';
  defaultTitle?: string;
  users: User[];
  excursionForGroupTitle?: (title: string) => Excursion | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:excursion', value: Excursion | null): void;
  (e: 'create-spot'): void;
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
  isEditTourDoneModified,
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
        openExcursionForm(props.defaultRole, props.defaultTitle);
      }
    }
  },
  { immediate: true }
);

const tourDoneToggleId = useId();

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
  return getTrackTitle(track);
}

function trackDurationLabel(track: LocationTrack): string | null {
  if (!track.started_at || !track.ended_at) {
    return null;
  }

  const ms = Math.max(0, new Date(track.ended_at).getTime() - new Date(track.started_at).getTime());
  return formatDurationShort(ms);
}

function addSpotIdToActiveForm(spotId: number) {
  activeExcursionForm.value.spot_ids = [...activeExcursionForm.value.spot_ids, spotId];
  showEditExcursionSpotsSection.value = true;
  showExcursionSpotsSection.value = true;
}

defineExpose({
  addSpotIdToActiveForm,
});
</script>

<template>
  <Modal
    :model-value="show || editingExcursion !== null"
    :title="editingExcursion !== null ? 'Tour bearbeiten' : 'Neue Tour'"
    full-height
    :confirm-close="isExcursionModalDirty"
    :confirm-close-mode="editingExcursion !== null ? 'unsaved' : 'draft'"
    confirm-close-entity="Tour"
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
        icon="tour"
        label="Rolle"
        :modified="isEditTourRoleModified"
        v-slot="{ id, modified }"
      >
        <Select :id="id" v-model="activeExcursionForm.role" :modified="modified">
          <option value="">🎒 Ausflug</option>
          <option v-for="roleOption in TRAVEL_ROLE_OPTIONS" :key="roleOption" :value="roleOption">
            {{ TRAVEL_ROLE_META[roleOption].icon }} {{ TRAVEL_ROLE_META[roleOption].label }} ({{
              TRAVEL_ROLE_META[roleOption].hint
            }})
          </option>
        </Select>
      </FormField>
      <p
        v-if="activeExcursionForm.role && activeExcursionForm.spot_ids.length < 2"
        class="hint info"
      >
        <AppIcon :icon="ACTION_ICONS.info" :size="14" group="actions" />
        Tipp: Ordne mindestens zwei Stationen zu, um Teilstrecken, Zeiten und die Route auf der
        Karte zu planen. Du kannst das auch später ergänzen.
      </p>
      <div class="tour-date-status-row">
        <FormField
          icon="date"
          label="Datum (sonst „In Planung“)"
          class="tour-date-field"
          :modified="isEditTourDateModified"
          v-slot="{ id, modified }"
        >
          <Input :id="id" v-model="activeExcursionForm.date" type="date" :modified="modified" />
        </FormField>
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
        <label
          :for="tourDoneToggleId"
          class="tour-done-field"
          :class="{ 'is-modified': isEditTourDoneModified }"
        >
          <span class="tour-done-label">
            <AppIcon :icon="ACTION_ICONS.done" :size="15" group="actions" />
            <span>Status</span>
            <span
              v-if="isEditTourDoneModified"
              class="modified-dot"
              title="Geändert"
              aria-label="Geändert"
            />
          </span>
          <span class="tour-done-control">
            <ToggleSwitch
              :id="tourDoneToggleId"
              :model-value="activeExcursionForm.done"
              :aria-label="
                activeExcursionForm.done
                  ? 'Tour nicht mehr als gemacht markieren'
                  : 'Tour als gemacht markieren'
              "
              :title="
                activeExcursionForm.done ? 'Als nicht gemacht markieren' : 'Als gemacht markieren'
              "
              @update:model-value="activeExcursionForm.done = $event"
            />
            <span class="tour-done-toggle-label">Gemacht</span>
          </span>
        </label>
      </div>
      <CollapsibleFieldset
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
          :spots="spotsStore.spots"
          :like-count="spotsStore.likeCountFor"
          :users="users"
          @create-spot="emit('create-spot')"
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
      <DiaryEntryPicker
        v-model="activeExcursionForm.diary_ids"
        :dates="activeExcursionForm.date ? [activeExcursionForm.date] : []"
        id-prefix="tour-diary"
      />
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

<style scoped lang="scss">
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.tour-date-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-lg);
}

.tour-date-field,
.tour-done-field {
  flex: 1 1 200px;
  min-width: 0;
}

.tour-done-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: var(--input-height, 46px);
  padding: var(--space-2) var(--space-3);
  background: var(--color-hover);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
}

.tour-done-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
}

.tour-done-field.is-modified {
  border-color: var(--color-success);
}

.tour-done-field.is-modified .tour-done-label {
  color: var(--color-success-dark, var(--color-success));
}

.modified-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-success-dark, var(--color-success));
  flex-shrink: 0;
}

.tour-done-control {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.tour-done-toggle-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.hint.info {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  margin: 0;
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
  border: 1px solid var(--color-border-divider);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

@include can-hover {
  .excursion-track-item:hover {
    background: var(--color-hover);
  }
}

.excursion-track-item.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.excursion-track-label {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.excursion-track-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  flex: 1;
  min-width: 0;
}

.excursion-track-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
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
  padding: 1px var(--space-1-5);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.privacy-pill--private {
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-divider);
  color: var(--color-text-muted);
}

.empty-subtext {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: block;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .excursion-track-item {
    transition: none;
  }
}
</style>
