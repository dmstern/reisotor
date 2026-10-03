import { ref, onMounted, onUnmounted, nextTick, getCurrentInstance, watch, type Ref } from 'vue';

export interface UseScrollFadeOptions {
  /** Toleranz-Schwellenwert in Pixeln für obere/untere Grenze. Standard: 2. */
  tolerance?: number;
}

/**
 * Reusable Composable für vertikale Scroll-Container, das berechnet,
 * ob nach oben (`canScrollUp`) und/oder nach unten (`canScrollDown`)
 * weiter gescrollt werden kann, um Fade-Out-Verläufe einzublenden.
 */
export function useScrollFade(
  containerRef: Ref<HTMLElement | null>,
  options: UseScrollFadeOptions = {}
) {
  const canScrollUp = ref(false);
  const canScrollDown = ref(false);

  const tolerance = options.tolerance ?? 2;

  function updateScrollFade() {
    const el = containerRef.value;
    if (!el) {
      canScrollUp.value = false;
      canScrollDown.value = false;
      return;
    }
    canScrollUp.value = el.scrollTop > tolerance;
    canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - tolerance;
  }

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  function attachObservers(el: HTMLElement) {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => {
        updateScrollFade();
      });
      resizeObserver.observe(el);
      for (const child of el.children) {
        resizeObserver.observe(child);
      }
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver?.disconnect();
      mutationObserver = new MutationObserver(() => {
        updateScrollFade();
        if (resizeObserver && containerRef.value) {
          for (const child of containerRef.value.children) {
            resizeObserver.observe(child);
          }
        }
      });
      mutationObserver.observe(el, { childList: true, subtree: true });
    }
  }

  function detachObservers() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    mutationObserver?.disconnect();
    mutationObserver = null;
  }

  if (getCurrentInstance()) {
    watch(containerRef, (newEl, oldEl) => {
      if (oldEl) detachObservers();
      if (newEl) attachObservers(newEl);
      nextTick(updateScrollFade);
    });

    onMounted(() => {
      if (containerRef.value) {
        attachObservers(containerRef.value);
      }
      nextTick(updateScrollFade);
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', updateScrollFade, { passive: true });
      }
    });

    onUnmounted(() => {
      detachObservers();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScrollFade);
      }
    });
  }

  return {
    canScrollUp,
    canScrollDown,
    updateScrollFade,
  };
}
