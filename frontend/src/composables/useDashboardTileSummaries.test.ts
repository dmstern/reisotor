// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, ref } from 'vue';
import { progressOfPacking, useDashboardTileSummaries } from './useDashboardTileSummaries';
import type {
  DiaryEntry,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  Spot,
  TodoItem,
  TravelItem,
  Trip,
  User,
} from '../api/types';

describe('useDashboardTileSummaries', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('progressOfPacking', () => {
    it('calculates total and clamps checked to quantity', () => {
      const items: PackingItem[] = [
        {
          id: 1,
          trip_id: 1,
          category: 'Kleidung',
          subcategory: null,
          label: 'T-Shirts',
          quantity: 3,
          laid_out_count: 0,
          packed_count: 5, // exceeded
          owner_id: null,
        },
        {
          id: 2,
          trip_id: 1,
          category: 'Kleidung',
          subcategory: null,
          label: 'Hose',
          quantity: 2,
          laid_out_count: 0,
          packed_count: 1,
          owner_id: null,
        },
      ];

      const res = progressOfPacking(items);
      expect(res.total).toBe(5);
      expect(res.checked).toBe(4); // 3 (clamped) + 1
    });
  });

  describe('tile summary computeds', () => {
    const trip = ref<Trip | null>({
      id: 1,
      name: 'Testurlaub',
      destination: 'Alpen',
      start_date: '2099-06-01',
      end_date: '2099-06-15',
      maps_link: null,
      image_url: null,
      packing_category_required: 0,
      weather_model: 'best_match',
      lat: 47.0,
      lng: 11.0,
      owner_restricted: false,
    });

    const schedule = ref<ScheduleItem[]>([]);
    const todos = ref<TodoItem[]>([
      {
        id: 1,
        trip_id: 1,
        title: 'Vignette kaufen',
        done: 1,
        priority: 'high',
        assigned_to_user_id: null,
        due_date: null,
        note: null,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Reisepass prüfen',
        done: 0,
        priority: 'medium',
        assigned_to_user_id: null,
        due_date: null,
        note: null,
      },
    ]);
    const packing = ref<PackingItem[]>([
      {
        id: 1,
        trip_id: 1,
        category: 'Dokumente',
        subcategory: null,
        label: 'Ausweise',
        quantity: 2,
        laid_out_count: 2,
        packed_count: 2,
        owner_id: null,
      },
      {
        id: 2,
        trip_id: 1,
        category: 'Kleidung',
        subcategory: null,
        label: 'Badehose',
        quantity: 1,
        laid_out_count: 0,
        packed_count: 0,
        owner_id: 42,
      },
    ]);
    const shopping = ref<ShoppingItem[]>([
      {
        id: 1,
        trip_id: 1,
        label: 'Sonnencreme',
        checked: 1,
        assigned_to_user_id: null,
        link: null,
        note: null,
        shop: null,
        period: null,
      },
      {
        id: 2,
        trip_id: 1,
        label: 'Snacks',
        checked: 0,
        assigned_to_user_id: null,
        link: null,
        note: null,
        shop: null,
        period: null,
      },
    ]);
    const diaryEntries = ref<DiaryEntry[]>([
      {
        id: 1,
        trip_id: 1,
        author_id: 42,
        date: '2099-06-02',
        title: 'Früher Eintrag',
        content: 'Text',
        content_format: 'plain',
        images: [],
        created_at: '2099-06-02T10:00:00Z',
        updated_at: null,
        excursion_ids: [],
        spot_ids: [],
        editor_ids: [],
        is_draft: 0,
      },
      {
        id: 2,
        trip_id: 1,
        author_id: 42,
        date: '2099-06-05',
        title: 'Späterer Eintrag',
        content: 'Text',
        content_format: 'plain',
        images: [],
        created_at: '2099-06-05T12:00:00Z',
        updated_at: null,
        excursion_ids: [],
        spot_ids: [],
        editor_ids: [],
        is_draft: 0,
      },
    ]);
    const users = ref<User[]>([
      { id: 42, username: 'Daenu', email: 'd@test.com', avatar: '😎' },
      { id: 43, username: 'Partner', email: 'p@test.com', avatar: '🐱' },
    ]);
    const travelItems = ref<TravelItem[]>([]);
    const accommodations = ref<Spot[]>([]);

    it('computes shopping and todo progress correctly', () => {
      const summaries = useDashboardTileSummaries({
        trip,
        schedule,
        todos,
        packing,
        shopping,
        diaryEntries,
        users,
        travelItems,
        accommodations,
        currentUserId: computed(() => 42),
      });

      expect(summaries.shoppingProgress.value).toEqual({ total: 2, checked: 1 });
      expect(summaries.todoProgress.value).toEqual({ total: 2, done: 1 });
    });

    it('computes packing lists with Meine Liste for current user', () => {
      const summaries = useDashboardTileSummaries({
        trip,
        schedule,
        todos,
        packing,
        shopping,
        diaryEntries,
        users,
        travelItems,
        accommodations,
        currentUserId: computed(() => 42),
      });

      const lists = summaries.packingLists.value;
      const myList = lists.find((l) => l.key === 'user-42');
      const partnerList = lists.find((l) => l.key === 'user-43');
      const sharedList = lists.find((l) => l.key === 'shared');

      expect(myList?.title).toBe('Meine Liste');
      expect(myList?.total).toBe(1);
      expect(partnerList?.title).toBe('Partner');
      expect(partnerList?.total).toBe(0);
      expect(sharedList?.title).toBe('Gemeinsam');
      expect(sharedList?.total).toBe(2);
    });

    it('identifies latest diary entry by date', () => {
      const summaries = useDashboardTileSummaries({
        trip,
        schedule,
        todos,
        packing,
        shopping,
        diaryEntries,
        users,
        travelItems,
        accommodations,
      });

      expect(summaries.latestDiaryEntry.value?.title).toBe('Späterer Eintrag');
    });

    it('formats date without year', () => {
      const summaries = useDashboardTileSummaries({
        trip,
        schedule,
        todos,
        packing,
        shopping,
        diaryEntries,
        users,
        travelItems,
        accommodations,
      });

      const formatted = summaries.formatDate('2099-06-05');
      expect(formatted).not.toContain('2099');
      expect(formatted).toContain('05');
    });
  });
});
