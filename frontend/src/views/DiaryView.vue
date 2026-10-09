<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { DiaryImage } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import { spotCategoryMeta } from '../utils/spotCategory';
import { formatDate } from '../utils/dateFormat';
import { weatherCodeMeta } from '../utils/weather';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

// Components
import RichTextEditor from '../components/RichTextEditor.vue';
import FormField from '../components/FormField.vue';
import RichTextDisplay from '../components/RichTextDisplay.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import SocialRow from '../components/SocialRow.vue';
import Comments from '../components/Comments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import DraftBadge from '../components/DraftBadge.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import AppIcon from '../components/AppIcon.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import Input from '../components/primitives/Input.vue';
import UploadProgressBar from '../components/UploadProgressBar.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal.vue';
import AttachmentThumbnails from '../components/AttachmentThumbnails.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import PolaroidStack from '../components/primitives/PolaroidStack.vue';

// Composables
import { useDiaryData } from '../composables/useDiaryData';
import { useDiarySocial } from '../composables/useDiarySocial';
import { useDiaryWeather } from '../composables/useDiaryWeather';
import { useDiaryEntityLinks } from '../composables/useDiaryEntityLinks';
import { useDiaryNewForm } from '../composables/useDiaryNewForm';
import { useDiaryEditForm } from '../composables/useDiaryEditForm';
import { useDiaryPreview } from '../composables/useDiaryPreview';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const drawers = useDrawersStore();

// 1. Data & Live Sync
const diaryData = useDiaryData({
  tripId,
  onSocialLoaded: (likes, comments) => {
    social.likes.value = likes;
    social.comments.value = comments;
  },
});
const {
  entries,
  loading,
  highlightedIds,
  author,
  coEditorsFor,
  removeEntry,
  removeImageFromEntry,
} = diaryData;

// 2. Social (Likes & Comments)
const social = useDiarySocial({
  users: diaryData.users,
});
const {
  likesFor,
  likedByMe,
  commentsFor,
  openComments,
  toggleLike,
  toggleComments,
  commentItemsFor,
  submitComment,
  removeComment,
  updateComment,
  toggleCommentLike,
} = social;

// 3. Weather
const weather = useDiaryWeather({
  trip,
  tripId,
});
const { weatherForEntry } = weather;

// 4. Entity Links & Map
const links = useDiaryEntityLinks();
const {
  pickerExcursions,
  pickerSpots,
  spotAlreadyPlanned,
  toggleSpot,
  hasMapContent,
  showEntryDayOnMap,
  excursionsForEntry,
  spotsForEntry,
} = links;

// 5. Image Preview Modal
const preview = useDiaryPreview();
const {
  diaryPreviewOpen,
  diaryPreviewImages,
  diaryPreviewIndex,
  diaryPreviewEditable,
  openDiaryPreview,
  handleDiaryPreviewRemove,
} = preview;

// 6. Edit Form State & Lifecycle
const editFormLogic = useDiaryEditForm({
  onEntryUpdated: (updated) => {
    const idx = entries.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) entries.value[idx] = updated;
    diaryData.sortEntries();
  },
  onEntryRemoved: (id) => removeEntry(id),
  onLinkDone: (excursionIds, spotIds, date) => {
    links.markLinkedAsDone(excursionIds, spotIds, date);
  },
});
const {
  editingEntry,
  editForm,
  editShowExcursionPicker,
  editShowSpotPicker,
  editorRef: editEditorRef,
  contentTouched: editContentTouched,
  dateTouched: editDateTouched,
  showDateError: showEditDateError,
  showContentError: showEditContentError,
  canSave: canSaveEditEntry,
  saveTooltip: editEntrySaveTooltip,
  isDeleteDisabled: isEditDeleteDisabled,
  deleteTooltip: editDeleteTooltip,
  editDraft,
  startEdit,
  submitEditEntry,
  closeEditForm,
  discardEditDraft,
  deleteEditingEntry,
} = editFormLogic;
const editUploading = editFormLogic.upload.uploading;
const editUploadError = editFormLogic.upload.uploadError;
const editFileInputRef = editFormLogic.upload.fileInputRef;
const editUploadCurrent = editFormLogic.upload.uploadCurrent;
const editUploadTotal = editFormLogic.upload.uploadTotal;
const editUploadFileName = editFormLogic.upload.uploadFileName;
const editUploadPercent = editFormLogic.upload.uploadPercent;
const abortEditUpload = editFormLogic.upload.abortUpload;
const onEditFilesSelected = (e: Event) => editFormLogic.upload.onFilesSelected(e, editForm.value);

// 7. New Form State & Lifecycle
const newFormLogic = useDiaryNewForm({
  tripId,
  myDraft: diaryData.myDraft,
  onStartEditDraft: (draft) => startEdit(draft),
  onEntryCreated: (created) => {
    entries.value.unshift(created);
    diaryData.sortEntries();
  },
  onLinkDone: (excursionIds, spotIds, date) => {
    links.markLinkedAsDone(excursionIds, spotIds, date);
  },
});
const {
  showForm,
  form,
  showExcursionPicker,
  showSpotPicker,
  editorRef: newEditorRef,
  contentTouched: newContentTouched,
  dateTouched: newDateTouched,
  showDateError: showNewDateError,
  showContentError: showNewContentError,
  canSubmit: canSubmitNewEntry,
  saveTooltip: newEntrySaveTooltip,
  newDraft,
  openNewForm,
  submitEntry,
  closeForm,
  discardNewDraft,
} = newFormLogic;
const uploading = newFormLogic.upload.uploading;
const uploadError = newFormLogic.upload.uploadError;
const newFileInputRef = newFormLogic.upload.fileInputRef;
const newUploadCurrent = newFormLogic.upload.uploadCurrent;
const newUploadTotal = newFormLogic.upload.uploadTotal;
const newUploadFileName = newFormLogic.upload.uploadFileName;
const newUploadPercent = newFormLogic.upload.uploadPercent;
const abortNewUpload = newFormLogic.upload.abortUpload;
const onNewFilesSelected = (e: Event) => newFormLogic.upload.onFilesSelected(e, form.value);

function removeImage(target: { images: DiaryImage[] }, index: number) {
  target.images.splice(index, 1);
}

onMounted(() => {
  weather.loadDiaryWeather();
});
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Tagebuch</h1>
      <Button @click="openNewForm"
        ><AppIcon :icon="ACTION_ICONS.write" :size="14" group="actions" /> Neuer Eintrag</Button
      >
    </div>

    <Modal
      :model-value="showForm"
      title="Neuer Tagebucheintrag"
      full-height
      @update:model-value="(v) => !v && closeForm()"
    >
      <form class="add-form" @submit.prevent="submitEntry">
        <FormField
          icon="date"
          label="Datum"
          required
          :invalid="showNewDateError"
          :error="showNewDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="form.date"
            type="date"
            required
            :invalid="invalid"
            @blur="newDateTouched = true"
          />
        </FormField>
        <FormField icon="title" label="Titel" v-slot="{ id }">
          <Input :id="id" v-model="form.title" type="text" placeholder="Titel" />
        </FormField>
        <FormField
          icon="note"
          label="Eintrag"
          required
          :invalid="showNewContentError"
          :error="showNewContentError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ invalid }"
        >
          <RichTextEditor
            ref="newEditorRef"
            class="diary-editor"
            v-model="form.content"
            placeholder="Was ist heute passiert?"
            :invalid="invalid"
            @blur="newContentTouched = true"
          />
        </FormField>
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <div v-else class="upload-control">
          <input
            ref="newFileInputRef"
            type="file"
            class="file-input-hidden"
            accept="image/*,.heic,.heif"
            multiple
            aria-label="Bilder auswählen"
            :disabled="uploading"
            @change="onNewFilesSelected"
          />
          <UploadProgressBar
            v-if="uploading"
            :current="newUploadCurrent"
            :total="newUploadTotal"
            :progress-percent="newUploadPercent"
            :filename="newUploadFileName"
            @cancel="abortNewUpload"
          />
          <Button
            v-else
            type="button"
            variant="secondary"
            size="sm"
            :icon="FORM_FIELD_ICONS.image"
            @click="newFileInputRef?.click()"
          >
            Bilder hinzufügen
          </Button>
        </div>
        <p v-if="uploadError" class="hint error">{{ uploadError }}</p>
        <AttachmentThumbnails
          v-if="form.images.length"
          :items="form.images"
          remove-title="Bild entfernen"
          remove-aria-label="Bild entfernen"
          @click="(idx) => openDiaryPreview(form.images, idx, true, (i) => removeImage(form, i))"
          @remove="(idx) => removeImage(form, idx)"
        />
        <CollapsibleFieldset
          v-if="excursionsStore.excursions.length"
          v-model="showExcursionPicker"
          label="Touren zuordnen"
          :count="
            form.excursion_ids.length ? `(${form.excursion_ids.length} ausgewählt)` : undefined
          "
          :icon="SECTION_ICON_DEFS.excursions"
          icon-group="navigation"
        >
          <label
            :for="`diary-excursion-${ex.id}`"
            v-for="ex in pickerExcursions(form.date)"
            :key="ex.id"
            class="excursion-option"
          >
            <Checkbox
              :id="`diary-excursion-${ex.id}`"
              :value="ex.id"
              v-model="form.excursion_ids"
            />
            <span class="excursion-option-title">{{ ex.title }}</span>
            <span v-if="ex.date === form.date" class="excursion-option-badge recommended">
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </label>
        </CollapsibleFieldset>

        <CollapsibleFieldset
          v-if="spotsStore.spots.length"
          v-model="showSpotPicker"
          label="Spots zuordnen"
          :count="form.spot_ids.length ? `(${form.spot_ids.length} ausgewählt)` : undefined"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <Button
            v-for="spot in pickerSpots(form.date)"
            :key="spot.id"
            type="button"
            class="excursion-option spot-option-btn"
            @click="toggleSpot(spot.id, form)"
          >
            <span class="excursion-option-title">
              <AppIcon
                :icon="spotCategoryMeta(spot.category).tabler"
                :size="14"
                group="categories"
              />
              {{ spot.title }}
            </span>
            <span v-if="form.spot_ids.includes(spot.id)" class="excursion-option-badge">
              <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
            </span>
            <span
              v-else-if="spotAlreadyPlanned(spot.id, form.date)"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </Button>
        </CollapsibleFieldset>
        <DraftStatusBar
          :status="newDraft.status.value"
          :restored="newDraft.restored.value"
          :can-discard="true"
          mode="create"
          @discard="discardNewDraft"
        />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeForm">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="!canSubmitNewEntry" :title="newEntrySaveTooltip">
            Eintragen
          </Button>
        </div>
      </form>
    </Modal>

    <TransitionGroup tag="div" name="list" class="entries">
      <Card
        tag="article"
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="entry animate-cascade"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
        :highlight="highlightedIds.has(entry.id)"
      >
        <header class="entry-head">
          <span class="avatar">{{
            entry.author_avatar ?? author(entry.author_id)?.avatar ?? '❓'
          }}</span>
          <div class="entry-meta">
            <strong>{{ entry.author_username ?? author(entry.author_id)?.username ?? '?' }}</strong>
            <span class="date">
              {{ formatDate(entry.date) }}
              <span v-if="coEditorsFor(entry).length" class="edited-by">
                · bearbeitet von
                <span v-for="(u, i) in coEditorsFor(entry)" :key="u.id" class="edited-by-user">
                  <span class="edited-by-avatar">{{ u.avatar }}</span
                  >{{ u.username }}<template v-if="i < coEditorsFor(entry).length - 1">, </template>
                </span>
              </span>
              <span v-else-if="entry.updated_at"> (bearbeitet)</span>
            </span>
          </div>
          <PendingSyncBadge v-if="entry._pending" />
          <div class="entry-actions">
            <EditButton small @click="startEdit(entry)" />
          </div>
        </header>

        <h3 v-if="entry.title">{{ entry.title }}</h3>
        <DraftBadge v-if="entry.is_draft" />
        <RichTextDisplay class="content" :content="entry.content" :format="entry.content_format" />

        <div class="diary-polaroid-wrap" v-if="entry.images.length">
          <PolaroidStack
            :items="entry.images"
            clipped
            @click="
              (idx) =>
                openDiaryPreview(entry.images, idx, !auth.user?.restricted, (i) =>
                  removeImageFromEntry(entry, i)
                )
            "
          />
        </div>

        <div class="card-actions-wrapper">
          <div class="excursion-links">
            <div
              v-if="weatherForEntry(entry)"
              class="diary-weather"
              :title="weatherCodeMeta(weatherForEntry(entry)!.weatherCode).label"
            >
              <WeatherIcon
                class="weather-icon"
                :size="16"
                :code="weatherForEntry(entry)!.weatherCode"
              />
              <span class="weather-temp"
                >{{ Math.round(weatherForEntry(entry)!.tempMax) }}° /
                {{ Math.round(weatherForEntry(entry)!.tempMin) }}°</span
              >
            </div>
            <Button
              type="button"
              variant="card-action"
              v-if="hasMapContent(entry)"
              @click="showEntryDayOnMap(entry)"
            >
              <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
              anzeigen
            </Button>
            <Button
              v-for="ex in excursionsForEntry(entry)"
              :key="ex.id"
              type="button"
              variant="ghost"
              class="excursion-chip"
              @click="drawers.openMapForExcursion(ex.id)"
            >
              <span
                class="excursion-chip-img"
                :style="ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : {}"
              >
                <AppIcon
                  v-if="!ex.image_url"
                  :icon="SECTION_ICON_DEFS.excursions"
                  :size="16"
                  group="navigation"
                />
              </span>
              <span class="excursion-chip-title">{{ ex.title }}</span>
            </Button>
            <Button
              v-for="spot in spotsForEntry(entry)"
              :key="spot.id"
              type="button"
              variant="ghost"
              class="excursion-chip"
              @click="drawers.openMapAt(`spot-${spot.id}`)"
            >
              <span
                class="excursion-chip-img"
                :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}"
              >
                <AppIcon
                  v-if="!spot.image_url"
                  :icon="spotCategoryMeta(spot.category).tabler"
                  :size="16"
                  group="categories"
                />
              </span>
              <span class="excursion-chip-title">{{ spot.title }}</span>
            </Button>
          </div>

          <SocialRow
            :like-count="likesFor(entry.id).length"
            :liked="likedByMe(entry.id)"
            :comment-count="commentsFor(entry.id).length"
            :comments-open="openComments.has(entry.id)"
            @toggle-like="toggleLike(entry.id)"
            @toggle-comments="toggleComments(entry.id)"
          />
        </div>

        <Accordion :expanded="openComments.has(entry.id)">
          <Comments
            :comments="commentItemsFor(entry.id)"
            @submit="(content) => submitComment(entry.id, content)"
            @remove="removeComment"
            @update="updateComment"
            @toggle-like="toggleCommentLike"
          />
        </Accordion>
      </Card>
    </TransitionGroup>
    <EmptyState v-if="!entries.length">Noch keine Tagebuch-Einträge.</EmptyState>

    <Modal
      :model-value="editingEntry !== null"
      :title="editingEntry?.is_draft ? 'Eintrag anlegen' : 'Eintrag bearbeiten'"
      full-height
      :confirm-close="!editingEntry?.is_draft && editDraft.isDirty.value"
      confirm-close-entity="Eintrag"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="add-form" @submit.prevent="submitEditEntry">
        <FormField
          icon="date"
          label="Datum"
          required
          :invalid="showEditDateError"
          :error="showEditDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="editForm.date"
            type="date"
            required
            :invalid="invalid"
            @blur="editDateTouched = true"
          />
        </FormField>
        <FormField icon="title" label="Titel" v-slot="{ id }">
          <Input :id="id" v-model="editForm.title" type="text" placeholder="Titel" />
        </FormField>
        <FormField
          icon="note"
          label="Eintrag"
          required
          :invalid="showEditContentError"
          :error="showEditContentError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ invalid }"
        >
          <RichTextEditor
            ref="editEditorRef"
            class="diary-editor"
            v-model="editForm.content"
            :invalid="invalid"
            @blur="editContentTouched = true"
          />
        </FormField>
        <p v-if="auth.user?.restricted" class="hint">
          Eingeschränkter Modus - Kein Datei-Upload möglich
        </p>
        <div v-else class="upload-control">
          <input
            ref="editFileInputRef"
            type="file"
            class="file-input-hidden"
            accept="image/*,.heic,.heif"
            multiple
            aria-label="Bilder auswählen"
            :disabled="editUploading"
            @change="onEditFilesSelected"
          />
          <UploadProgressBar
            v-if="editUploading"
            :current="editUploadCurrent"
            :total="editUploadTotal"
            :progress-percent="editUploadPercent"
            :filename="editUploadFileName"
            @cancel="abortEditUpload"
          />
          <Button
            v-else
            type="button"
            variant="secondary"
            size="sm"
            :icon="FORM_FIELD_ICONS.image"
            @click="editFileInputRef?.click()"
          >
            Bilder hinzufügen
          </Button>
        </div>
        <p v-if="editUploadError" class="hint error">{{ editUploadError }}</p>
        <AttachmentThumbnails
          v-if="editForm.images.length"
          :items="editForm.images"
          remove-title="Bild entfernen"
          remove-aria-label="Bild entfernen"
          @click="
            (idx) => openDiaryPreview(editForm.images, idx, true, (i) => removeImage(editForm, i))
          "
          @remove="(idx) => removeImage(editForm, idx)"
        />
        <CollapsibleFieldset
          v-if="excursionsStore.excursions.length"
          v-model="editShowExcursionPicker"
          label="Touren zuordnen"
          :count="
            editForm.excursion_ids.length
              ? `(${editForm.excursion_ids.length} ausgewählt)`
              : undefined
          "
          :icon="SECTION_ICON_DEFS.excursions"
          icon-group="navigation"
        >
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label
            v-for="ex in pickerExcursions(editForm.date)"
            :key="ex.id"
            class="excursion-option"
          >
            <Checkbox :value="ex.id" v-model="editForm.excursion_ids" />
            <span class="excursion-option-title">{{ ex.title }}</span>
            <span v-if="ex.date === editForm.date" class="excursion-option-badge recommended">
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </label>
        </CollapsibleFieldset>

        <CollapsibleFieldset
          v-if="spotsStore.spots.length"
          v-model="editShowSpotPicker"
          label="Spots zuordnen"
          :count="editForm.spot_ids.length ? `(${editForm.spot_ids.length} ausgewählt)` : undefined"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <Button
            v-for="spot in pickerSpots(editForm.date)"
            :key="spot.id"
            type="button"
            class="excursion-option spot-option-btn"
            @click="toggleSpot(spot.id, editForm)"
          >
            <span class="excursion-option-title">
              <AppIcon
                :icon="spotCategoryMeta(spot.category).tabler"
                :size="14"
                group="categories"
              />
              {{ spot.title }}
            </span>
            <span v-if="editForm.spot_ids.includes(spot.id)" class="excursion-option-badge">
              <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
            </span>
            <span
              v-else-if="spotAlreadyPlanned(spot.id, editForm.date)"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
              diesem Tag geplant
            </span>
          </Button>
        </CollapsibleFieldset>
        <DraftStatusBar
          :status="editDraft.status.value"
          :restored="editDraft.restored.value"
          :can-discard="true"
          :mode="editingEntry?.is_draft ? 'create' : 'edit'"
          @discard="discardEditDraft"
        />
        <div class="actions-row">
          <Button
            v-if="editingEntry?.author_id === auth.user?.id"
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            :disabled="isEditDeleteDisabled"
            :title="editDeleteTooltip"
            @click="deleteEditingEntry"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeEditForm">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="!canSaveEditEntry" :title="editEntrySaveTooltip">{{
            editingEntry?.is_draft ? 'Veröffentlichen' : 'Speichern'
          }}</Button>
        </div>
      </form>
    </Modal>
    <AttachmentPreviewModal
      v-model="diaryPreviewOpen"
      :attachments="diaryPreviewImages"
      :initial-index="diaryPreviewIndex"
      :editable="diaryPreviewEditable"
      @remove="handleDiaryPreviewRemove"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.file-input-hidden {
  display: none;
}

.excursion-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 400;
}

.excursion-option-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

/* Spot-Picker nutzt Buttons statt Checkbox-Labels (Klick schaltet die Zuordnung um, siehe
   toggleSpot) – Button-Grundstil zurücksetzen, damit er optisch zu den Checkbox-Zeilen der
   Ausflüge darüber passt. box-shadow explizit entfernen (#216) - der globale button-Grundstil
   (style.css) hängt sonst jedem Listeneintrag den Standard-Button-Schatten an, den Touren-Zeilen
   (echte <label>s, keine <Button>s) nicht haben. */
.spot-option-btn {
  background: none;
  border: none;
  box-shadow: none;
  padding: 2px 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
}

.spot-option-btn:active {
  box-shadow: none;
}

.excursion-option-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-success);
  white-space: nowrap;
}

/* Hebt die für den Tag des Eintrags tatsächlich geplanten Vorschläge zusätzlich optisch hervor
   (eigener Hintergrund-Chip statt nur eingefärbtem Text wie beim generischen Badge oben) - unter
   ggf. weiteren wählbaren Einträgen sollen sie sofort als die wahrscheinlich gemeinten erkennbar
   sein (siehe auch pickerExcursions/pickerSpots, die sie zusätzlich an den Listenanfang sortieren). */
.excursion-option-badge.recommended {
  background: var(--color-primary-tint);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

/* Aktionsleiste am unteren Rand der Kachel (Ausflugslinks links, Social-Actions rechts) */
.card-actions-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.excursion-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.excursion-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-hover);
  border: none;
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 4px 12px 4px 4px;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
}

.excursion-chip:hover {
  background: var(--color-primary-tint);
}

.excursion-chip-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
}

/* Gleiche Pillen-Dichte wie .excursion-chip daneben, aber kompakter (nur Icon + Temp, ohne
   Regenwahrscheinlichkeit) - reine Zusatzinfo, kein anklickbares Element. */
.diary-weather {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 4px 12px;
  font-size: 0.82rem;
  color: var(--color-text);
}

.diary-weather .weather-icon {
  font-size: 1rem;
}

.hint {
  margin: -4px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.hint.error {
  color: var(--color-danger);
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 800px;
  margin: 0 auto;
}

.entry-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.avatar {
  font-size: 1.6rem;
}

.entry-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.date {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.edited-by-avatar {
  font-size: 0.9em;
}

.entry-actions {
  display: flex;
  gap: 4px;
}

.entry h3 {
  margin: 0 0 var(--space-1);
  font-family: var(--font-diary);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.content {
  margin: 0 0 var(--space-2);
  font-family: var(--font-diary);
  font-size-adjust: from-font;
  font-size: 1.05rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  max-width: 75ch;
}

.diary-editor :deep(.richtext-content) {
  font-family: var(--font-diary);
  font-size-adjust: from-font;
  font-size: 1.05rem;
  line-height: 1.5;
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

.diary-polaroid-wrap {
  margin: var(--space-2) 0;
  padding: 4px 0 6px 4px;
}
</style>
