import { computed, type ComputedRef, type Ref } from 'vue';
import type {
  CalendarEntry,
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
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { buildAllEntries } from '../utils/calendarEntries';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';

export interface UseDashboardTileSummariesOptions {
  trip: Ref<Trip | null | undefined> | ComputedRef<Trip | null | undefined>;
  schedule: Ref<ScheduleItem[]>;
  todos: Ref<TodoItem[]>;
  packing: Ref<PackingItem[]>;
  shopping: Ref<ShoppingItem[]>;
  diaryEntries: Ref<DiaryEntry[]>;
  users: Ref<User[]>;
  travelItems: Ref<TravelItem[]> | ComputedRef<TravelItem[]>;
  accommodations: Ref<Spot[]> | ComputedRef<Spot[]>;
  currentUserId?: Ref<number | undefined> | ComputedRef<number | undefined>;
}

export interface PackingListBreakdown {
  key: string;
  title: string;
  avatar?: string | null;
  total: number;
  checked: number;
}

export interface UseDashboardTileSummariesReturn {
  upcomingEntries: ComputedRef<CalendarEntry[]>;
  packingTotal: ComputedRef<{ total: number; checked: number }>;
  packingLists: ComputedRef<PackingListBreakdown[]>;
  shoppingProgress: ComputedRef<{ total: number; checked: number }>;
  todoProgress: ComputedRef<{ total: number; done: number }>;
  nextTravelItem: ComputedRef<TravelItem | null>;
  currentOrNextAccommodation: ComputedRef<Spot | null>;
  latestDiaryEntry: ComputedRef<DiaryEntry | null>;
  formatDate: (d: string) => string;
}

export function progressOfPacking(listItems: PackingItem[]): { total: number; checked: number } {
  const total = listItems.reduce((sum, p) => sum + p.quantity, 0);
  const checked = listItems.reduce((sum, p) => sum + Math.min(p.packed_count, p.quantity), 0);
  return { total, checked };
}

export function useDashboardTileSummaries(
  options: UseDashboardTileSummariesOptions
): UseDashboardTileSummariesReturn {
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();

  const todayStr = () => toLocalDateString(new Date());

  const upcomingEntries = computed(() =>
    buildAllEntries(
      options.schedule.value,
      options.trip.value ?? null,
      options.todos.value,
      options.travelItems.value,
      excursionsStore.excursions,
      spotsStore.spots
    )
      .filter((e) => e.endDate >= todayStr())
      .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
      .slice(0, 3)
  );

  const packingTotal = computed(() => progressOfPacking(options.packing.value));

  const packingLists = computed(() => {
    const shared = {
      key: 'shared',
      title: 'Gemeinsam',
      avatar: '🤝',
      ...progressOfPacking(options.packing.value.filter((p) => p.owner_id == null)),
    };
    const myId = options.currentUserId?.value;
    const perUser = options.users.value.map((u) => ({
      key: `user-${u.id}`,
      title: u.id === myId ? 'Meine Liste' : u.username,
      avatar: u.avatar,
      ...progressOfPacking(options.packing.value.filter((p) => p.owner_id === u.id)),
    }));
    return [...perUser, shared];
  });

  const shoppingProgress = computed(() => {
    const total = options.shopping.value.length;
    const checked = options.shopping.value.filter((s) => s.checked).length;
    return { total, checked };
  });

  const todoProgress = computed(() => {
    const total = options.todos.value.length;
    const done = options.todos.value.filter((t) => t.done).length;
    return { total, done };
  });

  const nextTravelItem = computed(
    () =>
      [...options.travelItems.value]
        .filter((t) => t.date && t.date >= todayStr())
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0] ?? null
  );

  const currentOrNextAccommodation = computed(() => {
    const today = todayStr();
    const current = options.accommodations.value.find(
      (a) => a.start_date && a.end_date && a.start_date <= today && today <= a.end_date
    );
    if (current) return current;
    return (
      [...options.accommodations.value]
        .filter((a) => a.start_date && a.start_date >= today)
        .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0] ?? null
    );
  });

  const latestDiaryEntry = computed(
    () =>
      [...options.diaryEntries.value].sort(
        (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
      )[0] ?? null
  );

  function formatDate(d: string) {
    return formatDateShared(d, { includeYear: false });
  }

  return {
    upcomingEntries,
    packingTotal,
    packingLists,
    shoppingProgress,
    todoProgress,
    nextTravelItem,
    currentOrNextAccommodation,
    latestDiaryEntry,
    formatDate,
  };
}
