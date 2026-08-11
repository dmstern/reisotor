import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const SHOW_ACTIVITY_TOASTS_KEY = 'reisotor-show-activity-toasts';
const SHOW_VACATION_COUNTDOWN_KEY = 'reisotor-show-vacation-countdown';

function loadShowActivityToasts(): boolean {
  // Kein gespeicherter Wert -> Standard AN (bisheriges Verhalten unverändert für alle, die die
  // Einstellung noch nie angefasst haben).
  const stored = localStorage.getItem(SHOW_ACTIVITY_TOASTS_KEY);
  return stored === null ? true : stored === 'true';
}

// Kein gespeicherter Wert -> Standard AUS (statischer Hinweis statt Resttage-Countdown während des
// Urlaubs, siehe DashboardView.vue/utils/departureCountdown.ts's computeVacationPhase()).
function loadShowVacationCountdown(): boolean {
  return localStorage.getItem(SHOW_VACATION_COUNTDOWN_KEY) === 'true';
}

// Geräte-/Browser-UI-Einstellung (wie stores/mapOrientation.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten. showActivityToasts schaltet components/LoadingIndicator.vue's
// kurzlebige "Lädt…/Speichert…"-Toast-Meldungen an/aus - für alle, denen die häufigen kurzen
// Meldungen zu hektisch/zu viel Info sind, ohne die dauerhaften Header-Hinweise (Offline/
// PWA-Update) zu berühren. showVacationCountdown schaltet DashboardView.vue's Urlaubs-Hinweis
// während des laufenden Urlaubs zwischen einem festen Text und einem Resttage-Countdown um.
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showActivityToasts = ref(loadShowActivityToasts());
  const showVacationCountdown = ref(loadShowVacationCountdown());

  watch(showActivityToasts, (v) => localStorage.setItem(SHOW_ACTIVITY_TOASTS_KEY, String(v)));
  watch(showVacationCountdown, (v) => localStorage.setItem(SHOW_VACATION_COUNTDOWN_KEY, String(v)));

  return { showActivityToasts, showVacationCountdown };
});
