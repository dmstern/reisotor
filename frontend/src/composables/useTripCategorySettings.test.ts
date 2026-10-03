import { describe, it, expect, beforeEach } from 'vitest';
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
});
