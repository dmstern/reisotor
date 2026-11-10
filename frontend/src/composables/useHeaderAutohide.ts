import { ref, onMounted, onUnmounted, watch, getCurrentInstance, type Ref } from 'vue';
import { useRoute } from 'vue-router';

export const DEFAULT_HEADER_HEIGHT_PX = 56;
export const DEFAULT_SCROLL_DOWN_THRESHOLD_PX = 15;
export const DEFAULT_SCROLL_UP_THRESHOLD_PX = 8;
export const TOP_SCROLL_REST_EPSILON_PX = 2;

export interface UseHeaderAutohideOptions {
  /** Referenz auf das Header-Element zur dynamischen Höhenmessung und Prüfung auf :focus-within oder [aria-expanded="true"] */
  headerElement?: Ref<HTMLElement | null>;
  /** Reaktiver Boolean, ob Desktop-Ansicht aktiv ist (Autohide nur auf Mobile aktiv) */
  isDesktop?: Ref<boolean>;
  /** Feste Fallback-Höhe in Pixeln für den Header */
  headerHeight?: number;
  /** Scroll-Delta nach unten, ab dem der Header versteckt wird (im abgerollten Zustand) */
  scrollDownThreshold?: number;
  /** Scroll-Delta nach oben, ab dem der Header wieder eingeblendet wird */
  scrollUpThreshold?: number;
  /** Toleranzbereich in Pixeln am oberen Rand für den Ruhezustand */
  topRestEpsilon?: number;
}

/**
 * Autohide-Scrollverhalten für den mobilen App-Header (Issue #738 Refinement):
 * - Beim Runterscrollen vom oberen Rand scrollt der Header zunächst 1:1 mit dem Inhalt mit
 *   (über die Dynamic Island / Notch hinweg), bis er hinter dem oberen Bildschirmrand verschwunden ist.
 * - Jenseits der Kopfzeile wird er beim weiteren Runterscrollen weggesteckt und gleitet beim
 *   Hochscrollen sanft und weich (CSS-Transition 0.35s) wieder ins Bild.
 * - Auf Desktop oder wenn ein Dropdown/Fokus im Header aktiv ist, bleibt er dauerhaft sichtbar.
 */
export function useHeaderAutohide(options: UseHeaderAutohideOptions = {}) {
  const {
    headerElement,
    isDesktop,
    headerHeight,
    scrollDownThreshold = DEFAULT_SCROLL_DOWN_THRESHOLD_PX,
    scrollUpThreshold = DEFAULT_SCROLL_UP_THRESHOLD_PX,
    topRestEpsilon = TOP_SCROLL_REST_EPSILON_PX,
  } = options;

  const isHidden = ref(false);
  const isScrollingTop = ref(false);
  const topScrollOffset = ref(0);

  let isAtTop = true;
  let lastScrollY = 0;
  let accumulatedDown = 0;
  let accumulatedUp = 0;
  let ticking = false;

  function getHeaderHeight(): number {
    const element = headerElement?.value;

    if (element) {
      const rect = element.getBoundingClientRect();

      if (rect.height > 0) {
        return rect.height;
      }
    }

    return headerHeight ?? DEFAULT_HEADER_HEIGHT_PX;
  }

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
    isScrollingTop.value = false;
    topScrollOffset.value = 0;
    accumulatedDown = 0;
    accumulatedUp = 0;
  }

  function handleScrollPastHeader(scrollDelta: number): void {
    if (scrollDelta > 0) {
      accumulatedUp = 0;
      accumulatedDown += scrollDelta;

      if (accumulatedDown >= scrollDownThreshold) {
        isHidden.value = true;
      }
    } else if (scrollDelta < 0) {
      accumulatedDown = 0;
      accumulatedUp += Math.abs(scrollDelta);

      if (accumulatedUp >= scrollUpThreshold) {
        isHidden.value = false;
      }
    }
  }

  function handleInitialTopScroll(currentScrollY: number, effectiveHeaderHeight: number): void {
    if (currentScrollY < effectiveHeaderHeight) {
      isAtTop = false;
      isScrollingTop.value = true;
      topScrollOffset.value = currentScrollY;
      isHidden.value = false;
      accumulatedDown = 0;
      accumulatedUp = 0;

      return;
    }

    isAtTop = false;
    isScrollingTop.value = false;
    topScrollOffset.value = 0;
    isHidden.value = true;
    accumulatedDown = 0;
    accumulatedUp = 0;
  }

  function updateScroll(currentScrollY: number): void {
    if (isDesktop?.value) {
      if (isHidden.value || isScrollingTop.value || topScrollOffset.value > 0) {
        reveal();
      }

      lastScrollY = currentScrollY;

      return;
    }

    if (isInteractive()) {
      reveal();
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

    // 1. Ganz oben am Seitenanfang: Ruhezustand (Header voll sichtbar)
    if (currentScrollY <= topRestEpsilon) {
      isAtTop = true;
      isScrollingTop.value = false;
      topScrollOffset.value = 0;
      isHidden.value = false;
      accumulatedDown = 0;
      accumulatedUp = 0;

      return;
    }

    const effectiveHeaderHeight = getHeaderHeight();

    // 2. Initiales Mitscrollen beim Start am Seitenanfang:
    // Wenn der Nutzer vom oberen Rand nach unten scrollt, wandert der Header 1:1 mit dem Seiteninhalt
    // nach oben über die Dynamic Island / Notch, bis er hinter dem oberen Bildschirmrand verschwunden ist.
    if (isAtTop || isScrollingTop.value) {
      handleInitialTopScroll(currentScrollY, effectiveHeaderHeight);

      return;
    }

    // 3. Autohide jenseits der Kopfzeile im normalen Seiteninhalt:
    // Sanftes Ein- und Ausblenden über CSS-Transitionen je nach Scroll-Richtung.
    handleScrollPastHeader(scrollDelta);
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
        const initialScrollY = Math.max(0, window.scrollY);
        lastScrollY = initialScrollY;
        isAtTop = initialScrollY <= topRestEpsilon;
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

            if (typeof window === 'undefined') {
              return;
            }

            const currentY = Math.max(0, window.scrollY);
            lastScrollY = currentY;
            isAtTop = currentY <= topRestEpsilon;
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
    isScrollingTop,
    topScrollOffset,
    reveal,
    updateScroll,
  };
}
