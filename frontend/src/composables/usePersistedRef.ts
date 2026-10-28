import { type Ref, ref, watch, toValue, type MaybeRefOrGetter } from 'vue';

// Verallgemeinert das bisher an mehreren Stellen einzeln nachgebaute Muster (z. B.
// stores/navPosition.ts, TodoView.vues LAST_ASSIGNEE_KEY): ein Ref, das
// seinen Startwert aus localStorage lädt und bei jeder Änderung dorthin zurückschreibt. Gedacht für
// Geräte-/Browser-UI-Präferenzen (zuletzt gewählter Formularwert, Sortierung/Gruppierung/Filter
// einer Liste) statt Account-Daten - bewusst nur lokal, kein Sync über Geräte hinweg.
// Unterstützt sowohl statische Keys als auch reaktive Keys / Getter (z. B. trip-spezifische Keys).
export function usePersistedRef<T>(key: MaybeRefOrGetter<string>, defaultValue: T): Ref<T> {
  const currentKey = toValue(key);
  let isInternalUpdate = false;
  const value = ref(currentKey ? loadInitial(currentKey, defaultValue) : defaultValue) as Ref<T>;

  watch(
    () => toValue(key),
    (newKey, oldKey) => {
      if (newKey !== oldKey) {
        isInternalUpdate = true;
        try {
          value.value = newKey ? loadInitial(newKey, defaultValue) : defaultValue;
        } finally {
          isInternalUpdate = false;
        }
      }
    }
  );

  watch(
    value,
    (v) => {
      if (isInternalUpdate) return;
      const k = toValue(key);
      if (k && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch {
          // QuotaExceededError oder Zugriffsbeschränkungen im Browser defensiv abfangen
        }
      }
    },
    { flush: 'sync' }
  );

  return value;
}

function loadInitial<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored == null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}
