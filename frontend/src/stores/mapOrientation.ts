import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const MAP_ORIENTATION_KEY = 'reisotor-map-orientation';

export type MapOrientationMode = 'north' | 'heading';

function loadMode(): MapOrientationMode {
  return localStorage.getItem(MAP_ORIENTATION_KEY) === 'heading' ? 'heading' : 'north';
}

// Geräte-/Browser-UI-Einstellung (wie stores/uiSettings.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten. Steuert TripMap.vue's Kartenausrichtung (siehe dortiger
// toggleMapOrientation()) - "north": die Karte bleibt nordorientiert (0° Rotation), unabhängig vom
// Kompass; "heading": die Karte dreht sich laufend mit der Blickrichtung (Kompass-Heading) mit,
// sodass "oben" immer der aktuellen Guckrichtung entspricht. Nur die MODUS-Präferenz wird
// gespeichert - die tatsächliche Kartendrehung selbst (z. B. nach einer manuellen
// Zwei-Finger-Drehgeste im "north"-Modus) ist reiner Ansichtszustand und bleibt bewusst
// unpersistiert, genau wie Zoom/Zentrum der Karte auch.
export const useMapOrientationStore = defineStore('mapOrientation', () => {
  const mode = ref<MapOrientationMode>(loadMode());

  watch(mode, (v) => localStorage.setItem(MAP_ORIENTATION_KEY, v));

  function toggle() {
    mode.value = mode.value === 'north' ? 'heading' : 'north';
  }

  return { mode, toggle };
});
