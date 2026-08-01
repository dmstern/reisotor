<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { ApiError } from '../api/client';
import PasswordInput from '../components/PasswordInput.vue';

const auth = useAuthStore();
const router = useRouter();
const theme = useThemeStore();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push('/');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Login fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <button
      type="button"
      class="secondary theme-toggle"
      :title="theme.isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'"
      :aria-label="theme.isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'"
      @click="theme.toggle"
    >
      {{ theme.isDark ? '☀️' : '🌙' }}
    </button>
    <form class="card login-card" @submit.prevent="onSubmit">
      <img src="/reisotor_logo.svg" alt="Reisotor Logo" class="logo" />
      <h1>Reisotor</h1>
      <p>Melde dich an, um euren Urlaub zu planen.</p>

      <label>
        Benutzername
        <input v-model="username" type="text" autocomplete="username" required />
      </label>

      <div class="field">
        <label for="login-password">Passwort</label>
        <PasswordInput id="login-password" v-model="password" autocomplete="current-password" required />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">{{ loading ? 'Anmelden…' : 'Anmelden' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
}

.theme-toggle {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  font-size: 1.1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}

.logo {
  width: 140px;
  height: 140px;
  margin-bottom: var(--space-1);
}

.login-card h1 {
  color: var(--color-primary-dark);
  margin: 0;
}

.login-card p {
  margin: 0;
}

.login-card label,
.login-card .field {
  width: 100%;
  text-align: left;
}

.login-card button {
  width: 100%;
}

label,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
}

.error {
  color: var(--color-danger);
  margin: 0;
  font-size: 0.9rem;
}
</style>
