// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useDiaryNewForm } from './useDiaryNewForm';
import { useExcursionsStore } from '../stores/excursions';
import type { DiaryEntry, Excursion } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../api/client';

describe('useDiaryNewForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('openNewForm initializes empty form and pre-selects excursions for date', () => {
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      { id: 1, title: 'Tour A', date: '2026-07-01' } as Excursion,
      { id: 2, title: 'Tour B', date: '2026-07-02' } as Excursion,
    ];

    const myDraft = ref<DiaryEntry | null>(null);
    const startEditDraftSpy = vi.fn();
    const entryCreatedSpy = vi.fn();
    const linkDoneSpy = vi.fn();

    const newForm = useDiaryNewForm({
      tripId: 1,
      myDraft,
      onStartEditDraft: startEditDraftSpy,
      onEntryCreated: entryCreatedSpy,
      onLinkDone: linkDoneSpy,
    });

    newForm.openNewForm();

    expect(newForm.showForm.value).toBe(true);
    expect(newForm.contentTouched.value).toBe(false);
    expect(newForm.dateTouched.value).toBe(false);
    expect(startEditDraftSpy).not.toHaveBeenCalled();
  });

  it('openNewForm resumes existing draft if one exists (#89)', () => {
    const draft: DiaryEntry = {
      id: 99,
      trip_id: 1,
      author_id: 1,
      date: '2026-07-01',
      title: 'Mein Entwurf',
      content: 'Noch unfertig',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 1,
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    };

    const myDraft = ref<DiaryEntry | null>(draft);
    const startEditDraftSpy = vi.fn();

    const newForm = useDiaryNewForm({
      tripId: 1,
      myDraft,
      onStartEditDraft: startEditDraftSpy,
      onEntryCreated: vi.fn(),
      onLinkDone: vi.fn(),
    });

    newForm.openNewForm();

    expect(newForm.showForm.value).toBe(false);
    expect(startEditDraftSpy).toHaveBeenCalledWith(draft);
  });

  it('validates required fields for submission', () => {
    const newForm = useDiaryNewForm({
      tripId: 1,
      myDraft: ref(null),
      onStartEditDraft: vi.fn(),
      onEntryCreated: vi.fn(),
      onLinkDone: vi.fn(),
    });

    newForm.form.value.content = '';
    expect(newForm.canSubmit.value).toBe(false);

    newForm.form.value.content = '<p>Tolles Erlebnis</p>';
    newForm.form.value.date = '2026-07-01';
    expect(newForm.canSubmit.value).toBe(true);
  });

  it('submits entry and notifies callbacks', async () => {
    const entryCreatedSpy = vi.fn();
    const linkDoneSpy = vi.fn();

    const newForm = useDiaryNewForm({
      tripId: 1,
      myDraft: ref(null),
      onStartEditDraft: vi.fn(),
      onEntryCreated: entryCreatedSpy,
      onLinkDone: linkDoneSpy,
    });

    newForm.form.value.title = 'Toller Tag';
    newForm.form.value.content = '<p>Inhalt</p>';
    newForm.form.value.date = '2026-07-01';
    newForm.form.value.excursion_ids = [5];
    newForm.form.value.spot_ids = [10];

    const createdEntry = { id: 101, ...newForm.form.value } as unknown as DiaryEntry;
    vi.mocked(api.post).mockResolvedValueOnce(createdEntry);

    await newForm.submitEntry();

    expect(api.post).toHaveBeenCalledWith(
      '/diary',
      expect.objectContaining({
        trip_id: 1,
        title: 'Toller Tag',
        content: '<p>Inhalt</p>',
      })
    );
    expect(entryCreatedSpy).toHaveBeenCalledWith(createdEntry);
    expect(linkDoneSpy).toHaveBeenCalledWith([5], [10], '2026-07-01');
    expect(newForm.showForm.value).toBe(false);
  });

  it('closeForm saves draft when content exists', async () => {
    const entryCreatedSpy = vi.fn();

    const newForm = useDiaryNewForm({
      tripId: 1,
      myDraft: ref(null),
      onStartEditDraft: vi.fn(),
      onEntryCreated: entryCreatedSpy,
      onLinkDone: vi.fn(),
    });

    newForm.showForm.value = true;
    newForm.form.value.title = 'Entwurfstitel';
    newForm.form.value.content = '<p>Noch nicht fertig</p>';

    const draftEntry = { id: 102, ...newForm.form.value, is_draft: true } as unknown as DiaryEntry;
    vi.mocked(api.post).mockResolvedValueOnce(draftEntry);

    await newForm.closeForm();

    expect(api.post).toHaveBeenCalledWith(
      '/diary',
      expect.objectContaining({
        title: 'Entwurfstitel',
        is_draft: true,
      })
    );
    expect(entryCreatedSpy).toHaveBeenCalledWith(draftEntry);
    expect(newForm.showForm.value).toBe(false);
  });
});
