import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type NavPosition = 'top' | 'bottom';

const DESKTOP_KEY = 'reisotor-nav-position-desktop';
const MOBILE_KEY = 'reisotor-nav-position-mobile';

function loadPosition(key: string): NavPosition {
  const stored = localStorage.getItem(key);
  return stored === 'bottom' ? 'bottom' : 'top';
}

// Geräte-/Browser-UI-Einstellung (wie der Dark-Mode-Toggle in stores/theme.ts) statt Account-Daten:
// wird bewusst nur lokal in localStorage gehalten, nicht am User-Datensatz im Backend.
export const useNavPositionStore = defineStore('navPosition', () => {
  const desktop = ref<NavPosition>(loadPosition(DESKTOP_KEY));
  const mobile = ref<NavPosition>(loadPosition(MOBILE_KEY));

  watch(desktop, (v) => localStorage.setItem(DESKTOP_KEY, v));
  watch(mobile, (v) => localStorage.setItem(MOBILE_KEY, v));

  return { desktop, mobile };
});
