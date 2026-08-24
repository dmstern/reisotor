<script setup lang="ts">
import Button from './primitives/Button.vue';
import { ref, watch } from 'vue';
import { api, ApiError } from '../api/client';
import { compressImage } from '../utils/imageCompression';
import Modal from './Modal.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

type FeedbackType = 'bug' | 'feature';
interface FeedbackResult {
  issue_number: number;
  issue_url: string;
}

const form = ref<{ type: FeedbackType; title: string; description: string }>({
  type: 'bug',
  title: '',
  description: '',
});
const screenshot = ref<string | null>(null);
const screenshotName = ref('');
const submitting = ref(false);
const error = ref('');
const result = ref<FeedbackResult | null>(null);

// Formular bei jedem erneuten Öffnen zurücksetzen statt beim Schließen - sonst würde ein Klick auf
// den Schließen-Button mitten im Tippen den Entwurf verwerfen, bevor klar ist, ob wirklich ein
// neues Formular gewünscht ist.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    form.value = { type: 'bug', title: '', description: '' };
    screenshot.value = null;
    screenshotName.value = '';
    error.value = '';
    result.value = null;
  },
);

async function onScreenshotSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  screenshot.value = await compressImage(file);
  screenshotName.value = file.name;
}

function removeScreenshot() {
  screenshot.value = null;
  screenshotName.value = '';
}

async function submit() {
  error.value = '';
  if (!form.value.title.trim() || !form.value.description.trim()) return;
  submitting.value = true;
  try {
    result.value = await api.post<FeedbackResult>('/feedback', {
      type: form.value.type,
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      screenshot: screenshot.value ?? undefined,
    });
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Meldung konnte nicht gesendet werden.';
  } finally {
    submitting.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal :model-value="modelValue" title="Feedback geben" @update:model-value="close">
    <div class="feedback-dialog">
      <template v-if="result">
        <p class="hint success">
          Danke! Deine Meldung wurde als
          <a :href="result.issue_url" target="_blank" rel="noopener">Issue #{{ result.issue_number }}</a>
          angelegt.
        </p>
        <Button type="button" @click="close">Schließen</Button>
      </template>

      <form v-else class="form" @submit.prevent="submit">
        <label>
          Art der Meldung
          <select v-model="form.type">
            <option value="bug">🐛 Bug melden</option>
            <option value="feature">💡 Feature vorschlagen</option>
          </select>
        </label>

        <label>
          Titel
          <input v-model="form.title" type="text" required maxlength="200" placeholder="Kurze Zusammenfassung" />
        </label>

        <label>
          Beschreibung
          <textarea
            v-model="form.description"
            required
            rows="5"
            maxlength="5000"
            placeholder="Was ist passiert, was hättest du erwartet? Bzw.: Was soll die neue Funktion können?"
          />
        </label>

        <label v-if="!screenshot" class="upload-label">
          <input type="file" accept="image/*" class="hidden-input" @change="onScreenshotSelected" />
          + Screenshot hinzufügen
        </label>
        <div v-else class="screenshot-preview">
          <img :src="screenshot" alt="" />
          <span class="screenshot-name">{{ screenshotName }}</span>
          <Button variant="secondary" size="sm" @click="removeScreenshot">Entfernen</Button>
        </div>

        <p v-if="error" class="hint error">{{ error }}</p>

        <Button type="submit" :disabled="submitting">
          {{ submitting ? 'Wird gesendet…' : 'Absenden' }}
        </Button>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.feedback-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.hint.error {
  color: var(--color-danger);
}

.hint.success {
  color: var(--color-success);
}

.upload-label {
  display: inline-block;
  align-self: flex-start;
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--color-primary);
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.screenshot-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.screenshot-preview img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.screenshot-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
