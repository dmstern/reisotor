import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import {
  useTripCategoriesStore,
  type TripCategory,
  type CategoryUsageItem,
} from '../stores/tripCategories';
import {
  CATEGORY_COLOR_PALETTE,
  findCategoryIcon,
  type CategoryIconOption,
} from '../utils/categoryIcons';
import { KNOWN_EXPENSE_CATEGORIES } from '../utils/expenseCategory';
import { KNOWN_CATEGORIES as KNOWN_SPOT_CATEGORIES } from '../utils/spotCategory';
import type { DisplayCategory } from '../components/TripCategoryRow.vue';
import type { CategoryFormData } from '../components/TripCategoryFormFields.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

export function useTripCategorySettings(tripIdGetter: MaybeRefOrGetter<number>) {
  const tripCategoriesStore = useTripCategoriesStore();

  const activeType = ref<'expense' | 'spot'>('spot');
  const SCOPE_OPTIONS = [
    {
      value: 'spot',
      label: 'Spots',
      icon: FORM_FIELD_ICONS.location,
      iconGroup: 'formFields' as const,
    },
    {
      value: 'expense',
      label: 'Ausgaben',
      icon: FORM_FIELD_ICONS.amount,
      iconGroup: 'formFields' as const,
    },
  ];
  const searchQuery = ref('');
  const showCreateForm = ref(false);
  const editingCategory = ref<DisplayCategory | null>(null);
  const categoryToDelete = ref<{ id: number; name: string; count: number } | null>(null);
  const categoryToReset = ref<DisplayCategory | null>(null);
  const showIconPicker = ref(false);
  const iconPickerTarget = ref<'create' | 'edit'>('create');

  // Form-State für Neuanlage
  const createForm = ref<CategoryFormData>({
    name: '',
    icon: 'category',
    emoji: '🏷️',
    color: CATEGORY_COLOR_PALETTE[0],
  });

  // Form-State für Bearbeitung
  const editForm = ref<CategoryFormData & { id: number; usage_count: number }>({
    id: 0,
    name: '',
    icon: 'category',
    emoji: '🏷️',
    color: CATEGORY_COLOR_PALETTE[0],
    usage_count: 0,
  });

  const usageItems = ref<CategoryUsageItem[]>([]);
  const isLoadingUsageItems = ref(false);

  const currentPickerIconId = computed(() =>
    iconPickerTarget.value === 'create' ? createForm.value.icon : editForm.value.icon
  );

  // Bei Wechsel von tripId Store synchronisieren
  watch(
    () => toValue(tripIdGetter),
    (id) => {
      if (id && typeof window !== 'undefined') tripCategoriesStore.load(id, true);
    },
    { immediate: true }
  );

  function selectIcon(option: CategoryIconOption) {
    if (iconPickerTarget.value === 'create') {
      createForm.value.icon = option.id;
      createForm.value.emoji = option.defaultEmoji;
    } else {
      editForm.value.icon = option.id;
      editForm.value.emoji = option.defaultEmoji;
    }
    showIconPicker.value = false;
  }

  function openIconPicker(target: 'create' | 'edit') {
    iconPickerTarget.value = target;
    showIconPicker.value = true;
  }

  // Liste der Standardkategorien des aktiven Typs
  const defaultSuggestions = computed<{ label: string; icon?: string; color?: string }[]>(() => {
    return activeType.value === 'expense'
      ? KNOWN_EXPENSE_CATEGORIES
      : KNOWN_SPOT_CATEGORIES.map((s) => ({ label: s.label || '', icon: s.icon, color: s.color }));
  });

  // Kategorien aus dem Store für den aktuellen Typ
  const storedCategories = computed(() => {
    return tripCategoriesStore.categories.filter((c) => c.type === activeType.value);
  });

  const allDisplayCategories = computed<DisplayCategory[]>(() => {
    const list: DisplayCategory[] = [];
    const storedByName = new Map<string, TripCategory>();
    const storedByDefault = new Map<string, TripCategory>();

    for (const c of storedCategories.value) {
      storedByName.set(c.name.trim().toLowerCase(), c);
      if (c.default_name) {
        storedByDefault.set(c.default_name.trim().toLowerCase(), c);
      }
    }

    // 1. Gespeicherte Custom Categories (die weder Standard sind noch von einer Standardkategorie abstammen)
    for (const c of storedCategories.value) {
      const isDerivedFromStandard = Boolean(c.default_name);
      const matchesStandardName = defaultSuggestions.value.some(
        (s) => s.label.trim().toLowerCase() === c.name.trim().toLowerCase()
      );
      if (!isDerivedFromStandard && !matchesStandardName) {
        list.push({
          id: c.id,
          name: c.name,
          defaultName: null,
          isCustom: true,
          isAdapted: false,
          isHidden: Boolean(c.is_hidden),
          icon: c.icon,
          emoji: c.emoji,
          color: c.color,
          usageCount: c.usage_count ?? 0,
        });
      }
    }

    // 2. Standard-Kategorien (entweder im Original oder in angepasster Form)
    for (const s of defaultSuggestions.value) {
      const standardLower = s.label.trim().toLowerCase();
      // Prio 1: Wurde diese Standardkategorie angepasst und hat default_name == standardLower?
      // Prio 2: Wurde diese Standardkategorie gespeichert mit name == standardLower?
      const stored = storedByDefault.get(standardLower) ?? storedByName.get(standardLower);

      if (stored) {
        const isRenamed = stored.name.trim().toLowerCase() !== standardLower;
        const hasCustomIcon = stored.icon != null && stored.icon !== s.icon;
        const hasCustomEmoji = stored.emoji != null && stored.emoji !== s.icon;
        const hasCustomColor = stored.color != null && stored.color !== s.color;
        const isAdapted = isRenamed || hasCustomIcon || hasCustomEmoji || hasCustomColor;

        list.push({
          id: stored.id,
          name: stored.name,
          defaultName: s.label,
          isCustom: false,
          isAdapted,
          isHidden: Boolean(stored.is_hidden),
          icon: stored.icon ?? null,
          emoji: stored.emoji ?? s.icon,
          color: stored.color ?? s.color,
          usageCount: stored.usage_count ?? 0,
        });
      } else {
        list.push({
          id: undefined,
          name: s.label,
          defaultName: s.label,
          isCustom: false,
          isAdapted: false,
          isHidden: false,
          icon: null,
          emoji: s.icon,
          color: s.color,
          usageCount: 0,
        });
      }
    }

    // Sortierung: Aktive Kategorien zuerst (alphabetisch), ausgeblendete ans Ende
    return list.sort((a, b) => {
      if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
      return a.name.localeCompare(b.name, 'de');
    });
  });

  const filteredCategories = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return allDisplayCategories.value;
    return allDisplayCategories.value.filter((c) => c.name.toLowerCase().includes(q));
  });

  function loadUsage(categoryName: string) {
    usageItems.value = [];
    isLoadingUsageItems.value = true;
    const tripId = toValue(tripIdGetter);
    tripCategoriesStore
      .getCategoryUsageItems(tripId, activeType.value, categoryName)
      .then((items) => {
        const isStillActive =
          editingCategory.value?.name === categoryName ||
          categoryToDelete.value?.name === categoryName ||
          categoryToReset.value?.name === categoryName;
        if (isStillActive) {
          usageItems.value = items;
        }
      })
      .finally(() => {
        isLoadingUsageItems.value = false;
      });
  }

  function startEdit(cat: DisplayCategory) {
    const meta = tripCategoriesStore.categoryMeta(cat.name, activeType.value);
    const matchingOpt = findCategoryIcon(cat.icon || meta.tabler.id, cat.emoji || meta.icon);
    editForm.value = {
      id: cat.id ?? 0,
      name: cat.name,
      icon: matchingOpt?.id ?? cat.icon ?? meta.tabler.id ?? 'category',
      emoji: cat.emoji ?? meta.icon ?? matchingOpt?.defaultEmoji ?? '🏷️',
      color: cat.color ?? meta.color ?? CATEGORY_COLOR_PALETTE[0],
      usage_count: cat.usageCount,
    };
    editingCategory.value = cat;

    if (cat.usageCount > 0) {
      loadUsage(cat.name);
    } else {
      usageItems.value = [];
      isLoadingUsageItems.value = false;
    }
  }

  function cancelEdit() {
    editingCategory.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  async function saveEdit() {
    if (!editForm.value.name.trim()) return;
    const tripId = toValue(tripIdGetter);
    const trimmedNewName = editForm.value.name.trim();
    const isCustom = editingCategory.value?.isCustom ?? false;
    const defaultName = isCustom
      ? null
      : editingCategory.value?.defaultName || editingCategory.value?.name || trimmedNewName;
    const previousName = editingCategory.value?.name;

    if (editForm.value.id > 0) {
      await tripCategoriesStore.updateCategory(tripId, editForm.value.id, {
        name: trimmedNewName,
        default_name: defaultName,
        icon: editForm.value.icon,
        emoji: editForm.value.emoji,
        color: editForm.value.color,
      });
    } else {
      await tripCategoriesStore.createCategory(tripId, {
        type: activeType.value,
        name: trimmedNewName,
        default_name: defaultName,
        previous_name: previousName,
        icon: editForm.value.icon,
        emoji: editForm.value.emoji,
        color: editForm.value.color,
      });
    }

    // Spots- / Budget-Stores aktualisieren, falls sie bereits geladen sind
    if (typeof window !== 'undefined') {
      try {
        const { useSpotsStore } = await import('../stores/spots');
        const spotsStore = useSpotsStore();
        if (spotsStore.loaded) await spotsStore.load();
      } catch {
        // Ignorieren in Tests
      }
      try {
        const { useBudgetStore } = await import('../stores/budget');
        const budgetStore = useBudgetStore();
        if (budgetStore.loaded) await budgetStore.load();
      } catch {
        // Ignorieren in Tests
      }
    }

    editingCategory.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  async function handleCreate() {
    if (!createForm.value.name.trim()) return;
    const tripId = toValue(tripIdGetter);

    await tripCategoriesStore.createCategory(tripId, {
      type: activeType.value,
      name: createForm.value.name.trim(),
      icon: createForm.value.icon,
      emoji: createForm.value.emoji,
      color: createForm.value.color,
    });

    createForm.value = {
      name: '',
      icon: 'category',
      emoji: '🏷️',
      color: CATEGORY_COLOR_PALETTE[0],
    };
    showCreateForm.value = false;
  }

  function confirmDeleteFromEdit() {
    if (!editingCategory.value || !editingCategory.value.id) return;
    const catName = editingCategory.value.name;
    const count = editForm.value.usage_count;
    categoryToDelete.value = {
      id: editingCategory.value.id,
      name: catName,
      count,
    };
    editingCategory.value = null;
    if (count > 0 && usageItems.value.length === 0) {
      loadUsage(catName);
    }
  }

  function cancelDelete() {
    categoryToDelete.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  async function executeDelete() {
    if (!categoryToDelete.value) return;
    const tripId = toValue(tripIdGetter);
    await tripCategoriesStore.deleteCategory(tripId, categoryToDelete.value.id);
    if (typeof window !== 'undefined') {
      try {
        const { useSpotsStore } = await import('../stores/spots');
        const spotsStore = useSpotsStore();
        if (spotsStore.loaded) await spotsStore.load();
      } catch {
        // Ignorieren in Tests
      }
      try {
        const { useBudgetStore } = await import('../stores/budget');
        const budgetStore = useBudgetStore();
        if (budgetStore.loaded) await budgetStore.load();
      } catch {
        // Ignorieren in Tests
      }
    }
    categoryToDelete.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  function promptReset(cat: DisplayCategory) {
    categoryToReset.value = cat;
    if (cat.usageCount > 0) {
      loadUsage(cat.name);
    } else {
      usageItems.value = [];
      isLoadingUsageItems.value = false;
    }
  }

  function confirmResetFromEdit() {
    if (!editingCategory.value) return;
    const cat = editingCategory.value;
    categoryToReset.value = cat;
    editingCategory.value = null;
    if (cat.usageCount > 0 && usageItems.value.length === 0) {
      loadUsage(cat.name);
    }
  }

  function cancelReset() {
    categoryToReset.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  async function executeReset() {
    if (!categoryToReset.value || !categoryToReset.value.id) {
      categoryToReset.value = null;
      return;
    }
    const tripId = toValue(tripIdGetter);
    await tripCategoriesStore.resetCategory(tripId, categoryToReset.value.id);

    if (typeof window !== 'undefined') {
      try {
        const { useSpotsStore } = await import('../stores/spots');
        const spotsStore = useSpotsStore();
        if (spotsStore.loaded) await spotsStore.load();
      } catch {
        // Ignorieren in Tests
      }
      try {
        const { useBudgetStore } = await import('../stores/budget');
        const budgetStore = useBudgetStore();
        if (budgetStore.loaded) await budgetStore.load();
      } catch {
        // Ignorieren in Tests
      }
    }

    categoryToReset.value = null;
    usageItems.value = [];
    isLoadingUsageItems.value = false;
  }

  async function toggleHideStandard(cat: DisplayCategory) {
    const tripId = toValue(tripIdGetter);
    await tripCategoriesStore.setHidden(tripId, activeType.value, cat.name, !cat.isHidden);
  }

  return {
    activeType,
    SCOPE_OPTIONS,
    searchQuery,
    showCreateForm,
    editingCategory,
    categoryToDelete,
    categoryToReset,
    showIconPicker,
    iconPickerTarget,
    createForm,
    editForm,
    usageItems,
    isLoadingUsageItems,
    currentPickerIconId,
    filteredCategories,
    selectIcon,
    openIconPicker,
    startEdit,
    cancelEdit,
    saveEdit,
    handleCreate,
    confirmDeleteFromEdit,
    cancelDelete,
    executeDelete,
    promptReset,
    confirmResetFromEdit,
    cancelReset,
    executeReset,
    toggleHideStandard,
  };
}
