// Ein "abgeleiteter Ort": ein Standort, der bereits anderswo (Unterkunft, Reise-Start-/Zielort)
// mit Koordinaten hinterlegt ist, aber noch kein eigener Spot ist. Wird in mehreren Komponenten
// gebraucht (ExcursionsView.vue erzeugt sie, ExcursionCard.vue/SpotOrderPicker.vue nehmen sie als
// Drop-/Auswahl-Ziel entgegen), daher als gemeinsamer Typ statt mehrfach inline dupliziert.
export interface DerivedLocation {
  key: string;
  title: string;
  icon: string;
  category: string;
  maps_link: string | null;
  lat: number;
  lng: number;
}
