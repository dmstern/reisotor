import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTodoList } from './useTodoList';
import type { TodoItem } from '../api/types';

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

describe('useTodoList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockItems: TodoItem[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Ausweis erneuern',
      priority: 'high',
      assigned_to_user_id: null,
      due_date: null,
      note: null,
      done: 0,
    },
    {
      id: 2,
      trip_id: 1,
      title: 'Vignette kaufen',
      priority: 'medium',
      assigned_to_user_id: null,
      due_date: null,
      note: null,
      done: 1,
    },
  ];

  it('berechnet den Fortschritt (total, done)', () => {
    const list = useTodoList(1);
    list.items.value = mockItems;

    expect(list.progress.value).toEqual({ total: 2, done: 1 });
  });

  it('stellt toBody-Serialisierung für Formulare bereit', () => {
    const list = useTodoList(1);
    const body = list.toBody({
      title: ' Test ',
      priority: 'low',
      due_date: '2026-07-01',
      period: 'before',
      note: 'Notiz',
    });

    expect(body.title).toBe('Test');
    expect(body.due_date).toBe('2026-07-01');
    // Period wird bei gesetztem due_date verworfen
    expect(body.period).toBeUndefined();
    expect(body.note).toBe('Notiz');
  });
});
