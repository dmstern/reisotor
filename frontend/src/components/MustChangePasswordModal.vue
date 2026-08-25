<script setup lang="ts">
import { ref } from 'vue';
import Button from './primitives/Button.vue';
import PasswordInput from './PasswordInput.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const error = ref('');

async function onSubmit() {
  error.value = '';
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    error.value = 'Bitte fülle alle Felder aus.';
    return;
  }
  if (newPassword.value.length < 6) {
    error.value = 'Das neue Passwort muss mindestens 6 Zeichen lang sein.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Die Passwörter stimmen nicht überein.';
    return;
  }
  if (newPassword.value === currentPassword.value) {
    error.value = 'Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.';
    return;
  }

  submitting.value = true;
  try {
    await api.put('/users/me/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    auth.clearMustChangePassword();
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = 'Fehler beim Ändern des Passworts.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <h2 id="modal-title">
            <AppIcon :icon="ACTION_ICONS.warning" :size="18" group="actions" />
            Passwortänderung erforderlich
          </h2>
        </div>
        <div class="modal-body">
          <p class="intro">
            Du verwendest aktuell ein Standard- oder Initial-Passwort. Bitte vergib ein neues, sicheres Passwort, um Reisotor zu nutzen.
          </p>

          <form @submit.prevent="onSubmit" class="password-form">
            <div class="field">
              <label for="current-pass">Aktuelles Passwort</label>
              <PasswordInput
                id="current-pass"
                v-model="currentPassword"
                placeholder="Aktuelles Passwort"
                required
                autocomplete="current-password"
              />
            </div>

            <div class="field">
              <label for="new-pass">Neues Passwort</label>
              <PasswordInput
                id="new-pass"
                v-model="newPassword"
                placeholder="Mindestens 6 Zeichen"
                required
                autocomplete="new-password"
              />
            </div>

            <div class="field">
              <label for="confirm-pass">Neues Passwort wiederholen</label>
              <PasswordInput
                id="confirm-pass"
                v-model="confirmPassword"
                placeholder="Neues Passwort wiederholen"
                required
                autocomplete="new-password"
              />
            </div>

            <p v-if="error" class="error-msg">{{ error }}</p>

            <div class="actions">
              <Button type="submit" class="primary" :disabled="submitting">
                <template v-if="submitting">Speichere…</template>
                <template v-else>Passwort ändern</template>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 11, 11, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  padding: var(--space-5);
  max-width: 440px;
  width: 100%;
  box-shadow: var(--shadow-md);
}

.modal-head h2 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.intro {
  margin-top: 0;
  margin-bottom: var(--space-4);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.password-form {
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

.error-msg {
  color: var(--color-danger, #d93838);
  font-size: 0.85rem;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}
</style>
