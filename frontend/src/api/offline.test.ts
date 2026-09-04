import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueue,
  findCachedItemInCollection,
  flushOutbox,
  mergePendingIntoList,
  nextTempId,
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

  it('stops and preserves the queue on network failure', async () => {
    enqueue('POST', '/spots', { title: 'Offline 1' });
    enqueue('POST', '/spots', { title: 'Offline 2' });

    const sendRaw = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const success = await flushOutbox(sendRaw);

    expect(success).toBe(false);
    expect(sendRaw).toHaveBeenCalledTimes(1);
  });
});
