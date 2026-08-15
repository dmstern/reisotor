import type { Component } from 'vue';
import type { IconStyle, IconVariant } from '../stores/iconStyle';

// Ein "Konzept" (App-Bereich, Kategorie, Formularfeld-Zweck, …), das je nach iconStyle-Einstellung
// entweder als Emoji oder als Tabler-Icon dargestellt wird - siehe components/AppIcon.vue für die
// Render-Stelle, stores/iconStyle.ts für die Einstellung selbst. `id` ist der Tabler-Slug
// (kebab-case, identisch zum Dateinamen unter @tabler/icons/icons/{outline,filled}/<id>.svg) -
// genutzt als stabiler Cache-Key in utils/mapRoute.ts, wo Vue-Komponenten/rohe SVG-Strings selbst
// keine sinnvollen Map-Keys wären. `filled` fehlt bewusst für Icons ohne Tabler-Filled-Pendant
// (nicht jedes Outline-Icon hat eins) - resolveIconComponent() fällt dann automatisch auf outline
// zurück.
export interface IconDef {
  id: string;
  emoji: string;
  outline: Component;
  filled?: Component;
}

// Reine, komponentenfreie Auflösungslogik (kein Mounting nötig) - von AppIcon.vue für die
// Vue-Komponenten-Variante genutzt. Der Leaflet-Marker-Pfad (mapRoute.ts/tablerMarkerSvg.ts)
// braucht dieselbe Fallback-Regel für rohe SVG-Strings statt Komponenten und bildet sie dort
// separat nach.
export function resolveIconComponent(def: IconDef, style: IconStyle, variant: IconVariant): Component | null {
  if (style === 'emoji') return null;
  return variant === 'filled' && def.filled ? def.filled : def.outline;
}
