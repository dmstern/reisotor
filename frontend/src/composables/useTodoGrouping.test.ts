import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTodoGrouping } from './useTodoGrouping';
import type { TodoItem, User, Trip } from '../api/types';

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

describe('useTodoGrouping', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockUsers: User[] = [
    { id: 1, username: 'Alice', email: 'alice@example.com', avatar: '👩' },
    { id: 2, username: 'Bob', email: 'bob@example.com', avatar: '👨' },
  ];

  const mockTrip = {
    id: 1,
    name: 'Sommerurlaub',
    destination: null,
    start_date: '2026-07-01',
    end_date: '2026-07-14',
    maps_link: null,
    lat: null,
    lng: null,
    image_url: null,
    packing_category_required: 1,
    weather_model: 'best_match',
  } as Trip;

  const mockItems: TodoItem[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Pässe prüfen',
      priority: 'high',
      due_date: '2026-06-15',
      assigned_to_user_id: 1,
      note: null,
      done: 0,
    },
    {
      id: 2,
      trip_id: 1,
      title: 'Sonnencreme kaufen',
      priority: 'low',
      due_date: '2026-07-05',
      assigned_to_user_id: 2,
      note: null,
      done: 1,
    },
  ];

  it('berechnet Gruppierung nach Bearbeiter:in korrekt', () => {
    const items = ref(mockItems);
    const users = ref(mockUsers);
    const trip = ref(mockTrip);

    const grouping = useTodoGrouping(items, users, trip);
    grouping.groupBy.value = 'assignee';

    const groups = grouping.groupedItems.value;
    expect(groups.length).toBe(3); // Alice, Bob, Unassigned
    expect(groups[0].key).toBe('user-1');
    expect(groups[0].items.length).toBe(1);
    expect(groups[0].items[0].id).toBe(1);
  });

  it('berechnet Gruppierung nach Zeitraum korrekt', () => {
    const items = ref(mockItems);
    const users = ref(mockUsers);
    const trip = ref(mockTrip);

    const grouping = useTodoGrouping(items, users, trip);
    grouping.groupBy.value = 'period';

    const groups = grouping.groupedItems.value;
    expect(groups.length).toBe(3); // before, during, none
    const beforeGroup = groups.find((g) => g.key === 'before');
    const duringGroup = groups.find((g) => g.key === 'during');
    expect(beforeGroup?.items.map((i) => i.id)).toContain(1);
    expect(duringGroup?.items.map((i) => i.id)).toContain(2);
  });

  it('sortiert erledigte Einträge ans Ende der Gruppe', () => {
    const items = ref<TodoItem[]>([
      { ...mockItems[0], id: 10, done: 1 },
      { ...mockItems[1], id: 20, done: 0, assigned_to_user_id: 1 },
    ]);
    const users = ref(mockUsers);
    const trip = ref(mockTrip);

    const grouping = useTodoGrouping(items, users, trip);
    grouping.groupBy.value = 'assignee';

    const aliceGroup = grouping.groupedItems.value.find((g) => g.key === 'user-1');
    expect(aliceGroup?.items[0].id).toBe(20);
    expect(aliceGroup?.items[1].id).toBe(10);
  });
});
