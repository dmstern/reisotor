import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const ADVANCED_EDITING_KEY = 'reisotor-tour-advanced-editing';

function loadAdvancedEditing(): boolean {
  return localStorage.getItem(ADVANCED_EDITING_KEY) === 'true';
}

// Geräte-/Browser-UI-Einstellung (wie stores/calendarSettings.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten, Default aus (einfacher Tagging-Modus). Schaltet zwischen zwei
// UI-Modi um, die sich dasselbe Datenmodell teilen (siehe Migrationskommentar in db/index.ts):
// - aus (Standard): Touren werden per "Tour zuordnen"-Auswahl direkt im Spot-Formular getaggt
//   (ExcursionsView.vue), ohne Reihenfolge-Pflege.
// - an ("Erweiterte Touren-Bearbeitung"): das Touren-Formular (ExcursionsDrawer.vue) zeigt
//   zusätzlich den Drag&Drop-Reihenfolge-Editor (SpotOrderPicker.vue, unterstützt Mehrfachbesuch)
//   und Spots lassen sich per Drag&Drop direkt auf eine Tour-Karte ziehen (ExcursionCard.vue).
export const useTourSettingsStore = defineStore('tourSettings', () => {
  const advancedEditing = ref(loadAdvancedEditing());

  watch(advancedEditing, (v) => localStorage.setItem(ADVANCED_EDITING_KEY, String(v)));

  return { advancedEditing };
});
