import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useShoppingGrouping } from './useShoppingGrouping';
import type { ShoppingItem, User } from '../api/types';

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

describe('useShoppingGrouping', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockUsers: User[] = [
    { id: 1, username: 'Alice', email: 'alice@example.com', avatar: '👩' },
    { id: 2, username: 'Bob', email: 'bob@example.com', avatar: '👨' },
  ];

  const mockItems: ShoppingItem[] = [
    {
      id: 1,
      trip_id: 1,
      label: 'Sonnencreme',
      shop: 'Drogerie',
      period: 'before',
      assigned_to_user_id: 1,
      link: null,
      note: null,
      checked: 0,
    },
    {
      id: 2,
      trip_id: 1,
      label: 'Käse',
      shop: 'Supermarkt',
      period: 'during',
      assigned_to_user_id: 2,
      link: null,
      note: null,
      checked: 1,
    },
  ];

  it('gruppiert korrekt nach Shop', () => {
    const items = ref(mockItems);
    const users = ref(mockUsers);

    const grouping = useShoppingGrouping(items, users);
    grouping.groupBy.value = 'shop';

    const groups = grouping.groupedItems.value;
    expect(groups.length).toBe(2);
    expect(groups.map((g) => g.key)).toEqual(['Drogerie', 'Supermarkt']);
  });

  it('erkennt alle bekannten Shops dedupliziert und alphabetisch', () => {
    const items = ref(mockItems);
    const users = ref(mockUsers);

    const grouping = useShoppingGrouping(items, users);
    expect(grouping.knownShops.value).toEqual(['Drogerie', 'Supermarkt']);
  });

  it('gruppiert nach Einkäufer:in und sortiert erledigte Einträge nach hinten', () => {
    const items = ref<ShoppingItem[]>([
      { ...mockItems[0], checked: 1 },
      { ...mockItems[0], id: 3, label: 'Handtuch', checked: 0 },
    ]);
    const users = ref(mockUsers);

    const grouping = useShoppingGrouping(items, users);
    grouping.groupBy.value = 'buyer';

    const aliceGroup = grouping.groupedItems.value.find((g) => g.key === 'user-1');
    expect(aliceGroup?.items[0].id).toBe(3);
    expect(aliceGroup?.items[1].id).toBe(1);
  });
});
