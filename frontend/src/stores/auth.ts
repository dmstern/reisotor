import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

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

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    user.value = null;
  }

  return { user, checked, checkSession, login, logout };
});
