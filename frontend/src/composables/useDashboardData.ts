import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { api } from '../api/client';
import type {
  DiaryEntry,
  Note,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  Spot,
  TodoItem,
  TravelItem,
  Trip,
  User,
} from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useBudgetStore } from '../stores/budget';
import { deriveTravelItems } from '../utils/deriveTravelItems';

export interface UseDashboardDataReturn {
  trip: ComputedRef<Trip | null>;
  tripId: number;
  schedule: Ref<ScheduleItem[]>;
  todos: Ref<TodoItem[]>;
  packing: Ref<PackingItem[]>;
  shopping: Ref<ShoppingItem[]>;
  travelItems: ComputedRef<TravelItem[]>;
  accommodations: ComputedRef<Spot[]>;
  diaryEntries: Ref<DiaryEntry[]>;
  notes: Ref<Note[]>;
  users: Ref<User[]>;
  trashEntries: Ref<{ id: number }[]>;
  trashCount: ComputedRef<number>;
  loading: Ref<boolean>;
  loadDashboardData: () => Promise<void>;
}

export function useDashboardData(tripIdOverride?: number): UseDashboardDataReturn {
  const tripStore = useTripStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const budgetStore = useBudgetStore();
  const liveSync = useLiveSyncStore();

  const tripId = tripIdOverride ?? (tripStore.currentTripId as number);
  const trip = computed(() => tripStore.currentTrip);

  const schedule = ref<ScheduleItem[]>([]);
  const todos = ref<TodoItem[]>([]);
  const packing = ref<PackingItem[]>([]);
  const shopping = ref<ShoppingItem[]>([]);
  const travelItems = computed(() =>
    deriveTravelItems(excursionsStore.excursions, spotsStore.spots)
  );
  const accommodations = computed(() =>
    spotsStore.spots.filter((s) => s.category === 'Unterkunft')
  );
  const diaryEntries = ref<DiaryEntry[]>([]);
  const notes = ref<Note[]>([]);
  const users = ref<User[]>([]);
  const trashEntries = ref<{ id: number }[]>([]);
  const trashCount = computed(() => trashEntries.value.length);
  const loading = ref(true);

  async function loadDashboardData() {
    try {
      const [
        scheduleRes,
        todosRes,
        packingRes,
        shoppingRes,
        diaryRes,
        notesRes,
        usersRes,
        trashRes,
      ] = await Promise.all([
        api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
        api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
        api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
        api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
        api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
        api.get<Note[]>(`/notes?trip_id=${tripId}`),
        api.get<User[]>(`/trips/${tripId}/members`),
        api.get<{ id: number }[]>(`/trash?trip_id=${tripId}`),
        spotsStore.load(),
        budgetStore.load(),
      ]);
      schedule.value = scheduleRes;
      todos.value = todosRes;
      packing.value = packingRes;
      shopping.value = shoppingRes;
      diaryEntries.value = diaryRes;
      notes.value = notesRes;
      users.value = usersRes;
      trashEntries.value = trashRes;
    } catch {
      // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
      // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" für immer blank zu bleiben
    } finally {
      loading.value = false;
    }
  }

  // Echtzeit-Sync: Widgets aktualisieren, sobald Änderungen eintreffen
  watch(
    () => liveSync.domainVersion.schedule,
    async () => {
      try {
        schedule.value = await api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );
  watch(
    () => liveSync.domainVersion.todos,
    async () => {
      try {
        todos.value = await api.get<TodoItem[]>(`/todos?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );
  watch(
    () => liveSync.domainVersion.packing,
    async () => {
      try {
        packing.value = await api.get<PackingItem[]>(`/packing?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );
  watch(
    () => liveSync.domainVersion.shopping,
    async () => {
      try {
        shopping.value = await api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );
  watch(
    () => liveSync.domainVersion.notes,
    async () => {
      try {
        notes.value = await api.get<Note[]>(`/notes?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );
  watch(
    () => liveSync.domainVersion.diary,
    async () => {
      try {
        diaryEntries.value = await api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`);
      } catch {
        // offline / ignorable
      }
    }
  );

  return {
    trip,
    tripId,
    schedule,
    todos,
    packing,
    shopping,
    travelItems,
    accommodations,
    diaryEntries,
    notes,
    users,
    trashEntries,
    trashCount,
    loading,
    loadDashboardData,
  };
}
