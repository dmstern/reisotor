// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDiaryEditForm } from './useDiaryEditForm';
import type { DiaryEntry } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../api/client';

describe('useDiaryEditForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mockEntry: DiaryEntry = {
    id: 42,
    trip_id: 1,
    author_id: 1,
    date: '2026-07-02',
    title: 'Bestehender Eintrag',
    content: '<p>Alter Text</p>',
    content_format: 'html',
    images: [{ url: '/img.jpg', original_name: 'img.jpg' }],
    excursion_ids: [10],
    spot_ids: [20],
    editor_ids: [],
    is_draft: 0,
    created_at: '2026-07-02T10:00:00Z',
    updated_at: '2026-07-02T10:00:00Z',
  };

  it('startEdit populates form and configures pickers', () => {
    const editForm = useDiaryEditForm({
      onEntryUpdated: vi.fn(),
      onEntryRemoved: vi.fn(),
      onLinkDone: vi.fn(),
    });

    editForm.startEdit(mockEntry);

    expect(editForm.editingEntry.value).toEqual(mockEntry);
    expect(editForm.editForm.value.title).toBe('Bestehender Eintrag');
    expect(editForm.editForm.value.content).toBe('<p>Alter Text</p>');
    expect(editForm.editForm.value.images).toHaveLength(1);
    expect(editForm.editShowExcursionPicker.value).toBe(true);
    expect(editForm.editShowSpotPicker.value).toBe(true);
  });

  it('submitEditEntry calls api.put and notifies callbacks with is_draft false', async () => {
    const updatedSpy = vi.fn();
    const linkDoneSpy = vi.fn();

    const editForm = useDiaryEditForm({
      onEntryUpdated: updatedSpy,
      onEntryRemoved: vi.fn(),
      onLinkDone: linkDoneSpy,
    });

    editForm.startEdit(mockEntry);
    editForm.editForm.value.title = 'Neuer Titel';
    editForm.editForm.value.content = '<p>Neuer Text</p>';

    const updatedEntry = { ...mockEntry, title: 'Neuer Titel', content: '<p>Neuer Text</p>' };
    vi.mocked(api.put).mockResolvedValueOnce(updatedEntry);

    await editForm.submitEditEntry();

    expect(api.put).toHaveBeenCalledWith(
      '/diary/42',
      expect.objectContaining({
        title: 'Neuer Titel',
        content: '<p>Neuer Text</p>',
        is_draft: false,
      })
    );
    expect(updatedSpy).toHaveBeenCalledWith(updatedEntry);
    expect(linkDoneSpy).toHaveBeenCalledWith([10], [20], '2026-07-02');
    expect(editForm.editingEntry.value).toBeNull();
  });

  it('closeEditForm preserves draft content if editing draft entry', async () => {
    const updatedSpy = vi.fn();

    const editForm = useDiaryEditForm({
      onEntryUpdated: updatedSpy,
      onEntryRemoved: vi.fn(),
      onLinkDone: vi.fn(),
    });

    const draftEntry: DiaryEntry = {
      ...mockEntry,
      id: 88,
      is_draft: 1,
      title: 'Entwurf',
      content: '<p>Noch in Arbeit</p>',
    };

    editForm.startEdit(draftEntry);
    editForm.editForm.value.content = '<p>Zwischenstand</p>';

    const savedDraft = { ...draftEntry, content: '<p>Zwischenstand</p>' };
    vi.mocked(api.put).mockResolvedValueOnce(savedDraft);

    await editForm.closeEditForm();

    expect(api.put).toHaveBeenCalledWith(
      '/diary/88',
      expect.objectContaining({
        is_draft: true,
        content: '<p>Zwischenstand</p>',
      })
    );
    expect(updatedSpy).toHaveBeenCalledWith(savedDraft);
    expect(editForm.editingEntry.value).toBeNull();
  });

  it('deleteEditingEntry deletes entry and resets modal', async () => {
    const removeSpy = vi.fn();

    const editForm = useDiaryEditForm({
      onEntryUpdated: vi.fn(),
      onEntryRemoved: removeSpy,
      onLinkDone: vi.fn(),
    });

    editForm.startEdit(mockEntry);
    await editForm.deleteEditingEntry();

    expect(removeSpy).toHaveBeenCalledWith(42);
    expect(editForm.editingEntry.value).toBeNull();
  });
});
