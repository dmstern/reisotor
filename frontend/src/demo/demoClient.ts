// Backend-Ersatz für den Demo-Build (Issue #172): simuliert GET/POST/PUT/DELETE gegen die
// Dummy-Daten aus demoData.ts, komplett im Browser (localStorage). Wird von api/client.ts's
// rawRequest() anstelle des echten fetch() aufgerufen, wenn DEMO_MODE aktiv ist - alle
// aufrufenden Stores/Views bleiben dadurch unverändert.
import {
  DEMO_BUDGETS,
  DEMO_BUDGET_ALLOCATIONS,
  DEMO_BUDGET_EXPENSES,
  DEMO_BUDGET_TRANSFERS,
  DEMO_DIARY,
  DEMO_EXCURSIONS,
  DEMO_NOTES,
  DEMO_PACKING,
  DEMO_SCHEDULE,
  DEMO_SHOPPING,
  DEMO_SPOTS,
  DEMO_TODOS,
  DEMO_TRIP,
  DEMO_USER,
  DEMO_USERS,
  DEMO_SPOT_LIKES,
  DEMO_SPOT_COMMENTS,
  DEMO_EXCURSION_LIKES,
  DEMO_EXCURSION_COMMENTS,
  DEMO_DIARY_LIKES,
  DEMO_DIARY_COMMENTS,
} from './demoData';

const STORAGE_KEY = 'reisotor-demo-store';

type Collection = Record<string, unknown>[];
type Store = Record<string, Collection>;

function defaultStore(): Store {
  return {
    '/trips': structuredClone([DEMO_TRIP]) as unknown as Collection,
    '/schedule': structuredClone(DEMO_SCHEDULE) as unknown as Collection,
    '/ideas': structuredClone(DEMO_EXCURSIONS) as unknown as Collection,
    '/ideas/likes': structuredClone(DEMO_EXCURSION_LIKES) as unknown as Collection,
    '/ideas/comments': structuredClone(DEMO_EXCURSION_COMMENTS) as unknown as Collection,
    '/spots': structuredClone(DEMO_SPOTS) as unknown as Collection,
    '/spots/likes': structuredClone(DEMO_SPOT_LIKES) as unknown as Collection,
    '/spots/comments': structuredClone(DEMO_SPOT_COMMENTS) as unknown as Collection,
    '/budget': structuredClone(DEMO_BUDGET_EXPENSES) as unknown as Collection,
    '/budget/budgets': structuredClone(DEMO_BUDGETS) as unknown as Collection,
    '/budget/allocations': structuredClone(DEMO_BUDGET_ALLOCATIONS) as unknown as Collection,
    '/budget/transfers': structuredClone(DEMO_BUDGET_TRANSFERS) as unknown as Collection,
    '/packing': structuredClone(DEMO_PACKING) as unknown as Collection,
    '/shopping': structuredClone(DEMO_SHOPPING) as unknown as Collection,
    '/todos': structuredClone(DEMO_TODOS) as unknown as Collection,
    '/notes': structuredClone(DEMO_NOTES) as unknown as Collection,
    '/notes/comments': [],
    '/diary': structuredClone(DEMO_DIARY) as unknown as Collection,
    '/diary/likes': structuredClone(DEMO_DIARY_LIKES) as unknown as Collection,
    '/diary/comments': structuredClone(DEMO_DIARY_COMMENTS) as unknown as Collection,
    '/tracks': [],
    '/notifications': [],
    '/attachments': [],
  };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // korrupter/deaktivierter localStorage - einfach mit frischem Demo-Datensatz starten.
  }
  return defaultStore();
}

let store: Store = loadStore();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage voll/deaktiviert - Demo bleibt für die laufende Session trotzdem nutzbar.
  }
}

/** Setzt den Demo-Datensatz auf den Ausgangszustand zurück - von DemoModeBanner.vue's
 *  "Demo zurücksetzen"-Aktion aufgerufen. */
export function resetDemoStore() {
  store = defaultStore();
  persist();
}

function collectionOf(path: string): string {
  return path.split('?')[0].replace(/\/-?\d+$/, '');
}

function idFromPath(path: string): number | undefined {
  const match = /\/(-?\d+)(?:\?.*)?$/.exec(path.split('?')[0]);
  return match ? Number(match[1]) : undefined;
}

let nextId = 1000;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  await delay();
  const method = (options.method ?? 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? (JSON.parse(options.body) as Record<string, unknown>) : undefined;

  // Einzelfall-Endpunkte, die kein einfaches Collection-CRUD sind.
  if (path === '/auth/me') return structuredClone(DEMO_USER) as unknown as T;
  if (path === '/auth/config') return { registrationMode: 'off' } as unknown as T;
  if (path === '/auth/login' || path === '/auth/register') return structuredClone(DEMO_USER) as unknown as T;
  if (path === '/auth/logout') return undefined as T;
  if (path === '/build-info') {
    return {
      version: __APP_VERSION__,
      ref: __APP_COMMIT__,
      builtAt: __APP_BUILT_AT__,
      changelog: null,
      repoUrl: __REPO_URL__,
      hostingLocation: 'GitHub Pages (Demo)',
      // Demo soll bis auf den DemoModeBanner wie Produktion aussehen, nicht wie eine Dev-/Staging-
      // Instanz - sonst würden DEV-Badge und die orange Header-Umrandung (siehe AppHeader.vue)
      // fälschlich suggerieren, es handle sich um eine Test-/Vorschau-Version der echten App.
      environment: 'production',
    } as unknown as T;
  }
  if (/^\/trips\/-?\d+\/members$/.test(path.split('?')[0])) {
    return structuredClone(DEMO_USERS) as unknown as T;
  }
  if (/^\/trips\/-?\d+\/region-info$/.test(path.split('?')[0])) {
    // Objekt-, nicht Array-förmige Antwort (RegionInfo, siehe utils/regionInfo.ts) - ohne diesen
    // Sonderfall würde der generische "unbekannter Pfad"-Zweig unten [] liefern, woran
    // DashboardView.vue's `regionInfo.languages.length` mit einem TypeError scheitert (die Karte
    // selbst - `regionInfo` truthy als Array - besteht die vorgelagerte `regionInfo &&`-Prüfung).
    return {
      countryName: 'Portugal',
      languages: ['Portugiesisch'],
      currency: { code: 'EUR', name: 'Euro' },
      exchangeRate: null,
      advisory: null,
    } as unknown as T;
  }
  if (path.startsWith('/users/search')) {
    const q = (new URLSearchParams(path.split('?')[1] ?? '').get('q') ?? '').toLowerCase();
    return DEMO_USERS.filter((u) => u.username.toLowerCase().includes(q)) as unknown as T;
  }

  const collection = collectionOf(path);
  if (!(collection in store)) {
    // Unbekannter Pfad (z. B. Push-Abo, Standortfreigabe, Entwürfe) - im Demo-Modus bewusst
    // erfolgreich no-open statt einen Fehler zu werfen, damit die jeweilige View nicht hängen bleibt.
    return (method === 'GET' ? [] : undefined) as unknown as T;
  }

  if (method === 'GET') {
    return structuredClone(store[collection]) as unknown as T;
  }
  if (method === 'POST') {
    const id = nextId++;
    const created = { ...(body ?? {}), id };
    store[collection] = [...store[collection], created];
    persist();
    return created as unknown as T;
  }
  if (method === 'PUT') {
    const id = idFromPath(path);
    store[collection] = store[collection].map((item) => ((item as { id: number }).id === id ? { ...item, ...(body ?? {}) } : item));
    persist();
    return store[collection].find((item) => (item as { id: number }).id === id) as unknown as T;
  }
  if (method === 'DELETE') {
    const id = idFromPath(path);
    store[collection] = store[collection].filter((item) => (item as { id: number }).id !== id);
    persist();
    return undefined as T;
  }
  return undefined as T;
}
