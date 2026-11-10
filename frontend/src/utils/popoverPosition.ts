const DEFAULT_MENU_WIDTH_PX = 216;
const DEFAULT_MENU_HEIGHT_PX = 120;
const DEFAULT_OFFSET_PX = 6;
const DEFAULT_VIEWPORT_PADDING_PX = 8;
const FALLBACK_VIEWPORT_WIDTH_PX = 1024;
const FALLBACK_VIEWPORT_HEIGHT_PX = 768;
const MIN_VIEWPORT_MAX_HEIGHT_PX = 120;

export interface PopoverPositionOptions {
  /** Breite des Popover-Menüs für die Randprüfung. Standard: 216 */
  menuWidth?: number;
  /** Geschätzte oder tatsächlich gemessene Höhe des Menüs. Standard: 120 */
  menuHeight?: number;
  /** Abstand in Pixeln zum Trigger-Element. Standard: 6 */
  offset?: number;
  /** Mindestabstand zu den Rändern des sichtbaren Browserfensters. Standard: 8 */
  viewportPadding?: number;
  /** Bevorzugte Platzierung ('bottom' | 'top' | 'auto'). Standard: 'auto' */
  placement?: 'bottom' | 'top' | 'auto';
  /** Horizontale Ausrichtung zum Trigger-Element ('left' | 'right'). Standard: 'left' */
  align?: 'left' | 'right';
  /** Optionaler Viewport-Override (z. B. für SSR oder Tests) */
  viewport?: { width: number; height: number };
}

export interface PopoverPositionResult {
  top: string;
  left: string;
  maxHeight: string;
}

export interface RectLike {
  left: number;
  right?: number;
  top: number;
  bottom: number;
  width?: number;
  height?: number;
}

export interface ObservePopoverPositionConfig extends PopoverPositionOptions {
  getTrigger: () => HTMLElement | null;
  getMenu: () => HTMLElement | null;
  onUpdate: (coords: PopoverPositionResult) => void;
}

function resolveViewport(override?: { width: number; height: number }): {
  width: number;
  height: number;
} {
  if (override) {
    return override;
  }

  if (typeof window !== 'undefined') {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  return { width: FALLBACK_VIEWPORT_WIDTH_PX, height: FALLBACK_VIEWPORT_HEIGHT_PX };
}

function resolveVerticalTop(params: {
  rect: RectLike;
  placement: 'bottom' | 'top' | 'auto';
  offset: number;
  padding: number;
  viewportHeight: number;
  effectiveMenuHeight: number;
}): number {
  const { rect, placement, offset, padding, viewportHeight, effectiveMenuHeight } = params;
  const spaceBelow = viewportHeight - rect.bottom - offset - padding;
  const spaceAbove = rect.top - offset - padding;

  if (placement === 'top') {
    return rect.top - offset - effectiveMenuHeight;
  }

  if (placement === 'bottom') {
    return rect.bottom + offset;
  }

  if (
    spaceBelow < effectiveMenuHeight &&
    spaceAbove >= effectiveMenuHeight &&
    spaceAbove > spaceBelow
  ) {
    // 'auto': nach oben umklappen, wenn unten der Platz nicht reicht, das Menü aber oben komplett hinpasst
    return rect.top - offset - effectiveMenuHeight;
  }

  return rect.bottom + offset;
}

/**
 * Berechnet top-, left- und maxHeight-Werte für ein absolut/fixed über Teleport gerendertes Popover-Menü.
 * Verhindert das Herausragen aus dem Viewport, klappt kompakte Menüs bei Platzmangel nach oben um
 * und schiebt große Menüs automatisch nach oben, sobald der untere Rand aus dem sichtbaren Bereich ragt.
 */
export function computePopoverPosition(
  trigger: HTMLElement | RectLike,
  options: PopoverPositionOptions = {}
): PopoverPositionResult {
  const rect =
    typeof (trigger as HTMLElement).getBoundingClientRect === 'function'
      ? (trigger as HTMLElement).getBoundingClientRect()
      : (trigger as RectLike);
  const menuWidth = options.menuWidth ?? DEFAULT_MENU_WIDTH_PX;
  const rawMenuHeight = options.menuHeight ?? DEFAULT_MENU_HEIGHT_PX;
  const offset = options.offset ?? DEFAULT_OFFSET_PX;
  const padding = options.viewportPadding ?? DEFAULT_VIEWPORT_PADDING_PX;
  const placement = options.placement ?? 'auto';
  const align = options.align ?? 'left';

  const { width: viewportWidth, height: viewportHeight } = resolveViewport(options.viewport);
  const maxAvailableHeight = Math.max(MIN_VIEWPORT_MAX_HEIGHT_PX, viewportHeight - padding * 2);
  const effectiveMenuHeight = Math.min(rawMenuHeight, maxAvailableHeight);

  // Horizontale Platzierung: links oder rechts am Button ausrichten, aber an Viewport-Grenzen klemmen
  const rawTargetLeft =
    align === 'right' ? (rect.right ?? rect.left + (rect.width ?? 0)) - menuWidth : rect.left;
  const left = Math.max(padding, Math.min(rawTargetLeft, viewportWidth - menuWidth - padding));

  const rawTop = resolveVerticalTop({
    rect,
    placement,
    offset,
    padding,
    viewportHeight,
    effectiveMenuHeight,
  });

  // Sicherheits-Klemmen an Viewport-Grenzen: Schiebt das Menü nach oben, wenn der untere Rand überläuft
  const top = Math.max(padding, Math.min(rawTop, viewportHeight - effectiveMenuHeight - padding));

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: `${Math.round(maxAvailableHeight)}px`,
  };
}

/**
 * Beobachtet Trigger und geöffnetes Popover-Menü (via ResizeObserver sowie Scroll-/Resize-Events)
 * und führt die Position bei Größenänderungen (z. B. Auf-/Zuklappen von Sektionen) automatisch nach.
 */
export function observePopoverPosition(config: ObservePopoverPositionConfig): () => void {
  let resizeObserver: ResizeObserver | null = null;
  let observedMenuEl: HTMLElement | null = null;

  const update = () => {
    const triggerEl = config.getTrigger();

    if (!triggerEl || typeof triggerEl.getBoundingClientRect !== 'function') {
      return;
    }

    const menuEl = config.getMenu();

    if (menuEl && menuEl !== observedMenuEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => update());
      resizeObserver.observe(menuEl);
      observedMenuEl = menuEl;
    }

    const menuRect =
      menuEl && typeof menuEl.getBoundingClientRect === 'function'
        ? menuEl.getBoundingClientRect()
        : null;
    const measuredWidth =
      menuRect && menuRect.width > 0 ? Math.round(menuRect.width) : config.menuWidth;
    const measuredHeight =
      menuRect && menuRect.height > 0 ? Math.round(menuRect.height) : config.menuHeight;

    const coords = computePopoverPosition(triggerEl, {
      ...config,
      menuWidth: measuredWidth,
      menuHeight: measuredHeight,
    });

    config.onUpdate(coords);
  };

  update();

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true, capture: true });
  }

  return () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    observedMenuEl = null;

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
    }
  };
}
