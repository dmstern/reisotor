import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import {
  matchingLevel,
  NOTIFICATION_LEVEL_PRESETS,
  type NotificationLevel,
  type NotificationPreferences,
} from '../utils/notificationPreferences';

// Bewusst ein Pinia-Store statt localStorage (anders als navConfig.ts/uiSettings.ts): die
// Filterung passiert serverseitig beim Push-Versand (backend/src/push.ts), der Zustand gilt pro
// Account statt pro Gerät/Browser.
export const useNotificationPreferencesStore = defineStore('notificationPreferences', () => {
  const preferences = ref<NotificationPreferences | null>(null);
  const emailPreferences = ref<Record<string, boolean> | null>(null);
  const loading = ref(false);
  const error = ref('');
  const emailError = ref('');

  const currentLevel = computed<NotificationLevel | null>(() =>
    preferences.value ? matchingLevel(preferences.value) : null
  );

  async function load() {
    loading.value = true;
    error.value = '';
    emailError.value = '';
    try {
      const [pushPrefs, mailPrefs] = await Promise.all([
        api.get<NotificationPreferences>('/push/preferences'),
        api.get<Record<string, boolean>>('/notifications/email-preferences').catch(() => null),
      ]);
      preferences.value = pushPrefs;
      if (mailPrefs) emailPreferences.value = mailPrefs;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Präferenzen konnten nicht geladen werden';
    } finally {
      loading.value = false;
    }
  }

  async function update(partial: Partial<NotificationPreferences>) {
    error.value = '';
    const previous = preferences.value;
    if (previous) preferences.value = { ...previous, ...partial };
    try {
      preferences.value = await api.put<NotificationPreferences>('/push/preferences', partial);
    } catch (err) {
      preferences.value = previous;
      error.value =
        err instanceof Error ? err.message : 'Präferenzen konnten nicht gespeichert werden';
    }
  }

  async function updateEmail(partial: Partial<Record<string, boolean>>) {
    emailError.value = '';
    const previous = emailPreferences.value;
    if (previous) {
      const merged = { ...previous };
      for (const [k, v] of Object.entries(partial)) {
        if (v !== undefined) merged[k] = v;
      }
      emailPreferences.value = merged;
    }
    try {
      emailPreferences.value = await api.put<Record<string, boolean>>(
        '/notifications/email-preferences',
        partial
      );
    } catch (err) {
      emailPreferences.value = previous;
      emailError.value =
        err instanceof Error ? err.message : 'E-Mail-Präferenzen konnten nicht gespeichert werden';
    }
  }

  async function applyLevel(level: NotificationLevel) {
    await update(NOTIFICATION_LEVEL_PRESETS[level]);
  }

  return {
    preferences,
    emailPreferences,
    loading,
    error,
    emailError,
    currentLevel,
    load,
    update,
    updateEmail,
    applyLevel,
  };
});
