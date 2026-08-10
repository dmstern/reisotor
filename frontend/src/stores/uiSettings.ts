import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const SHOW_ACTIVITY_TOASTS_KEY = 'reisotor-show-activity-toasts';

function loadShowActivityToasts(): boolean {
  // Kein gespeicherter Wert -> Standard AN (bisheriges Verhalten unverändert für alle, die die
  // Einstellung noch nie angefasst haben).
  const stored = localStorage.getItem(SHOW_ACTIVITY_TOASTS_KEY);
  return stored === null ? true : stored === 'true';
}

// Geräte-/Browser-UI-Einstellung (wie stores/mapOrientation.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten. Schaltet components/LoadingIndicator.vue's kurzlebige
// "Lädt…/Speichert…"-Toast-Meldungen an/aus - für alle, denen die häufigen kurzen Meldungen zu
// hektisch/zu viel Info sind, ohne die dauerhaften Header-Hinweise (Offline/PWA-Update) zu berühren.
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showActivityToasts = ref(loadShowActivityToasts());

  watch(showActivityToasts, (v) => localStorage.setItem(SHOW_ACTIVITY_TOASTS_KEY, String(v)));

  return { showActivityToasts };
});
