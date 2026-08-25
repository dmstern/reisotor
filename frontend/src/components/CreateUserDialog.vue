<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import PasswordInput from './PasswordInput.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', user: User): void;
}>();

const username = ref('');
const email = ref('');
const password = ref('');
const isAdmin = ref(false);
const avatar = ref('🙂');
const submitting = ref(false);
const error = ref('');

const AVATAR_OPTIONS = [
  '🙂',
  '🧑',
  '👩',
  '👨',
  '😎',
  '🥳',
  '🤓',
  '🥸',
  '🧙',
  '🦊',
  '🦁',
  '🐢',
  '🐱',
  '🐶',
];

function resetForm() {
  username.value = '';
  email.value = '';
  password.value = '';
  isAdmin.value = false;
  avatar.value = '🙂';
  error.value = '';
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetForm();
    }
  },
  { immediate: true }
);

function close() {
  resetForm();
  emit('update:modelValue', false);
}

async function submit() {
  error.value = '';
  if (!username.value.trim() || !password.value) {
    error.value = 'Benutzername und Passwort erforderlich.';
    return;
  }
  if (password.value.length < 6) {
    error.value = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
    return;
  }

  submitting.value = true;
  try {
    const newUser = await api.post<User>('/users', {
      username: username.value.trim(),
      email: email.value.trim() || undefined,
      password: password.value,
      avatar: avatar.value,
      is_admin: isAdmin.value,
    });
    emit('created', newUser);
    close();
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = 'Fehler beim Anlegen des Nutzers.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal :model-value="modelValue" title="Neuen Nutzer anlegen" @update:model-value="close">
    <form @submit.prevent="submit" class="create-user-form">
      <div class="field">
        <label for="create-username">Benutzername</label>
        <input
          id="create-username"
          v-model="username"
          type="text"
          class="input"
          placeholder="z. B. max_muster"
          required
        />
      </div>

      <div class="field">
        <label for="create-email">E-Mail-Adresse (optional)</label>
        <input
          id="create-email"
          v-model="email"
          type="email"
          class="input"
          placeholder="max@example.com"
        />
      </div>

      <div class="field">
        <label for="create-password">Initial-Passwort</label>
        <PasswordInput
          id="create-password"
          v-model="password"
          placeholder="Mindestens 6 Zeichen"
          required
        />
        <p class="hint">Der Nutzer wird beim ersten Login zur Passwortänderung aufgefordert.</p>
      </div>

      <div class="field">
        <label>Avatar / Symbol</label>
        <div class="avatar-picker">
          <IconButton
            v-for="e in AVATAR_OPTIONS"
            :key="e"
            :active="avatar === e"
            :aria-label="`Avatar-Symbol ${e}`"
            :title="`Avatar ${e}`"
            size="md"
            @click="avatar = e"
          >
            {{ e }}
          </IconButton>
        </div>
      </div>

      <div class="field checkbox-field">
        <label class="checkbox-label">
          <input type="checkbox" v-model="isAdmin" />
          <span>Als Administrator:in anlegen</span>
        </label>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="actions">
        <Button type="button" variant="secondary" @click="close">Abbrechen</Button>
        <Button type="submit" variant="primary" :disabled="submitting">
          <template v-if="submitting">Speichere…</template>
          <template v-else
            ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Nutzer
            anlegen</template
          >
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.create-user-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-heading);
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.95rem;
}

.input:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.hint {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
}

.avatar-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}


.checkbox-field {
  margin-top: var(--space-1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.9rem;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.error-msg {
  color: var(--color-danger, #d93838);
  font-size: 0.85rem;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
