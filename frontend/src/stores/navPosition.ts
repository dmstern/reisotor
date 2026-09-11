import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type NavPosition = 'top' | 'bottom';

const DESKTOP_KEY = 'reisotor-nav-position-desktop';

function loadPosition(key: string, defaultValue: NavPosition): NavPosition {
  const stored = localStorage.getItem(key);
  if (stored === 'top' || stored === 'bottom') return stored;
  return defaultValue;
}

// Geräte-/Browser-UI-Einstellung (wie der Dark-Mode-Toggle in stores/theme.ts) statt Account-Daten:
// wird bewusst nur lokal in localStorage gehalten, nicht am User-Datensatz im Backend.
export const useNavPositionStore = defineStore('navPosition', () => {
  // Auf Desktop kann die Leiste wahlweise im Header ('top') oder schwebend unten ('bottom') sein.
  // Auf Mobile ist sie stets am unteren Rand ('bottom', daumenfreundlich wie bei nativen Apps).
  const desktop = ref<NavPosition>(loadPosition(DESKTOP_KEY, 'top'));
  const mobile = ref<NavPosition>('bottom');

  watch(desktop, (v) => localStorage.setItem(DESKTOP_KEY, v));

  return { desktop, mobile };
});
