// Backend-Ersatz für den Demo-Build (Issue #172): simuliert GET/POST/PUT/DELETE gegen die
// Dummy-Daten aus demoData.ts, komplett im Browser (in-memory). Wird von api/client.ts's
// rawRequest() anstelle des echten fetch() aufgerufen, wenn DEMO_MODE aktiv ist - alle
// aufrufenden Stores/Views bleiben dadurch unverändert.
import { createDemoData } from './demoData';
import type { User } from '../api/types';

const STORAGE_KEY = 'reisotor-demo-store';

type Collection = Record<string, unknown>[];
type Store = Record<string, Collection>;

export function defaultStore(baseDate?: Date): Store {
  const data = createDemoData(baseDate);
  return {
    '/trips': [data.trip] as unknown as Collection,
    '/schedule': data.schedule as unknown as Collection,
    '/ideas': data.excursions as unknown as Collection,
    '/ideas/likes': data.excursionLikes as unknown as Collection,
    '/ideas/comments': data.excursionComments as unknown as Collection,
    '/spots': data.spots as unknown as Collection,
    '/spots/likes': data.spotLikes as unknown as Collection,
    '/spots/comments': data.spotComments as unknown as Collection,
    '/budget': data.budgetExpenses as unknown as Collection,
    '/budget/budgets': data.budgets as unknown as Collection,
    '/budget/allocations': data.budgetAllocations as unknown as Collection,
    '/budget/transfers': data.budgetTransfers as unknown as Collection,
    '/packing': data.packing as unknown as Collection,
    '/shopping': data.shopping as unknown as Collection,
    '/todos': data.todos as unknown as Collection,
    '/notes': data.notes as unknown as Collection,
    '/notes/comments': [],
    '/diary': data.diary as unknown as Collection,
    '/diary/likes': data.diaryLikes as unknown as Collection,
    '/diary/comments': data.diaryComments as unknown as Collection,
    '/tracks': [],
    '/tracks/points': [],
    '/notifications': [],
    '/attachments': [],
    '/users/me/icon-settings': [],
  };
}

// Säubern von Altlasten im Browser: frühere Versionen haben den Demo-Store in localStorage
// abgelegt. Dadurch froren Datumsangaben im August 2026 fest, sodass der Urlaub bei späteren Besuchen
// in der Vergangenheit lag. Im Demo-Modus werden Daten nun bei jedem Besuch frisch generiert.
try {
  localStorage.removeItem(STORAGE_KEY);
} catch {
  // korrupter/deaktivierter localStorage - no-op
}

let store: Store = defaultStore();
let currentDemoUsers: User[] = createDemoData().users;
let currentDemoUser: User = currentDemoUsers[0];

function persist() {
  // In-Memory-Store: Änderungen während der laufenden Nutzersitzung bleiben im Speicher
  // erhalten, ohne in localStorage festzufrieren.
}

/** Setzt den Demo-Datensatz auf den Ausgangszustand zurück - von DemoModeBanner.vue's
 *  "Demo zurücksetzen"-Aktion aufgerufen. */
export function resetDemoStore(baseDate?: Date) {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
  store = defaultStore(baseDate);
  const data = createDemoData(baseDate);
  currentDemoUsers = data.users;
  currentDemoUser = currentDemoUsers[0];
}

function collectionOf(path: string): string {
  return path.split('?')[0].replace(/\/-?\d+$/, '');
}

function idFromPath(path: string): number | undefined {
  const match = /\/(-?\d+)(?:\?.*)?$/.exec(path.split('?')[0]);
  return match ? Number(match[1]) : undefined;
}

let nextId = 1000;

function syncDemoIdeaSchedule(
  ideaId: number,
  title: string,
  date?: string | null,
  tripId?: number
) {
  const schedule = store['/schedule'] as Record<string, unknown>[];
  const existingIdx = schedule.findIndex((s) => s.idea_id === ideaId);
  if (date) {
    if (existingIdx !== -1) {
      schedule[existingIdx] = { ...schedule[existingIdx], date, title };
    } else {
      schedule.push({
        id: nextId++,
        trip_id: tripId ?? 1,
        date,
        title,
        idea_id: ideaId,
        spot_id: null,
        category: 'excursion',
      });
    }
  } else if (existingIdx !== -1) {
    schedule.splice(existingIdx, 1);
  }
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  await delay();
  const method = (options.method ?? 'GET').toUpperCase();
  const body =
    typeof options.body === 'string'
      ? (JSON.parse(options.body) as Record<string, unknown>)
      : undefined;
  const basePath = path.split('?')[0];

  // Einzelfall-Endpunkte, die kein einfaches Collection-CRUD sind.
  if (path === '/auth/me') return structuredClone(currentDemoUser) as unknown as T;
  if (path === '/auth/config') return { registrationMode: 'off' } as unknown as T;
  if (path === '/auth/login' || path === '/auth/register')
    return structuredClone(currentDemoUser) as unknown as T;
  if (path === '/auth/logout') return undefined as T;
  if (path === '/build-info') {
    const demoVersion = __APP_VERSION__.includes('(Demo)')
      ? __APP_VERSION__
      : `${__APP_VERSION__} (Demo)`;
    return {
      version: demoVersion,
      ref: __APP_COMMIT__,
      builtAt: __APP_BUILT_AT__,
      changelog: {
        version: demoVersion,
        date: new Date().toISOString().slice(0, 10),
        notes: [
          '🔔 **Update-Dialoge**: Neue Dialoge für verfügbare Updates und Versions-Changelogs',
          '⚙️ **Einstellungen**: Einstellungs-Option zum Deaktivieren von Update-Popups',
          '⚡ **Performance**: Verbesserte Offline-Stabilität und schnellere Ladezeiten',
        ],
        groups: [
          {
            title: 'Design & Navigation',
            notes: [
              '🔔 **Update-Dialoge**: Neue Dialoge für verfügbare Updates und Versions-Changelogs',
            ],
          },
          {
            title: 'Einstellungen & Synchronisation',
            notes: ['⚙️ **Einstellungen**: Einstellungs-Option zum Deaktivieren von Update-Popups'],
          },
          {
            title: 'Leistung & Stabilität',
            notes: ['⚡ **Performance**: Verbesserte Offline-Stabilität und schnellere Ladezeiten'],
          },
        ],
      },
      repoUrl: __REPO_URL__,
      hostingLocation: 'GitHub Pages (Demo)',
      environment: 'production',
    } as unknown as T;
  }

  // --- Profile/User settings ---
  if (path === '/users/me/avatar' && method === 'PUT') {
    const avatar = String(body?.avatar ?? '👤');
    currentDemoUser.avatar = avatar;
    const meInList = currentDemoUsers.find((u) => u.id === currentDemoUser.id);
    if (meInList) meInList.avatar = avatar;
    return structuredClone(currentDemoUser) as unknown as T;
  }
  if (path === '/users/me/username' && method === 'PUT') {
    const username = String(body?.username ?? currentDemoUser.username);
    currentDemoUser.username = username;
    const meInList = currentDemoUsers.find((u) => u.id === currentDemoUser.id);
    if (meInList) meInList.username = username;
    return structuredClone(currentDemoUser) as unknown as T;
  }
  if (path === '/users/me/icon-settings') {
    if (method === 'GET') return (store['/users/me/icon-settings']?.[0] ?? {}) as unknown as T;
    if (method === 'PUT') {
      store['/users/me/icon-settings'] = [(body ?? {}) as Record<string, unknown>];
      persist();
      return (body ?? {}) as unknown as T;
    }
  }

  // --- Feedback & Image upload ---
  if (path === '/feedback' && method === 'POST') {
    return {
      issueUrl: 'https://github.com/dmstern/reisotor/issues/demo',
      issueNumber: 999,
    } as unknown as T;
  }
  if ((path === '/images' || path === '/diary/images') && method === 'POST') {
    return {
      url: String(body?.data ?? ''),
      original_name: String(body?.filename ?? 'Bild'),
    } as unknown as T;
  }

  // --- Trip members & region info ---
  if (/^\/trips\/-?\d+\/members$/.test(basePath)) {
    return structuredClone(currentDemoUsers) as unknown as T;
  }
  if (/^\/trips\/-?\d+\/region-info$/.test(basePath)) {
    return {
      countryName: 'Portugal',
      languages: ['Portugiesisch'],
      currency: { code: 'EUR', name: 'Euro' },
      exchangeRate: null,
      advisory: null,
    } as unknown as T;
  }
  if (path === '/users') {
    if (method === 'GET') return structuredClone(currentDemoUsers) as unknown as T;
    if (method === 'POST') {
      const newUser = {
        id: Date.now(),
        username: String(body?.username ?? 'NeuerNutzer'),
        email: body?.email ? String(body.email) : null,
        avatar: String(body?.avatar ?? '🙂'),
        is_admin: Boolean(body?.is_admin),
        must_change_password: true,
      };
      currentDemoUsers.push(newUser as unknown as User);
      return structuredClone(newUser) as unknown as T;
    }
  }
  const adminMatch = /^\/users\/(\d+)\/admin$/.exec(basePath);
  if (adminMatch && method === 'PUT') {
    const targetId = Number(adminMatch[1]);
    const user = currentDemoUsers.find((u) => u.id === targetId);
    if (user) {
      user.is_admin = Boolean(body?.is_admin);
      return structuredClone(user) as unknown as T;
    }
  }
  const deleteUserMatch = /^\/users\/(\d+)$/.exec(basePath);
  if (deleteUserMatch && method === 'DELETE') {
    const targetId = Number(deleteUserMatch[1]);
    const idx = currentDemoUsers.findIndex((u) => u.id === targetId);
    if (idx !== -1) currentDemoUsers.splice(idx, 1);
    return {} as T;
  }

  if (path.startsWith('/users/search')) {
    const q = (new URLSearchParams(path.split('?')[1] ?? '').get('q') ?? '').toLowerCase();
    return currentDemoUsers.filter((u) => u.username.toLowerCase().includes(q)) as unknown as T;
  }

  // --- Likes toggling (/spots/:id/like, /ideas/:id/like, /notes/:id/like, /diary/:id/like) ---
  const likeMatch = /^\/(spots|ideas|notes|diary)\/(-?\d+)\/like$/.exec(basePath);
  if (likeMatch && method === 'POST') {
    const domain = likeMatch[1];
    const targetId = Number(likeMatch[2]);
    const likesKey = `/${domain === 'ideas' ? 'ideas' : domain}/likes`;
    const fkKey =
      domain === 'ideas'
        ? 'idea_id'
        : domain === 'diary'
          ? 'entry_id'
          : domain === 'notes'
            ? 'note_id'
            : 'spot_id';

    if (!(likesKey in store)) store[likesKey] = [];
    const existingIdx = store[likesKey].findIndex(
      (item) => item[fkKey] === targetId && item.user_id === currentDemoUser.id
    );

    if (existingIdx !== -1) {
      store[likesKey].splice(existingIdx, 1);
      persist();
      return { liked: false } as unknown as T;
    } else {
      store[likesKey].push({ id: nextId++, [fkKey]: targetId, user_id: currentDemoUser.id });
      persist();
      return { liked: true } as unknown as T;
    }
  }

  // --- Comments posting (/spots/:id/comments, /ideas/:id/comments, /notes/:id/comments, /diary/:id/comments) ---
  const commentMatch = /^\/(spots|ideas|notes|diary)\/(-?\d+)\/comments$/.exec(basePath);
  if (commentMatch && method === 'POST') {
    const domain = commentMatch[1];
    const targetId = Number(commentMatch[2]);
    const commentsKey = `/${domain}/comments`;
    const fkKey =
      domain === 'ideas'
        ? 'idea_id'
        : domain === 'diary'
          ? 'entry_id'
          : domain === 'notes'
            ? 'note_id'
            : 'spot_id';

    if (!(commentsKey in store)) store[commentsKey] = [];
    const created = {
      id: nextId++,
      [fkKey]: targetId,
      author_id: currentDemoUser.id,
      content: String(body?.content ?? ''),
      created_at: new Date().toISOString(),
    };
    store[commentsKey].push(created);
    persist();
    return created as unknown as T;
  }

  // --- Comment Likes toggling (/spots/comments/:id/like, /ideas/comments/:id/like, /notes/comments/:id/like, /diary/comments/:id/like) ---
  const commentLikeMatch = /^\/(spots|ideas|notes|diary)\/comments\/(-?\d+)\/like$/.exec(basePath);
  if (commentLikeMatch && method === 'POST') {
    const domain = commentLikeMatch[1];
    const commentId = Number(commentLikeMatch[2]);
    const commentsKey = `/${domain}/comments`;
    const comment = store[commentsKey]?.find((c) => (c as { id: number }).id === commentId) as
      { id: number; liked?: boolean; like_count?: number } | undefined;
    if (!comment) {
      throw new Error('Not found');
    }
    const wasLiked = Boolean(comment.liked);
    comment.liked = !wasLiked;
    comment.like_count = Math.max(0, ((comment.like_count as number) ?? 0) + (wasLiked ? -1 : 1));
    persist();
    return { liked: comment.liked, like_count: comment.like_count } as unknown as T;
  }

  // --- Done toggles (/spots/:id/done, /ideas/:id/done) ---
  const doneMatch = /^\/(spots|ideas)\/(-?\d+)\/done$/.exec(basePath);
  if (doneMatch && method === 'POST') {
    const domain = doneMatch[1];
    const targetId = Number(doneMatch[2]);
    const coll = `/${domain}`;
    const doneVal = body?.done ? 1 : 0;
    const existing = store[coll]?.find((item) => (item as { id: number }).id === targetId);
    if (existing) existing.done = doneVal;
    persist();
    return { done: !!doneVal } as unknown as T;
  }

  // --- Track recording endpoints (/tracks, /tracks/:id/stop, /tracks/:id/points) ---
  if (basePath === '/tracks' && method === 'POST') {
    const created = {
      id: nextId++,
      trip_id: Number(body?.trip_id ?? 1),
      user_id: currentDemoUser.id,
      excursion_id: (body?.excursion_id as number | null) ?? null,
      title: null,
      visibility: (body?.visibility as string) ?? 'private',
      started_at: new Date().toISOString(),
      ended_at: null,
    };
    if (!store['/tracks']) store['/tracks'] = [];
    store['/tracks'].push(created);
    persist();
    return created as unknown as T;
  }
  const trackStopMatch = /^\/tracks\/(-?\d+)\/stop$/.exec(basePath);
  if (trackStopMatch && method === 'POST') {
    const trackId = Number(trackStopMatch[1]);
    const found = store['/tracks']?.find((t) => (t as { id: number }).id === trackId);
    if (found) found.ended_at = new Date().toISOString();
    persist();
    return found as unknown as T;
  }
  const trackPointsMatch = /^\/tracks\/(-?\d+)\/points$/.exec(basePath);
  if (trackPointsMatch) {
    const trackId = Number(trackPointsMatch[1]);
    if (!store['/tracks/points']) store['/tracks/points'] = [];
    if (method === 'GET') {
      return store['/tracks/points'].filter(
        (p) => (p as { track_id: number }).track_id === trackId
      ) as unknown as T;
    }
    if (method === 'POST') {
      const rawPoints = Array.isArray(body?.points) ? body.points : [];
      const createdPoints = rawPoints.map((p) => ({
        id: nextId++,
        track_id: trackId,
        lat: Number((p as { lat: number }).lat),
        lng: Number((p as { lng: number }).lng),
        recorded_at: String(
          (p as { recorded_at?: string }).recorded_at ?? new Date().toISOString()
        ),
        accuracy: (p as { accuracy?: number }).accuracy ?? null,
      }));
      store['/tracks/points'].push(...createdPoints);
      persist();
      return createdPoints as unknown as T;
    }
  }

  // --- Budget Allocations UPSERT ---
  if (basePath === '/budget/allocations' && method === 'PUT') {
    const budgetId = Number(body?.budget_id);
    const category = String(body?.category ?? '');
    const amount = Number(body?.amount ?? 0);
    const existing = store['/budget/allocations']?.find(
      (a) =>
        (a as { budget_id: number; category: string }).budget_id === budgetId &&
        (a as { category: string }).category === category
    );
    if (existing) {
      existing.amount = amount;
      persist();
      return existing as unknown as T;
    } else {
      const created = { id: nextId++, budget_id: budgetId, category, amount };
      store['/budget/allocations'].push(created);
      persist();
      return created as unknown as T;
    }
  }

  const collection = collectionOf(path);
  if (!(collection in store)) {
    // Unbekannter Pfad (z. B. Push-Abo, Standortfreigabe, Entwürfe) - im Demo-Modus bewusst
    // erfolgreich no-open statt einen Fehler zu werfen, damit die jeweilige View nicht hängen bleibt.
    return (method === 'GET' ? [] : undefined) as unknown as T;
  }

  if (method === 'GET') {
    const rawList = store[collection];
    const searchParams = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
    const queryTripId = searchParams.get('trip_id')
      ? Number(searchParams.get('trip_id'))
      : undefined;

    if (queryTripId !== undefined) {
      // Filtern nach trip_id (oder verknüpfter Eltern-ID für Sub-Collections)
      if (collection === '/spots/likes' || collection === '/spots/comments') {
        const tripSpotIds = new Set(
          store['/spots']?.filter((s) => s.trip_id === queryTripId).map((s) => s.id)
        );
        return structuredClone(
          rawList.filter((item) => tripSpotIds.has(item.spot_id as number))
        ) as unknown as T;
      }
      if (collection === '/ideas/likes' || collection === '/ideas/comments') {
        const tripIdeaIds = new Set(
          store['/ideas']?.filter((e) => e.trip_id === queryTripId).map((e) => e.id)
        );
        return structuredClone(
          rawList.filter((item) => tripIdeaIds.has(item.idea_id as number))
        ) as unknown as T;
      }
      if (collection === '/diary/likes' || collection === '/diary/comments') {
        const tripEntryIds = new Set(
          store['/diary']?.filter((d) => d.trip_id === queryTripId).map((d) => d.id)
        );
        return structuredClone(
          rawList.filter((item) => tripEntryIds.has(item.entry_id as number))
        ) as unknown as T;
      }
      if (collection === '/notes/comments') {
        const tripNoteIds = new Set(
          store['/notes']?.filter((n) => n.trip_id === queryTripId).map((n) => n.id)
        );
        return structuredClone(
          rawList.filter((item) => tripNoteIds.has(item.note_id as number))
        ) as unknown as T;
      }
      if (collection === '/budget/allocations') {
        const tripBudgetIds = new Set(
          store['/budget/budgets']?.filter((b) => b.trip_id === queryTripId).map((b) => b.id)
        );
        return structuredClone(
          rawList.filter((item) => tripBudgetIds.has(item.budget_id as number))
        ) as unknown as T;
      }
      // Standard-Filterung für alle Sammlungen mit `trip_id`
      return structuredClone(
        rawList.filter((item) => item.trip_id === queryTripId)
      ) as unknown as T;
    }

    if (collection === '/attachments') {
      const domain = searchParams.get('domain');
      const entityId = searchParams.get('entity_id')
        ? Number(searchParams.get('entity_id'))
        : undefined;
      return structuredClone(
        rawList.filter(
          (item) =>
            (!domain || (item as { domain?: string }).domain === domain) &&
            (entityId === undefined || (item as { entity_id?: number }).entity_id === entityId)
        )
      ) as unknown as T;
    }

    return structuredClone(rawList) as unknown as T;
  }

  if (method === 'POST') {
    const id = nextId++;
    const created = { ...(body ?? {}), id };

    if (collection === '/attachments') {
      const dataUrl = String(body?.data ?? '');
      const mimeMatch = /^data:([^;]+);base64,/i.exec(dataUrl);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      (created as Record<string, unknown>).url = dataUrl;
      (created as Record<string, unknown>).original_name = String(body?.filename ?? 'attachment');
      (created as Record<string, unknown>).mime_type = mimeType;
      (created as Record<string, unknown>).size_bytes = sizeBytes;
      (created as Record<string, unknown>).created_at = new Date().toISOString();
    }

    store[collection] = [...store[collection], created];

    if (collection === '/ideas') {
      syncDemoIdeaSchedule(
        id,
        (body?.title as string) ?? '',
        body?.date as string | null | undefined,
        body?.trip_id as number | undefined
      );
    } else if (collection === '/schedule' && body?.idea_id) {
      const ideaId = Number(body.idea_id);
      const existingIdea = store['/ideas']?.find((e) => e.id === ideaId);
      if (existingIdea) existingIdea.date = body.date ?? null;
    }

    persist();
    return created as unknown as T;
  }

  if (method === 'PUT') {
    const id = idFromPath(path);
    store[collection] = store[collection].map((item) =>
      (item as { id: number }).id === id ? { ...item, ...(body ?? {}) } : item
    );
    const updated = store[collection].find((item) => (item as { id: number }).id === id);

    if (collection === '/ideas' && id != null) {
      const updatedIdea = store['/ideas'].find((item) => (item as { id: number }).id === id) as
        Record<string, unknown> | undefined;
      if (updatedIdea) {
        syncDemoIdeaSchedule(
          id,
          (updatedIdea.title as string) ?? '',
          updatedIdea.date as string | null | undefined,
          updatedIdea.trip_id as number | undefined
        );
      }
    } else if (collection === '/schedule' && id != null) {
      const schedItem = updated as { idea_id?: number | null; date?: string } | undefined;
      if (schedItem?.idea_id != null) {
        const idea = store['/ideas']?.find((e) => e.id === schedItem.idea_id);
        if (idea) idea.date = schedItem.date ?? null;
      }
    }

    persist();
    return updated as unknown as T;
  }

  if (method === 'DELETE') {
    const id = idFromPath(path);
    if (collection === '/schedule' && id != null) {
      const schedItem = store['/schedule']?.find((s) => s.id === id) as
        { idea_id?: number | null } | undefined;
      if (schedItem?.idea_id != null) {
        const idea = store['/ideas']?.find((e) => e.id === schedItem.idea_id);
        if (idea) idea.date = null;
      }
    }

    store[collection] = store[collection].filter((item) => (item as { id: number }).id !== id);
    if (collection === '/ideas' && id != null) {
      syncDemoIdeaSchedule(id, '', null);
    }
    persist();
    return undefined as T;
  }

  return undefined as T;
}
