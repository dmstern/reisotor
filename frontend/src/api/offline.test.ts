import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueue,
  findCachedItemInCollection,
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
