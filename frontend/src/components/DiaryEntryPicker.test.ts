// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DiaryEntryPicker from './DiaryEntryPicker.vue';
import { useDiaryStore } from '../stores/diary';
import { useTripStore } from '../stores/trip';
import type { DiaryEntry } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

describe('DiaryEntryPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('EventSource', MockEventSource);
  });

  function makeEntry(overrides: Partial<DiaryEntry>): DiaryEntry {
    return {
      id: 1,
      trip_id: 1,
      author_id: 1,
      title: 'Standard-Eintrag',
      content: '<p>Text</p>',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      date: '2026-08-10',
      is_draft: 0,
      created_at: '2026-08-10T10:00:00Z',
      updated_at: null,
      ...overrides,
    };
  }

  it('renders nothing when only drafts or no diary entries exist', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const diaryStore = useDiaryStore();
    diaryStore.setEntries([makeEntry({ id: 10, title: 'Geheimer Entwurf', is_draft: 1 })]);

    const container = document.createElement('div');
    const selectedIds = ref<number[]>([]);
    const app = createApp({
      render: () =>
        h(DiaryEntryPicker, {
          idPrefix: 'test-diary',
          modelValue: selectedIds.value,
          'onUpdate:modelValue': (nextIds: number[]) => {
            selectedIds.value = nextIds;
          },
        }),
    });
    app.use(createPinia());
    // Re-set active pinia to ensure same store instance
    setActivePinia(app.config.globalProperties.$pinia);
    const mountedTripStore = useTripStore();
    mountedTripStore.currentTripId = 1;
    const mountedDiaryStore = useDiaryStore();
    mountedDiaryStore.setEntries([makeEntry({ id: 10, title: 'Geheimer Entwurf', is_draft: 1 })]);

    app.mount(container);
    await nextTick();

    expect(container.querySelector('fieldset')).toBeNull();
    app.unmount();
  });

  it('filters out drafts, sorts matching-date entries first with recommended badge, and toggles selection', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const diaryStore = useDiaryStore();
    diaryStore.setEntries([
      makeEntry({ id: 1, title: 'Alter Tag', date: '2026-08-05', is_draft: 0 }),
      makeEntry({ id: 2, title: 'Passender Tag', date: '2026-08-12', is_draft: 0 }),
      makeEntry({ id: 3, title: 'Entwurf am selben Tag', date: '2026-08-12', is_draft: 1 }),
      makeEntry({ id: 4, title: 'Neuerer Tag', date: '2026-08-14', is_draft: 0 }),
    ]);

    const container = document.createElement('div');
    const selectedIds = ref<number[]>([1]);
    const app = createApp({
      render: () =>
        h(DiaryEntryPicker, {
          idPrefix: 'tour-diary',
          dates: ['2026-08-12'],
          modelValue: selectedIds.value,
          'onUpdate:modelValue': (nextIds: number[]) => {
            selectedIds.value = nextIds;
          },
        }),
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.classList.contains('is-open')).toBe(true);
    expect(container.textContent).toContain('(1 zugeordnet)');
    expect(container.textContent).not.toContain('Entwurf am selben Tag');

    const names = Array.from(container.querySelectorAll('.diary-picker-option-name')).map(
      (element) => element.textContent
    );
    expect(names).toEqual(['Passender Tag', 'Neuerer Tag', 'Alter Tag']);
    expect(container.textContent).toContain('Empfohlen – gleicher Tag');
    expect(container.textContent).toContain('14.08.2026');

    const checkbox = container.querySelector('#tour-diary-2') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event('change'));
    await nextTick();

    expect(selectedIds.value).toEqual([1, 2]);
    app.unmount();
  });
});
