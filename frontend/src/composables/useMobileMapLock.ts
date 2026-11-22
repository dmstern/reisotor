import { ref, type Ref } from 'vue';
import type leaflet from 'leaflet';
import { BREAKPOINTS } from '../tokens/breakpoints';

/** Leaflet-Gesten, die auf Mobile beim vertikalen Scrollen versehentlich ausgelöst werden. */
const LOCKABLE_HANDLERS = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom'] as const;

interface MobileMapLockOptions {
  getMap: () => leaflet.Map | null;
  containerEl: Ref<HTMLElement | null>;
}

/**
 * Sperrt eine Leaflet-Karte auf schmalen Containern als reine Vorschau, damit beim Scrollen
 * nicht versehentlich gezoomt/verschoben wird. Per `toggleExpanded` lässt sie sich bewusst freigeben.
 */
export function useMobileMapLock(options: MobileMapLockOptions) {
  const isExpanded = ref(false);

  function isMobileLayout(): boolean {
    const width = options.containerEl.value?.clientWidth;

    if (width && width > 0) {
      return width <= BREAKPOINTS.tabletSm;
    }

    return typeof window !== 'undefined' && window.innerWidth <= BREAKPOINTS.tabletSm;
  }

  function syncInteractivity(): void {
    const map = options.getMap();

    if (!map) {
      return;
    }

    const isMobile = isMobileLayout();

    if (!isMobile) {
      isExpanded.value = false;
    }

    const isLocked = isMobile && !isExpanded.value;

    for (const handler of LOCKABLE_HANDLERS) {
      if (isLocked) {
        map[handler]?.disable?.();
      } else {
        map[handler]?.enable?.();
      }
    }
  }

  function toggleExpanded(): void {
    isExpanded.value = !isExpanded.value;
    syncInteractivity();
  }

  return { isExpanded, isMobileLayout, syncInteractivity, toggleExpanded };
}
