// Offline-Fähigkeit (siehe CLAUDE.md-Auftrag): lokaler Lese-Cache für GET-Antworten + eine
// Warteschlange ("Outbox") für Mutationen, die nicht sofort ans Backend geschickt werden konnten.
// Bewusst localStorage statt IndexedDB – die hier gecachten Datenmengen (JSON einer Reiseplanung)
// sind klein, localStorage ist synchron und braucht keine zusätzliche Abstraktionsebene.

export interface OutboxEntryError {
  status?: number;
  message: string;
  timestamp: string;
}

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
  lastError?: OutboxEntryError;
  retryCount?: number;
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

export function getOutbox(): OutboxEntry[] {
  return readOutbox();
}

export function removeOutboxEntry(id: string): boolean {
  const list = readOutbox();
  const next = list.filter((e) => e.id !== id);
  if (next.length !== list.length) {
    writeOutboxList(next);
    return true;
  }
  return false;
}

export function clearOutbox(): void {
  writeOutboxList([]);
}

export function updateOutboxEntry(
  id: string,
  updates: Partial<Pick<OutboxEntry, 'path' | 'body' | 'method' | 'lastError' | 'retryCount'>>
): boolean {
  const list = readOutbox();
  const index = list.findIndex((e) => e.id === id);
  if (index === -1) return false;
  list[index] = {
    ...list[index],
    ...updates,
  };
  writeOutboxList(list);
  return true;
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

/** Prüft, ob ein Pfad für die persistente Outbox-Warteschlange geeignet ist.
 *  Ephemere Echtzeitdaten (/realtime), Berechnungs-/RPC-Abfragen (/routes/directions),
 *  Push-Registrierungen (/push) oder Authentifizierungs-Requests (/auth) dürfen
 *  niemals in der Outbox landen. */
export function isQueueablePath(path: string): boolean {
  const cleanPath = path.split('?')[0];
  if (
    cleanPath.startsWith('/auth') ||
    cleanPath.startsWith('/users') ||
    cleanPath.startsWith('/admin') ||
    cleanPath.startsWith('/backup') ||
    cleanPath.startsWith('/realtime') ||
    cleanPath.startsWith('/push') ||
    cleanPath.startsWith('/trip-activity') ||
    cleanPath.startsWith('/weather') ||
    cleanPath.includes('/routes/directions')
  ) {
    return false;
  }
  return true;
}

function bodyContainsId(body: unknown, id: number): boolean {
  if (body == null) return false;
  if (body === id || body === String(id)) return true;
  if (Array.isArray(body)) return body.some((item) => bodyContainsId(item, id));
  if (typeof body === 'object') {
    return Object.values(body as Record<string, unknown>).some((val) => bodyContainsId(val, id));
  }
  return false;
}

/** Ermittelt, ob ein Child-Eintrag von einem früheren Parent-Eintrag abhängt.
 *  Abhängigkeiten entstehen, wenn Child die tempId des Parents referenziert oder
 *  wenn beide denselben spezifischen Endpunkt/dieselbe Entität mutieren. */
export function entryDependsOn(child: OutboxEntry, parent: OutboxEntry): boolean {
  if (parent.tempId != null) {
    if (child.path.includes(`/${parent.tempId}`)) return true;
    if (bodyContainsId(child.body, parent.tempId)) return true;
  }

  // Zwei unabhängige Neuerstellungen per POST auf denselben Collection-Endpunkt
  // (z. B. 2x POST /todos oder 2x POST /notes) sind unabhängig und können parallel laufen.
  if (child.path === parent.path) {
    const isIndependentCollectionPost =
      child.method === 'POST' &&
      parent.method === 'POST' &&
      !child.path.endsWith('/like') &&
      !child.path.endsWith('/done') &&
      !child.path.endsWith('/read');
    if (!isIndependentCollectionPost) {
      return true;
    }
  }

  const childCol = collectionOf(child.path);
  const parentCol = collectionOf(parent.path);
  if (childCol === parentCol) {
    const childIdMatch = /\/(-?\d+)$/.exec(child.path.split('?')[0]);
    const parentIdMatch = /\/(-?\d+)$/.exec(parent.path.split('?')[0]);
    if (childIdMatch && parentIdMatch && childIdMatch[1] === parentIdMatch[1]) {
      return true;
    }
  }

  return false;
}

function remapTempIdInValue(val: unknown, tempId: number, realId: number): unknown {
  if (val === tempId) return realId;
  if (val === String(tempId)) return String(realId);
  if (Array.isArray(val)) {
    return val.map((v) => remapTempIdInValue(v, tempId, realId));
  }
  if (val !== null && typeof val === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = remapTempIdInValue(v, tempId, realId);
    }
    return res;
  }
  return val;
}

function remapTempId(list: OutboxEntry[], tempId: number, realId: number) {
  for (const entry of list) {
    entry.path = entry.path.replace(`/${tempId}`, `/${realId}`);
    if (entry.body && typeof entry.body === 'object') {
      entry.body = remapTempIdInValue(entry.body, tempId, realId);
    }
  }
}

export function remapOutboxTempId(tempId: number, realId: number) {
  const list = readOutbox();
  remapTempId(list, tempId, realId);
  writeOutboxList(list);
}

const MAX_CONCURRENCY = 3;
let isFlushing = false;

/** Sendet die Warteschlange parallel (bis zu MAX_CONCURRENCY gleichzeitige Anfragen) über `sendRaw`.
 *  - Berücksichtigt Kausalitäts-Abhängigkeiten (z. B. PUT auf vorherige temporäre ID wartet auf POST).
 *  - Unabhängige Mutationen laufen parallel, sodass ein Fehler in einem Eintrag NICHT die anderen blockiert.
 *  - Fehlerhafte Einträge verbleiben mit Fehlermeldung und Inkrementierung von retryCount in der Outbox.
 *  - 4xx Client-Fehler (außer 408/429) werden übersprungen und entfernt.
 *  - Gibt zurück, ob die Warteschlange komplett geleert werden konnte. */
export async function flushOutbox(
  sendRaw: (method: string, path: string, body: unknown) => Promise<unknown>
): Promise<boolean> {
  if (isFlushing) return false;
  isFlushing = true;

  try {
    // 1. Zuerst alte/ungültige oder nicht-synchronisierbare Einträge (z. B. versehentlich gequeuete
    // Routenberechnungen oder Realtime-Positionen aus früheren Versionen) sofort bereinigen.
    let initialList = readOutbox();
    const invalidEntries = initialList.filter((e) => !isQueueablePath(e.path));
    if (invalidEntries.length > 0) {
      console.warn(
        `Ungültige/nicht-synchronisierbare Einträge aus Outbox entfernt:`,
        invalidEntries.map((e) => e.path)
      );
      initialList = initialList.filter((e) => isQueueablePath(e.path));
      writeOutboxList(initialList);
    }

    if (initialList.length === 0) return true;

    const inFlight = new Map<string, Promise<void>>();
    const failedIds = new Set<string>();

    function findNextReady(): OutboxEntry | undefined {
      const currentList = readOutbox();
      for (let i = 0; i < currentList.length; i++) {
        const entry = currentList[i];
        if (inFlight.has(entry.id) || failedIds.has(entry.id)) {
          continue;
        }
        let hasUnresolvedDep = false;
        for (let j = 0; j < i; j++) {
          const prev = currentList[j];
          if (entryDependsOn(entry, prev)) {
            hasUnresolvedDep = true;
            break;
          }
        }
        if (!hasUnresolvedDep) {
          return entry;
        }
      }
      return undefined;
    }

    while (true) {
      // Starte so viele bereite Einträge parallel wie möglich (bis MAX_CONCURRENCY)
      while (inFlight.size < MAX_CONCURRENCY) {
        const entry = findNextReady();
        if (!entry) break;

        const promise = (async () => {
          try {
            const response = await sendRaw(entry.method, entry.path, entry.body);
            if (
              entry.tempId != null &&
              response &&
              typeof response === 'object' &&
              'id' in response
            ) {
              remapOutboxTempId(entry.tempId, (response as { id: number }).id);
            }
            removeOutboxEntry(entry.id);
          } catch (err: unknown) {
            const status =
              typeof err === 'object' &&
              err !== null &&
              'status' in err &&
              typeof (err as { status: unknown }).status === 'number'
                ? (err as { status: number }).status
                : undefined;
            const message =
              err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in err
                  ? String((err as { message: unknown }).message)
                  : 'Unbekannter Serverfehler';

            // Unbehebbare Client-Fehler (4xx wie 400 Bad Request, 404 Not Found, 422 etc., außer
            // 408 Request Timeout und 429 Too Many Requests): der Server lehnt diese Mutation endgültig ab.
            if (
              status != null &&
              status >= 400 &&
              status < 500 &&
              status !== 408 &&
              status !== 429
            ) {
              console.warn(
                `Outbox-Eintrag vom Server dauerhaft abgelehnt (HTTP ${status}), wird übersprungen:`,
                entry
              );
              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(
                  new CustomEvent('reisotor:outbox-rejected', { detail: { entry, error: err } })
                );
              }
              removeOutboxEntry(entry.id);
              return;
            }

            failedIds.add(entry.id);
            updateOutboxEntry(entry.id, {
              lastError: {
                status,
                message,
                timestamp: new Date().toISOString(),
              },
              retryCount: (entry.retryCount || 0) + 1,
            });

            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(
                new CustomEvent('reisotor:outbox-failed', { detail: { entry, error: err } })
              );
            }
          } finally {
            inFlight.delete(entry.id);
          }
        })();

        inFlight.set(entry.id, promise);
      }

      if (inFlight.size === 0) {
        break;
      }

      // Auf das nächste fertig werdende Promise warten
      await Promise.race(inFlight.values());
    }

    return readOutbox().length === 0;
  } finally {
    isFlushing = false;
  }
}
