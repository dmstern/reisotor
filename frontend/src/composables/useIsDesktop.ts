import { onUnmounted, ref } from 'vue';
import { BREAKPOINTS } from '../tokens/breakpoints';

// Reaktive Desktop/Mobil-Erkennung anhand des einen app-weiten Breakpoints (1024px, siehe u. a.
// NavBar.vue/Drawer.vue/style.css) – zentral statt dupliziert, da inzwischen mehrere Stellen
// (App.vue, NavBar.vue) zur Laufzeit wissen müssen, ob gerade Desktop- oder Mobil-Darstellung
// aktiv ist (z. B. um Kalender/Touren dort als Schublade vs. eigenständige Seite zu rendern).
export function useIsDesktop() {
  const query = window.matchMedia(`(min-width: ${BREAKPOINTS.desktop}px)`);
  const isDesktop = ref(query.matches);
  function onChange(event: MediaQueryListEvent) {
    isDesktop.value = event.matches;
  }
  query.addEventListener('change', onChange);
  onUnmounted(() => query.removeEventListener('change', onChange));
  return isDesktop;
}
