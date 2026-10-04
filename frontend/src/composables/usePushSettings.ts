import { computed, ref } from 'vue';
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../utils/push';
import { useNotificationPreferencesStore } from '../stores/notificationPreferences';
import {
  NOTIFICATION_DOMAINS,
  NOTIFICATION_LEVEL_OPTIONS,
  type NotificationLevel,
} from '../utils/notificationPreferences';

export const PUSH_LEVEL_TOGGLE_OPTIONS = [
  { value: 'off', label: 'Aus' },
  ...NOTIFICATION_LEVEL_OPTIONS,
];

export function usePushSettings() {
  const pushSupported = isPushSupported();
  // null = wird noch geprüft, sonst tatsächlicher Abo-Status beim Browser (nicht nur ein lokaler
  // Toggle-Zustand, da das Abo z. B. auch über die Browser-Einstellungen widerrufen worden sein kann).
  const pushEnabled = ref<boolean | null>(null);
  const pushLoading = ref(false);
  const pushError = ref('');
  const showPushDetails = ref(false);
  const notificationPrefs = useNotificationPreferencesStore();

  // Segmented-Control-Wert: 'off' bei fehlendem Abo, sonst die Stufe, die exakt zu den aktuellen
  // Einzel-Präferenzen passt - passt keine der drei Presets (individuell angepasst), matched nichts
  // in PUSH_LEVEL_TOGGLE_OPTIONS und die Toggle zeigt bewusst keinen aktiven Zustand.
  const pushLevelValue = computed(() =>
    pushEnabled.value ? (notificationPrefs.currentLevel ?? 'custom') : 'off'
  );

  /** Bei "Aus" wird komplett abbestellt; bei jeder anderen Stufe wird (falls noch nicht geschehen)
   *  zuerst abonniert und danach die zugehörige Preset-Kombination aus Einzel-Präferenzen gesetzt -
   *  ein frisches Abo landet so direkt bei "Ausgewogen" statt ungefiltert bei "Alles". */
  async function selectPushLevel(level: string) {
    pushError.value = '';
    pushLoading.value = true;
    try {
      if (level === 'off') {
        await unsubscribeFromPush();
        pushEnabled.value = false;
      } else {
        if (!pushEnabled.value) {
          await subscribeToPush();
          pushEnabled.value = true;
        }
        await notificationPrefs.applyLevel(level as NotificationLevel);
      }
    } catch (err) {
      pushError.value =
        err instanceof Error
          ? err.message
          : 'Push-Benachrichtigungen konnten nicht geändert werden';
    } finally {
      pushLoading.value = false;
    }
  }

  async function setDomainPreference(
    domain: (typeof NOTIFICATION_DOMAINS)[number],
    enabled: boolean
  ) {
    await notificationPrefs.update({ [domain]: enabled });
  }

  const isPushDefault = computed(() => {
    if (!pushEnabled.value) return true;
    return pushLevelValue.value === 'balanced';
  });

  async function resetPush() {
    if (pushEnabled.value) {
      await selectPushLevel('balanced');
    }
  }

  async function initPushSubscription() {
    if (!pushSupported) return;
    try {
      const sub = await getExistingSubscription();
      pushEnabled.value = !!sub;
      if (pushEnabled.value) {
        await notificationPrefs.load();
      }
    } catch {
      // Ignoriere Fehler bei der initialen Abfrage
    }
  }

  return {
    pushSupported,
    pushEnabled,
    pushLoading,
    pushError,
    showPushDetails,
    notificationPrefs,
    pushLevelValue,
    pushLevelOptions: PUSH_LEVEL_TOGGLE_OPTIONS,
    isPushDefault,
    selectPushLevel,
    setDomainPreference,
    resetPush,
    initPushSubscription,
  };
}
