<script setup lang="ts">
import { watch } from 'vue';
import type { DiaryEntry, DiaryImage } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useDiaryEditForm } from '../composables/useDiaryEditForm';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Button from './primitives/Button.vue';
import RichTextEditor from './RichTextEditor.vue';
import UploadProgressBar from './UploadProgressBar.vue';
import AttachmentThumbnails from './AttachmentThumbnails.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import DiaryEntityPicker from './DiaryEntityPicker.vue';

const props = defineProps<{
  entry: DiaryEntry | null;
}>();

const emit = defineEmits<{
  (e: 'update:entry', entry: DiaryEntry | null): void;
  (e: 'updated', entry: DiaryEntry): void;
  (e: 'removed', id: number): void;
  (e: 'linkDone', excursionIds: number[], spotIds: number[], date: string): void;
  (e: 'previewImage', images: DiaryImage[], index: number, onRemove: (idx: number) => void): void;
}>();

const auth = useAuthStore();

const editFormLogic = useDiaryEditForm({
  onEntryUpdated: (updated) => {
    emit('updated', updated);
    closeEdit();
  },
  onEntryRemoved: async (id) => {
    emit('removed', id);
    closeEdit();
  },
  onLinkDone: (excursionIds, spotIds, date) => {
    emit('linkDone', excursionIds, spotIds, date);
  },
});

const {
  editingEntry,
  editForm,
  editorRef,
  contentTouched,
  dateTouched,
  showDateError,
  showContentError,
  canSave,
  saveTooltip,
  isDeleteDisabled,
  deleteTooltip,
  editDraft,
  startEdit,
  submitEditEntry,
  closeEditForm: internalCloseEditForm,
  discardEditDraft,
  deleteEditingEntry,
} = editFormLogic;

const {
  uploading: editUploading,
  uploadError: editUploadError,
  fileInputRef: editFileInputRef,
  uploadCurrent: editUploadCurrent,
  uploadTotal: editUploadTotal,
  uploadFileName: editUploadFileName,
  uploadPercent: editUploadPercent,
  abortUpload: abortEditUpload,
  onFilesSelected: handleEditFilesSelected,
} = editFormLogic.upload;

const onEditFilesSelected = (e: Event) => handleEditFilesSelected(e, editForm.value);

function closeEdit() {
  internalCloseEditForm();
  emit('update:entry', null);
}

function removeImage(index: number) {
  editForm.value.images.splice(index, 1);
}

function openPreview(index: number) {
  emit('previewImage', editForm.value.images, index, (idx) => removeImage(idx));
}

watch(
  () => props.entry,
  (newEntry) => {
    if (newEntry) {
      startEdit(newEntry);
    } else if (editingEntry.value) {
      internalCloseEditForm();
    }
  },
  { immediate: true }
);

defineExpose({
  startEdit,
  close: closeEdit,
});
</script>

<template>
  <Modal
    :model-value="editingEntry !== null"
    :title="editingEntry?.is_draft ? 'Eintrag anlegen' : 'Eintrag bearbeiten'"
    full-height
    :confirm-close="!editingEntry?.is_draft && editDraft.isDirty.value"
    confirm-close-entity="Eintrag"
    @update:model-value="(v) => !v && closeEdit()"
  >
    <form class="add-form" @submit.prevent="submitEditEntry">
      <FormField
        icon="date"
        label="Datum"
        required
        :invalid="showDateError"
        :error="showDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
        v-slot="{ id, invalid }"
      >
        <Input
          :id="id"
          v-model="editForm.date"
          type="date"
          required
          :invalid="invalid"
          @blur="dateTouched = true"
        />
      </FormField>

      <FormField icon="title" label="Titel" v-slot="{ id }">
        <Input :id="id" v-model="editForm.title" type="text" placeholder="Titel" />
      </FormField>

      <FormField
        icon="note"
        label="Eintrag"
        required
        :invalid="showContentError"
        :error="showContentError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
        v-slot="{ invalid }"
      >
        <RichTextEditor
          ref="editorRef"
          class="diary-editor"
          v-model="editForm.content"
          :invalid="invalid"
          @blur="contentTouched = true"
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
        @click="openPreview"
        @remove="removeImage"
      />

      <DiaryEntityPicker
        :date="editForm.date"
        v-model:excursion-ids="editForm.excursion_ids"
        v-model:spot-ids="editForm.spot_ids"
      />

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
          :disabled="isDeleteDisabled"
          :title="deleteTooltip"
          @click="deleteEditingEntry"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="closeEdit">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="!canSave" :title="saveTooltip">
          {{ editingEntry?.is_draft ? 'Veröffentlichen' : 'Speichern' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.file-input-hidden {
  display: none;
}

.upload-control {
  display: flex;
  align-items: center;
}

.hint {
  margin: -4px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.hint.error {
  color: var(--color-danger);
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

.diary-editor :deep(.richtext-content) {
  font-family: var(--font-diary);
  font-size-adjust: from-font;
  font-size: 1.05rem;
  line-height: 1.5;
}
</style>
