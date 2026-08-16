<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ApiError } from '../api/client';
import PasswordInput from '../components/PasswordInput.vue';
import ReisotorRobot from '../components/ReisotorRobot.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';

const auth = useAuthStore();
const router = useRouter();

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const email = ref('');
const password = ref('');
const passwordVisible = ref(false);
const error = ref('');
const loading = ref(false);

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  error.value = '';
}

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'register') {
      await auth.register(username.value, email.value, password.value);
    } else {
      await auth.login(username.value, password.value);
    }
    router.push('/');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : mode.value === 'register' ? 'Registrierung fehlgeschlagen' : 'Login fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <ThemeModeSelect variant="icon" class="theme-toggle" />
    <form class="card login-card" @submit.prevent="onSubmit">
      <ReisotorRobot :covering-eyes="passwordVisible" size="140px" class="logo" />
      <h1>Reisotor</h1>
      <p>{{ mode === 'register' ? 'Erstelle ein Konto, um euren Urlaub zu planen.' : 'Melde dich an, um euren Urlaub zu planen.' }}</p>

      <label>
        Benutzername
        <input v-model="username" type="text" autocomplete="username" required />
      </label>

      <label v-if="mode === 'register'">
        E-Mail-Adresse
        <input v-model="email" type="email" autocomplete="email" required />
      </label>

      <div class="field">
        <label for="login-password">Passwort</label>
        <PasswordInput
          id="login-password"
          v-model="password"
          v-model:visible="passwordVisible"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          required
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? (mode === 'register' ? 'Registrieren…' : 'Anmelden…') : mode === 'register' ? 'Registrieren' : 'Anmelden' }}
      </button>

      <button type="button" class="secondary mode-toggle" @click="toggleMode">
        {{ mode === 'register' ? 'Schon registriert? Anmelden' : 'Noch kein Konto? Registrieren' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  gap: 1rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
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

.mode-toggle {
  font-size: 0.85rem;
  font-weight: 400;
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
