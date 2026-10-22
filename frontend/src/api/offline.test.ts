import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOutbox,
  enqueue,
  findCachedItemInCollection,
  flushOutbox,
  getOutbox,
  mergePendingIntoList,
  nextTempId,
  removeOutboxEntry,
  updateOutboxEntry,
  writeCache,
} from './offline';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('mergePendingIntoList', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('appends an offline-created item as a synthetic, negative-id pending entry', () => {
    const tempId = nextTempId();
    enqueue('POST', '/diary', { title: 'Strandtag', trip_id: 5 }, tempId);

    const merged = mergePendingIntoList('/diary?trip_id=5', []);

    expect(merged).toEqual([{ title: 'Strandtag', trip_id: 5, id: tempId, _pending: true }]);
  });

  it('merges an offline PUT over the existing item instead of replacing it', () => {
    enqueue('PUT', '/diary/42', { title: 'Neuer Titel' });

    const merged = mergePendingIntoList('/diary?trip_id=5', [
      { id: 42, title: 'Alter Titel', author_id: 7 },
    ]);

    expect(merged).toEqual([{ id: 42, title: 'Neuer Titel', author_id: 7, _pending: true }]);
  });

  it('removes an item that was deleted offline', () => {
    enqueue('DELETE', '/diary/42', undefined);

    const merged = mergePendingIntoList('/diary?trip_id=5', [{ id: 42, title: 'weg' }]);

    expect(merged).toEqual([]);
  });

  it('does not merge outbox entries belonging to a different collection', () => {
    enqueue('POST', '/notes', { title: 'Andere Sammlung' }, nextTempId());

    const merged = mergePendingIntoList('/diary?trip_id=5', [{ id: 1, title: 'unberührt' }]);

    expect(merged).toEqual([{ id: 1, title: 'unberührt' }]);
  });

  it('does not confuse a sub-resource path (e.g. comments) with the base collection', () => {
    enqueue('POST', '/diary/42/comments', { content: 'Kommentar' }, nextTempId());

    const merged = mergePendingIntoList('/diary?trip_id=5', [{ id: 42, title: 'Eintrag' }]);

    expect(merged).toEqual([{ id: 42, title: 'Eintrag' }]);
  });
});

describe('findCachedItemInCollection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('finds an item by id in a cached GET list for the same collection', () => {
    writeCache('/diary?trip_id=5', [{ id: 42, title: 'Eintrag', author_id: 7 }]);

    expect(findCachedItemInCollection('/diary', 42)).toEqual({
      id: 42,
      title: 'Eintrag',
      author_id: 7,
    });
  });

  it('returns undefined when no cached list contains a matching id', () => {
    writeCache('/diary?trip_id=5', [{ id: 42, title: 'Eintrag' }]);

    expect(findCachedItemInCollection('/diary', 99)).toBeUndefined();
  });

  it('does not match a differently-named collection with the same prefix', () => {
    writeCache('/diary/comments?trip_id=5', [{ id: 42, content: 'Kommentar' }]);

    expect(findCachedItemInCollection('/diary', 42)).toBeUndefined();
  });
});

describe('flushOutbox and outbox events', () => {
  let eventTarget: EventTarget;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    eventTarget = new EventTarget();
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => eventTarget.dispatchEvent(e),
      addEventListener: (t: string, l: EventListener) => eventTarget.addEventListener(t, l),
      removeEventListener: (t: string, l: EventListener) => eventTarget.removeEventListener(t, l),
    });
    vi.stubGlobal(
      'CustomEvent',
      class CustomEvent extends Event {
        detail: unknown;
        constructor(type: string, params?: { detail?: unknown }) {
          super(type);
          this.detail = params?.detail;
        }
      }
    );
  });

  it('dispatches reisotor:outbox-changed when enqueueing', () => {
    const handler = vi.fn();
    window.addEventListener('reisotor:outbox-changed', handler);

    enqueue('POST', '/spots', { title: 'Strand' }, nextTempId());

    expect(handler).toHaveBeenCalled();
    window.removeEventListener('reisotor:outbox-changed', handler);
  });

  it('flushes queued entries successfully and remaps tempIds in URLs and arrays', async () => {
    const tempId = -999;
    enqueue('POST', '/spots', { title: 'Neuer Spot' }, tempId);
    enqueue('PUT', `/ideas/10`, { title: 'Tour', spot_ids: [tempId, 42] });

    const sent: { method: string; path: string; body: unknown }[] = [];
    const sendRaw = vi.fn().mockImplementation(async (method, path, body) => {
      sent.push({ method, path, body });
      if (method === 'POST') {
        return { id: 777, title: 'Neuer Spot' };
      }
      return { id: 10, title: 'Tour' };
    });

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent[0].path).toBe('/spots');
    // Spot ID remapped in array inside body of second request:
    expect(sent[1].body).toEqual({ title: 'Tour', spot_ids: [777, 42] });
  });

  it('skips permanent 4xx client errors without blocking the outbox', async () => {
    enqueue('PUT', '/spots/404', { title: 'Gelöschter Spot' });
    enqueue('POST', '/todos', { title: 'Gültiges Todo' });

    const sendRaw = vi.fn().mockImplementation(async (method, path) => {
      if (path === '/spots/404') {
        const err = new Error('Not found') as Error & { status: number };
        err.status = 404;
        throw err;
      }
      return { id: 1, title: 'Gültiges Todo' };
    });

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(true);
    expect(sendRaw).toHaveBeenCalledTimes(2);
  });

  it('does not block independent items when one item fails', async () => {
    enqueue('POST', '/notes', { title: 'Fehlerhafte Notiz' });
    enqueue('POST', '/todos', { title: 'Erfolgreiches Todo' });

    const sendRaw = vi.fn().mockImplementation(async (_method, path) => {
      if (path === '/notes') {
        const err = Object.assign(new Error('Fetch is aborted'), { name: 'AbortError' });
        throw err;
      }
      return { id: 101, title: 'Erfolgreiches Todo' };
    });

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(false);
    expect(sendRaw).toHaveBeenCalledTimes(2);

    const outbox = getOutbox();
    // Das erfolgreiche Todo wurde übertragen und aus der Outbox entfernt.
    // Nur die fehlerhafte Notiz bleibt zurück!
    expect(outbox).toHaveLength(1);
    expect(outbox[0].path).toBe('/notes');
    expect(outbox[0].lastError?.message).toBe('Fetch is aborted');
    expect(outbox[0].retryCount).toBe(1);
  });

  it('preserves order and waits for parent when items depend on each other', async () => {
    const tempId = -888;
    enqueue('POST', '/spots', { title: 'Neuer Spot' }, tempId);
    enqueue('PUT', `/spots/${tempId}`, { title: 'Spot Update' });

    const sendRaw = vi.fn().mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(false);
    // Da PUT von POST (tempId) abhängt, darf PUT nicht ausgeführt werden, solange POST fehlschlägt!
    expect(sendRaw).toHaveBeenCalledTimes(1);

    const outbox = getOutbox();
    expect(outbox).toHaveLength(2);
    expect(outbox[0].lastError?.message).toBe('Failed to fetch');
  });

  it('automatically purges unqueueable paths (e.g. /routes/directions or /realtime) from the outbox', async () => {
    enqueue('POST', '/trips/1/routes/directions', { from_lat: 47, to_lat: 52 });
    enqueue('POST', '/realtime/position', { lat: 47, lng: 9 });
    enqueue('POST', '/todos', { title: 'Gültiges Todo' });

    const sendRaw = vi.fn().mockResolvedValue({ id: 50, title: 'Gültiges Todo' });

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(true);
    // Nur das gültige Todo wurde gesendet:
    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(sendRaw).toHaveBeenCalledWith('POST', '/todos', { title: 'Gültiges Todo' });
    expect(getOutbox()).toHaveLength(0);
  });

  it('records lastError and emits reisotor:outbox-failed on server error 500', async () => {
    enqueue('POST', '/budget', { amount: 10, title: 'Essen' });

    const failedHandler = vi.fn();
    window.addEventListener('reisotor:outbox-failed', failedHandler);

    const err = Object.assign(new Error('Internal Server Error'), { status: 500 });
    const sendRaw = vi.fn().mockRejectedValue(err);

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(false);
    expect(failedHandler).toHaveBeenCalledTimes(1);
    const detail = failedHandler.mock.calls[0][0].detail;
    expect(detail.entry.path).toBe('/budget');
    expect(detail.error.status).toBe(500);

    const outbox = getOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].lastError).toEqual({
      status: 500,
      message: 'Internal Server Error',
      timestamp: expect.any(String),
    });
    expect(outbox[0].retryCount).toBe(1);

    window.removeEventListener('reisotor:outbox-failed', failedHandler);
  });

  it('allows getting, updating, removing and clearing outbox entries', () => {
    enqueue('POST', '/todos', { title: 'Koffer packen' });
    enqueue('PUT', '/todos/1', { title: 'Fertig' });

    const list = getOutbox();
    expect(list).toHaveLength(2);

    const firstId = list[0].id;
    const updated = updateOutboxEntry(firstId, {
      body: { title: 'Großen Koffer packen' },
    });
    expect(updated).toBe(true);
    expect(getOutbox()[0].body).toEqual({ title: 'Großen Koffer packen' });

    const removed = removeOutboxEntry(firstId);
    expect(removed).toBe(true);
    expect(getOutbox()).toHaveLength(1);

    clearOutbox();
    expect(getOutbox()).toHaveLength(0);
  });
});
