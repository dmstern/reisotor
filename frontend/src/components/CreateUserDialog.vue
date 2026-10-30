<script lang="ts">
export type UserRole = 'restricted' | 'plus' | 'admin';
export const STORAGE_KEY_REMEMBER_ROLE = 'reisotor_admin_last_created_user_role';
</script>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import CheckboxCard from './primitives/CheckboxCard.vue';
import FormField from './FormField.vue';
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
const role = ref<UserRole>('restricted');
const rememberRole = ref(false);
const avatar = ref('🙂');
const submitting = ref(false);
const error = ref('');

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'restricted', label: 'Basis-Konto' },
  { value: 'plus', label: 'Reisotor Plus' },
  { value: 'admin', label: 'Administrator:in' },
];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  restricted: 'Eingeschränkte Rechte: kein Datei-Upload, maximal 1 selbst angelegter Urlaub.',
  plus: 'Voller Zugriff auf alle Urlaubs- und Planungsfunktionen sowie Datei-Uploads.',
  admin: 'Volle Systemrechte inkl. Instanzeinstellungen und Nutzerverwaltung.',
};

const currentRoleHint = computed(() => ROLE_DESCRIPTIONS[role.value] ?? '');

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

function initRoleFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_REMEMBER_ROLE) as UserRole | null;
    if (saved && (saved === 'restricted' || saved === 'plus' || saved === 'admin')) {
      role.value = saved;
      rememberRole.value = true;
      return;
    }
  } catch {
    // localStorage might be unavailable
  }
  role.value = 'restricted';
  rememberRole.value = false;
}

function resetForm() {
  username.value = '';
  email.value = '';
  password.value = '';
  initRoleFromStorage();
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

  try {
    if (rememberRole.value) {
      localStorage.setItem(STORAGE_KEY_REMEMBER_ROLE, role.value);
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER_ROLE);
    }
  } catch {
    // ignore storage errors
  }

  submitting.value = true;
  try {
    const newUser = await api.post<User>('/users', {
      username: username.value.trim(),
      email: email.value.trim() || undefined,
      password: password.value,
      avatar: avatar.value,
      role: role.value,
      is_admin: role.value === 'admin',
      is_restricted: role.value === 'restricted',
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
      <FormField icon="person" label="Benutzername" required>
        <Input
          id="create-username"
          v-model="username"
          type="text"
          placeholder="z. B. max_muster"
          required
        />
      </FormField>

      <FormField icon="email" label="E-Mail-Adresse">
        <Input id="create-email" v-model="email" type="email" placeholder="max@example.com" />
      </FormField>

      <FormField icon="title" label="Initial-Passwort" required>
        <PasswordInput
          id="create-password"
          v-model="password"
          placeholder="Mindestens 6 Zeichen"
          required
        />
        <p class="hint">Der Nutzer wird beim ersten Login zur Passwortänderung aufgefordert.</p>
      </FormField>

      <div class="field">
        <span class="pseudo-label">Avatar / Symbol</span>
        <div class="avatar-picker">
          <IconButton
            v-for="e in AVATAR_OPTIONS"
            :key="e"
            variant="ghost"
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

      <FormField id="create-role" icon="shared" label="Konto-Typ / Rolle" required>
        <Select
          id="create-role"
          v-model="role"
          :options="ROLE_OPTIONS"
          aria-label="Konto-Typ / Rolle"
          required
        />
        <p class="hint">{{ currentRoleHint }}</p>
      </FormField>

      <CheckboxCard
        id="create-remember-role"
        v-model="rememberRole"
        label="Gewählte Rolle für nächste Neuanlage merken"
        variant="row"
      />

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="actions-row">
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="close"
          >Abbrechen</Button
        >
        <Button type="submit" variant="primary" :disabled="submitting">
          <template v-if="submitting">Speichere…</template>
          <template v-else>
            <AppIcon :icon="ACTION_ICONS.userPlus" :size="14" group="actions" /> Nutzer anlegen
          </template>
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

.field label,
.field .pseudo-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-heading);
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
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
  gap: var(--space-2);
}

.error-msg {
  color: var(--color-danger);
  font-size: 0.85rem;
  margin: 0;
}
</style>
