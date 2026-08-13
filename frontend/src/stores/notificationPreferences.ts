import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import {
  matchingLevel,
  NOTIFICATION_LEVEL_PRESETS,
  type NotificationDomain,
  type NotificationLevel,
  type NotificationPreferences,
} from '../utils/notificationPreferences';

// Bewusst ein Pinia-Store statt localStorage (anders als navConfig.ts/uiSettings.ts): die
// Filterung passiert serverseitig beim Push-Versand (backend/src/push.ts), der Zustand gilt pro
// Account statt pro Gerät/Browser.
export const useNotificationPreferencesStore = defineStore('notificationPreferences', () => {
  const preferences = ref<NotificationPreferences | null>(null);
  const loading = ref(false);
  const error = ref('');

  const currentLevel = computed<NotificationLevel | null>(() =>
    preferences.value ? matchingLevel(preferences.value) : null,
  );

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      preferences.value = await api.get<NotificationPreferences>('/push/preferences');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Präferenzen konnten nicht geladen werden';
    } finally {
      loading.value = false;
    }
  }

  async function update(partial: Partial<Record<NotificationDomain, boolean>>) {
    error.value = '';
    const previous = preferences.value;
    if (previous) preferences.value = { ...previous, ...partial };
    try {
      preferences.value = await api.put<NotificationPreferences>('/push/preferences', partial);
    } catch (err) {
      preferences.value = previous;
      error.value = err instanceof Error ? err.message : 'Präferenzen konnten nicht gespeichert werden';
    }
  }

  async function applyLevel(level: NotificationLevel) {
    await update(NOTIFICATION_LEVEL_PRESETS[level]);
  }

  return { preferences, loading, error, currentLevel, load, update, applyLevel };
});
