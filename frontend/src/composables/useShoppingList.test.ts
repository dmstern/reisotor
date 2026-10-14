import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useShoppingList } from './useShoppingList';
import type { ShoppingItem } from '../api/types';

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

describe('useShoppingList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockItems: ShoppingItem[] = [
    {
      id: 1,
      trip_id: 1,
      label: 'Klopapier',
      assigned_to_user_id: null,
      link: null,
      note: null,
      shop: null,
      period: null,
      checked: 1,
    },
    {
      id: 2,
      trip_id: 1,
      label: 'Nudeln',
      assigned_to_user_id: null,
      link: null,
      note: null,
      shop: null,
      period: null,
      checked: 0,
    },
  ];

  it('berechnet den Fortschritt (total, checked)', () => {
    const list = useShoppingList(1);
    list.items.value = mockItems;

    expect(list.progress.value).toEqual({ total: 2, checked: 1 });
  });
});
