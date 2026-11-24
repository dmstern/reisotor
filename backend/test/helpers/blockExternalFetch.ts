const realFetch = globalThis.fetch;

const ALLOWED_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function extractRequestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function isLocalUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return ALLOWED_LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Blockiert unbeabsichtigte Live-HTTP-Requests in Backend-Tests, lässt aber lokale Testserver
 *  (z. B. 127.0.0.1 in places-failures.challenger2.test.ts) passieren. Tests, die externes
 *  Verhalten prüfen, müssen `fetch` explizit per `vi.stubGlobal('fetch', ...)` mocken. */
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const urlString = extractRequestUrl(input);

  if (isLocalUrl(urlString)) {
    return realFetch(input, init);
  }

  throw new Error(
    `Unexpected live fetch in backend test: ${urlString} — mock fetch with vi.stubGlobal('fetch', ...) instead.`
  );
};
