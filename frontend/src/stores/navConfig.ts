import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { NAV_LINKS } from '../utils/navLinks';

const STORAGE_KEY = 'reisotor-nav-config';

export interface NavConfigEntry {
  key: string;
  visible: boolean;
}

function defaultEntries(): NavConfigEntry[] {
  return NAV_LINKS.map((l) => ({ key: l.key, visible: true }));
}

function loadEntries(): NavConfigEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  let parsed: NavConfigEntry[] = [];
  if (stored) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = [];
    }
  }
  // Nur bekannte Keys aus dem gespeicherten Zustand übernehmen (Reihenfolge + Sichtbarkeit); Keys,
  // die es beim letzten Speichern noch nicht gab (z. B. ein künftig neu hinzugekommener Nav-Punkt),
  // werden sichtbar ans Ende angehängt - sonst würden neue Bereiche für bestehende Nutzer:innen
  // sofort unsichtbar bleiben, ohne dass sie das je bewusst ausgeblendet hätten.
  const known = new Set(NAV_LINKS.map((l) => l.key));
  const validExisting = parsed.filter((e) => known.has(e.key));
  const existingKeys = new Set(validExisting.map((e) => e.key));
  const missing = NAV_LINKS.filter((l) => !existingKeys.has(l.key)).map((l) => ({
    key: l.key,
    visible: true,
  }));
  return [...validExisting, ...missing];
}

// Geräte-/Browser-UI-Einstellung (wie stores/navPosition.ts/theme.ts) statt Account-Daten - bewusst
// nur lokal in localStorage gehalten.
export const useNavConfigStore = defineStore('navConfig', () => {
  const entries = ref<NavConfigEntry[]>(loadEntries());

  watch(entries, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true });

  function moveUp(key: string) {
    const idx = entries.value.findIndex((e) => e.key === key);
    if (idx <= 0) return;
    const copy = [...entries.value];
    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
    entries.value = copy;
  }

  function moveDown(key: string) {
    const idx = entries.value.findIndex((e) => e.key === key);
    if (idx === -1 || idx >= entries.value.length - 1) return;
    const copy = [...entries.value];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    entries.value = copy;
  }

  function setVisible(key: string, visible: boolean) {
    const entry = entries.value.find((e) => e.key === key);
    if (entry) entry.visible = visible;
  }

  function reset() {
    entries.value = defaultEntries();
  }

  return { entries, moveUp, moveDown, setVisible, reset };
});
