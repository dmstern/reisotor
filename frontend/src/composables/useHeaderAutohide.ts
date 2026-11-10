import { ref, onMounted, onUnmounted, watch, getCurrentInstance, type Ref } from 'vue';
import { useRoute } from 'vue-router';

export const DEFAULT_SCROLL_DOWN_THRESHOLD_PX = 15;
export const DEFAULT_SCROLL_UP_THRESHOLD_PX = 6;
export const DEFAULT_TOP_REVEAL_THRESHOLD_PX = 50;

export interface UseHeaderAutohideOptions {
  /** Referenz auf das Header-Element zur Prüfung auf :focus-within oder [aria-expanded="true"] */
  headerElement?: Ref<HTMLElement | null>;
  /** Reaktiver Boolean, ob Desktop-Ansicht aktiv ist (Autohide nur auf Mobile aktiv) */
  isDesktop?: Ref<boolean>;
  /** Scroll-Delta nach unten, ab dem der Header versteckt wird */
  scrollDownThreshold?: number;
  /** Scroll-Delta nach oben, ab dem der Header wieder eingeblendet wird */
  scrollUpThreshold?: number;
  /** Scroll-Position von oben, unterhalb derer der Header immer sichtbar bleibt */
  topRevealThreshold?: number;
}

/**
 * Autohide-Scrollverhalten für den mobilen App-Header (Issue / Feature):
 * - Beim Runterscrollen wird der Header sanft nach oben weggescrollt.
 * - Beim leichten Hochscrollen oder am oberen Bildschirmrand wird er sofort wieder eingeblendet.
 * - Auf Desktop oder wenn ein Dropdown/Fokus im Header aktiv ist, bleibt er dauerhaft sichtbar.
 */
export function useHeaderAutohide(options: UseHeaderAutohideOptions = {}) {
  const {
    headerElement,
    isDesktop,
    scrollDownThreshold = DEFAULT_SCROLL_DOWN_THRESHOLD_PX,
    scrollUpThreshold = DEFAULT_SCROLL_UP_THRESHOLD_PX,
    topRevealThreshold = DEFAULT_TOP_REVEAL_THRESHOLD_PX,
  } = options;

  const isHidden = ref(false);
  let lastScrollY = 0;
  let accumulatedDown = 0;
  let accumulatedUp = 0;
  let ticking = false;

  function isInteractive(): boolean {
    const element = headerElement?.value;

    if (!element) {
      return false;
    }

    if (element.matches?.(':focus-within')) {
      return true;
    }

    if (element.querySelector?.('[aria-expanded="true"]') !== null) {
      return true;
    }

    return false;
  }

  function reveal(): void {
    isHidden.value = false;
    accumulatedDown = 0;
    accumulatedUp = 0;
  }

  function updateScroll(currentScrollY: number): void {
    if (isDesktop?.value) {
      if (isHidden.value) {
        isHidden.value = false;
      }

      accumulatedDown = 0;
      accumulatedUp = 0;
      lastScrollY = currentScrollY;

      return;
    }

    // Am oberen Bildschirmrand bleibt der Header immer sichtbar
    if (currentScrollY <= topRevealThreshold) {
      isHidden.value = false;
      accumulatedDown = 0;
      accumulatedUp = 0;
      lastScrollY = currentScrollY;

      return;
    }

    // iOS Rubber-Banding am unteren Bildschirmrand ignorieren
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      if (currentScrollY > maxScrollY) {
        return;
      }
    }

    const scrollDelta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    if (scrollDelta > 0) {
      // Runterscrollen
      accumulatedUp = 0;
      accumulatedDown += scrollDelta;

      if (accumulatedDown >= scrollDownThreshold) {
        if (!isInteractive()) {
          isHidden.value = true;
        }
      }
    } else if (scrollDelta < 0) {
      // Hochscrollen
      accumulatedDown = 0;
      accumulatedUp += Math.abs(scrollDelta);

      if (accumulatedUp >= scrollUpThreshold) {
        isHidden.value = false;
      }
    }
  }

  function onScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (ticking) {
      return;
    }

    ticking = true;

    window.requestAnimationFrame(() => {
      ticking = false;
      const currentScrollY = Math.max(0, window.scrollY);
      updateScroll(currentScrollY);
    });
  }

  function onFocusIn(): void {
    reveal();
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (typeof window !== 'undefined') {
        lastScrollY = Math.max(0, window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
      }

      if (headerElement?.value) {
        headerElement.value.addEventListener('focusin', onFocusIn);
      }
    });

    onUnmounted(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }

      if (headerElement?.value) {
        headerElement.value.removeEventListener('focusin', onFocusIn);
      }
    });

    try {
      const route = useRoute();

      if (route) {
        watch(
          () => route.fullPath,
          () => {
            reveal();

            if (typeof window !== 'undefined') {
              lastScrollY = Math.max(0, window.scrollY);
            }
          }
        );
      }
    } catch {
      // In isolierten Komponenten-Tests ohne Router ignorieren
    }
  }

  if (isDesktop) {
    watch(isDesktop, (desktopActive) => {
      if (desktopActive) {
        reveal();
      }
    });
  }

  return {
    isHidden,
    reveal,
    updateScroll,
  };
}
