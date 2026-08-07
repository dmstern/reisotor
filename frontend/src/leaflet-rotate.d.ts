// leaflet-rotate (TripMap.vue) patcht L.Map zur Laufzeit per L.Class.include() statt eigene
// TypeScript-Typen mitzuliefern - @types/leaflet kennt die neuen Optionen/Methoden entsprechend
// nicht. Modul-Augmentation statt eigener Wrapper-Typen, damit der Rest des Codes ganz normal mit
// dem bereits importierten `L`/`Map`-Typ aus 'leaflet' weiterarbeiten kann.
import 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    rotateControl?: boolean | Record<string, unknown>;
    touchRotate?: boolean;
  }

  interface Map {
    setBearing(theta: number): void;
    getBearing(): number;
  }
}
