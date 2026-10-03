import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useTripCategoriesStore, type TripCategory } from '../stores/tripCategories';
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

  const activeType = ref<'expense' | 'spot'>('expense');
  const SCOPE_OPTIONS = [
    {
      value: 'expense',
      label: 'Ausgaben',
      icon: FORM_FIELD_ICONS.amount,
      iconGroup: 'formFields' as const,
    },
    {
      value: 'spot',
      label: 'Spots',
      icon: FORM_FIELD_ICONS.location,
      iconGroup: 'formFields' as const,
    },
  ];
  const searchQuery = ref('');
  const showCreateForm = ref(false);
  const editingCategory = ref<DisplayCategory | null>(null);
  const categoryToDelete = ref<{ id: number; name: string; count: number } | null>(null);
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

    for (const c of storedCategories.value) {
      storedByName.set(c.name.trim().toLowerCase(), c);
    }

    // 1. Gespeicherte Custom Categories
    for (const c of storedCategories.value) {
      const isStandard = defaultSuggestions.value.some(
        (s) => s.label.trim().toLowerCase() === c.name.trim().toLowerCase()
      );
      if (!isStandard) {
        list.push({
          id: c.id,
          name: c.name,
          isCustom: true,
          isHidden: Boolean(c.is_hidden),
          icon: c.icon,
          emoji: c.emoji,
          color: c.color,
          usageCount: c.usage_count ?? 0,
        });
      }
    }

    // 2. Standard-Kategorien
    for (const s of defaultSuggestions.value) {
      const stored = storedByName.get(s.label.trim().toLowerCase());
      list.push({
        id: stored?.id,
        name: s.label,
        isCustom: false,
        isHidden: Boolean(stored?.is_hidden),
        icon: stored?.icon ?? null,
        emoji: stored?.emoji ?? s.icon,
        color: stored?.color ?? s.color,
        usageCount: stored?.usage_count ?? 0,
      });
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
  }

  function cancelEdit() {
    editingCategory.value = null;
  }

  async function saveEdit() {
    if (!editForm.value.name.trim()) return;
    const tripId = toValue(tripIdGetter);

    if (editForm.value.id > 0) {
      await tripCategoriesStore.updateCategory(tripId, editForm.value.id, {
        name: editForm.value.name.trim(),
        icon: editForm.value.icon,
        emoji: editForm.value.emoji,
        color: editForm.value.color,
      });
    } else {
      // Falls Standard-Kategorie erstmalig angepasst wird: als Eintrag anlegen
      await tripCategoriesStore.createCategory(tripId, {
        type: activeType.value,
        name: editForm.value.name.trim(),
        icon: editForm.value.icon,
        emoji: editForm.value.emoji,
        color: editForm.value.color,
      });
    }
    editingCategory.value = null;
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
    categoryToDelete.value = {
      id: editingCategory.value.id,
      name: editForm.value.name,
      count: editForm.value.usage_count,
    };
    editingCategory.value = null;
  }

  async function executeDelete() {
    if (!categoryToDelete.value) return;
    const tripId = toValue(tripIdGetter);
    await tripCategoriesStore.deleteCategory(tripId, categoryToDelete.value.id);
    categoryToDelete.value = null;
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
    showIconPicker,
    iconPickerTarget,
    createForm,
    editForm,
    currentPickerIconId,
    filteredCategories,
    selectIcon,
    openIconPicker,
    startEdit,
    cancelEdit,
    saveEdit,
    handleCreate,
    confirmDeleteFromEdit,
    executeDelete,
    toggleHideStandard,
  };
}
