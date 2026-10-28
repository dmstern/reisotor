// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useSpotForm } from './useSpotForm';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('useSpotForm - openSpotForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('leaves showSpotScheduleSection false when no tourTitles or scheduledDates exist', () => {
    const { openSpotForm, showSpotScheduleSection, showSpotForm } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    openSpotForm();

    expect(showSpotForm.value).toBe(true);
    expect(showSpotScheduleSection.value).toBe(false);
  });

  it('sets showSpotScheduleSection true when scheduledDates are present', () => {
    const { spotForm, openSpotForm, showSpotScheduleSection } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    spotForm.value.scheduledDates = ['2026-06-01'];
    openSpotForm();

    expect(showSpotScheduleSection.value).toBe(true);
  });

  it('migrates legacy scheduledDate and sets showSpotScheduleSection true', () => {
    const { spotForm, openSpotForm, showSpotScheduleSection } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    spotForm.value.scheduledDate = '2026-06-02';
    openSpotForm();

    expect(spotForm.value.scheduledDates).toEqual(['2026-06-02']);
    expect(showSpotScheduleSection.value).toBe(true);
  });

  it('sets showSpotScheduleSection true when tourTitles are present', () => {
    const { spotForm, openSpotForm, showSpotScheduleSection } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    spotForm.value.tourTitles = ['Bergwanderung'];
    openSpotForm();

    expect(showSpotScheduleSection.value).toBe(true);
  });
});
