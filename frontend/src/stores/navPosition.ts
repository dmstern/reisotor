import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type NavPosition = 'top' | 'bottom';

const DESKTOP_KEY = 'reisotor-nav-position-desktop';
const MOBILE_KEY = 'reisotor-nav-position-mobile';

function loadPosition(key: string, defaultValue: NavPosition): NavPosition {
  const stored = localStorage.getItem(key);
  if (stored === 'top' || stored === 'bottom') return stored;
  return defaultValue;
}

// Geräte-/Browser-UI-Einstellung (wie der Dark-Mode-Toggle in stores/theme.ts) statt Account-Daten:
// wird bewusst nur lokal in localStorage gehalten, nicht am User-Datensatz im Backend.
export const useNavPositionStore = defineStore('navPosition', () => {
  // Unterschiedliche Defaults: auf Desktop ist eine oben fixierte NavBar etabliert, auf Mobile ist
  // unten (Daumen-Reichweite, wie bei nativen Apps) die sinnvollere Grundeinstellung.
  const desktop = ref<NavPosition>(loadPosition(DESKTOP_KEY, 'top'));
  const mobile = ref<NavPosition>(loadPosition(MOBILE_KEY, 'bottom'));

  watch(desktop, (v) => localStorage.setItem(DESKTOP_KEY, v));
  watch(mobile, (v) => localStorage.setItem(MOBILE_KEY, v));

  return { desktop, mobile };
});
