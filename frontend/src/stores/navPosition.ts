import { defineStore } from 'pinia';
import { ref } from 'vue';

export type NavPosition = 'top' | 'bottom';

const LEGACY_DESKTOP_KEY = 'reisotor-nav-position-desktop';

export const DEFAULT_DESKTOP_NAV_POSITION: NavPosition = 'top';

// Navigations-Position:
// Auf Desktop ist die Leiste fest im Header verankert ('top' - Floating Island). Das verhindert
// Kollisionen mit schwebenden Elementen am unteren Bildschirmrand (Kalender-Drawer, Spots-Drawer, Day-Strip).
// Auf Mobile/schmalen Screens ist sie stets am unteren Rand ('bottom', daumenfreundlich wie native Apps).
export const useNavPositionStore = defineStore('navPosition', () => {
  // Alten localStorage-Key bereinigen, falls vorhanden
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_DESKTOP_KEY);
  }

  const desktop = ref<NavPosition>('top');
  const mobile = ref<NavPosition>('bottom');

  function reset() {
    desktop.value = DEFAULT_DESKTOP_NAV_POSITION;
    mobile.value = 'bottom';
  }

  return { desktop, mobile, reset };
});
