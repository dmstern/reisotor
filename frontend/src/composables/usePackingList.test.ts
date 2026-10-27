import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePackingList } from './usePackingList';
import { useAuthStore } from '../stores/auth';
import type { PackingItem, User } from '../api/types';

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

describe('usePackingList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockUsers: User[] = [
    { id: 1, username: 'Alice', email: 'alice@example.com', avatar: '👩' },
    { id: 2, username: 'Bob', email: 'bob@example.com', avatar: '👨' },
  ];

  const mockItems: PackingItem[] = [
    {
      id: 1,
      trip_id: 1,
      label: 'T-Shirts',
      category: 'Kleidung',
      subcategory: 'Oberteile',
      quantity: 5,
      laid_out_count: 2,
      packed_count: 3,
      owner_id: 1,
    },
    {
      id: 2,
      trip_id: 1,
      label: 'Reiseapotheke',
      category: 'Gesundheit',
      subcategory: '',
      quantity: 1,
      laid_out_count: 0,
      packed_count: 1,
      owner_id: null,
    },
  ];

  it('berechnet Kategorien und Unterkategorien dedupliziert', () => {
    const hook = usePackingList(1);
    hook.items.value = mockItems;

    expect(hook.categories.value).toEqual(['Gesundheit', 'Kleidung']);
    expect(hook.subcategories.value).toEqual(['Oberteile']);
  });

  it('berechnet den Fortschritt basierend auf Stückzahlen', () => {
    const hook = usePackingList(1);
    hook.items.value = mockItems;

    const prog = hook.overallProgress.value;
    // T-Shirts: 3/5 gepackt, Reiseapotheke: 1/1 gepackt => 4 von 6
    expect(prog.total).toBe(6);
    expect(prog.packed).toBe(4);
  });

  it('partitioniert Listen in Eigene, Gemeinsame und Andere', () => {
    const auth = useAuthStore();
    auth.user = {
      id: 1,
      username: 'Alice',
      email: 'alice@example.com',
      avatar: '👩',
    } as unknown as User;

    const hook = usePackingList(1);
    hook.users.value = mockUsers;
    hook.items.value = mockItems;

    const partitioned = hook.lists.value;
    expect(partitioned.length).toBe(3); // Mine, Shared, Bob
    expect(partitioned[0].ownerId).toBe(1);
    expect(partitioned[0].items.length).toBe(1);
    expect(partitioned[1].key).toBe('shared');
    expect(partitioned[1].items.length).toBe(1);
    expect(partitioned[2].ownerId).toBe(2);
    expect(partitioned[2].items.length).toBe(0);
  });

  it('gruppiert Items nach Kategorie und Unterkategorie', () => {
    const hook = usePackingList(1);
    const groups = hook.groupByCategory(mockItems);

    expect(groups.length).toBe(2);
    const clothesGroup = groups.find((g) => g.category === 'Kleidung');
    expect(clothesGroup?.subgroups.length).toBe(1);
    expect(clothesGroup?.subgroups[0].subcategory).toBe('Oberteile');
  });
});
