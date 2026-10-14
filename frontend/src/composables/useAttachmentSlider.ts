import {
  computed,
  getCurrentInstance,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type CSSProperties,
  type Ref,
} from 'vue';
import type { AttachmentPreviewItem } from '../utils/attachment';

export interface VisibleSlide {
  slot: 'prev' | 'current' | 'next';
  item: AttachmentPreviewItem | null;
  ariaHidden: boolean;
}

export interface UseAttachmentSliderOptions {
  items: ComputedRef<AttachmentPreviewItem[]> | Ref<AttachmentPreviewItem[]>;
  initialIndex?: Ref<number> | ComputedRef<number>;
  isOpen: Ref<boolean> | ComputedRef<boolean>;
  onClose?: () => void;
  onIndexChange?: (newIndex: number) => void;
}

export function useAttachmentSlider(options: UseAttachmentSliderOptions) {
  const { items, initialIndex, isOpen, onClose, onIndexChange } = options;

  const currentIndex = ref(initialIndex ? initialIndex.value : 0);

  watch(
    () => (initialIndex ? initialIndex.value : 0),
    (newIdx) => {
      if (newIdx !== undefined && newIdx >= 0 && newIdx < items.value.length) {
        currentIndex.value = newIdx;
      }
    }
  );

  const isDragging = ref(false);
  const isAnimating = ref(false);
  const dragOffset = ref(0);
  const targetOffsetPercent = ref<-200 | -100 | 0>(-100);

  let touchStartX = 0;
  let touchStartY = 0;
  let isHorizontalGesture: boolean | null = null;
  let animationTimer: ReturnType<typeof setTimeout> | null = null;
  let activeMouseUpHandler: (() => void) | null = null;
  let activeMouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  function clearAnimTimer() {
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
  }

  function removeActiveMouseDragListeners() {
    if (activeMouseMoveHandler && typeof window !== 'undefined') {
      window.removeEventListener('mousemove', activeMouseMoveHandler);
      activeMouseMoveHandler = null;
    }
    if (activeMouseUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('mouseup', activeMouseUpHandler);
      activeMouseUpHandler = null;
    }
  }

  function resetAnimationState() {
    clearAnimTimer();
    removeActiveMouseDragListeners();
    isAnimating.value = false;
    isDragging.value = false;
    dragOffset.value = 0;
    targetOffsetPercent.value = -100;
    isHorizontalGesture = null;
  }

  const ANIMATION_DURATION_MS = 280;

  function isReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function slideTowards(direction: 'next' | 'prev' | 'cancel') {
    if (isAnimating.value) return;
    clearAnimTimer();

    const reducedMotion = isReducedMotion();

    if (direction === 'cancel') {
      if (dragOffset.value === 0) return;
      isAnimating.value = true;
      dragOffset.value = 0;
      targetOffsetPercent.value = -100;
      animationTimer = setTimeout(
        () => {
          isAnimating.value = false;
        },
        reducedMotion ? 0 : 220
      );
      return;
    }

    isAnimating.value = true;
    dragOffset.value = 0;
    targetOffsetPercent.value = direction === 'next' ? -200 : 0;

    const duration = reducedMotion ? 0 : ANIMATION_DURATION_MS;

    animationTimer = setTimeout(() => {
      const len = items.value.length;
      if (len > 0) {
        if (direction === 'next') {
          currentIndex.value = (currentIndex.value + 1) % len;
        } else {
          currentIndex.value = (currentIndex.value - 1 + len) % len;
        }
        onIndexChange?.(currentIndex.value);
      }
      targetOffsetPercent.value = -100;
      isAnimating.value = false;
    }, duration);
  }

  function prev() {
    if (items.value.length <= 1 || isAnimating.value) return;
    slideTowards('prev');
  }

  function next() {
    if (items.value.length <= 1 || isAnimating.value) return;
    slideTowards('next');
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isOpen.value || items.value.length <= 1 || isAnimating.value) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  }

  watch(isOpen, (open) => {
    if (open) {
      if (
        initialIndex &&
        initialIndex.value !== undefined &&
        initialIndex.value >= 0 &&
        initialIndex.value < items.value.length
      ) {
        currentIndex.value = initialIndex.value;
      } else {
        currentIndex.value = 0;
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', onKeydown);
      }
    } else {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeydown);
      }
      resetAnimationState();
    }
  });

  watch(
    () => items.value.length,
    (newLen) => {
      resetAnimationState();
      if (newLen === 0) {
        onClose?.();
      } else if (currentIndex.value >= newLen) {
        currentIndex.value = Math.max(0, newLen - 1);
        onIndexChange?.(currentIndex.value);
      }
    }
  );

  if (getCurrentInstance() && typeof window !== 'undefined') {
    onUnmounted(() => {
      window.removeEventListener('keydown', onKeydown);
      resetAnimationState();
    });
  }

  const currentAttachment = computed<AttachmentPreviewItem | null>(
    () => items.value[currentIndex.value] ?? null
  );

  const prevAttachment = computed<AttachmentPreviewItem | null>(() => {
    if (items.value.length <= 1) return null;
    const idx = (currentIndex.value - 1 + items.value.length) % items.value.length;
    return items.value[idx] ?? null;
  });

  const nextAttachment = computed<AttachmentPreviewItem | null>(() => {
    if (items.value.length <= 1) return null;
    const idx = (currentIndex.value + 1) % items.value.length;
    return items.value[idx] ?? null;
  });

  const visibleSlides = computed<VisibleSlide[]>(() => {
    if (items.value.length <= 1) {
      return [
        {
          slot: 'current',
          item: currentAttachment.value,
          ariaHidden: false,
        },
      ];
    }
    return [
      {
        slot: 'prev',
        item: prevAttachment.value,
        ariaHidden: true,
      },
      {
        slot: 'current',
        item: currentAttachment.value,
        ariaHidden: false,
      },
      {
        slot: 'next',
        item: nextAttachment.value,
        ariaHidden: true,
      },
    ];
  });

  const trackStyle = computed<CSSProperties>(() => {
    if (items.value.length <= 1) {
      return {
        transform: 'none',
        transition: 'none',
      };
    }

    if (isDragging.value) {
      return {
        transform: `translateX(calc(-100% + ${dragOffset.value}px))`,
        transition: 'none',
      };
    }

    if (isAnimating.value) {
      return {
        transform: `translateX(calc(${targetOffsetPercent.value}% + 0px))`,
        transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      };
    }

    return {
      transform: 'translateX(calc(-100% + 0px))',
      transition: 'none',
    };
  });

  function onTouchStart(e: TouchEvent) {
    if (items.value.length <= 1 || isAnimating.value) return;
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isHorizontalGesture = null;
    dragOffset.value = 0;
    isDragging.value = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging.value || isAnimating.value) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

    if (isHorizontalGesture === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > 6 || absY > 6) {
        if (absX > absY) {
          isHorizontalGesture = true;
        } else {
          isHorizontalGesture = false;
          isDragging.value = false;
          return;
        }
      } else {
        return;
      }
    }

    if (isHorizontalGesture) {
      if (e.cancelable) {
        e.preventDefault();
      }
      dragOffset.value = deltaX;
    }
  }

  function onTouchEnd() {
    if (!isDragging.value) return;
    isDragging.value = false;

    if (isHorizontalGesture) {
      const SWIPE_THRESHOLD = 45;
      if (dragOffset.value < -SWIPE_THRESHOLD) {
        slideTowards('next');
      } else if (dragOffset.value > SWIPE_THRESHOLD) {
        slideTowards('prev');
      } else {
        slideTowards('cancel');
      }
    } else {
      dragOffset.value = 0;
    }
    isHorizontalGesture = null;
  }

  function onTouchCancel() {
    if (isDragging.value) {
      isDragging.value = false;
      slideTowards('cancel');
    }
    isHorizontalGesture = null;
  }

  function onMouseDown(e: MouseEvent) {
    if (items.value.length <= 1 || isAnimating.value) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

    e.preventDefault();
    removeActiveMouseDragListeners();

    const startX = e.clientX;
    isDragging.value = true;
    dragOffset.value = 0;

    activeMouseMoveHandler = (moveEvent: MouseEvent) => {
      if (!isDragging.value) return;
      dragOffset.value = moveEvent.clientX - startX;
    };

    activeMouseUpHandler = () => {
      removeActiveMouseDragListeners();
      if (!isDragging.value) return;
      isDragging.value = false;

      const SWIPE_THRESHOLD = 50;
      if (dragOffset.value < -SWIPE_THRESHOLD) {
        slideTowards('next');
      } else if (dragOffset.value > SWIPE_THRESHOLD) {
        slideTowards('prev');
      } else {
        slideTowards('cancel');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', activeMouseMoveHandler);
      window.addEventListener('mouseup', activeMouseUpHandler);
    }
  }

  return {
    currentIndex,
    currentAttachment,
    prevAttachment,
    nextAttachment,
    visibleSlides,
    isDragging,
    isAnimating,
    dragOffset,
    trackStyle,
    slideTowards,
    prev,
    next,
    resetAnimationState,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onMouseDown,
    onKeydown,
  };
}
