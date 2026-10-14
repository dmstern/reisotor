import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { PackingItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useToast } from './useToast';
import { sortWithDoneLast } from './useCheckedSort';
import { isFullyPacked } from '../utils/packing';

export interface PackingListGroup {
  key: string;
  title: string;
  ownerId: number | null;
  items: PackingItem[];
}

export interface PackingSubGroup {
  subcategory: string | null;
  items: PackingItem[];
}

export interface PackingCategoryGroup {
  category: string;
  subgroups: PackingSubGroup[];
}

export interface PackingEditFormInput {
  label: string;
  category?: string;
  subcategory?: string;
  quantity: number;
  ownerId: string;
}

export const DEFAULT_PACKING_CATEGORY = 'Sonstiges';

export function usePackingList(tripIdOverride?: number) {
  const auth = useAuthStore();
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const uiSettings = useUiSettingsStore();
  const { showToast } = useToast();

  const tripId = tripIdOverride ?? (tripStore.currentTripId as number);
  const items = ref<PackingItem[]>([]);
  const users = ref<User[]>([]);
  const loading = ref(true);
  const highlightedIds = ref<Set<number>>(new Set());

  const quickAddCategories = ref<Record<string, string>>({});
  const quickAddSubcategories = ref<Record<string, string>>({});
  const quickAddQuantities = ref<Record<string, number>>({});

  const categoryRequired = computed(() => tripStore.currentTrip?.packing_category_required !== 0);

  async function load() {
    try {
      const [itemsRes, usersRes] = await Promise.all([
        api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
        api.get<User[]>(`/trips/${tripId}/members`),
      ]);
      items.value = itemsRes;
      users.value = usersRes;
    } catch {
      // Offline-Fallback
    } finally {
      loading.value = false;
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      highlightedIds.value = liveSync.markSeen('packing');
      load();
    });
  }

  watch(() => liveSync.domainVersion.packing, load);

  const categories = computed(() => {
    const set = new Set(items.value.map((i) => i.category?.trim()).filter((c): c is string => !!c));
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  const subcategories = computed(() => {
    const set = new Set(
      items.value.map((i) => i.subcategory?.trim()).filter((c): c is string => !!c)
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  const lists = computed<PackingListGroup[]>(() => {
    const memberIds = new Set(users.value.map((u) => u.id));
    const shared: PackingListGroup = {
      key: 'shared',
      title: '👥 Gemeinsame Packliste',
      ownerId: null,
      items: items.value.filter((i) => i.owner_id == null || !memberIds.has(i.owner_id)),
    };
    const perUser: PackingListGroup[] = users.value.map((u) => ({
      key: `user-${u.id}`,
      title:
        u.id === auth.user?.id
          ? `${u.avatar} Meine Packliste`
          : `${u.avatar} Packliste von ${u.username}`,
      ownerId: u.id,
      items: items.value.filter(
        (i) =>
          i.owner_id === u.id ||
          (users.value.length <= 1 && (i.owner_id == null || !memberIds.has(i.owner_id)))
      ),
    }));

    if (users.value.length <= 1) {
      return perUser;
    }

    const mine = perUser.filter((l) => l.ownerId === auth.user?.id);
    const others = perUser.filter((l) => l.ownerId !== auth.user?.id);
    return [...mine, shared, ...others];
  });

  watch(
    lists,
    (ls) => {
      if (!categoryRequired.value) return;
      for (const list of ls) {
        if (quickAddCategories.value[list.key] === undefined) {
          quickAddCategories.value[list.key] = DEFAULT_PACKING_CATEGORY;
        }
      }
    },
    { immediate: true }
  );

  function groupByCategory(listItems: PackingItem[]): PackingCategoryGroup[] {
    const visibleItems = uiSettings.hideCompletedPacking
      ? listItems.filter((i) => !isFullyPacked(i))
      : listItems;
    const catMap = new Map<string, PackingItem[]>();
    for (const item of visibleItems) {
      const key = item.category?.trim() || DEFAULT_PACKING_CATEGORY;
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(item);
    }
    return [...catMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([category, catItems]) => {
        const subMap = new Map<string, PackingItem[]>();
        for (const item of catItems) {
          const subKey = item.subcategory?.trim() || '';
          if (!subMap.has(subKey)) subMap.set(subKey, []);
          subMap.get(subKey)!.push(item);
        }
        const subgroups = [...subMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'de'))
          .map(([subcategory, subItems]) => ({
            subcategory: subcategory || null,
            items: sortWithDoneLast(subItems, isFullyPacked),
          }))
          .filter((sub) => sub.items.length > 0);
        return { category, subgroups };
      })
      .filter((catGroup) => catGroup.subgroups.length > 0);
  }

  function progress(listItems: PackingItem[]) {
    const total = listItems.reduce((sum, i) => sum + i.quantity, 0);
    const packed = listItems.reduce((sum, i) => sum + Math.min(i.packed_count, i.quantity), 0);
    return { total, packed };
  }

  const overallProgress = computed(() => progress(items.value));

  async function updateCounts(item: PackingItem, laidOutCount: number, packedCount: number) {
    const updated = await api.put<PackingItem>(`/packing/${item.id}`, {
      category: item.category ?? undefined,
      subcategory: item.subcategory ?? undefined,
      label: item.label,
      quantity: item.quantity,
      laid_out_count: laidOutCount,
      packed_count: packedCount,
      owner_id: item.owner_id,
    });
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function quickAdd(list: PackingListGroup, label: string): Promise<PackingItem | null> {
    if (!label.trim()) return null;
    const category = (quickAddCategories.value[list.key] ?? '').trim();
    if (categoryRequired.value && !category) return null;
    const subcategory = (quickAddSubcategories.value[list.key] ?? '').trim();
    const quantity = Math.max(1, Math.round(quickAddQuantities.value[list.key] || 1));
    const created = await api.post<PackingItem>('/packing', {
      trip_id: tripId,
      label: label.trim(),
      category: category || undefined,
      subcategory: subcategory || undefined,
      quantity,
      owner_id: list.ownerId,
    });
    items.value.push(created);
    quickAddQuantities.value[list.key] = 1;
    return created;
  }

  async function submitEdit(
    id: number,
    form: PackingEditFormInput,
    laidOutCount: number,
    packedCount: number
  ): Promise<PackingItem | null> {
    if (!form.label.trim()) return null;
    if (categoryRequired.value && !form.category?.trim()) return null;
    const owner_id = form.ownerId === 'shared' ? null : Number(form.ownerId);
    const updated = await api.put<PackingItem>(`/packing/${id}`, {
      label: form.label.trim(),
      category: form.category?.trim() || undefined,
      subcategory: form.subcategory?.trim() || undefined,
      quantity: Math.max(1, Math.round(form.quantity) || 1),
      laid_out_count: laidOutCount,
      packed_count: packedCount,
      owner_id,
    });
    const idx = items.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/packing/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
    showToast({
      message: 'Gegenstand gelöscht. Er befindet sich nun im Papierkorb.',
      type: 'info',
    });
  }

  return {
    tripId,
    items,
    users,
    loading,
    highlightedIds,
    categoryRequired,
    categories,
    subcategories,
    lists,
    overallProgress,
    quickAddCategories,
    quickAddSubcategories,
    quickAddQuantities,
    load,
    updateCounts,
    quickAdd,
    submitEdit,
    remove,
    groupByCategory,
    progress,
  };
}
