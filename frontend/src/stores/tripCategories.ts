import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { api } from '../api/client';
import { useTripStore } from './trip';
import { EXPENSE_CATEGORY_SUGGESTIONS } from '../utils/expenseCategory';
import { SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { resolveCategoryMeta, type ResolvedCategoryMeta } from '../utils/categoryIcons';

export interface TripCategory {
  id: number;
  trip_id: number;
  type: 'expense' | 'spot' | 'packing';
  name: string;
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
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
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
      }
    }
    return map;
  });

  /** Aktive (nicht ausgeblendete) Ausgabekategorien für Dropdowns & Autocomplete */
  const activeExpenseCategories = computed(() => {
    const hidden = hiddenNamesByType.value.get('expense') ?? new Set();
    const set = new Set<string>();

    // 1. Standard-Vorschläge (außer ausgeblendete)
    for (const def of EXPENSE_CATEGORY_SUGGESTIONS) {
      if (!hidden.has(def.trim().toLowerCase())) {
        set.add(def);
      }
    }

    // 2. Custom Kategorien dieses Urlaubs
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
    const set = new Set<string>();

    for (const def of SPOT_CATEGORY_SUGGESTIONS) {
      if (!hidden.has(def.trim().toLowerCase())) {
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
      (c) => c.type === type && c.name.trim().toLowerCase() === trimmedLower
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
    return updated;
  }

  async function deleteCategory(tripId: number, id: number): Promise<void> {
    await api.delete(`/trips/${tripId}/categories/${id}`);
    categories.value = categories.value.filter((c) => c.id !== id);
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

  return {
    categories,
    loading,
    loadedTripId,
    load,
    categoriesByType,
    activeExpenseCategories,
    activeSpotCategories,
    categoryMeta,
    createCategory,
    updateCategory,
    deleteCategory,
    setHidden,
  };
});
