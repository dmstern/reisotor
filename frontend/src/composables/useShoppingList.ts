import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Period, ShoppingItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { useToast } from './useToast';

export interface ShoppingFormInput {
  label: string;
  assigned_to_user_id?: number | null;
  link?: string | null;
  note?: string | null;
  shop?: string | null;
  period?: Period | '' | null;
}

export function useShoppingList(tripIdOverride?: number) {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const { showToast } = useToast();

  const tripId = tripIdOverride ?? (tripStore.currentTripId as number);
  const items = ref<ShoppingItem[]>([]);
  const users = ref<User[]>([]);
  const loading = ref(true);
  const highlightedIds = ref<Set<number>>(new Set());

  async function load() {
    try {
      const [itemsRes, usersRes] = await Promise.all([
        api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
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
      highlightedIds.value = liveSync.markSeen('shopping');
      load();
    });
  }

  watch(() => liveSync.domainVersion.shopping, load);

  const progress = computed(() => {
    const total = items.value.length;
    const checked = items.value.filter((i) => i.checked).length;
    return { total, checked };
  });

  async function toggle(item: ShoppingItem): Promise<ShoppingItem> {
    const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
      label: item.label,
      assigned_to_user_id: item.assigned_to_user_id,
      checked: !item.checked,
      link: item.link ?? undefined,
      note: item.note ?? undefined,
      shop: item.shop ?? undefined,
      period: item.period ?? undefined,
    });
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function reassign(
    item: ShoppingItem,
    assigned_to_user_id: number | null
  ): Promise<ShoppingItem> {
    const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
      label: item.label,
      assigned_to_user_id,
      checked: !!item.checked,
      link: item.link ?? undefined,
      note: item.note ?? undefined,
      shop: item.shop ?? undefined,
      period: item.period ?? undefined,
    });
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function addItem(input: ShoppingFormInput): Promise<ShoppingItem | null> {
    if (!input.label.trim()) return null;
    const created = await api.post<ShoppingItem>('/shopping', {
      trip_id: tripId,
      label: input.label.trim(),
      assigned_to_user_id: input.assigned_to_user_id ?? undefined,
      link: input.link || undefined,
      note: input.note || undefined,
      shop: input.shop || undefined,
      period: input.period || undefined,
    });
    items.value.push(created);
    return created;
  }

  async function quickAddToGroup(params: {
    groupKey: string;
    groupBy: 'buyer' | 'shop' | 'period';
    label: string;
    fallbackBuyer?: string;
    fallbackShop?: string;
    fallbackPeriod?: Period | '';
    unassignedShopLabel?: string;
  }): Promise<ShoppingItem | null> {
    if (!params.label.trim()) return null;
    const assigned_to_user_id =
      params.groupBy === 'buyer'
        ? params.groupKey.startsWith('user-')
          ? Number(params.groupKey.slice(5))
          : undefined
        : params.fallbackBuyer
          ? Number(params.fallbackBuyer)
          : undefined;

    const shop =
      params.groupBy === 'shop'
        ? params.groupKey === (params.unassignedShopLabel ?? 'Ohne Shop')
          ? undefined
          : params.groupKey
        : params.fallbackShop || undefined;

    const period =
      params.groupBy === 'period'
        ? params.groupKey === 'before' || params.groupKey === 'during'
          ? (params.groupKey as Period)
          : undefined
        : params.fallbackPeriod || undefined;

    const created = await api.post<ShoppingItem>('/shopping', {
      trip_id: tripId,
      label: params.label.trim(),
      assigned_to_user_id,
      shop,
      period,
    });
    items.value.push(created);
    return created;
  }

  async function submitEdit(
    id: number,
    input: ShoppingFormInput,
    checked: boolean
  ): Promise<ShoppingItem> {
    const updated = await api.put<ShoppingItem>(`/shopping/${id}`, {
      label: input.label.trim(),
      assigned_to_user_id: input.assigned_to_user_id,
      checked,
      link: input.link || undefined,
      note: input.note || undefined,
      shop: input.shop || undefined,
      period: input.period || undefined,
    });
    const idx = items.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/shopping/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
    showToast({ message: 'Artikel gelöscht. Er befindet sich nun im Papierkorb.', type: 'info' });
  }

  return {
    tripId,
    items,
    users,
    loading,
    highlightedIds,
    progress,
    load,
    toggle,
    reassign,
    addItem,
    quickAddToGroup,
    submitEdit,
    remove,
  };
}
