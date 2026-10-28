<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import PasswordInput from '../components/PasswordInput.vue';
import ReisotorRobot from '../components/ReisotorRobot.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import AppFooterLinks from '../components/AppFooterLinks.vue';
import Button from '../components/primitives/Button.vue';
import AppIcon from '../components/AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const route = useRoute();
const router = useRouter();

const token = computed(() => (route.query.token as string | undefined)?.trim() ?? '');

const newPassword = ref('');
const confirmPassword = ref('');
const passwordVisible = ref(false);
const error = ref('');
const success = ref(false);
const loading = ref(false);

const landingUrl = __LANDING_URL__;

async function onSubmit() {
  error.value = '';
  if (!token.value) {
    error.value = 'Kein gültiger Token im Link gefunden.';
    return;
  }
  if (newPassword.value.length < 6) {
    error.value = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Die Passwörter stimmen nicht überein.';
    return;
  }

  loading.value = true;
  try {
    await api.post('/auth/reset-password', {
      token: token.value,
      newPassword: newPassword.value,
    });
    success.value = true;
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Fehler beim Zurücksetzen des Passworts.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="reset-page">
    <ThemeModeSelect variant="icon" class="theme-toggle" />
    <div class="card reset-card">
      <ReisotorRobot :covering-eyes="passwordVisible" size="140px" class="logo" />
      <h1>Reisotor</h1>

      <div v-if="success" class="state-container">
        <div class="success-icon-wrapper">
          <AppIcon :icon="ACTION_ICONS.done" :size="32" group="actions" />
        </div>
        <h2>Passwort geändert!</h2>
        <p class="description">
          Dein neues Passwort wurde erfolgreich gespeichert. Du kannst dich jetzt anmelden.
        </p>
        <Button variant="primary" class="action-btn" @click="router.push('/login')">
          Zum Login
        </Button>
      </div>

      <div v-else-if="!token" class="state-container">
        <h2>Ungültiger Link</h2>
        <p class="description error-text">
          In diesem Link fehlt der Sicherheitstoken. Bitte fordere auf der Anmeldeseite einen neuen
          Link an.
        </p>
        <Button variant="secondary" class="action-btn" @click="router.push('/login')">
          Zurück zur Anmeldung
        </Button>
      </div>

      <form v-else class="form-content" @submit.prevent="onSubmit">
        <h2>Neues Passwort festlegen</h2>
        <p class="description">Vergib jetzt ein neues, sicheres Passwort für deinen Account.</p>

        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="new-password">Neues Passwort</label>
          <PasswordInput
            id="new-password"
            v-model="newPassword"
            v-model:visible="passwordVisible"
            autocomplete="new-password"
            required
          />
        </div>

        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="confirm-password">Passwort wiederholen</label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            v-model:visible="passwordVisible"
            autocomplete="new-password"
            required
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <Button type="submit" :loading="loading" :disabled="loading">
          {{ loading ? 'Speichern…' : 'Passwort speichern' }}
        </Button>

        <Button type="button" variant="secondary" class="back-btn" @click="router.push('/login')">
          Zurück zur Anmeldung
        </Button>
      </form>
    </div>

    <footer class="reset-footer">
      <AppFooterLinks :landing-url="landingUrl" />
    </footer>
  </div>
</template>

<style scoped>
.reset-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  gap: var(--space-3);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
}

.theme-toggle.icon {
  position: absolute;
  top: max(var(--space-4), env(safe-area-inset-top, var(--space-4)));
  right: max(var(--space-4), env(safe-area-inset-right, var(--space-4)));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.reset-card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}

.reset-card h1 {
  color: var(--color-primary-dark);
  margin: 0;
}

.reset-card h2 {
  font-size: 1.15rem;
  margin: 0;
}

.form-content,
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
  font-weight: 600;
  font-size: 0.9rem;
}

button {
  width: 100%;
}

.back-btn,
.action-btn {
  font-size: 0.85rem;
}

.error {
  color: var(--color-danger);
  margin: 0;
  font-size: 0.9rem;
}

.error-text {
  color: var(--color-danger);
}

.success-icon-wrapper {
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--color-success-bg, rgba(46, 160, 67, 0.12));
  border-radius: var(--radius-pill);
}

.reset-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.8rem;
}
</style>
