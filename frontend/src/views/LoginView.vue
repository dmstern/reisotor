<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ApiError } from '../api/client';

const auth = useAuthStore();
const router = useRouter();

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
    <form class="card login-card" @submit.prevent="onSubmit">
      <h1>Reisotor</h1>
      <p>Melde dich an, um eure Reise zu planen.</p>

      <label>
        Benutzername
        <input v-model="username" type="text" autocomplete="username" required />
      </label>

      <label>
        Passwort
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">{{ loading ? 'Anmelden…' : 'Anmelden' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, #eaf3f1, var(--color-bg) 60%);
}

.login-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.login-card h1 {
  color: var(--color-primary-dark);
}

label {
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
