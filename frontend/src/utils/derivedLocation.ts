import type { IconDef } from './icon';

// Ein "abgeleiteter Ort": ein Reise-Etappen-Ende ohne verknüpften Spot (Freitext-Von/Nach ohne
// Wiederverwendung eines bestehenden Orts, siehe travelDerivedLocations.ts), das noch Koordinaten
// braucht, um als Pin auf TripMap.vue zu erscheinen.
export interface DerivedLocation {
  key: string;
  title: string;
  icon: string;
  /** Tabler-Pendant zu icon, für TripMap.vue's Kartenmarker (siehe utils/icon.ts). */
  tabler: IconDef;
  category: string;
  maps_link: string | null;
  lat: number;
  lng: number;
}
