import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { api } from '../api/client';
import { useTripStore } from './trip';
import { useToast } from '../composables/useToast';
import { EXPENSE_CATEGORY_SUGGESTIONS } from '../utils/expenseCategory';
import { SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { resolveCategoryMeta, type ResolvedCategoryMeta } from '../utils/categoryIcons';

export interface TripCategory {
  id: number;
  trip_id: number;
  type: 'expense' | 'spot' | 'packing';
  name: string;
  default_name?: string | null;
  icon: string | null;
  emoji: string | null;
  color: string | null;
  is_hidden: number;
  created_at: string;
  usage_count?: number;
}

export interface CategoryInput {
  type: 'expense' | 'spot' | 'packing';
  name: string;
  default_name?: string | null;
  previous_name?: string | null;
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
}

export interface CategoryUsageItem {
  id: string;
  title: string;
  amount?: number;
  date?: string | null;
  subtitle?: string;
}

export const useTripCategoriesStore = defineStore('tripCategories', () => {
  const tripStore = useTripStore();
  const categories = ref<TripCategory[]>([]);
  const loading = ref(false);
  const loadedTripId = ref<number | null>(null);

  async function load(tripId?: number, force = false) {
    const targetId = tripId ?? tripStore.currentTripId;
    if (targetId == null) {
      categories.value = [];
      loadedTripId.value = null;
      return;
    }
    if (!force && loadedTripId.value === targetId) return;

    loading.value = true;
    try {
      const res = await api.get<{ categories: TripCategory[] }>(`/trips/${targetId}/categories`);
      categories.value = res.categories ?? [];
      loadedTripId.value = targetId;
    } finally {
      loading.value = false;
    }
  }

  // Bei Urlaub-Wechsel Kategorien automatisch neu laden
  watch(
    () => tripStore.currentTripId,
    (newId) => {
      if (newId != null) {
        load(newId, true);
      } else {
        categories.value = [];
        loadedTripId.value = null;
      }
    },
    { immediate: true }
  );

  /** Alle Kategorien eines Typs (Ausgaben, Spots, Packliste) */
  function categoriesByType(type: 'expense' | 'spot' | 'packing') {
    return computed(() => categories.value.filter((c) => c.type === type));
  }

  /** Set der ausgeblendeten Standard-Kategorienamen (lowercase) pro Typ */
  const hiddenNamesByType = computed(() => {
    const map = new Map<'expense' | 'spot' | 'packing', Set<string>>();
    map.set('expense', new Set());
    map.set('spot', new Set());
    map.set('packing', new Set());

    for (const c of categories.value) {
      if (c.is_hidden) {
        map.get(c.type)?.add(c.name.trim().toLowerCase());
        if (c.default_name) {
          map.get(c.type)?.add(c.default_name.trim().toLowerCase());
        }
      }
    }
    return map;
  });

  /** Set der ursprünglichen Standard-Kategorienamen (lowercase), die durch eine Umbenennung ersetzt wurden */
  const replacedDefaultNamesByType = computed(() => {
    const map = new Map<'expense' | 'spot' | 'packing', Set<string>>();
    map.set('expense', new Set());
    map.set('spot', new Set());
    map.set('packing', new Set());

    for (const c of categories.value) {
      if (c.default_name && c.default_name.trim().toLowerCase() !== c.name.trim().toLowerCase()) {
        map.get(c.type)?.add(c.default_name.trim().toLowerCase());
      }
    }
    return map;
  });

  /** Aktive (nicht ausgeblendete) Ausgabekategorien für Dropdowns & Autocomplete */
  const activeExpenseCategories = computed(() => {
    const hidden = hiddenNamesByType.value.get('expense') ?? new Set();
    const replaced = replacedDefaultNamesByType.value.get('expense') ?? new Set();
    const set = new Set<string>();

    // 1. Standard-Vorschläge (außer ausgeblendete und durch Umbenennung ersetzte)
    for (const def of EXPENSE_CATEGORY_SUGGESTIONS) {
      const lower = def.trim().toLowerCase();
      if (!hidden.has(lower) && !replaced.has(lower)) {
        set.add(def);
      }
    }

    // 2. Custom & angepasste Kategorien dieses Urlaubs
    for (const c of categories.value) {
      if (c.type === 'expense' && !c.is_hidden && c.name.trim()) {
        set.add(c.name.trim());
      }
    }

    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  /** Aktive (nicht ausgeblendete) Spot-Kategorien für Dropdowns & Autocomplete */
  const activeSpotCategories = computed(() => {
    const hidden = hiddenNamesByType.value.get('spot') ?? new Set();
    const replaced = replacedDefaultNamesByType.value.get('spot') ?? new Set();
    const set = new Set<string>();

    for (const def of SPOT_CATEGORY_SUGGESTIONS) {
      const lower = def.trim().toLowerCase();
      if (!hidden.has(lower) && !replaced.has(lower)) {
        set.add(def);
      }
    }

    for (const c of categories.value) {
      if (c.type === 'spot' && !c.is_hidden && c.name.trim()) {
        set.add(c.name.trim());
      }
    }

    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  /** Löst Metadaten für eine Kategorie auf unter Berücksichtigung von Custom-Overrides */
  function categoryMeta(name: string, type: 'expense' | 'spot'): ResolvedCategoryMeta {
    const trimmedLower = (name ?? '').trim().toLowerCase();
    const custom = categories.value.find(
      (c) =>
        c.type === type &&
        (c.name.trim().toLowerCase() === trimmedLower ||
          (c.default_name && c.default_name.trim().toLowerCase() === trimmedLower))
    );
    return resolveCategoryMeta(name, type, custom);
  }

  async function createCategory(tripId: number, data: CategoryInput): Promise<TripCategory> {
    const created = await api.post<TripCategory>(`/trips/${tripId}/categories`, data);
    // In lokale Liste einfügen oder ersetzen
    const idx = categories.value.findIndex(
      (c) => c.type === created.type && c.name.toLowerCase() === created.name.toLowerCase()
    );
    if (idx >= 0) {
      categories.value[idx] = created;
    } else {
      categories.value.push(created);
    }
    await load(tripId, true);
    return created;
  }

  async function updateCategory(
    tripId: number,
    id: number,
    data: Partial<CategoryInput & { is_hidden: boolean | number }>
  ): Promise<TripCategory> {
    const updated = await api.put<TripCategory>(`/trips/${tripId}/categories/${id}`, data);
    const idx = categories.value.findIndex((c) => c.id === id);
    if (idx >= 0) {
      categories.value[idx] = updated;
    }
    await load(tripId, true);
    return updated;
  }

  async function resetCategory(tripId: number, id: number): Promise<void> {
    const { showToast } = useToast();
    await api.post(`/trips/${tripId}/categories/${id}/reset`);
    await load(tripId, true);
    showToast({
      message: 'Kategorie auf Standard zurückgesetzt.',
      type: 'info',
    });
  }

  async function deleteCategory(tripId: number, id: number): Promise<void> {
    const { showToast } = useToast();
    await api.delete(`/trips/${tripId}/categories/${id}`);
    categories.value = categories.value.filter((c) => c.id !== id);
    showToast({
      message: 'Kategorie gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
    });
  }

  async function setHidden(
    tripId: number,
    type: 'expense' | 'spot' | 'packing',
    name: string,
    isHidden: boolean
  ): Promise<void> {
    await api.post(`/trips/${tripId}/categories/hide`, { type, name, is_hidden: isHidden });
    // Neu laden, um synchronen DB-Zustand sicherzustellen
    await load(tripId, true);
  }

  async function getCategoryUsageItems(
    tripId: number,
    type: 'expense' | 'spot' | 'packing',
    name: string
  ): Promise<CategoryUsageItem[]> {
    try {
      const res = await api.get<{
        items: CategoryUsageItem[];
        allocations?: CategoryUsageItem[];
      }>(`/trips/${tripId}/categories/usage-items?type=${type}&name=${encodeURIComponent(name)}`);
      const list = [...(res.items || [])];
      if (res.allocations?.length) {
        list.push(...res.allocations);
      }
      return list;
    } catch {
      return [];
    }
  }

  return {
    categories,
    loading,
    loadedTripId,
    load,
    categoriesByType,
    hiddenNamesByType,
    replacedDefaultNamesByType,
    activeExpenseCategories,
    activeSpotCategories,
    categoryMeta,
    createCategory,
    updateCategory,
    resetCategory,
    deleteCategory,
    setHidden,
    getCategoryUsageItems,
  };
});
