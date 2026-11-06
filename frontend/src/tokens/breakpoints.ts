/**
 * Breakpoint Tokens (Issue #575)
 *
 * Single Source of Truth für responsive Viewport- und Container-Schwellenwerte in TypeScript.
 * Korrespondiert 1:1 mit den SCSS-Mixins & Variablen in `src/styles/breakpoints.scss`
 * sowie den CSS Custom Properties in `src/style.css`.
 */

export const BREAKPOINTS = {
  /** 360px - Ultra-schmale Mobilgeräte & kompakte Kartenkacheln */
  mobileCompact: 360,
  /** 420px - Schmale Container, Card-Header & Drawer-Kompaktmodus */
  mobileSm: 420,
  /** 480px - Standard Mobil-Grenze (Karten vertikal, Modals/Sheets 100% Breite) */
  mobile: 480,
  /** 600px - Breites Smartphone / kleines Tablet, Dialoge schalten auf schwebend */
  tabletSm: 600,
  /** 700px - Tablet & Kalenderwoche (Schaltet auf volle 7-Tage-Ansicht) */
  tablet: 700,
  /** 800px - Frühere Desktop-Grenze & Formular-/Modal-Breiten */
  desktopSm: 800,
  /** 900px - Breite Tabellen & Grids (Todo-, Pack- & Einkaufslisten) */
  desktopMd: 900,
  /** 1024px - App-weite Haupt-Desktop-Grenze (Header, feste Drawers, Desktop-Split) */
  desktop: 1024,
  /** 1400px - Maximale Standard-Inhaltsbreite der Seite (.page) */
  pageMax: 1400,
  /** 2200px - WQHD Ultra-Wide Skalierung (Page-Breite 1600px) */
  wqhd: 2200,
  /** 3200px - 4K Ultra-Wide Skalierung (Page-Breite 1920px) */
  ultraWide: 3200,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export const BREAKPOINTS_PX = {
  mobileCompact: `${BREAKPOINTS.mobileCompact}px`,
  mobileSm: `${BREAKPOINTS.mobileSm}px`,
  mobile: `${BREAKPOINTS.mobile}px`,
  tabletSm: `${BREAKPOINTS.tabletSm}px`,
  tablet: `${BREAKPOINTS.tablet}px`,
  desktopSm: `${BREAKPOINTS.desktopSm}px`,
  desktopMd: `${BREAKPOINTS.desktopMd}px`,
  desktop: `${BREAKPOINTS.desktop}px`,
  pageMax: `${BREAKPOINTS.pageMax}px`,
  wqhd: `${BREAKPOINTS.wqhd}px`,
  ultraWide: `${BREAKPOINTS.ultraWide}px`,
} as const;

/** Media-Query Strings für window.matchMedia */
export const MEDIA_QUERIES = {
  mobileCompact: `(max-width: ${BREAKPOINTS.mobileCompact}px)`,
  mobileSm: `(max-width: ${BREAKPOINTS.mobileSm}px)`,
  mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
  tabletSm: `(max-width: ${BREAKPOINTS.tabletSm}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tablet}px)`,
  desktopSm: `(min-width: ${BREAKPOINTS.desktopSm}px)`,
  desktopMd: `(min-width: ${BREAKPOINTS.desktopMd}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  pageMax: `(min-width: ${BREAKPOINTS.pageMax}px)`,
  wqhd: `(min-width: ${BREAKPOINTS.wqhd}px)`,
  ultraWide: `(min-width: ${BREAKPOINTS.ultraWide}px)`,
} as const;
