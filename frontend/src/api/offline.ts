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

// Bewusst ein reines Modul-Flag statt eines Pinia-Stores hier: api/offline.ts bleibt framework-
// unabhängig, der eigentliche Online-Status inkl. periodischem Health-Check lebt weiterhin in
// stores/connectivity.ts. Dieses Flag ist nur die für api/client.ts sichtbare Kurzfassung "seit dem
// letzten bestätigten Erfolg wurde schon mal ein echter Netzfehler festgestellt" - ohne das müsste
// JEDER einzelne Request erneut den vollen REQUEST_TIMEOUT_MS abwarten, bevor er auf den Cache
// zurückfällt, obwohl längst klar ist, dass der Server gerade nicht erreichbar ist (genau der vom
// Nutzer gemeldete Fall: Internet da, aber Server-Antworten blockiert - jede View/jeder Klick hing
// dadurch für Sekunden). stores/connectivity.ts setzt dieses Flag zurück, sobald ein periodischer
// Health-Check (oder ein manueller Retry) wieder erfolgreich war.
let confirmedOffline = false;
export function isConfirmedOffline(): boolean {
  return confirmedOffline;
}
export function setConfirmedOffline(value: boolean) {
  confirmedOffline = value;
}

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
  } catch {
    return [];
  }
}

/** Collection-Pfad vor einem eventuellen '?id'-Suffix bzw. Query-String, z. B. '/diary' sowohl für
 *  GET '/diary?trip_id=5' als auch für POST '/diary'/PUT '/diary/123' – gemeinsamer Schlüssel, über
 *  den mergePendingIntoList() und findCachedItemInCollection() unten Outbox-Einträge derselben
 *  fachlichen Sammlung zuordnen, unabhängig vom jeweiligen HTTP-Pfad-Suffix. */
export function collectionOf(path: string): string {
  return path.split('?')[0].replace(/\/-?\d+$/, '');
}

interface Pendable {
  id: number;
}

/** Ergänzt eine vom Server oder aus dem Cache gelesene Liste um noch nicht synchronisierte
 *  Outbox-Einträge derselben Sammlung (siehe collectionOf) – ohne das würde ein offline neu
 *  angelegtes/bearbeitetes/gelöschtes Objekt nach einem Seiten-Reload (bevor die Outbox wieder
 *  gesendet werden konnte) einfach aus der Liste verschwinden, obwohl es sicher in der Outbox auf
 *  den nächsten Sync-Versuch wartet. Reine Lese-Sicht – verändert weder Outbox noch Cache. Von
 *  api/client.ts's get() für jede Array-Antwort aufgerufen. */
export function mergePendingIntoList<T extends Pendable>(path: string, list: T[]): T[] {
  const collection = collectionOf(path);
  let result = list;
  for (const entry of readOutbox()) {
    const entryCollection = collectionOf(entry.path);
    if (entryCollection !== collection) continue;
    if (entry.method === 'POST' && entry.tempId != null) {
      result = [
        ...result,
        { ...(entry.body as object), id: entry.tempId, _pending: true } as unknown as T,
      ];
      continue;
    }
    const idMatch = /\/(-?\d+)$/.exec(entry.path.split('?')[0]);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);
    if (entry.method === 'PUT') {
      result = result.map((item) =>
        item.id === id
          ? ({ ...item, ...(entry.body as object), _pending: true } as unknown as T)
          : item
      );
    } else if (entry.method === 'DELETE') {
      result = result.filter((item) => item.id !== id);
    }
  }
  return result;
}

/** Sucht ein Objekt mit passender id in irgendeinem gecachten GET-Ergebnis derselben Sammlung
 *  (siehe collectionOf) – der genaue Query-String (z. B. '?trip_id=5') ist an dieser Stelle nicht
 *  bekannt (queueMutation() unten kennt nur den PUT-Pfad '/diary/123', nicht den GET-Listenpfad),
 *  daher ein Scan über alle Cache-Keys mit passendem Sammlungs-Präfix statt eines direkten Lookups.
 *  Liefert das VOLLSTÄNDIGE zuletzt bekannte Objekt, damit ein offline abgeschickter PUT (dessen
 *  Body typischerweise nur die im Formular editierbaren Felder enthält, siehe z. B. DiaryView.vue's
 *  submitEditEntry) beim optimistischen Zurückschreiben keine server-verwalteten Felder wie
 *  created_by/trip_id verliert (siehe queueMutation()). */
export function findCachedItemInCollection(
  collection: string,
  id: number
): Record<string, unknown> | undefined {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(CACHE_PREFIX)) continue;
    const path = key.slice(CACHE_PREFIX.length);
    if (path !== collection && !path.startsWith(`${collection}?`)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      const found = (list as Array<Record<string, unknown>>).find((item) => item && item.id === id);
      if (found) return found;
    } catch {
      // korrupter Cache-Eintrag - einfach überspringen, andere Cache-Keys können noch passen.
    }
  }
  return undefined;
}

function writeOutboxList(list: OutboxEntry[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('reisotor:outbox-changed'));
  }
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

export function enqueue(
  method: OutboxEntry['method'],
  path: string,
  body: unknown,
  tempId?: number
) {
  const list = readOutbox();
  list.push({
    id: crypto.randomUUID(),
    method,
    path,
    body,
    tempId,
    createdAt: new Date().toISOString(),
  });
  writeOutboxList(list);
}

function remapTempId(list: OutboxEntry[], tempId: number, realId: number) {
  for (const entry of list) {
    entry.path = entry.path.replace(`/${tempId}`, `/${realId}`);
    if (entry.body && typeof entry.body === 'object') {
      const bodyObj = entry.body as Record<string, unknown>;
      for (const [key, value] of Object.entries(bodyObj)) {
        if (value === tempId) {
          bodyObj[key] = realId;
        } else if (Array.isArray(value)) {
          bodyObj[key] = value.map((v) => (v === tempId ? realId : v));
        }
      }
    }
  }
}

/** Sendet die Warteschlange der Reihe nach über `sendRaw` (die echte Netzwerk-Funktion, ohne
 *  Offline-Fallback – siehe api/client.ts's rawRequest) – bricht beim ersten erneuten Fehlschlag ab
 *  und lässt den Rest für den nächsten Versuch stehen, damit die Reihenfolge erhalten bleibt und
 *  nichts übersprungen wird. Endgültig vom Server abgelehnte Client-Fehler (4xx außer 408/429)
 *  werden übersprungen, damit sie die Warteschlange nicht dauerhaft blockieren.
 *  Gibt zurück, ob die Warteschlange komplett geleert werden konnte. */
export async function flushOutbox(
  sendRaw: (method: string, path: string, body: unknown) => Promise<unknown>
): Promise<boolean> {
  let list = readOutbox();
  while (list.length) {
    const entry = list[0];
    let response: unknown;
    try {
      response = await sendRaw(entry.method, entry.path, entry.body);
    } catch (err: unknown) {
      // Unbehebbare Client-Fehler (4xx wie 400 Bad Request, 404 Not Found, 422 etc., außer
      // 408 Request Timeout und 429 Too Many Requests): der Server lehnt diese Mutation endgültig ab.
      // Würde dieser Eintrag in der Outbox verbleiben, blockiert er alle nachfolgenden Mutationen
      // dauerhaft. Daher überspringen und aus der Outbox entfernen.
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;
      if (status != null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        console.warn(
          `Outbox-Eintrag vom Server dauerhaft abgelehnt (HTTP ${status}), wird übersprungen:`,
          entry
        );
        list = list.slice(1);
        writeOutboxList(list);
        continue;
      }
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
