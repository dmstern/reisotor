import type { IconDef } from './icon';

// Ein "abgeleiteter Ort": ein Standort, der bereits anderswo (Unterkunft, Reise-Start-/Zielort)
// mit Koordinaten hinterlegt ist, aber noch kein eigener Spot ist. Wird in mehreren Komponenten
// gebraucht (ExcursionsView.vue erzeugt sie, ExcursionCard.vue/SpotOrderPicker.vue nehmen sie als
// Drop-/Auswahl-Ziel entgegen), daher als gemeinsamer Typ statt mehrfach inline dupliziert.
export interface DerivedLocation {
  key: string;
  title: string;
  icon: string;
  /** Tabler-Pendant zu icon, für TripMap.vue's Kartenmarker (siehe utils/icon.ts) - additiv, damit
   *  Aufrufstellen, die nur icon lesen (z. B. DerivedLocationCard.vue), unverändert funktionieren. */
  tabler: IconDef;
  category: string;
  maps_link: string | null;
  lat: number;
  lng: number;
}
