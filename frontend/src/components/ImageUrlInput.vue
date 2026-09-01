<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import AppIcon from './AppIcon.vue';
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
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const urlValue = computed<string>({
  get: () => props.modelValue ?? '',
  set: (v) => emit('update:modelValue', v),
});

const uploading = ref(false);
const uploadError = ref('');

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;
  uploading.value = true;
  uploadError.value = '';
  try {
    const compressed = await compressImage(file);
    const { url } = await api.post<{ url: string }>('/images', { data: compressed });
    emit('update:modelValue', url);
  } catch {
    uploadError.value = 'Bild-Upload fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="image-url-input">
    <!-- type="text" statt "url": das Feld kann seit dem Datei-Upload oben auch eine relative
         /api/uploads/…-URL enthalten (kein eigenes Schema/Host), das würde die native
         type="url"-Validierung des Browsers sonst ablehnen und das Formular blockieren. -->
    <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
    <input v-model="urlValue" type="text" :placeholder="placeholder ?? 'Bild-URL (optional)'" />
    <label for="auto-id-1788301175437-9" class="upload-label">
      <input
        id="auto-id-1788301175437-9"
        type="file"
        accept="image/*"
        :disabled="uploading"
        @change="onFileSelected"
      />
      <template v-if="uploading">Lädt hoch …</template>
      <template v-else
        ><AppIcon :icon="FORM_FIELD_ICONS.image" :size="14" group="formFields" /> Oder Bild
        hochladen</template
      >
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
