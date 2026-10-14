import {
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  ref,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from 'vue';
import { isImage, type AttachmentPreviewItem } from '../utils/attachment';

const STACK_ANGLES = [-2, 6, -7, 8];
const STACK_X_OFFSETS = [0, 4, -5, 6];
const STACK_Y_OFFSETS = [0, -1, 2, 1];

export interface UseThumbnailStackAnimationOptions {
  rootRef: Ref<HTMLElement | null>;
  isFanned: WritableComputedRef<boolean> | Ref<boolean>;
  items: ComputedRef<AttachmentPreviewItem[]> | Ref<AttachmentPreviewItem[]>;
}

export function useThumbnailStackAnimation(options: UseThumbnailStackAnimationOptions) {
  const { rootRef, isFanned, items } = options;

  const isCollapsing = ref(false);
  let activeAnimTimeout: number | null = null;
  let cachedTileOffsets: { centerX: number; centerY: number; width: number }[] = [];
  let cachedStackedHeight = 78;

  function clearActiveAnimation() {
    if (activeAnimTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(activeAnimTimeout);
      activeAnimTimeout = null;
    }
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      clearActiveAnimation();
    });
  }

  function isReducedMotion(): boolean {
    if (typeof window === 'undefined') return true;
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function expandToFanned() {
    if (isFanned.value && !isCollapsing.value) return;
    clearActiveAnimation();

    if (isReducedMotion() || !rootRef.value) {
      isCollapsing.value = false;
      isFanned.value = true;
      return;
    }

    // 1. Positionen der Kacheln im gestapelten Zustand erfassen (relativ zum Container)
    const stackTiles = rootRef.value.querySelectorAll<HTMLElement>(
      '.thumbnails-stacked-container .polaroid-tile'
    );
    const rootRectBefore = rootRef.value.getBoundingClientRect();
    const tileOffsets = Array.from(stackTiles).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        centerX: r.left + r.width / 2 - rootRectBefore.left,
        centerY: r.top + r.height / 2 - rootRectBefore.top,
        width: r.width,
      };
    });
    const initialHeight = rootRectBefore.height;
    if (tileOffsets.length > 0) {
      cachedTileOffsets = tileOffsets;
    }
    if (initialHeight > 0) {
      cachedStackedHeight = initialHeight;
    }

    // 2. Aufgefächerten Zustand mounten
    isCollapsing.value = false;
    isFanned.value = true;

    await nextTick();
    if (!rootRef.value) return;

    const fannedWraps = rootRef.value.querySelectorAll<HTMLElement>('.fanned-item-wrap');
    const removeThumbs = rootRef.value.querySelectorAll<HTMLElement>('.remove-thumb');
    const headerBar = rootRef.value.querySelector<HTMLElement>('.fanned-header-bar');

    if (!fannedWraps.length || !tileOffsets.length) return;

    const rootRectAfter = rootRef.value.getBoundingClientRect();
    const targetHeight = rootRectAfter.height;

    // 3. FLIP Invert: Kacheln sofort an der relativen Position des Stapels initialisieren
    fannedWraps.forEach((wrap, i) => {
      const tile = tileOffsets[Math.min(i, tileOffsets.length - 1)];
      const cardRect = wrap.getBoundingClientRect();

      const cardCenterX = cardRect.left + cardRect.width / 2 - rootRectAfter.left;
      const cardCenterY = cardRect.top + cardRect.height / 2 - rootRectAfter.top;

      const dx = tile.centerX - cardCenterX;
      const dy = tile.centerY - cardCenterY;
      const scale = tile.width / (cardRect.width || 1);
      const stackRot = STACK_ANGLES[Math.min(i, STACK_ANGLES.length - 1)] || 0;

      wrap.style.transformOrigin = 'center center';
      wrap.style.transition = 'none';
      wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${stackRot}deg) scale(${scale})`;
      wrap.style.zIndex = String(fannedWraps.length - i);
      if (i >= tileOffsets.length) {
        wrap.style.opacity = '0';
      }
    });

    removeThumbs.forEach((thumb) => {
      thumb.style.transition = 'none';
      thumb.style.transform = 'scale(0)';
      thumb.style.opacity = '0';
    });

    if (headerBar) {
      headerBar.style.transition = 'none';
      headerBar.style.transform = 'translate3d(0, -8px, 0)';
      headerBar.style.opacity = '0';
    }

    rootRef.value.style.height = `${initialHeight}px`;
    rootRef.value.style.overflow = 'visible';

    // 4. In den nächsten Frames die Animation flüssig starten (FLIP Play)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!rootRef.value) return;

        rootRef.value.style.transition = 'height 0.44s cubic-bezier(0.32, 0.72, 0, 1)';
        rootRef.value.style.height = `${targetHeight}px`;

        if (headerBar) {
          headerBar.style.transition =
            'opacity 0.32s ease, transform 0.35s cubic-bezier(0.34, 1.25, 0.64, 1)';
          headerBar.style.transform = 'translate3d(0, 0, 0)';
          headerBar.style.opacity = '1';
        }

        fannedWraps.forEach((wrap, i) => {
          const delay = i * 32;
          wrap.style.transition = `transform 0.46s cubic-bezier(0.34, 1.25, 0.64, 1) ${delay}ms, opacity 0.32s ease ${delay}ms`;
          wrap.style.transform = `translate3d(0, 0, 0) rotate(var(--item-rot, 0deg)) scale(1)`;
          wrap.style.opacity = '1';
        });

        removeThumbs.forEach((thumb, i) => {
          const delay = 140 + i * 32;
          thumb.style.transition = `transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1) ${delay}ms, opacity 0.22s ease ${delay}ms`;
          thumb.style.transform = 'scale(1)';
          thumb.style.opacity = '1';
        });

        const totalDuration = Math.min(650, (fannedWraps.length - 1) * 32 + 480);
        activeAnimTimeout = window.setTimeout(() => {
          if (rootRef.value) {
            rootRef.value.style.height = '';
            rootRef.value.style.overflow = '';
            rootRef.value.style.transition = '';
          }
          if (headerBar) {
            headerBar.style.transition = '';
            headerBar.style.transform = '';
            headerBar.style.opacity = '';
          }
          fannedWraps.forEach((wrap) => {
            wrap.style.transition = '';
            wrap.style.transform = '';
            wrap.style.opacity = '';
            wrap.style.transformOrigin = '';
            wrap.style.zIndex = '';
          });
          removeThumbs.forEach((thumb) => {
            thumb.style.transition = '';
            thumb.style.transform = '';
            thumb.style.opacity = '';
          });
          activeAnimTimeout = null;
        }, totalDuration);
      });
    });
  }

  function collapseToStacked() {
    if (!isFanned.value || isCollapsing.value) return;
    clearActiveAnimation();

    if (isReducedMotion() || !rootRef.value) {
      isCollapsing.value = false;
      isFanned.value = false;
      return;
    }

    const fannedWraps = rootRef.value.querySelectorAll<HTMLElement>('.fanned-item-wrap');
    const removeThumbs = rootRef.value.querySelectorAll<HTMLElement>('.remove-thumb');
    const headerBar = rootRef.value.querySelector<HTMLElement>('.fanned-header-bar');

    if (!fannedWraps.length) {
      isCollapsing.value = false;
      isFanned.value = false;
      return;
    }

    isCollapsing.value = true;

    const currentRootRect = rootRef.value.getBoundingClientRect();
    const currentHeight = currentRootRect.height;

    rootRef.value.style.height = `${currentHeight}px`;
    rootRef.value.style.overflow = 'visible';
    rootRef.value.style.transition = 'none';

    const baseTileCenterX = cachedTileOffsets[0]?.centerX ?? 33;
    const baseTileCenterY = cachedTileOffsets[0]?.centerY ?? 37;
    const stackedHeight = cachedStackedHeight > 0 ? cachedStackedHeight : 78;

    if (headerBar) {
      headerBar.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      headerBar.style.opacity = '0';
      headerBar.style.transform = 'translate3d(0, -6px, 0)';
    }

    removeThumbs.forEach((thumb) => {
      thumb.style.transition = 'transform 0.16s ease, opacity 0.14s ease';
      thumb.style.transform = 'scale(0)';
      thumb.style.opacity = '0';
    });

    fannedWraps.forEach((wrap, i) => {
      const cardRect = wrap.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2 - currentRootRect.left;
      const cardCenterY = cardRect.top + cardRect.height / 2 - currentRootRect.top;

      const targetCenterX =
        cachedTileOffsets[i]?.centerX ?? baseTileCenterX + (STACK_X_OFFSETS[i % 4] || 0);
      const targetCenterY =
        cachedTileOffsets[i]?.centerY ?? baseTileCenterY + (STACK_Y_OFFSETS[i % 4] || 0);
      const targetRot = STACK_ANGLES[i % 4] || 0;
      const isDoc = !isImage(items.value[i]);
      const targetWidth = cachedTileOffsets[i]?.width ?? (isDoc ? 44 : 52);
      const targetScale = targetWidth / (cardRect.width || 1);

      const dx = targetCenterX - cardCenterX;
      const dy = targetCenterY - cardCenterY;

      const reverseIndex = fannedWraps.length - 1 - i;
      const delay = reverseIndex * 20;

      wrap.style.transformOrigin = 'center center';
      wrap.style.zIndex = String(fannedWraps.length - i);
      wrap.style.transition = `transform 0.32s cubic-bezier(0.25, 1, 0.5, 1) ${delay}ms, opacity 0.26s ease ${delay}ms`;
      wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${targetRot}deg) scale(${targetScale})`;
      if (i >= 4) {
        wrap.style.opacity = '0';
      }
    });

    const flightDuration = Math.min(420, (fannedWraps.length - 1) * 20 + 320);

    activeAnimTimeout = window.setTimeout(() => {
      if (!rootRef.value) {
        isFanned.value = false;
        isCollapsing.value = false;
        return;
      }

      isFanned.value = false;
      isCollapsing.value = false;

      requestAnimationFrame(() => {
        if (!rootRef.value) return;
        rootRef.value.style.transition = 'height 0.26s cubic-bezier(0.32, 0.72, 0, 1)';
        rootRef.value.style.height = `${stackedHeight}px`;

        activeAnimTimeout = window.setTimeout(() => {
          if (rootRef.value) {
            rootRef.value.style.height = '';
            rootRef.value.style.overflow = '';
            rootRef.value.style.transition = '';
          }
          if (headerBar) {
            headerBar.style.transition = '';
            headerBar.style.transform = '';
            headerBar.style.opacity = '';
          }
          fannedWraps.forEach((wrap) => {
            wrap.style.transition = '';
            wrap.style.transform = '';
            wrap.style.opacity = '';
            wrap.style.transformOrigin = '';
            wrap.style.zIndex = '';
          });
          removeThumbs.forEach((thumb) => {
            thumb.style.transition = '';
            thumb.style.transform = '';
            thumb.style.opacity = '';
          });
          activeAnimTimeout = null;
        }, 280);
      });
    }, flightDuration);
  }

  return {
    isCollapsing,
    expandToFanned,
    collapseToStacked,
    clearActiveAnimation,
  };
}
