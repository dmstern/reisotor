import { ref, watch, toValue, type Ref, type MaybeRefOrGetter } from 'vue';
import { api } from '../api/client';
import { useTripStore } from '../stores/trip';

export type DraftStatus = 'idle' | 'dirty' | 'saved' | 'offline';

interface DraftEntry<T> {
  data: T;
  updated_at: string;
}

const DEBOUNCE_MS = 600;

function storageKey(tripId: number, draftKey: string) {
  return `reisotor-draft:${tripId}:${draftKey}`;
}

function readLocal<T>(key: string): DraftEntry<T> | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftEntry<T>;
  } catch {
    return null;
  }
}

// Generisches Autosave für Create-/Edit-Formulare (Nutzer-Feedback: ungespeicherte Eingaben gehen
// bei einem App-Absturz/versehentlichem Schließen verloren). Persistiert das übergebene
// Formular-Objekt bei jeder Änderung debounced sowohl in localStorage (sofort verfügbar, übersteht
// auch einen kompletten Prozessabsturz ohne jede Netzverbindung) als auch serverseitig über
// PUT/GET/DELETE /drafts - der Server-Request läuft über den normalen api.put()-Wrapper und landet
// bei fehlender Verbindung automatisch in der bestehenden Offline-Outbox (api/offline.ts), kein
// eigener Offline-Mechanismus nötig. Server-Sync ist bewusst best-effort/optional (nur damit ein
// Entwurf auch nach Geräte-/Browserwechsel oder gelöschtem localStorage wiederhergestellt werden
// kann) - localStorage ist die primäre, sofort wirksame Absicherung.
//
// `active` steuert, ob das Formular gerade sichtbar/relevant ist - beim Aktivieren wird zuerst ein
// evtl. vorhandener Entwurf wiederhergestellt (localStorage bevorzugt, Server nur falls dort ein
// NEUERER Stand liegt), danach beginnt die Änderungsbeobachtung. So funktioniert dieselbe Instanz
// für Formulare, die nicht permanent gemountet sind, sondern nur bei v-if="showForm"/
// v-if="editingItem" im DOM erscheinen (siehe Verdrahtung in den *View.vue-Dateien). `draftKey`
// wird erst beim Aktivieren ausgewertet (per toValue()), da er bei Edit-Formularen von der gerade
// bearbeiteten Objekt-id abhängt, die zum selben Zeitpunkt gesetzt wird wie `active`.
export function useDraftAutosave<T extends Record<string, unknown>>(
  draftKey: MaybeRefOrGetter<string>,
  formRef: Ref<T>,
  active: MaybeRefOrGetter<boolean>,
) {
  const status = ref<DraftStatus>('idle');
  const restored = ref(false);
  let baseline = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopFormWatch: (() => void) | null = null;
  let currentKey = '';

  function currentTripId(): number | null {
    return useTripStore().currentTripId;
  }

  async function restoreIfPresent(tripId: number, key: string) {
    let best = readLocal<T>(storageKey(tripId, key));
    try {
      const remote = await api.get<{ draft_key: string; data: T; updated_at: string }[]>(`/drafts?trip_id=${tripId}`);
      const match = remote.find((d) => d.draft_key === key);
      if (match && (!best || match.updated_at > best.updated_at)) best = match;
    } catch {
      // offline/Fehler - lokaler Stand (falls vorhanden) reicht als Fallback.
    }
    if (best) {
      formRef.value = { ...formRef.value, ...best.data };
      restored.value = true;
    }
  }

  function persist(tripId: number, key: string) {
    const now = new Date().toISOString();
    localStorage.setItem(storageKey(tripId, key), JSON.stringify({ data: formRef.value, updated_at: now }));
    api
      .put<{ _pending?: boolean }>('/drafts', { trip_id: tripId, draft_key: key, data: formRef.value })
      .then((res) => {
        status.value = res?._pending ? 'offline' : 'saved';
      })
      .catch(() => {
        status.value = 'offline';
      });
  }

  function clear() {
    const tripId = currentTripId();
    if (tripId != null && currentKey) {
      localStorage.removeItem(storageKey(tripId, currentKey));
      api.delete(`/drafts?trip_id=${tripId}&draft_key=${encodeURIComponent(currentKey)}`).catch(() => {});
    }
    if (timer) clearTimeout(timer);
    status.value = 'idle';
    restored.value = false;
  }

  watch(
    () => toValue(active),
    async (isActive) => {
      stopFormWatch?.();
      stopFormWatch = null;
      if (timer) clearTimeout(timer);

      if (!isActive) {
        status.value = 'idle';
        restored.value = false;
        return;
      }

      currentKey = toValue(draftKey);
      restored.value = false;
      baseline = JSON.stringify(formRef.value);

      const tripId = currentTripId();
      if (tripId != null && currentKey) {
        await restoreIfPresent(tripId, currentKey);
      }
      status.value = JSON.stringify(formRef.value) !== baseline ? 'saved' : 'idle';

      stopFormWatch = watch(
        formRef,
        () => {
          if (JSON.stringify(formRef.value) === baseline) {
            if (timer) clearTimeout(timer);
            status.value = 'idle';
            return;
          }
          status.value = 'dirty';
          if (timer) clearTimeout(timer);
          const tripId2 = currentTripId();
          if (tripId2 == null || !currentKey) return;
          const key = currentKey;
          timer = setTimeout(() => persist(tripId2, key), DEBOUNCE_MS);
        },
        { deep: true },
      );
    },
    { immediate: true },
  );

  return { status, restored, clear };
}
