import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { DASHBOARD_TILES } from '../utils/dashboardTiles';

const STORAGE_KEY = 'reisotor-dashboard-config';

export interface DashboardConfigEntry {
  key: string;
  visible: boolean;
}

function defaultEntries(): DashboardConfigEntry[] {
  return DASHBOARD_TILES.map((t) => ({ key: t.key, visible: true }));
}

function loadEntries(): DashboardConfigEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  let parsed: DashboardConfigEntry[] = [];
  if (stored) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = [];
    }
  }
  // Nur bekannte Keys aus dem gespeicherten Zustand übernehmen (Reihenfolge + Sichtbarkeit); Keys,
  // die es beim letzten Speichern noch nicht gab (z. B. eine künftig neu hinzugekommene Kachel),
  // werden sichtbar ans Ende angehängt - sonst würden neue Kacheln für bestehende Nutzer:innen
  // sofort unsichtbar bleiben, ohne dass sie das je bewusst ausgeblendet hätten. 1:1 dieselbe
  // Reconciliation-Logik wie stores/navConfig.ts.
  const known = new Set(DASHBOARD_TILES.map((t) => t.key));
  const validExisting = parsed.filter((e) => known.has(e.key));
  const existingKeys = new Set(validExisting.map((e) => e.key));
  const missing = DASHBOARD_TILES.filter((t) => !existingKeys.has(t.key)).map((t) => ({
    key: t.key,
    visible: true,
  }));
  return [...validExisting, ...missing];
}

export function sanitizeDashboardEntries(parsed: DashboardConfigEntry[]): DashboardConfigEntry[] {
  const known = new Set(DASHBOARD_TILES.map((t) => t.key));
  const validExisting = parsed.filter((e) => known.has(e.key) && typeof e.visible === 'boolean');
  const existingKeys = new Set(validExisting.map((e) => e.key));
  const missing = DASHBOARD_TILES.filter((t) => !existingKeys.has(t.key)).map((t) => ({
    key: t.key,
    visible: true,
  }));
  return [...validExisting, ...missing];
}

// Account-Einstellung (Issue #324): Persistiert über /users/me/app-settings.
export const useDashboardConfigStore = defineStore('dashboardConfig', () => {
  const entries = ref<DashboardConfigEntry[]>(loadEntries());

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
