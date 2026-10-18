import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type CSSProperties,
  type Ref,
} from 'vue';

export interface UseAttachmentHeightOptions {
  isOpen: Ref<boolean> | ComputedRef<boolean>;
  slidesCountOrKey: ComputedRef<unknown> | Ref<unknown>;
}

export function useAttachmentHeight(options: UseAttachmentHeightOptions) {
  const { isOpen, slidesCountOrKey } = options;

  const previewContentRef = ref<HTMLElement | null>(null);
  const sliderTrackRef = ref<HTMLElement | null>(null);
  const contentHeight = ref<number | null>(null);
  const isTransitionReady = ref(false);

  const contentStyle = computed<CSSProperties>(() => {
    if (!contentHeight.value) return {};
    return {
      height: `${contentHeight.value}px`,
    };
  });

  function measureSlideHeight(slideEl: HTMLElement): number {
    const img = slideEl.querySelector<HTMLImageElement>('.preview-img');
    if (img) {
      const rect = img.getBoundingClientRect();
      if (rect.height > 0) {
        return rect.height;
      }
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const containerWidth = previewContentRef.value?.clientWidth || 600;
        const maxViewportH = typeof window !== 'undefined' ? window.innerHeight * 0.65 : 500;
        const aspect = img.naturalHeight / img.naturalWidth;
        return Math.min(containerWidth * aspect, maxViewportH);
      }
    }
    const unsupported = slideEl.querySelector<HTMLElement>('.unsupported-wrapper');
    if (unsupported) {
      const rect = unsupported.getBoundingClientRect();
      return rect.height > 0 ? rect.height : 220;
    }
    return 0;
  }

  function updateContentHeight(animate = true) {
    if (!sliderTrackRef.value || !isOpen.value) return;

    const slides = sliderTrackRef.value.querySelectorAll<HTMLElement>('.slider-slide');
    if (!slides.length) return;

    let maxHeight = 0;
    slides.forEach((slide) => {
      const h = measureSlideHeight(slide);
      if (h > maxHeight) {
        maxHeight = h;
      }
    });

    if (maxHeight <= 0) return;

    const targetH = Math.max(200, Math.round(maxHeight));

    if (!animate) {
      isTransitionReady.value = false;
      contentHeight.value = targetH;
      nextTick(() => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            isTransitionReady.value = true;
          });
        } else {
          isTransitionReady.value = true;
        }
      });
    } else {
      isTransitionReady.value = true;
      contentHeight.value = targetH;
    }
  }

  function onImageLoad() {
    updateContentHeight(isTransitionReady.value);
  }

  watch(
    () => slidesCountOrKey.value,
    () => {
      nextTick(() => {
        updateContentHeight(isTransitionReady.value);
      });
    },
    { deep: true }
  );

  let contentResizeObserver: ResizeObserver | null = null;
  let lastObservedWidth = 0;

  if (getCurrentInstance()) {
    onMounted(() => {
      if (typeof ResizeObserver !== 'undefined') {
        contentResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const w = Math.round(entry.contentRect.width);
            if (w > 0 && w !== lastObservedWidth) {
              lastObservedWidth = w;
              updateContentHeight(isTransitionReady.value);
            }
          }
        });
        if (previewContentRef.value) {
          contentResizeObserver.observe(previewContentRef.value);
        }
      }
    });

    onUnmounted(() => {
      if (contentResizeObserver) {
        contentResizeObserver.disconnect();
        contentResizeObserver = null;
      }
    });
  }

  watch(previewContentRef, (el, oldEl) => {
    if (oldEl && contentResizeObserver) {
      contentResizeObserver.unobserve(oldEl);
    }
    if (el && contentResizeObserver) {
      contentResizeObserver.observe(el);
    }
  });

  function resetHeightState() {
    isTransitionReady.value = false;
    contentHeight.value = null;
  }

  return {
    previewContentRef,
    sliderTrackRef,
    contentHeight,
    isTransitionReady,
    contentStyle,
    measureSlideHeight,
    updateContentHeight,
    onImageLoad,
    resetHeightState,
  };
}
