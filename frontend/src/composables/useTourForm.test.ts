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
    expect(excursionForm.value.done).toBe(false);
    expect(showExcursionSpotsSection.value).toBe(false);
  });

  it('initializes done from existing excursion, tracks modification, and includes done in payload', async () => {
    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    const excursion = {
      id: 7,
      trip_id: 1,
      title: 'Küstentour',
      spot_ids: [1, 2],
      done: 1,
      created_by: 1,
    } as never;
    excursionsStore.excursions = [excursion];

    const { startEditExcursion, editExcursionForm, isEditTourDoneModified } = useTourForm({
      users: ref([]),
      tracksToShareOnSave: ref(new Set()),
    });

    startEditExcursion(excursion);
    expect(editExcursionForm.value.done).toBe(true);
    expect(isEditTourDoneModified.value).toBe(false);

    editExcursionForm.value.done = false;
    expect(isEditTourDoneModified.value).toBe(true);
  });
});
