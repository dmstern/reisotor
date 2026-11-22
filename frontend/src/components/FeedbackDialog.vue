<script setup lang="ts">
import Alert from './primitives/Alert.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Textarea from './primitives/Textarea.vue';
import { ref, watch, computed } from 'vue';
import { api, ApiError } from '../api/client';
import { compressImage, isHeicFile } from '../utils/imageCompression';
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { renderRichText } from '../utils/richText';
import { useBuildInfoStore } from '../stores/buildInfo';

const props = defineProps<{
  modelValue: boolean;
  initialTitle?: string;
  initialDescription?: string;
  initialType?: 'bug' | 'feature';
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

type FeedbackType = 'bug' | 'feature';
interface FeedbackResult {
  issue_number: number;
  issue_url: string;
}

const buildInfoStore = useBuildInfoStore();

const form = ref<{ type: FeedbackType; title: string; description: string }>({
  type: props.initialType ?? 'bug',
  title: props.initialTitle ?? '',
  description: props.initialDescription ?? '',
});
const contactEmail = ref('');
const screenshot = ref<string | null>(null);
const screenshotName = ref('');
const submitting = ref(false);
const showPublishConfirm = ref(false);
const error = ref('');
const result = ref<FeedbackResult | null>(null);

const gitHubIssueUrl = computed(() => {
  const baseUrl = buildInfoStore.buildInfo?.repoUrl ?? 'https://github.com/dmstern/reisotor';
  const params = new URLSearchParams();

  if (form.value.title.trim()) {
    params.set('title', form.value.title.trim());
  }

  let body = form.value.description.trim();

  if (contactEmail.value.trim()) {
    body += `\n\n---\nKontakt: ${contactEmail.value.trim()}`;
  }

  if (body) {
    params.set('body', body);
  }

  return `${baseUrl}/issues/new?${params.toString()}`;
});

// Formular bei jedem erneuten Öffnen zurücksetzen statt beim Schließen - sonst würde ein Klick auf
// den Schließen-Button mitten im Tippen den Entwurf verwerfen, bevor klar ist, ob wirklich ein
// neues Formular gewünscht ist.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return;
    }

    buildInfoStore.load();
    form.value = {
      type: props.initialType ?? 'bug',
      title: props.initialTitle ?? '',
      description: props.initialDescription ?? '',
    };
    contactEmail.value = '';
    screenshot.value = null;
    screenshotName.value = '';
    showPublishConfirm.value = false;
    error.value = '';
    result.value = null;
  }
);

async function onScreenshotSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  screenshot.value = await compressImage(file);
  screenshotName.value = isHeicFile(file)
    ? file.name.replace(/\.(heic|heif)$/i, '.jpg')
    : file.name;
}

function removeScreenshot() {
  screenshot.value = null;
  screenshotName.value = '';
}

function requestSubmit() {
  error.value = '';

  if (!form.value.title.trim() || !form.value.description.trim()) {
    return;
  }

  showPublishConfirm.value = true;
}

function cancelPublishConfirm() {
  showPublishConfirm.value = false;
}

async function confirmAndSubmit() {
  showPublishConfirm.value = false;
  error.value = '';

  if (!form.value.title.trim() || !form.value.description.trim()) {
    return;
  }

  submitting.value = true;

  try {
    result.value = await api.post<FeedbackResult>('/feedback', {
      type: form.value.type,
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      screenshot: screenshot.value ?? undefined,
      email: contactEmail.value.trim() || undefined,
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
  <Modal :model-value="modelValue" title="Feedback geben" size="lg" @update:model-value="close">
    <div class="feedback-dialog">
      <template v-if="result">
        <p class="hint success">
          Danke! Deine Meldung wurde als
          <a :href="result.issue_url" target="_blank" rel="noopener"
            >Issue #{{ result.issue_number }}</a
          >
          angelegt.
        </p>
        <Button type="button" @click="close">Schließen</Button>
      </template>

      <form v-else class="form" @submit.prevent="requestSubmit">
        <Alert variant="warning" title="Öffentlich im Internet sichtbar">
          Alle Meldungen (Titel, Beschreibung, Screenshot sowie ggf. E-Mail-Adresse) werden
          öffentlich einsehbar auf GitHub (Plattform von Microsoft) gespeichert. Bitte teile keine
          privaten oder sensiblen Daten!
        </Alert>

        <label for="auto-id-1788301151970-4">
          Art der Meldung
          <Select id="auto-id-1788301151970-4" v-model="form.type">
            <option value="bug">🐛 Bug melden</option>
            <option value="feature">💡 Feature vorschlagen</option>
          </Select>
        </label>

        <label for="auto-id-1788301175436-4">
          <span class="label-text">
            Titel <span class="required-indicator" aria-hidden="true">*</span>
          </span>
          <Input
            id="auto-id-1788301175436-4"
            v-model="form.title"
            type="text"
            required
            :maxlength="200"
            placeholder="Kurze Zusammenfassung"
          />
        </label>

        <label for="auto-id-1788301175436-5">
          <span class="label-text">
            Beschreibung <span class="required-indicator" aria-hidden="true">*</span>
          </span>
          <Textarea
            id="auto-id-1788301175436-5"
            v-model="form.description"
            required
            :rows="5"
            :maxlength="5000"
            placeholder="Was ist passiert, was hättest du erwartet? Bzw.: Was soll die neue Funktion können?"
          />
        </label>

        <label for="feedback-contact-email">
          <span class="label-text"> E-Mail für Rückfragen (optional) </span>
          <Input
            id="feedback-contact-email"
            v-model="contactEmail"
            type="email"
            :maxlength="200"
            placeholder="deine-adresse@beispiel.de"
          />
        </label>

        <label for="auto-id-1788301175436-6" v-if="!screenshot" class="upload-label">
          <input
            id="auto-id-1788301175436-6"
            type="file"
            accept="image/*,.heic,.heif"
            class="hidden-input"
            @change="onScreenshotSelected"
          />
          <AppIcon :icon="ACTION_ICONS.photoPlus" :size="14" group="actions" /> Screenshot
          hinzufügen
        </label>
        <div v-else class="screenshot-preview-container">
          <div class="screenshot-preview">
            <img :src="screenshot" alt="" />
            <span class="screenshot-name">{{ screenshotName }}</span>
            <Button variant="secondary" size="sm" @click="removeScreenshot">Entfernen</Button>
          </div>
          <p class="screenshot-github-note">
            Tipp: Bei „Auf GitHub öffnen“ kannst du Screenshots dort direkt per Copy &amp; Paste
            einfügen.
          </p>
        </div>

        <div v-if="error" class="error-container">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="hint error" v-html="renderRichText(error)"></p>
          <Button
            :href="gitHubIssueUrl"
            target="_blank"
            rel="noopener"
            variant="secondary"
            size="sm"
            class="github-fallback-btn"
          >
            <AppIcon :icon="ACTION_ICONS.share" :size="14" group="actions" />
            Als Issue auf GitHub öffnen
          </Button>
        </div>

        <div class="actions-row">
          <Button
            :href="gitHubIssueUrl"
            target="_blank"
            rel="noopener"
            variant="secondary"
            class="btn-github-direct"
            title="Meldung vorbereiten und direkt auf GitHub mit deinem Account einreichen"
          >
            <AppIcon :icon="ACTION_ICONS.share" :size="14" group="actions" />
            Auf GitHub öffnen
          </Button>
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="close">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="submitting">
            <AppIcon :icon="ACTION_ICONS.send" :size="15" group="actions" />
            {{ submitting ? 'Wird gesendet…' : 'Absenden' }}
          </Button>
        </div>
      </form>
    </div>
  </Modal>

  <Modal
    :model-value="showPublishConfirm"
    title="Öffentlich auf GitHub veröffentlichen?"
    size="sm"
    @update:model-value="cancelPublishConfirm"
  >
    <div class="publish-confirm-dialog">
      <Alert variant="warning" title="Achtung: Öffentliche Speicherung im Internet">
        Deine Meldung wird für alle sichtbar auf GitHub veröffentlicht und lässt sich dort nicht
        einfach privat stellen.
      </Alert>
      <p class="publish-confirm-text">
        Bitte prüfe vor dem Absenden noch einmal, dass weder im <strong>Titel</strong>, in der
        <strong>Beschreibung</strong>, im <strong>Screenshot</strong> noch in der optionalen
        <strong>E-Mail-Adresse</strong> private oder sensible Daten enthalten sind.
      </p>
      <ButtonGroup>
        <Button type="button" variant="secondary" class="btn-cancel" @click="cancelPublishConfirm">
          Zurück &amp; prüfen
        </Button>
        <Button
          type="button"
          class="btn-confirm-publish"
          :disabled="submitting"
          @click="confirmAndSubmit"
        >
          <AppIcon :icon="ACTION_ICONS.send" :size="15" group="actions" />
          Ja, öffentlich absenden
        </Button>
      </ButtonGroup>
    </div>
  </Modal>
</template>

<style scoped>
.feedback-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.publish-confirm-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.publish-confirm-text {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text);
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
  font-size: var(--font-size-sm);
}

.label-text {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}

.error-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  font-size: var(--font-size-sm);
}

.hint.error {
  color: var(--color-danger);
}

.hint.error :deep(a) {
  color: var(--color-danger);
  font-weight: 600;
  text-decoration: underline;
  word-break: break-all;
}

.github-fallback-btn {
  align-self: flex-start;
}

.hint.success {
  color: var(--color-success);
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  align-self: flex-start;
  min-height: 44px;
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-primary);
  cursor: pointer;
  border-radius: var(--radius-xs-squircle);
}

.upload-label:has(.hidden-input:focus-visible) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.screenshot-preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.screenshot-github-note {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.btn-github-direct {
  text-decoration: none;
}

.screenshot-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.screenshot-preview img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  flex-shrink: 0;
}

.screenshot-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
