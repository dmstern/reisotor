// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useLocationSuggestions } from './useLocationSuggestions';

describe('useLocationSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('cycles through address suggestions on click', async () => {
    const title = ref('Stephansdom');
    const editTitleInput = ref('Stephansdom');
    const address = ref('');
    const editAddressInput = ref('');
    const category = ref('');
    const editCategoryInput = ref('');
    const modelValue = ref(null);
    const isEditingAddress = ref(false);
    const isEditingCategory = ref(false);
    const onApplyAddress = vi.fn();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Stephansdom', formatted_address: 'Stephansplatz 3, Wien' },
        { name: 'Stephansdom Shop', formatted_address: 'Stephansplatz 1, Wien' },
      ],
    } as unknown as Response);

    const suggestions = useLocationSuggestions({
      title,
      editTitleInput,
      address,
      editAddressInput,
      category,
      editCategoryInput,
      modelValue,
      isEditingAddress,
      isEditingCategory,
      onApplyAddress,
    });

    expect(suggestions.showAddressSparkle.value).toBe(true);

    await suggestions.cycleAddressSuggestion();
    expect(onApplyAddress).toHaveBeenCalledWith('Stephansplatz 3, Wien');
    expect(editAddressInput.value).toBe('Stephansplatz 3, Wien');

    await suggestions.cycleAddressSuggestion();
    expect(onApplyAddress).toHaveBeenCalledWith('Stephansplatz 1, Wien');
    expect(editAddressInput.value).toBe('Stephansplatz 1, Wien');
  });

  it('generates location search candidates and cycles search', () => {
    const title = ref('Café Central');
    const editTitleInput = ref('');
    const address = ref('Herrengasse 14');
    const editAddressInput = ref('');
    const category = ref('Café');
    const editCategoryInput = ref('');
    const modelValue = ref(null);
    const isEditingAddress = ref(false);
    const isEditingCategory = ref(false);
    const onSearchCandidate = vi.fn();

    const suggestions = useLocationSuggestions({
      title,
      editTitleInput,
      address,
      editAddressInput,
      category,
      editCategoryInput,
      modelValue,
      isEditingAddress,
      isEditingCategory,
      onSearchCandidate,
    });

    expect(suggestions.showLocationSparkle.value).toBe(true);
    expect(suggestions.locationSearchCandidates.value).toContain('Café Central');
    expect(suggestions.locationSearchCandidates.value).toContain('Herrengasse 14');

    suggestions.cycleLocationSearch();
    expect(onSearchCandidate).toHaveBeenCalledWith(expect.any(String));
  });
});
