import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTripCategorySettings } from './useTripCategorySettings';
import { useTripCategoriesStore } from '../stores/tripCategories';

describe('useTripCategorySettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initialisiert Spots als Standard-Typ und bietet Scope-Optionen', () => {
    const { activeType, SCOPE_OPTIONS } = useTripCategorySettings(1);
    expect(activeType.value).toBe('spot');
    expect(SCOPE_OPTIONS.length).toBe(2);
    expect(SCOPE_OPTIONS[0].value).toBe('spot');
    expect(SCOPE_OPTIONS[1].value).toBe('expense');
  });

  it('lädt und filtert Kategorien basierend auf Suche', () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 1,
        trip_id: 1,
        type: 'spot',
        name: 'Aussichtspunkt',
        icon: 'mountain',
        emoji: '⛰️',
        color: '#0ea5e9',
        is_hidden: 0,
        created_at: '',
        usage_count: 2,
      },
    ];

    const { filteredCategories, searchQuery } = useTripCategorySettings(1);
    expect(filteredCategories.value.some((c) => c.name === 'Aussichtspunkt')).toBe(true);

    searchQuery.value = 'Café';
    expect(filteredCategories.value.some((c) => c.name === 'Aussichtspunkt')).toBe(false);
    expect(filteredCategories.value.some((c) => c.name.includes('Café'))).toBe(true);
  });

  it('steuert Neuanlage und Edit-State sauber', () => {
    const {
      showCreateForm,
      editingCategory,
      editForm,
      startEdit,
      cancelEdit,
      openIconPicker,
      selectIcon,
      showIconPicker,
    } = useTripCategorySettings(1);

    expect(showCreateForm.value).toBe(false);
    expect(editingCategory.value).toBeNull();

    // Start edit
    startEdit({
      id: 5,
      name: 'Museum',
      isCustom: true,
      isHidden: false,
      icon: 'building',
      emoji: '🏛️',
      color: '#e34948',
      usageCount: 1,
    });
    expect(editingCategory.value?.name).toBe('Museum');
    expect(editForm.value.name).toBe('Museum');

    // Icon picker
    openIconPicker('edit');
    expect(showIconPicker.value).toBe(true);
    selectIcon({
      id: 'camera',
      label: 'Kamera',
      defaultEmoji: '📷',
      tabler: { id: 'camera', emoji: '📷', outline: () => null },
    });
    expect(editForm.value.icon).toBe('camera');
    expect(editForm.value.emoji).toBe('📷');
    expect(showIconPicker.value).toBe(false);

    cancelEdit();
    expect(editingCategory.value).toBeNull();
  });

  it('lädt betroffene Einträge bei startEdit wenn usageCount > 0 und leert sie bei cancelEdit', async () => {
    const store = useTripCategoriesStore();
    store.getCategoryUsageItems = async () => [
      { id: 'expense-1', title: 'Mittagessen', amount: 35.5 },
      { id: 'expense-2', title: 'Abendessen', amount: 80.0 },
    ];

    const { editingCategory, usageItems, isLoadingUsageItems, startEdit, cancelEdit } =
      useTripCategorySettings(1);

    expect(usageItems.value).toEqual([]);

    startEdit({
      id: 10,
      name: 'Restaurant',
      isCustom: false,
      isHidden: false,
      icon: 'cutlery',
      emoji: '🍽️',
      color: '#e34948',
      usageCount: 2,
    });

    expect(isLoadingUsageItems.value).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(usageItems.value).toHaveLength(2);
    expect(usageItems.value[0].title).toBe('Mittagessen');
    expect(isLoadingUsageItems.value).toBe(false);

    cancelEdit();
    expect(editingCategory.value).toBeNull();
    expect(usageItems.value).toEqual([]);
  });

  it('dupliziert eine angepasste Standardkategorie nicht und markiert sie als isAdapted', () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 8,
        trip_id: 1,
        type: 'spot',
        name: 'Flughafennnnn',
        default_name: 'Flughafen',
        icon: 'plane',
        emoji: '✈️',
        color: '#4a3aa7',
        is_hidden: 0,
        created_at: '',
        usage_count: 2,
      },
    ];

    const { filteredCategories } = useTripCategorySettings(1);

    // Es darf nur genau EIN Eintrag für Flughafen existieren (nämlich der angepasste)
    const flughafenEntries = filteredCategories.value.filter(
      (c) => c.name === 'Flughafen' || c.defaultName === 'Flughafen'
    );
    expect(flughafenEntries).toHaveLength(1);

    const entry = flughafenEntries[0];
    expect(entry.name).toBe('Flughafennnnn');
    expect(entry.defaultName).toBe('Flughafen');
    expect(entry.isCustom).toBe(false);
    expect(entry.isAdapted).toBe(true);
    expect(entry.usageCount).toBe(2);
  });

  it('steuert den Reset-Dialog und führt executeReset aus', async () => {
    const store = useTripCategoriesStore();
    let resetCalledWith: { tripId: number; id: number } | null = null;
    store.resetCategory = async (tripId: number, id: number) => {
      resetCalledWith = { tripId, id };
    };

    const { categoryToReset, promptReset, executeReset } = useTripCategorySettings(1);

    expect(categoryToReset.value).toBeNull();

    promptReset({
      id: 8,
      name: 'Flughafennnnn',
      defaultName: 'Flughafen',
      isCustom: false,
      isAdapted: true,
      isHidden: false,
      usageCount: 2,
    });

    expect(categoryToReset.value?.name).toBe('Flughafennnnn');

    await executeReset();
    expect(resetCalledWith).toEqual({ tripId: 1, id: 8 });
    expect(categoryToReset.value).toBeNull();
  });

  it('lädt betroffene Einträge bei promptReset und leert sie bei cancelReset', async () => {
    const store = useTripCategoriesStore();
    store.getCategoryUsageItems = vi
      .fn()
      .mockResolvedValue([{ id: 101, title: 'Spot am Flughafen' }]);

    const { categoryToReset, usageItems, promptReset, cancelReset } = useTripCategorySettings(1);

    promptReset({
      id: 5,
      name: 'Flughafen',
      isCustom: false,
      isAdapted: true,
      isHidden: false,
      usageCount: 1,
    });

    expect(categoryToReset.value?.name).toBe('Flughafen');
    await Promise.resolve();
    expect(usageItems.value).toHaveLength(1);
    expect(usageItems.value[0].title).toBe('Spot am Flughafen');

    cancelReset();
    expect(categoryToReset.value).toBeNull();
    expect(usageItems.value).toHaveLength(0);
  });

  it('überträgt betroffene Einträge von edit zu delete und leert sie bei cancelDelete', async () => {
    const store = useTripCategoriesStore();
    store.getCategoryUsageItems = vi.fn().mockResolvedValue([{ id: 201, title: 'Eigener Spot' }]);

    const { startEdit, confirmDeleteFromEdit, cancelDelete, categoryToDelete, usageItems } =
      useTripCategorySettings(1);

    startEdit({
      id: 99,
      name: 'Eigene Kategorie',
      isCustom: true,
      isAdapted: false,
      isHidden: false,
      usageCount: 1,
    });

    await Promise.resolve();
    expect(usageItems.value).toHaveLength(1);

    confirmDeleteFromEdit();
    expect(categoryToDelete.value).toEqual({
      id: 99,
      name: 'Eigene Kategorie',
      count: 1,
    });
    expect(usageItems.value).toHaveLength(1);

    cancelDelete();
    expect(categoryToDelete.value).toBeNull();
    expect(usageItems.value).toHaveLength(0);
  });
});
