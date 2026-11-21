import {
  ref,
  onMounted,
  onUnmounted,
  nextTick,
  getCurrentInstance,
  watch,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

const DEFAULT_SCROLL_RATIO = 0.7;
const DEFAULT_TOLERANCE_PX = 1;

export interface UseScrollArrowsOptions {
  /** Fraction of clientWidth to scroll per click. Defaults to 0.7 (70%). */
  scrollRatio?: MaybeRefOrGetter<number>;
  /** Tolerance threshold in pixels when checking scroll bounds. Defaults to 1. */
  tolerance?: number;
}

export function useScrollArrows(
  containerRef: Ref<HTMLElement | null>,
  options: UseScrollArrowsOptions = {}
) {
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);

  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_PX;

  function updateScrollArrows() {
    const el = containerRef.value;

    if (!el) {
      canScrollLeft.value = false;
      canScrollRight.value = false;
      return;
    }

    canScrollLeft.value = el.scrollLeft > tolerance;
    canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance;
  }

  function scrollBy(direction: 1 | -1) {
    const el = containerRef.value;

    if (!el) {
      return;
    }

    const scrollRatio = toValue(options.scrollRatio) ?? DEFAULT_SCROLL_RATIO;
    const distance = direction * Math.round(el.clientWidth * scrollRatio);
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof el.scrollBy === 'function') {
      el.scrollBy({
        left: distance,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    } else {
      el.scrollLeft += distance;
    }
  }

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  function attachObservers(el: HTMLElement) {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => {
        updateScrollArrows();
      });
      resizeObserver.observe(el);

      for (const child of el.children) {
        resizeObserver.observe(child);
      }
    }

    if (typeof MutationObserver === 'undefined') {
      return;
    }

    mutationObserver?.disconnect();
    mutationObserver = new MutationObserver(() => {
      updateScrollArrows();

      if (resizeObserver && containerRef.value) {
        for (const child of containerRef.value.children) {
          resizeObserver.observe(child);
        }
      }
    });
    mutationObserver.observe(el, { childList: true, subtree: true });
  }

  function detachObservers() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    mutationObserver?.disconnect();
    mutationObserver = null;
  }

  if (getCurrentInstance()) {
    watch(containerRef, (newEl, oldEl) => {
      if (oldEl) {
        detachObservers();
      }

      if (newEl) {
        attachObservers(newEl);
      }

      nextTick(updateScrollArrows);
    });

    onMounted(() => {
      if (containerRef.value) {
        attachObservers(containerRef.value);
      }

      nextTick(updateScrollArrows);

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', updateScrollArrows, { passive: true });
      }
    });

    onUnmounted(() => {
      detachObservers();

      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScrollArrows);
      }
    });
  }

  return {
    canScrollLeft,
    canScrollRight,
    updateScrollArrows,
    scrollBy,
  };
}
