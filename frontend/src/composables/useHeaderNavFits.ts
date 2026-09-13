import { onUnmounted, ref } from 'vue';

// Reaktive Erkennung, ob der Viewport breit genug ist (≥1024px), um die Hauptnavigation
// im Header neben dem TripSwitcher anzudocken, ohne mit Brand-Logo oder Avataren zu kollidieren.
// Auf schmaleren Bildschirmen (<1024px) schaltet die App automatisch auf die daumenfreundliche
// schwebende Leiste am unteren Bildschirmrand um.
export function useHeaderNavFits() {
  if (typeof window === 'undefined') return ref(true);
  const query = window.matchMedia('(min-width: 1024px)');
  const fits = ref(query.matches);
  function onChange(event: MediaQueryListEvent) {
    fits.value = event.matches;
  }
  query.addEventListener('change', onChange);
  onUnmounted(() => query.removeEventListener('change', onChange));
  return fits;
}
