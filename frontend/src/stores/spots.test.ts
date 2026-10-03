import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpotsStore } from './spots';
import { useTripCategoriesStore } from './tripCategories';
import type { Spot } from '../api/types';

vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('useSpotsStore computeds', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function spot(id: number, category: string | null): Spot {
    return {
      id,
      trip_id: 1,
      title: `Spot ${id}`,
      image_url: null,
      category,
      note: null,
      note_format: 'html',
      maps_link: null,
      lat: null,
      lng: null,
      created_by: 1,
      is_home: 0,
      address: null,
      start_date: null,
      end_date: null,
      checkin: null,
      checkout: null,
      contact: null,
      amount: null,
      paid_by_user_id: null,
      budget_expense_id: null,
      done: 0,
    };
  }

  it('schließt ausgeblendete oder ersetzte Kategorien aus spotCategories aus, selbst wenn Spots sie nutzen', () => {
    const spotsStore = useSpotsStore();
    const categoriesStore = useTripCategoriesStore();

    categoriesStore.categories = [
      {
        id: 1,
        trip_id: 1,
        type: 'spot',
        name: 'Flughafennn',
        default_name: 'Flughafen',
        icon: null,
        emoji: null,
        color: null,
        is_hidden: 1,
        created_at: '',
      },
    ];

    spotsStore.spots = [spot(1, 'Flughafennn'), spot(2, 'Flughafen'), spot(3, 'Aussichtsturm')];

    expect(spotsStore.spotCategories).not.toContain('Flughafennn');
    expect(spotsStore.spotCategories).not.toContain('Flughafen');
    expect(spotsStore.spotCategories).toContain('Aussichtsturm');
  });

  it('bindet nicht-ausgeblendete benutzerdefinierte Kategorien von Spots ein', () => {
    const spotsStore = useSpotsStore();
    const categoriesStore = useTripCategoriesStore();
    categoriesStore.categories = [];

    spotsStore.spots = [spot(1, 'Geheimtipp')];

    expect(spotsStore.spotCategories).toContain('Geheimtipp');
  });
});
