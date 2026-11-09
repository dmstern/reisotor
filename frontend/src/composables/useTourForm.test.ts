// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTourForm } from './useTourForm';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('useTourForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('pre-fills role and title when passed to openExcursionForm', () => {
    const { excursionForm, openExcursionForm, showExcursionForm, showExcursionSpotsSection } =
      useTourForm({
        users: ref([]),
        tracksToShareOnSave: ref(new Set()),
      });

    openExcursionForm('arrival', 'Anreise');

    expect(showExcursionForm.value).toBe(true);
    expect(excursionForm.value.role).toBe('arrival');
    expect(excursionForm.value.title).toBe('Anreise');
    expect(showExcursionSpotsSection.value).toBe(true);
  });

  it('opens with empty defaults when no arguments are passed', () => {
    const { excursionForm, openExcursionForm, showExcursionForm, showExcursionSpotsSection } =
      useTourForm({
        users: ref([]),
        tracksToShareOnSave: ref(new Set()),
      });

    openExcursionForm();

    expect(showExcursionForm.value).toBe(true);
    expect(excursionForm.value.role).toBe('');
    expect(excursionForm.value.title).toBe('');
    expect(showExcursionSpotsSection.value).toBe(false);
  });
});
