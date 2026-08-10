import { type Ref, ref, watch } from 'vue';

// Verallgemeinert das bisher an mehreren Stellen einzeln nachgebaute Muster (z. B.
// stores/navPosition.ts, TodoView.vues LAST_ASSIGNEE_KEY): ein Ref, das
// seinen Startwert aus localStorage lädt und bei jeder Änderung dorthin zurückschreibt. Gedacht für
// Geräte-/Browser-UI-Präferenzen (zuletzt gewählter Formularwert, Sortierung/Gruppierung/Filter
// einer Liste) statt Account-Daten - bewusst nur lokal, kein Sync über Geräte hinweg.
export function usePersistedRef<T>(key: string, defaultValue: T): Ref<T> {
  const value = ref(loadInitial(key, defaultValue)) as Ref<T>;

  watch(
    value,
    (v) => {
      localStorage.setItem(key, JSON.stringify(v));
    },
    { flush: 'sync' },
  );

  return value;
}

function loadInitial<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key);
  if (stored == null) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}
