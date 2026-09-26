import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripCategoriesStore, type TripCategory } from './tripCategories';
import { api } from '../api/client';

describe('useTripCategoriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('berechnet activeExpenseCategories unter Ausschluss ausgeblendeter Standardkategorien', () => {
    const store = useTripCategoriesStore();

    store.categories = [
      {
        id: 1,
        trip_id: 10,
        type: 'expense',
        name: 'Tauchkurs',
        icon: 'swimming',
        emoji: '🤿',
        color: '#0ea5e9',
        is_hidden: 0,
        created_at: '',
      },
      {
        id: 2,
        trip_id: 10,
        type: 'expense',
        name: 'Flug & Anreise',
        icon: null,
        emoji: null,
        color: null,
        is_hidden: 1,
        created_at: '',
      },
    ];

    expect(store.activeExpenseCategories).toContain('Tauchkurs');
    expect(store.activeExpenseCategories).not.toContain('Flug & Anreise');
    expect(store.activeExpenseCategories).toContain('Unterkunft');
  });

  it('löst Metadaten mit Vorrang für benutzerdefinierte Einträge auf', () => {
    const store = useTripCategoriesStore();

    store.categories = [
      {
        id: 1,
        trip_id: 10,
        type: 'expense',
        name: 'Tauchkurs',
        icon: 'swimming',
        emoji: '🤿',
        color: '#0ea5e9',
        is_hidden: 0,
        created_at: '',
      },
    ];

    const meta = store.categoryMeta('Tauchkurs', 'expense');
    expect(meta.label).toBe('Tauchkurs');
    expect(meta.icon).toBe('🤿');
    expect(meta.color).toBe('#0ea5e9');
    expect(meta.tabler.id).toBe('swimming');

    // Standard-Fallback
    const standardMeta = store.categoryMeta('Unterkunft', 'expense');
    expect(standardMeta.color).toBe('#1baf7a');
  });

  it('lädt Kategorien über API', async () => {
    const store = useTripCategoriesStore();

    const mockCategories: TripCategory[] = [
      {
        id: 42,
        trip_id: 5,
        type: 'spot',
        name: 'Aussichtsturm',
        icon: 'camera',
        emoji: '🗼',
        color: '#f59e0b',
        is_hidden: 0,
        created_at: '',
        usage_count: 2,
      },
    ];

    vi.spyOn(api, 'get').mockResolvedValueOnce({ categories: mockCategories });

    await store.load(5, true);

    expect(store.categories.length).toBe(1);
    expect(store.categories[0].name).toBe('Aussichtsturm');
    expect(store.activeSpotCategories).toContain('Aussichtsturm');
  });
});
