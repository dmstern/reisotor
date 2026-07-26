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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Content-Type nur setzen, wenn wirklich ein Body gesendet wird – sonst parst Fastify
  // den (nicht vorhandenen) JSON-Body und lehnt mit 400 Bad Request ab (z. B. bei DELETE).
  const headers: HeadersInit = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const res = await fetch(`/api${path}`, {
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

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
