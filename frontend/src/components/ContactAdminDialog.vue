<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import Textarea from './primitives/Textarea.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { api, ApiError } from '../api/client';

const props = defineProps<{
  modelValue: boolean;
  initialUsername?: string;
  initialEmail?: string;
  initialMessage?: string;
  initialType?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const name = ref('');
const email = ref('');
const username = ref('');
const message = ref('');
const type = ref('registration_help');
const submitting = ref(false);
const error = ref('');
const success = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return;
    }

    username.value = props.initialUsername ?? '';
    email.value = props.initialEmail ?? '';
    message.value = props.initialMessage ?? '';
    type.value = props.initialType ?? 'registration_help';
    name.value = '';
    error.value = '';
    success.value = false;
  }
);

function close() {
  emit('update:modelValue', false);
}

async function onSubmit() {
  if (!message.value.trim()) {
    return;
  }

  error.value = '';
  submitting.value = true;

  try {
    await api.post('/auth/contact-admin', {
      name: name.value.trim() || undefined,
      email: email.value.trim() || undefined,
      username: username.value.trim() || undefined,
      message: message.value.trim(),
      type: type.value,
    });
    success.value = true;
  } catch (err) {
    error.value =
      err instanceof ApiError
        ? err.message
        : 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Administrator:in kontaktieren"
    @update:model-value="close"
  >
    <div class="contact-dialog">
      <template v-if="success">
        <div class="success-box">
          <p class="success-title">Vielen Dank!</p>
          <p class="hint">
            Deine Nachricht wurde an die Administration dieser Reisotor-Instanz übermittelt. Ein:e
            Administrator:in kann dein Anliegen einsehen und ggf. deinen Account manuell
            freischalten.
          </p>
          <Button type="button" @click="close">Schließen</Button>
        </div>
      </template>

      <form v-else class="contact-form" @submit.prevent="onSubmit">
        <p class="hint">
          Hier kannst du die Administration direkt über Probleme bei der Registrierung oder
          Anmeldung informieren.
        </p>

        <label for="contact-name">
          Dein Name (optional)
          <Input id="contact-name" v-model="name" type="text" placeholder="z. B. Alex" />
        </label>

        <label for="contact-username">
          Gewünschter Benutzername (optional)
          <Input id="contact-username" v-model="username" type="text" placeholder="z. B. alex" />
        </label>

        <label for="contact-email">
          Deine E-Mail-Adresse (für Rückfragen)
          <Input id="contact-email" v-model="email" type="email" placeholder="alex@example.com" />
        </label>

        <label for="contact-message">
          Nachricht / Problembeschreibung *
          <Textarea
            id="contact-message"
            v-model="message"
            :rows="4"
            required
            placeholder="z. B. Ich erhalte keine Bestätigungs-E-Mail..."
          />
        </label>

        <p v-if="error" class="error-banner">{{ error }}</p>

        <div class="actions">
          <Button type="button" variant="secondary" @click="close">Abbrechen</Button>
          <Button type="submit" :loading="submitting" :disabled="submitting || !message.trim()">
            <AppIcon :icon="ACTION_ICONS.send" :size="16" group="actions" />
            Nachricht senden
          </Button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.contact-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.contact-form label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm, 0.85rem);
  font-weight: 500;
  color: var(--color-text);
}

.success-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.success-title {
  margin: 0;
  font-size: var(--font-size-lg, 1.1rem);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.error-banner {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
  border-radius: var(--radius-sm-squircle, 6px);
  font-size: var(--font-size-sm, 0.85rem);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
