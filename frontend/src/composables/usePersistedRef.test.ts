import { ref, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedRef } from './usePersistedRef';

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
  };
}

describe('usePersistedRef', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('falls back to the default value when nothing is stored yet', () => {
    const value = usePersistedRef('test-key', 'buyer');
    expect(value.value).toBe('buyer');
  });

  it('round-trips a value through JSON on write and on the next read', () => {
    const value = usePersistedRef('test-key', { groupBy: 'buyer' });
    value.value = { groupBy: 'shop' };
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ groupBy: 'shop' }));

    const reloaded = usePersistedRef('test-key', { groupBy: 'buyer' });
    expect(reloaded.value).toEqual({ groupBy: 'shop' });
  });

  it('falls back to the default value when the stored JSON is corrupt', () => {
    localStorage.setItem('test-key', '{not valid json');
    const value = usePersistedRef('test-key', 'fallback');
    expect(value.value).toBe('fallback');
  });

  it('keeps independently-keyed refs isolated from each other', () => {
    const a = usePersistedRef('key-a', 'a-default');
    const b = usePersistedRef('key-b', 'b-default');
    a.value = 'a-changed';
    expect(a.value).toBe('a-changed');
    expect(b.value).toBe('b-default');
    expect(localStorage.getItem('key-b')).toBeNull();
  });

  it('supports reactive keys and switches storage partition when key changes', async () => {
    const tripId = ref(1);
    localStorage.setItem('shopping-shop:1', JSON.stringify('dm'));

    const lastShop = usePersistedRef(
      () => (tripId.value ? `shopping-shop:${tripId.value}` : ''),
      ''
    );
    expect(lastShop.value).toBe('dm');

    // Switch to fresh trip 2
    tripId.value = 2;
    await nextTick();
    expect(lastShop.value).toBe('');

    // Set value in trip 2
    lastShop.value = 'rewe';
    expect(localStorage.getItem('shopping-shop:2')).toBe(JSON.stringify('rewe'));
    expect(localStorage.getItem('shopping-shop:1')).toBe(JSON.stringify('dm'));

    // Switch back to trip 1
    tripId.value = 1;
    await nextTick();
    expect(lastShop.value).toBe('dm');
  });

  it('handles empty or null key safely without touching storage', () => {
    const value = usePersistedRef(() => '', 'fallback');
    expect(value.value).toBe('fallback');
    value.value = 'updated';
    expect(localStorage.getItem('')).toBeNull();
  });

  it('safely catches QuotaExceededError or storage exceptions on setItem', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const value = usePersistedRef('quota-key', 'initial');
    expect(() => {
      value.value = 'new-value';
    }).not.toThrow();
    expect(value.value).toBe('new-value');
  });
});
