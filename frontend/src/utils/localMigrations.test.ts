import { beforeEach, describe, expect, it } from 'vitest';
import { clearOutbox, enqueue, getOutbox, type OutboxEntry } from '../api/offline';
import {
  CURRENT_LOCAL_DATA_VERSION,
  LOCAL_DATA_VERSION_KEY,
  migrateLocalData,
  migrateOutboxEntry,
  purgeStaleCache,
} from './localMigrations';

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

describe('localMigrations', () => {
  beforeEach(() => {
    const memory = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: memory,
      configurable: true,
      writable: true,
    });
    clearOutbox();
  });

  describe('migrateOutboxEntry', () => {
    it('parses stringified JSON body', () => {
      const entry = {
        id: '1',
        method: 'POST' as const,
        path: '/todos',
        body: JSON.stringify({ title: 'Test Todo' }),
        tempId: -100,
        createdAt: '2026-10-22T00:00:00Z',
      };
      const result = migrateOutboxEntry(entry);
      expect(result.changed).toBe(true);
      expect(entry.body).toEqual({ title: 'Test Todo' });
    });

    it('normalizes path by stripping /api/ prefix and double slashes', () => {
      const entry = {
        id: '1',
        method: 'PUT' as const,
        path: '/api//spots/42',
        body: { title: 'Spot' },
        createdAt: '2026-10-22T00:00:00Z',
      };
      const result = migrateOutboxEntry(entry);
      expect(result.changed).toBe(true);
      expect(entry.path).toBe('/spots/42');
    });

    it('adds negative tempId if missing on POST', () => {
      const entry: OutboxEntry = {
        id: '1',
        method: 'POST',
        path: '/todos',
        body: { title: 'New Todo' },
        createdAt: '2026-10-22T00:00:00Z',
      };
      const result = migrateOutboxEntry(entry);
      expect(result.changed).toBe(true);
      expect(entry.tempId).toBeDefined();
      expect(entry.tempId).toBeLessThan(0);
    });

    it('migrates budget entry with string amount and untrimmed category', () => {
      const entry = {
        id: '1',
        method: 'POST' as const,
        path: '/budget',
        body: { amount: '45.50', category: '  Essen  ', paid_by_user_id: '3' },
        tempId: -1,
        createdAt: '2026-10-22T00:00:00Z',
      };
      const result = migrateOutboxEntry(entry);
      expect(result.changed).toBe(true);
      expect(entry.body).toEqual({
        amount: 45.5,
        category: 'Essen',
        paid_by_user_id: 3,
      });
    });

    it('migrates todo entry with numeric done and name instead of title', () => {
      const entry = {
        id: '1',
        method: 'PUT' as const,
        path: '/todos/5',
        body: { name: 'Koffer packen', done: 1 },
        createdAt: '2026-10-22T00:00:00Z',
      };
      const result = migrateOutboxEntry(entry);
      expect(result.changed).toBe(true);
      expect(entry.body).toEqual({
        title: 'Koffer packen',
        name: 'Koffer packen',
        done: true,
      });
    });
  });

  describe('purgeStaleCache', () => {
    it('removes only reisotor-cache: keys and leaves outbox intact', () => {
      localStorage.setItem('reisotor-cache:/todos', '[{"id":1}]');
      localStorage.setItem('reisotor-cache:/spots', '[{"id":2}]');
      localStorage.setItem('reisotor-other', 'value');
      enqueue('POST', '/todos', { title: 'Offline' });

      const count = purgeStaleCache();
      expect(count).toBe(2);
      expect(localStorage.getItem('reisotor-cache:/todos')).toBeNull();
      expect(localStorage.getItem('reisotor-cache:/spots')).toBeNull();
      expect(localStorage.getItem('reisotor-other')).toBe('value');
      expect(getOutbox()).toHaveLength(1);
    });
  });

  describe('migrateLocalData', () => {
    it('runs migrations on all entries in outbox and updates version', () => {
      enqueue('POST', '/api/budget', { amount: '12.00', category: '  Food  ' });
      enqueue('POST', '/todos', { name: 'Einkaufen', done: 0 });

      localStorage.setItem(LOCAL_DATA_VERSION_KEY, '1');
      localStorage.setItem('reisotor-cache:/old-data', '{}');

      const report = migrateLocalData();
      expect(report.versionChanged).toBe(true);
      expect(report.migratedEntriesCount).toBe(2);
      expect(report.cachePurgedCount).toBe(1);
      expect(localStorage.getItem(LOCAL_DATA_VERSION_KEY)).toBe(String(CURRENT_LOCAL_DATA_VERSION));

      const updated = getOutbox();
      expect(updated[0].path).toBe('/budget');
      expect((updated[0].body as { amount: number }).amount).toBe(12);
      expect((updated[0].body as { category: string }).category).toBe('Food');
      expect((updated[1].body as { done: boolean }).done).toBe(false);
      expect((updated[1].body as { title: string }).title).toBe('Einkaufen');
    });
  });
});
