import { reactive } from 'vue';

// 60 Sekunden Rückgängig-Fenster nach jedem Löschen (siehe CLAUDE.md-Auftrag) – das serverseitige
// Löschen ist zu diesem Zeitpunkt bereits ein weicher Löschvorgang (deleted_at, siehe
// routes/trash.ts), dieses Fenster steuert nur, wie lange die betroffene Karte/Zeile im UI noch als
// "Gelöscht · Löschen rückgängig machen"-Platzhalter an genau der Stelle stehen bleibt, an der das
// Objekt vorher war (siehe UndoDeleteRow.vue), bevor sie endgültig aus der lokalen Liste verschwindet.
const UNDO_WINDOW_MS = 60_000;

/** Pro View einmal aufgerufen (nicht global/Singleton) – jede Liste (Spots, ToDos, Notizen, …)
 *  verwaltet ihr eigenes Undo-Fenster unabhängig von allen anderen. */
export function useUndoableDelete() {
  const pendingTimeouts = reactive(new Map<number, number>());

  function isPending(id: number): boolean {
    return pendingTimeouts.has(id);
  }

  function clearPending(id: number) {
    const timeoutId = pendingTimeouts.get(id);
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      pendingTimeouts.delete(id);
    }
  }

  /** Serverseitig ist das Objekt zu diesem Zeitpunkt schon gelöscht – onExpire() entfernt es nach
   *  Ablauf des Undo-Fensters endgültig aus der lokalen Liste (rein clientseitige Aufräumarbeit). */
  function markPendingDelete(id: number, onExpire: () => void) {
    clearPending(id);
    const timeoutId = window.setTimeout(() => {
      pendingTimeouts.delete(id);
      onExpire();
    }, UNDO_WINDOW_MS);
    pendingTimeouts.set(id, timeoutId);
  }

  return { isPending, markPendingDelete, clearPending };
}
