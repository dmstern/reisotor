import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpotsStore } from './spots';
import { useTripCategoriesStore } from './tripCategories';
import type { Spot, SpotComment } from '../api/types';
import { api } from '../api/client';

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

describe('useSpotsStore toggleCommentLike', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  const sampleComment: SpotComment = {
    id: 101,
    spot_id: 1,
    author_id: 2,
    content: 'Toller Ausblick!',
    created_at: '2026-08-01T10:00:00Z',
    like_count: 0,
    liked: false,
  };

  it('toggelt like optimistisch und übernimmt Server-Ergebnis unter Wahrung von shallowRef Reaktivität', async () => {
    const spotsStore = useSpotsStore();
    spotsStore.spotComments = [sampleComment];

    const initialArrayRef = spotsStore.spotComments;

    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      liked: true,
      like_count: 1,
    });

    const promise = spotsStore.toggleCommentLike(101);

    // Optimistisches Update muss eine neue Array-Referenz erzeugen (wichtig für shallowRef)
    expect(spotsStore.spotComments).not.toBe(initialArrayRef);
    expect(spotsStore.spotComments[0]?.liked).toBe(true);
    expect(spotsStore.spotComments[0]?.like_count).toBe(1);

    await promise;

    expect(postSpy).toHaveBeenCalledWith('/spots/comments/101/like');
    expect(spotsStore.spotComments[0]?.liked).toBe(true);
    expect(spotsStore.spotComments[0]?.like_count).toBe(1);
  });

  it('setzt Zustand bei Server-Fehler sauber auf den Ursprungswert zurück', async () => {
    const spotsStore = useSpotsStore();
    spotsStore.spotComments = [{ ...sampleComment, liked: true, like_count: 3 }];

    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network error'));

    await expect(spotsStore.toggleCommentLike(101)).rejects.toThrow('Network error');

    expect(spotsStore.spotComments[0]?.liked).toBe(true);
    expect(spotsStore.spotComments[0]?.like_count).toBe(3);
  });
});
