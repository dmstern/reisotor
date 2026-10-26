<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import ReisotorRobot from '../components/ReisotorRobot.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import AppFooterLinks from '../components/AppFooterLinks.vue';
import Button from '../components/primitives/Button.vue';
import AppIcon from '../components/AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const success = ref(false);
const error = ref('');

const landingUrl = __LANDING_URL__;

onMounted(async () => {
  const token = (route.query.token as string | undefined)?.trim();
  if (!token) {
    loading.value = false;
    error.value = 'In diesem Link fehlt der Bestätigungs-Token.';
    return;
  }

  try {
    await api.post('/auth/verify-email', { token });
    success.value = true;
  } catch (err) {
    error.value =
      err instanceof ApiError ? err.message : 'Die E-Mail-Adresse konnte nicht bestätigt werden.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="verify-page">
    <ThemeModeSelect variant="icon" class="theme-toggle" />
    <div class="card verify-card">
      <ReisotorRobot size="140px" class="logo" />
      <h1>Reisotor</h1>

      <div v-if="loading" class="state-container">
        <h2>E-Mail wird bestätigt…</h2>
        <p class="description">Bitte einen kurzen Moment Geduld.</p>
      </div>

      <div v-else-if="success" class="state-container">
        <div class="success-icon-wrapper">
          <AppIcon :icon="ACTION_ICONS.done" :size="32" group="actions" />
        </div>
        <h2>E-Mail-Adresse bestätigt!</h2>
        <p class="description">
          Vielen Dank! Dein Konto ist nun verifiziert und du kannst dich anmelden.
        </p>
        <Button variant="primary" class="action-btn" @click="router.push('/login')">
          Jetzt anmelden
        </Button>
      </div>

      <div v-else class="state-container">
        <h2>Bestätigung fehlgeschlagen</h2>
        <p class="description error-text">{{ error }}</p>
        <Button variant="secondary" class="action-btn" @click="router.push('/login')">
          Zurück zur Anmeldung
        </Button>
      </div>
    </div>

    <footer class="verify-footer">
      <AppFooterLinks :landing-url="landingUrl" />
    </footer>
  </div>
</template>

<style scoped>
.verify-page {
  position: relative;
  min-height: 100vh;
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
  top: var(--space-4);
  right: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.verify-card {
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

.verify-card h1 {
  color: var(--color-primary-dark);
  margin: 0;
}

.verify-card h2 {
  font-size: 1.15rem;
  margin: 0;
}

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

button {
  width: 100%;
}

.action-btn {
  font-size: 0.85rem;
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

.verify-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.8rem;
}
</style>
