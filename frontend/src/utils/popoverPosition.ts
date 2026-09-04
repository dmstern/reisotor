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
  /** Optionaler Viewport-Override (z. B. für SSR oder Tests) */
  viewport?: { width: number; height: number };
}

export interface RectLike {
  left: number;
  right?: number;
  top: number;
  bottom: number;
  width?: number;
  height?: number;
}

/**
 * Berechnet top- und left-Koordinaten für ein absolut/fixed über Teleport gerendertes Popover-Menü.
 * Verhindert das Herausragen aus dem Viewport und klappt bei Platzmangel nach oben um.
 */
export function computePopoverPosition(
  trigger: HTMLElement | RectLike,
  options: PopoverPositionOptions = {}
): { top: string; left: string } {
  const rect =
    typeof HTMLElement !== 'undefined' && trigger instanceof HTMLElement
      ? trigger.getBoundingClientRect()
      : (trigger as RectLike);
  const menuWidth = options.menuWidth ?? 216;
  const menuHeight = options.menuHeight ?? 120;
  const offset = options.offset ?? 6;
  const padding = options.viewportPadding ?? 8;
  const placement = options.placement ?? 'auto';

  const viewportWidth =
    options.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const viewportHeight =
    options.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

  // Horizontale Platzierung: links am Button ausrichten, aber an Viewport-Grenzen klemmen
  const left = Math.max(padding, Math.min(rect.left, viewportWidth - menuWidth - padding));

  // Vertikaler verbleibender Raum
  const spaceBelow = viewportHeight - rect.bottom - offset - padding;
  const spaceAbove = rect.top - offset - padding;

  let top: number;
  if (placement === 'top') {
    top = rect.top - offset - menuHeight;
  } else if (placement === 'bottom') {
    top = rect.bottom + offset;
  } else {
    // 'auto': unten bevorzugen, außer unten reicht der Platz nicht und oben ist mehr Raum frei
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      top = rect.top - offset - menuHeight;
    } else {
      top = rect.bottom + offset;
    }
  }

  // Sicherheits-Klemmen an Viewport-Grenzen (oben und unten)
  top = Math.max(padding, Math.min(top, viewportHeight - menuHeight - padding));

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}
