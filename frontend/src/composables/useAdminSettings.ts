import { ref } from 'vue';
import { api } from '../api/client';
import type { AdminSettings, UpdateAdminSettingsPayload } from '../api/types';

export function useAdminSettings() {
  const settings = ref<AdminSettings | null>(null);
  const loading = ref(false);
  const savingSection = ref<string | null>(null);
  const saveSuccess = ref<Record<string, boolean>>({});
  const errorMessage = ref<string | null>(null);
  const generatingVapid = ref(false);

  async function loadSettings(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
      const res = await api.get<{ settings: AdminSettings }>('/admin/settings');
      settings.value = res.settings;
    } catch (err: unknown) {
      errorMessage.value =
        (err as { message?: string }).message || 'Fehler beim Laden der Systemeinstellungen';
    } finally {
      loading.value = false;
    }
  }

  async function saveSection(
    sectionKey: keyof UpdateAdminSettingsPayload,
    payload: UpdateAdminSettingsPayload
  ): Promise<boolean> {
    savingSection.value = sectionKey;
    errorMessage.value = null;
    try {
      const res = await api.put<{ settings: AdminSettings }>('/admin/settings', payload);
      settings.value = res.settings;
      saveSuccess.value[sectionKey] = true;
      setTimeout(() => {
        saveSuccess.value[sectionKey] = false;
      }, 3000);
      return true;
    } catch (err: unknown) {
      errorMessage.value =
        (err as { message?: string }).message || 'Fehler beim Speichern der Einstellungen';
      return false;
    } finally {
      savingSection.value = null;
    }
  }

  async function generateVapidKeys(subject?: string): Promise<boolean> {
    generatingVapid.value = true;
    errorMessage.value = null;
    try {
      const res = await api.post<{ publicKey: string; isPrivateKeySet: boolean }>(
        '/admin/settings/vapid-generate',
        { subject }
      );
      if (settings.value) {
        settings.value.push.vapidPublicKey = res.publicKey;
        settings.value.push.isVapidPrivateKeySet = res.isPrivateKeySet;
        if (subject) {
          settings.value.push.vapidSubject = subject;
        }
      }
      saveSuccess.value['push'] = true;
      setTimeout(() => {
        saveSuccess.value['push'] = false;
      }, 3000);
      return true;
    } catch (err: unknown) {
      errorMessage.value =
        (err as { message?: string }).message || 'Fehler beim Generieren der Push-Schlüssel';
      return false;
    } finally {
      generatingVapid.value = false;
    }
  }

  return {
    settings,
    loading,
    savingSection,
    saveSuccess,
    errorMessage,
    generatingVapid,
    loadSettings,
    saveSection,
    generateVapidKeys,
  };
}
