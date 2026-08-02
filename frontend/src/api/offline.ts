// Offline-Fähigkeit (siehe CLAUDE.md-Auftrag): lokaler Lese-Cache für GET-Antworten + eine
// Warteschlange ("Outbox") für Mutationen, die nicht sofort ans Backend geschickt werden konnten.
// Bewusst localStorage statt IndexedDB – die hier gecachten Datenmengen (JSON einer Reiseplanung)
// sind klein, localStorage ist synchron und braucht keine zusätzliche Abstraktionsebene.

export interface OutboxEntry {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Nur bei POST gesetzt: die client-seitig vergebene, negative Platzhalter-id (siehe nextTempId),
   *  damit spätere Einträge in derselben Warteschlange, die sich auf dasselbe frisch angelegte
   *  Objekt beziehen (z. B. offline erst anlegen, dann bearbeiten), nach dem erfolgreichen
   *  Nachsenden auf die echte Server-id umgeschrieben werden können (siehe remapTempId). */
  tempId?: number;
  createdAt: string;
}

const OUTBOX_KEY = 'reisotor-outbox';
const CACHE_PREFIX = 'reisotor-cache:';

// Endpunkte, die entweder pro Aufruf einen anderen Query-String tragen (Nachhol-Protokoll,
// Autocomplete-Suche) oder ohnehin nur als Echtzeit-Ergänzung dienen – ein Cache-Eintrag pro
// jemals aufgerufener Variante würde localStorage unbegrenzt wachsen lassen, ohne beim Offline-Lesen
// echten Nutzen zu bringen (die jeweilige View verlässt sich für ihre Kernliste ohnehin auf eigene,
// stabile GET-Pfade wie /todos?trip_id=).
const UNCACHEABLE_PREFIXES = ['/trip-activity', '/users/search', '/realtime'];

function isCacheable(path: string): boolean {
  return !UNCACHEABLE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function readCache<T>(path: string): T | undefined {
  if (!isCacheable(path)) return undefined;
  const raw = localStorage.getItem(CACHE_PREFIX + path);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeCache(path: string, data: unknown) {
  if (!isCacheable(path)) return;
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
  } catch {
    // localStorage voll o. Ä. - der Cache ist ein Best-Effort-Komfort, kein harter Fehler.
  }
}

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
  } catch {
    return [];
  }
}

function writeOutboxList(list: OutboxEntry[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

let tempIdSeq = 0;
/** Garantiert negative, pro Tab eindeutige Platzhalter-id für offline angelegte Objekte – echte
 *  Server-ids sind immer positiv (SQLite AUTOINCREMENT), Verwechslung damit ausgeschlossen. */
export function nextTempId(): number {
  tempIdSeq -= 1;
  return -Date.now() + tempIdSeq;
}

export function getOutboxLength(): number {
  return readOutbox().length;
}

export function enqueue(method: OutboxEntry['method'], path: string, body: unknown, tempId?: number) {
  const list = readOutbox();
  list.push({ id: crypto.randomUUID(), method, path, body, tempId, createdAt: new Date().toISOString() });
  writeOutboxList(list);
}

function remapTempId(list: OutboxEntry[], tempId: number, realId: number) {
  for (const entry of list) {
    entry.path = entry.path.replace(`/${tempId}`, `/${realId}`);
    if (entry.body && typeof entry.body === 'object') {
      for (const [key, value] of Object.entries(entry.body as Record<string, unknown>)) {
        if (value === tempId) (entry.body as Record<string, unknown>)[key] = realId;
      }
    }
  }
}

/** Sendet die Warteschlange der Reihe nach über `sendRaw` (die echte Netzwerk-Funktion, ohne
 *  Offline-Fallback – siehe api/client.ts's rawRequest) – bricht beim ersten erneuten Fehlschlag ab
 *  und lässt den Rest für den nächsten Versuch stehen, damit die Reihenfolge erhalten bleibt und
 *  nichts übersprungen wird. Gibt zurück, ob die Warteschlange komplett geleert werden konnte. */
export async function flushOutbox(
  sendRaw: (method: string, path: string, body: unknown) => Promise<unknown>,
): Promise<boolean> {
  let list = readOutbox();
  while (list.length) {
    const entry = list[0];
    let response: unknown;
    try {
      response = await sendRaw(entry.method, entry.path, entry.body);
    } catch {
      return false;
    }
    if (entry.tempId != null && response && typeof response === 'object' && 'id' in response) {
      remapTempId(list, entry.tempId, (response as { id: number }).id);
    }
    list = list.slice(1);
    writeOutboxList(list);
  }
  return true;
}
