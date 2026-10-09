<script setup lang="ts">
import { computed, watch } from 'vue';
import type { DiaryEntry, DiaryImage } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useDiaryNewForm } from '../composables/useDiaryNewForm';
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
  modelValue: boolean;
  tripId: number;
  myDraft?: DiaryEntry | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', entry: DiaryEntry): void;
  (e: 'startEditDraft', draft: DiaryEntry): void;
  (e: 'linkDone', excursionIds: number[], spotIds: number[], date: string): void;
  (e: 'previewImage', images: DiaryImage[], index: number, onRemove: (idx: number) => void): void;
}>();

const auth = useAuthStore();

const newFormLogic = useDiaryNewForm({
  tripId: computed(() => props.tripId),
  myDraft: computed(() => props.myDraft ?? null),
  onStartEditDraft: (draft) => {
    emit('startEditDraft', draft);
    emit('update:modelValue', false);
  },
  onEntryCreated: (created) => {
    emit('created', created);
    emit('update:modelValue', false);
  },
  onLinkDone: (excursionIds, spotIds, date) => {
    emit('linkDone', excursionIds, spotIds, date);
  },
});

const {
  showForm,
  form,
  editorRef,
  contentTouched,
  dateTouched,
  showDateError,
  showContentError,
  canSubmit,
  saveTooltip,
  newDraft,
  openNewForm,
  submitEntry,
  closeForm: internalCloseForm,
  discardNewDraft,
} = newFormLogic;

const {
  uploading,
  uploadError,
  fileInputRef,
  uploadCurrent,
  uploadTotal,
  uploadFileName,
  uploadPercent,
  abortUpload,
  onFilesSelected: handleFilesSelected,
} = newFormLogic.upload;

const onFilesSelected = (e: Event) => handleFilesSelected(e, form.value);

function closeForm() {
  internalCloseForm();
  emit('update:modelValue', false);
}

function removeImage(index: number) {
  form.value.images.splice(index, 1);
}

function openPreview(index: number) {
  emit('previewImage', form.value.images, index, (idx) => removeImage(idx));
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && !showForm.value) {
      openNewForm();
    } else if (!isOpen && showForm.value) {
      internalCloseForm();
    }
  },
  { immediate: true }
);

watch(showForm, (isOpen) => {
  if (props.modelValue !== isOpen) {
    emit('update:modelValue', isOpen);
  }
});

defineExpose({
  open: openNewForm,
  close: closeForm,
});
</script>

<template>
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
        :invalid="showDateError"
        :error="showDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
        v-slot="{ id, invalid }"
      >
        <Input
          :id="id"
          v-model="form.date"
          type="date"
          required
          :invalid="invalid"
          @blur="dateTouched = true"
        />
      </FormField>

      <FormField icon="title" label="Titel" v-slot="{ id }">
        <Input :id="id" v-model="form.title" type="text" placeholder="Titel" />
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
          v-model="form.content"
          placeholder="Was ist heute passiert?"
          :invalid="invalid"
          @blur="contentTouched = true"
        />
      </FormField>

      <p v-if="auth.user?.restricted" class="hint">
        Eingeschränkter Modus - Kein Datei-Upload möglich
      </p>
      <div v-else class="upload-control">
        <input
          ref="fileInputRef"
          type="file"
          class="file-input-hidden"
          accept="image/*,.heic,.heif"
          multiple
          aria-label="Bilder auswählen"
          :disabled="uploading"
          @change="onFilesSelected"
        />
        <UploadProgressBar
          v-if="uploading"
          :current="uploadCurrent"
          :total="uploadTotal"
          :progress-percent="uploadPercent"
          :filename="uploadFileName"
          @cancel="abortUpload"
        />
        <Button
          v-else
          type="button"
          variant="secondary"
          size="sm"
          :icon="FORM_FIELD_ICONS.image"
          @click="fileInputRef?.click()"
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
        @click="openPreview"
        @remove="removeImage"
      />

      <DiaryEntityPicker
        :date="form.date"
        v-model:excursion-ids="form.excursion_ids"
        v-model:spot-ids="form.spot_ids"
      />

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
        <Button type="submit" :disabled="!canSubmit" :title="saveTooltip"> Eintragen </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.add-form {
  container-type: inline-size;
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
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.hint.error {
  color: var(--color-danger);
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.spacer {
  flex: 1;
}

@container (max-width: 360px) {
  .actions-row {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .spacer {
    display: none;
  }

  .actions-row :deep(button),
  .actions-row button {
    width: 100%;
  }
}

.diary-editor :deep(.richtext-content) {
  font-family: var(--font-diary);
  font-size-adjust: from-font;
  font-size: 1.05rem;
  line-height: 1.5;
}
</style>
