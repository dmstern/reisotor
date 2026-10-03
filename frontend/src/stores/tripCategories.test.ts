import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripCategoriesStore, type TripCategory } from './tripCategories';
import { api } from '../api/client';

vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

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

  it('schließt ersetzte Standardkategorien aus activeSpotCategories aus und bindet den angepassten Namen ein', () => {
    const store = useTripCategoriesStore();

    store.categories = [
      {
        id: 8,
        trip_id: 10,
        type: 'spot',
        name: 'Flughafennnnn',
        default_name: 'Flughafen',
        icon: 'plane',
        emoji: '✈️',
        color: '#4a3aa7',
        is_hidden: 0,
        created_at: '',
      },
    ];

    expect(store.activeSpotCategories).toContain('Flughafennnnn');
    expect(store.activeSpotCategories).not.toContain('Flughafen');
  });

  it('schließt ausgeblendete angepasste Standardkategorien vollständig aus activeSpotCategories aus und erfasst beide Namen in hiddenNamesByType', () => {
    const store = useTripCategoriesStore();

    store.categories = [
      {
        id: 8,
        trip_id: 10,
        type: 'spot',
        name: 'Flughafennn',
        default_name: 'Flughafen',
        icon: 'plane',
        emoji: '✈️',
        color: '#4a3aa7',
        is_hidden: 1,
        created_at: '',
      },
    ];

    expect(store.activeSpotCategories).not.toContain('Flughafennn');
    expect(store.activeSpotCategories).not.toContain('Flughafen');
    expect(store.hiddenNamesByType.get('spot')?.has('flughafennn')).toBe(true);
    expect(store.hiddenNamesByType.get('spot')?.has('flughafen')).toBe(true);
  });

  it('führt resetCategory aus und lädt Kategorien neu', async () => {
    const store = useTripCategoriesStore();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({ success: true });
    vi.spyOn(api, 'get').mockResolvedValueOnce({ categories: [] });

    await store.resetCategory(5, 8);

    expect(postSpy).toHaveBeenCalledWith('/trips/5/categories/8/reset');
  });
});
