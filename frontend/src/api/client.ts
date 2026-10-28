import {
  collectionOf,
  enqueue,
  findCachedItemInCollection,
  isConfirmedOffline,
  isQueueablePath,
  mergePendingIntoList,
  nextTempId,
  readCache,
  setConfirmedOffline,
  writeCache,
} from './offline';
import { useRequestActivityStore } from '../stores/requestActivity';
import { DEMO_MODE } from '../demo/isDemoMode';
import { demoRequest } from '../demo/demoClient';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  noQueue?: boolean;
  silent?: boolean;
}

export class ApiError extends Error {
  status: number;
  method?: string;
  path?: string;
  constructor(status: number, message: string, meta?: { method?: string; path?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.method = meta?.method;
    this.path = meta?.path;
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
const ROUTING_TIMEOUT_MS = 25_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const defaultTimeout = input.includes('/routes/directions')
    ? ROUTING_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS;
  const timeoutMs = init.timeoutMs ?? defaultTimeout;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', onAbort, { once: true });
    }
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (init.signal) {
      init.signal.removeEventListener('abort', onAbort);
    }
  }
}

// Rohe Netzwerk-Anfrage ohne Offline-Fallback (Cache-Lesen/Outbox-Warteschlange, siehe unten) –
// wird sowohl von den öffentlichen api.*-Funktionen als auch vom Outbox-Replay
// (stores/connectivity.ts) verwendet. Ein erneuter Fehlschlag beim Nachsenden aus der Warteschlange
// heraus darf NICHT wieder in dieselbe Warteschlange zurückgequeued werden, deshalb ein eigener,
// unveränderter Kern statt der öffentlichen request()-Wrapper-Funktion.
export async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Backend-loser Demo-Build (Issue #172): alle Requests gegen die Dummy-Daten aus
  // demo/demoClient.ts statt gegen ein echtes Backend. Einziger Abzweig - api/offline.ts (Cache/
  // Outbox) darum herum bleibt unverändert und läuft einfach mit (harmlos, da demoRequest() nie
  // mit einem Netzwerkfehler fehlschlägt).
  if (DEMO_MODE) return demoRequest<T>(path, options);

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
  // ankommt. Ein CustomEvent statt eines direkten Store-/Router-Imports hier (der eine zirkuläre
  // Modul-Abhängigkeit client.ts <-> stores/auth.ts <-> router/index.ts erzeugen würde) – App.vue
  // hört zu und navigiert per router.push('/login'). Bewusst KEIN harter window.location.href-Reload
  // mehr: der ließ parallel laufende Requests/Watcher während der Navigations-Verzögerung
  // weiterlaufen und noch auf die bereits im Teardown befindliche Pinia-/Router-Instanz zugreifen
  // (Ursache der in Issue #77 beobachteten Abstürze). stores/trip.ts's reset() (siehe App.vue)
  // übernimmt jetzt das Zurücksetzen des Trip-bezogenen State.
  if (
    res.status === 401 &&
    !AUTH_SELF_HANDLED_PATHS.includes(path) &&
    window.location.pathname !== '/login'
  ) {
    window.dispatchEvent(new CustomEvent('reisotor:session-expired'));
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // ignore, kein JSON-Body
    }
    if (!message || !message.trim()) {
      if (res.status === 502) message = 'Bad Gateway (Server nicht erreichbar)';
      else if (res.status === 503)
        message = 'Service Unavailable (Server vorübergehend nicht erreichbar)';
      else if (res.status === 504) message = 'Gateway Timeout (Server antwortet nicht)';
    }
    throw new ApiError(res.status, message, {
      method: (options.method ?? 'GET').toUpperCase(),
      path,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// fetch() wirft einen TypeError, wenn die Anfrage den Server gar nicht erst erreicht (offline,
// DNS-Fehler, …); ein per fetchWithTimeout() oben abgebrochener, hängender Request wirft stattdessen
// einen DOMException("AbortError"). Zusätzlich gelten Gateway-/Proxy-Fehler (502 Bad Gateway, 503
// Service Unavailable, 504 Gateway Timeout) als Netzwerkausfall, da sie vom Reverse Proxy (Caddy/
// Nginx) signalisieren, dass das Backend offline, im Neustart oder nicht erreichbar ist – im
// Unterschied zu echten Applikations-Antworten (400, 403, 404, 500). Dadurch greift bei einem
// Serverneustart oder temporärem Proxy-Fehler der Cache-Fallback bzw. die Outbox-Warteschlange.
function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')) {
    return true;
  }
  if (err instanceof ApiError && [502, 503, 504].includes(err.status)) {
    return true;
  }
  return false;
}

// Ergänzt eine Array-Antwort um noch nicht synchronisierte Outbox-Einträge derselben Sammlung
// (siehe api/offline.ts's mergePendingIntoList) – sonst würde ein offline neu angelegtes/
// bearbeitetes/gelöschtes Objekt nach einem Seiten-Reload (bevor die Outbox wieder gesendet werden
// konnte) aus der Liste verschwinden, obwohl es sicher auf den nächsten Sync-Versuch wartet.
// Nicht-Array-Antworten (Einzelobjekte, /users, …) bleiben unverändert.
function withPending<T>(path: string, data: T): T {
  if (!Array.isArray(data)) return data;
  return mergePendingIntoList(path, data as Array<{ id: number }>) as unknown as T;
}

async function get<T>(path: string, options?: RequestOptions): Promise<T> {
  const activity = useRequestActivityStore();
  const trackActivity = !options?.silent && !path.startsWith('/drafts');
  if (trackActivity) activity.start('read');
  try {
    // isConfirmedOffline(): erst NACH einem echten Fehlschlag gesetzt (siehe api/offline.ts) - beim
    // allerersten Request eines Ladens gilt navigator.onLine also noch allein, damit der Normalfall
    // (echtes Online) unverändert sofort einen Netzversuch macht.
    if (navigator.onLine && !isConfirmedOffline()) {
      try {
        const data = await rawRequest<T>(path, { method: 'GET', ...options });
        writeCache(path, data);
        return withPending(path, data);
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
    if (cached !== undefined) return withPending(path, cached);
    throw new ApiError(
      0,
      'Offline und keine zwischengespeicherten Daten für diese Ansicht vorhanden',
      { method: 'GET', path }
    );
  } finally {
    if (trackActivity) activity.finish('read');
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
  // PUT: die id steht schon in der URL (z. B. /todos/123 oder /spots/-123) – kein eigener Platzhalter nötig, die
  // Zeile existiert (aus Sicht des Clients) bereits.
  const idMatch = /(-?\d+)(?:\?.*)?$/.exec(path);
  enqueue('PUT', path, body);
  const id = idMatch ? Number(idMatch[1]) : undefined;
  // body enthält meist nur die im Formular editierbaren Felder (siehe z. B. DiaryView.vue's
  // submitEditEntry), nicht server-verwaltete Felder wie created_by/trip_id/done - ohne diesen
  // Merge über das zuletzt gecachte Vollobjekt würde die optimistische Antwort (bis zum nächsten
  // echten GET) mit fehlenden Feldern in die View geschrieben (siehe findCachedItemInCollection).
  const cachedBase = id != null ? findCachedItemInCollection(collectionOf(path), id) : undefined;
  return { ...cachedBase, ...(body as object), id, _pending: true } as T;
}

const MUTATE_KIND: Record<MutateMethod, 'create' | 'update' | 'delete'> = {
  POST: 'create',
  PUT: 'update',
  DELETE: 'delete',
};

async function mutate<T>(
  method: MutateMethod,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const activity = useRequestActivityStore();
  const trackActivity = !options?.silent && !path.startsWith('/drafts');
  if (trackActivity) activity.start(MUTATE_KIND[method]);
  try {
    const queueable = !options?.noQueue && isQueueablePath(path);
    if (navigator.onLine && !isConfirmedOffline()) {
      try {
        return await rawRequest<T>(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        });
      } catch (err) {
        if (!isNetworkFailure(err)) throw err;
        // Wenn dieser Pfad nicht in die Outbox gehört (z. B. Routenberechnung oder Realtime-Position),
        // Fehler direkt werfen statt in die Outbox zu schieben!
        if (!queueable) throw err;
        setConfirmedOffline(true);
        // durchfallen zur Offline-Warteschlange unten
      }
    }
    if (!queueable) {
      throw new ApiError(0, `Offline: ${path} kann offline nicht ausgeführt werden`, {
        method,
        path,
      });
    }
    return queueMutation<T>(method, path, body);
  } finally {
    if (trackActivity) activity.finish(MUTATE_KIND[method]);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => get<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    mutate<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    mutate<T>('PUT', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    mutate<T>('DELETE', path, undefined, options),
};
