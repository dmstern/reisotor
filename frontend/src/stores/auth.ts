import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { useIconStyleStore } from './iconStyle';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const checked = ref(false);

  async function checkSession(): Promise<boolean> {
    try {
      user.value = await api.get<User>('/auth/me');
      return true;
    } catch {
      user.value = null;
      return false;
    } finally {
      checked.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    user.value = await api.post<User>('/auth/login', { username, password });
  }

  // Selbstregistrierung auf der Login-Seite (LoginView.vue) – loggt wie login() direkt ein, statt
  // einen separaten zweiten Schritt zu verlangen (siehe routes/auth.ts's /register).
  async function register(username: string, email: string, password: string): Promise<void> {
    user.value = await api.post<User>('/auth/register', { username, email, password });
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    user.value = null;
    // Gemeinsam genutztes Gerät (App ist ursprünglich für zwei Personen pro Haushalt gebaut):
    // Icon-Einstellungen der abgemeldeten Person dürfen nicht bis zum nächsten Login stehen bleiben.
    useIconStyleStore().clearOnLogout();
  }

  function clearMustChangePassword(): void {
    if (user.value) {
      user.value = { ...user.value, must_change_password: false };
    }
  }

  return { user, checked, checkSession, login, register, logout, clearMustChangePassword };
});
