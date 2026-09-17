import { ref, onMounted, onUnmounted, nextTick, getCurrentInstance, type Ref } from 'vue';

export interface UseScrollArrowsOptions {
  /** Fraction of clientWidth to scroll per click. Defaults to 0.7 (70%). */
  scrollRatio?: number;
  /** Tolerance threshold in pixels when checking scroll bounds. Defaults to 1. */
  tolerance?: number;
}

export function useScrollArrows(
  containerRef: Ref<HTMLElement | null>,
  options: UseScrollArrowsOptions = {}
) {
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);

  const scrollRatio = options.scrollRatio ?? 0.7;
  const tolerance = options.tolerance ?? 1;

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
    if (!el) return;
    const distance = direction * Math.round(el.clientWidth * scrollRatio);
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({
        left: distance,
        behavior: 'smooth',
      });
    } else {
      el.scrollLeft += distance;
    }
  }

  let resizeObserver: ResizeObserver | null = null;

  if (getCurrentInstance()) {
    onMounted(() => {
      nextTick(updateScrollArrows);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          updateScrollArrows();
        });
        if (containerRef.value) {
          resizeObserver.observe(containerRef.value);
        }
      }
    });

    onUnmounted(() => {
      resizeObserver?.disconnect();
    });
  }

  return {
    canScrollLeft,
    canScrollRight,
    updateScrollArrows,
    scrollBy,
  };
}
