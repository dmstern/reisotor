<script setup lang="ts">
import { computed, ref, onUnmounted, useId } from 'vue';
import { api } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import AppIcon from './AppIcon.vue';
import Input from './primitives/Input.vue';
import UploadProgressBar from './UploadProgressBar.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

// Ergänzt das reine Bild-URL-Textfeld (extern gehostetes Bild) um einen direkten Datei-Upload -
// beide schreiben am Ende in dasselbe image_url-Feld (Trip-/Spot-/Tour-Titelbild), es gibt keinen
// eigenen "hochgeladen vs. verlinkt"-Unterschied im Datenmodell. Nutzt denselben client-seitigen
// Komprimierungsweg wie DiaryView.vue's Galerie (compressImage()), lädt aber über den generischen
// backend/src/routes/images.ts-Endpoint hoch (kein trip_id/entity_id nötig, anders als
// FileAttachments.vue) und ohne Mehrfachauswahl/Galerie - hier gibt es immer nur EIN Titelbild.
const props = defineProps<{
  modelValue: string | undefined;
  placeholder?: string;
  uploading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:uploading', value: boolean): void;
}>();

const fileInputId = useId();
const fileInputRef = ref<HTMLInputElement | null>(null);

const urlValue = computed<string>({
  get: () => props.modelValue ?? '',
  set: (v) => emit('update:modelValue', v),
});

const isUploading = ref(false);
const progressPercent = ref(0);
const currentFileName = ref('');
const uploadError = ref('');
let abortController: AbortController | null = null;
let progressTimer: ReturnType<typeof setInterval> | null = null;

function setUploading(value: boolean) {
  isUploading.value = value;
  emit('update:uploading', value);
}

function clearProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function abortUpload() {
  clearProgressTimer();
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  setUploading(false);
  progressPercent.value = 0;
  currentFileName.value = '';
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  clearProgressTimer();
  abortController = new AbortController();
  currentFileName.value = file.name;
  progressPercent.value = 0;
  uploadError.value = '';
  setUploading(true);

  try {
    progressPercent.value = 20;
    const compressed = await compressImage(file);
    if (abortController.signal.aborted) return;

    progressPercent.value = 50;

    progressTimer = setInterval(() => {
      if (progressPercent.value < 90) {
        progressPercent.value = Math.min(90, progressPercent.value + 5);
      }
    }, 150);

    const { url } = await api.post<{ url: string }>(
      '/images',
      { data: compressed },
      { signal: abortController.signal }
    );

    if (abortController.signal.aborted) return;

    clearProgressTimer();
    progressPercent.value = 100;
    emit('update:modelValue', url);
  } catch {
    if (abortController?.signal.aborted) return;
    uploadError.value = 'Bild-Upload fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    clearProgressTimer();
    setUploading(false);
    abortController = null;
  }
}

onUnmounted(() => {
  abortUpload();
});

defineExpose({
  abortUpload,
  uploading: isUploading,
});
</script>

<template>
  <div class="image-url-input">
    <!-- type="text" statt "url": das Feld kann seit dem Datei-Upload oben auch eine relative
         /api/uploads/…-URL enthalten (kein eigenes Schema/Host), das würde die native
         type="url"-Validierung des Browsers sonst ablehnen und das Formular blockieren. -->
    <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
    <Input
      v-model="urlValue"
      type="text"
      :placeholder="placeholder ?? 'Bild-URL'"
      :disabled="isUploading"
    />

    <UploadProgressBar
      v-if="isUploading"
      :progress-percent="progressPercent"
      :filename="currentFileName"
      :cancellable="true"
      @cancel="abortUpload"
    />

    <label v-else :for="fileInputId" class="upload-label">
      <input
        :id="fileInputId"
        ref="fileInputRef"
        type="file"
        accept="image/*,.heic,.heif"
        @change="onFileSelected"
      />
      <AppIcon :icon="FORM_FIELD_ICONS.image" :size="14" group="formFields" />
      <span>Oder Bild hochladen</span>
    </label>

    <p v-if="uploadError" class="hint error">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.image-url-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  align-self: flex-start;
  font-size: 0.88rem;
  color: var(--color-primary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition: background-color 0.15s;
}

.upload-label:hover {
  background: var(--color-primary-tint);
}

.upload-label input {
  display: none;
}

.hint {
  margin: 0;
  font-size: 0.78rem;
}

.hint.error {
  color: var(--color-danger);
}
</style>
