<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import FormField from './FormField.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { User, AdminResetPasswordResult } from '../api/types';

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
  result: AdminResetPasswordResult | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'reset', password?: string): void;
  (e: 'close'): void;
}>();

const mode = ref<'auto' | 'custom'>('auto');
const customPassword = ref('');
const error = ref('');
const copiedPassword = ref(false);
const copiedLink = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      mode.value = 'auto';
      customPassword.value = '';
      error.value = '';
      copiedPassword.value = false;
      copiedLink.value = false;
    }
  }
);

watch(
  () => props.result,
  (res) => {
    if (res?.temporaryPassword) {
      void copyToClipboard(res.temporaryPassword, 'password');
    }
  },
  { immediate: true }
);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleReset() {
  error.value = '';
  if (mode.value === 'custom') {
    if (!customPassword.value || customPassword.value.length < 6) {
      error.value = 'Das temporäre Passwort muss mindestens 6 Zeichen lang sein.';
      return;
    }
    emit('reset', customPassword.value);
  } else {
    emit('reset');
  }
}

async function copyToClipboard(text?: string | null, type?: 'password' | 'link') {
  if (!text) return;
  try {
    await navigator.clipboard?.writeText(text);
    if (type === 'password') {
      copiedPassword.value = true;
      setTimeout(() => {
        copiedPassword.value = false;
      }, 2000);
    } else if (type === 'link') {
      copiedLink.value = true;
      setTimeout(() => {
        copiedLink.value = false;
      }, 2000);
    }
  } catch {
    // Clipboard API nicht verfügbar
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`Passwort zurücksetzen – ${user?.username ?? ''}`"
    @update:model-value="close"
  >
    <div v-if="!result" class="reset-dialog-body">
      <p class="description">
        Setzt das Passwort für <strong>{{ user?.username }}</strong> zurück. Der Account wird mit
        einem Einmalpasswort versehen und muss beim nächsten Anmelden ein neues Passwort vergeben.
      </p>

      <div class="mode-selection" role="radiogroup" aria-label="Passwort-Methode">
        <label for="reset-mode-auto" class="mode-label">
          <input id="reset-mode-auto" v-model="mode" type="radio" name="resetMode" value="auto" />
          <span>Zufälliges Passwort automatisch generieren (empfohlen)</span>
        </label>
        <label for="reset-mode-custom" class="mode-label">
          <input
            id="reset-mode-custom"
            v-model="mode"
            type="radio"
            name="resetMode"
            value="custom"
          />
          <span>Eigenes temporäres Passwort festlegen</span>
        </label>
      </div>

      <FormField
        v-if="mode === 'custom'"
        label="Temporäres Passwort"
        hint="Mindestens 6 Zeichen. Der Nutzer muss es nach dem Login ändern."
        class="custom-field"
      >
        <Input
          v-model="customPassword"
          type="text"
          placeholder="z. B. NeuesStartPW123"
          autocomplete="off"
        />
      </FormField>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="actions actions-row">
        <Button variant="secondary" :disabled="loading" @click="close">Abbrechen</Button>
        <Button variant="primary" :loading="loading" :disabled="loading" @click="handleReset">
          <AppIcon :icon="ACTION_ICONS.key" :size="14" group="actions" />
          Passwort jetzt zurücksetzen
        </Button>
      </div>
    </div>

    <div v-else class="result-body">
      <div class="success-banner">
        <AppIcon :icon="ACTION_ICONS.done" :size="18" group="actions" class="success-icon" />
        <span>Das Passwort wurde erfolgreich zurückgesetzt.</span>
      </div>

      <div class="credential-box">
        <div class="credential-row">
          <div class="credential-info">
            <span class="label">Temporäres Einmal-Passwort:</span>
            <code class="val">{{ result.temporaryPassword }}</code>
          </div>
          <Button
            size="sm"
            variant="secondary"
            class="copy-btn"
            :disabled="!result.temporaryPassword"
            @click="copyToClipboard(result.temporaryPassword, 'password')"
          >
            <AppIcon
              :icon="copiedPassword ? ACTION_ICONS.done : ACTION_ICONS.copy"
              :size="14"
              group="actions"
            />
            {{ copiedPassword ? 'Kopiert!' : 'Kopieren' }}
          </Button>
        </div>

        <div class="credential-row">
          <div class="credential-info">
            <span class="label">Oder direkter Reset-Link:</span>
            <span class="val link-val">{{ result.resetUrl }}</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            class="copy-btn"
            :disabled="!result.resetUrl"
            @click="copyToClipboard(result.resetUrl, 'link')"
          >
            <AppIcon
              :icon="copiedLink ? ACTION_ICONS.done : ACTION_ICONS.copy"
              :size="14"
              group="actions"
            />
            {{ copiedLink ? 'Kopiert!' : 'Link kopieren' }}
          </Button>
        </div>
      </div>

      <p v-if="result.emailSent" class="email-hint success">
        Eine E-Mail mit dem Reset-Link wurde direkt an <strong>{{ user?.email }}</strong> versendet.
      </p>
      <p v-else class="email-hint info">
        Keine automatische E-Mail versendet (kein SMTP aktiv oder keine Adresse hinterlegt). Teile
        dem Nutzer das Einmal-Passwort oder den Link persönlich oder per Messenger mit.
      </p>

      <div class="actions actions-row">
        <Button variant="primary" @click="close">Fertig</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.reset-dialog-body,
.result-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.mode-selection {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.mode-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.custom-field {
  margin-top: var(--space-1);
}

.error-msg {
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  margin: 0;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-success-bg, rgba(46, 160, 67, 0.1));
  color: var(--color-success);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm-squircle);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.credential-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-bg-secondary, var(--color-hover));
  padding: var(--space-3);
  border-radius: var(--radius-sm-squircle);
  border: 1px solid var(--color-border);
}

.credential-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) 0;
  min-width: 0;
}

.credential-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  min-width: 0;
  flex: 1;
}

.credential-info .label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.credential-info .val {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  word-break: break-all;
}

.credential-info .link-val {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.copy-btn {
  flex-shrink: 0;
}

@container (max-width: 420px) {
  .credential-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .copy-btn {
    width: 100%;
    justify-content: center;
  }
}

.email-hint {
  font-size: var(--font-size-xs);
  margin: 0;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.email-hint.success {
  color: var(--color-success);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
