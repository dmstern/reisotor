import { enqueue, isConfirmedOffline, nextTempId, readCache, setConfirmedOffline, writeCache } from './offline';
import { useRequestActivityStore } from '../stores/requestActivity';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Diese Pfade behandeln ein 401 bereits selbst sinnvoll (Login-Formular zeigt "falsches Passwort"
// an, checkSession() setzt still auf user=null) – dort NICHT automatisch weiterleiten, sonst würde
// z. B. die Fehlermeldung im Login-Formular durch den Reload sofort wieder verschwinden.
const AUTH_SELF_HANDLED_PATHS = ['/auth/login', '/auth/me', '/auth/logout'];

// Auf einem instabilen Netz (Verbindung steht, Server antwortet aber nie - z. B. ein NAT64-/CGNAT-
// Pfad, der Pakete verschluckt, oder ein Mobilfunk-/Ferienwohnungs-WLAN mit hängenden Verbindungen)
// wirft ein normaler fetch() ohne eigenes Timeout NIE den TypeError, auf den isNetworkFailure()
// unten prüft - der Request hängt stattdessen unbegrenzt lange, und die aufrufende View bleibt bei
// navigator.onLine === true für immer im Ladezustand hängen statt auf den Cache zurückzufallen.
// Eigener Timeout per AbortController erzwingt stattdessen einen definierten Fehlschlag.
const REQUEST_TIMEOUT_MS = 8_000;

export async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Rohe Netzwerk-Anfrage ohne Offline-Fallback (Cache-Lesen/Outbox-Warteschlange, siehe unten) –
// wird sowohl von den öffentlichen api.*-Funktionen als auch vom Outbox-Replay
// (stores/connectivity.ts) verwendet. Ein erneuter Fehlschlag beim Nachsenden aus der Warteschlange
// heraus darf NICHT wieder in dieselbe Warteschlange zurückgequeued werden, deshalb ein eigener,
// unveränderter Kern statt der öffentlichen request()-Wrapper-Funktion.
export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Content-Type nur setzen, wenn wirklich ein Body gesendet wird – sonst parst Fastify
  // den (nicht vorhandenen) JSON-Body und lehnt mit 400 Bad Request ab (z. B. bei DELETE).
  const headers: HeadersInit = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const res = await fetchWithTimeout(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Session serverseitig weg (z. B. Prozess-Neustart – die Session wird aktuell nur im
  // Arbeitsspeicher gehalten, siehe server.ts). Ohne das hier bekommt der Aufrufer nur eine
  // unbehandelte Promise-Ablehnung und die View bleibt meist für immer im loading-Zustand hängen,
  // da "loading = false" typischerweise erst NACH einem await steht, der bei einem Fehler nie
  // ankommt. Ein harter Reload auf die Login-Seite ist robuster als jeden Pinia-Store einzeln
  // manuell zurückzusetzen.
  if (res.status === 401 && !AUTH_SELF_HANDLED_PATHS.includes(path) && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // ignore, kein JSON-Body
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// fetch() wirft einen TypeError, wenn die Anfrage den Server gar nicht erst erreicht (offline,
// DNS-Fehler, …); ein per fetchWithTimeout() oben abgebrochener, hängender Request wirft stattdessen
// einen DOMException("AbortError") – im Unterschied zu einer echten HTTP-Fehlerantwort (4xx/5xx), die
// ganz normal als ApiError oben geworfen wird. Nur die ersten beiden Fälle sollen offline behandelt
// werden (Cache-Fallback bzw. Outbox-Warteschlange); eine echte 403/404/500 soll weiterhin sofort als
// Fehler sichtbar werden.
function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError');
}

async function get<T>(path: string): Promise<T> {
  const activity = useRequestActivityStore();
  activity.start('read');
  try {
    // isConfirmedOffline(): erst NACH einem echten Fehlschlag gesetzt (siehe api/offline.ts) - beim
    // allerersten Request eines Ladens gilt navigator.onLine also noch allein, damit der Normalfall
    // (echtes Online) unverändert sofort einen Netzversuch macht.
    if (navigator.onLine && !isConfirmedOffline()) {
      try {
        const data = await rawRequest<T>(path, { method: 'GET' });
        writeCache(path, data);
        return data;
      } catch (err) {
        if (!isNetworkFailure(err)) throw err;
        // Netzwerk nicht erreichbar, obwohl navigator.onLine true meldet (unzuverlässig) – auf den
        // Cache zurückfallen statt den Fehler direkt hochzureichen. Merken, damit nachfolgende
        // Requests nicht jedes Mal erneut den vollen Timeout abwarten müssen (siehe
        // stores/connectivity.ts, das dieses Flag per Health-Check wieder zurücksetzt).
        setConfirmedOffline(true);
      }
    }
    const cached = readCache<T>(path);
    if (cached !== undefined) return cached;
    throw new ApiError(0, 'Offline und keine zwischengespeicherten Daten für diese Ansicht vorhanden');
  } finally {
    activity.finish('read');
  }
}

type MutateMethod = 'POST' | 'PUT' | 'DELETE';

/** Legt eine offline gebliebene Mutation in die Outbox (siehe api/offline.ts, von
 *  stores/connectivity.ts beim Wiederverbinden abgearbeitet) und liefert eine optimistische,
 *  synthetische Antwort zurück, damit der aufrufende View-Code (der ganz normal `items.value.push
 *  (created)` o. Ä. macht) unverändert weiterläuft, ohne selbst wissen zu müssen, dass gerade offline
 *  gearbeitet wird. */
function queueMutation<T>(method: MutateMethod, path: string, body: unknown): T {
  if (method === 'DELETE') {
    enqueue('DELETE', path, body);
    return undefined as T;
  }
  if (method === 'POST') {
    const tempId = nextTempId();
    enqueue('POST', path, body, tempId);
    return { ...(body as object), id: tempId, _pending: true } as T;
  }
  // PUT: die id steht schon in der URL (z. B. /todos/123) – kein eigener Platzhalter nötig, die
  // Zeile existiert (aus Sicht des Clients) bereits.
  const idMatch = /(\d+)(?:\?.*)?$/.exec(path);
  enqueue('PUT', path, body);
  return { ...(body as object), id: idMatch ? Number(idMatch[1]) : undefined, _pending: true } as T;
}

const MUTATE_KIND: Record<MutateMethod, 'create' | 'update' | 'delete'> = {
  POST: 'create',
  PUT: 'update',
  DELETE: 'delete',
};

async function mutate<T>(method: MutateMethod, path: string, body?: unknown): Promise<T> {
  const activity = useRequestActivityStore();
  activity.start(MUTATE_KIND[method]);
  try {
    if (navigator.onLine && !isConfirmedOffline()) {
      try {
        return await rawRequest<T>(path, { method, body: body ? JSON.stringify(body) : undefined });
      } catch (err) {
        if (!isNetworkFailure(err)) throw err;
        setConfirmedOffline(true);
        // durchfallen zur Offline-Warteschlange unten
      }
    }
    return queueMutation<T>(method, path, body);
  } finally {
    activity.finish(MUTATE_KIND[method]);
  }
}

export const api = {
  get: <T>(path: string) => get<T>(path),
  post: <T>(path: string, body?: unknown) => mutate<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => mutate<T>('PUT', path, body),
  delete: <T>(path: string) => mutate<T>('DELETE', path),
};
