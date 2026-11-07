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

  it('updates is_home when category changes between home and vacation categories', async () => {
    const { spotForm, showSpotLocationSection } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    expect(spotForm.value.is_home).toBe(false);

    // Wechsel zu Zuhause -> is_home = true
    spotForm.value.category = 'Zuhause';
    await new Promise((r) => setTimeout(r, 10));
    expect(spotForm.value.is_home).toBe(true);
    expect(showSpotLocationSection.value).toBe(true);

    // Wechsel zu Restaurant -> is_home = false
    spotForm.value.category = 'Restaurant';
    await new Promise((r) => setTimeout(r, 10));
    expect(spotForm.value.is_home).toBe(false);
  });

  it('updates editSpotForm.is_home when changing an existing home spot to vacation category', async () => {
    const { startEditSpot, editSpotForm } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    startEditSpot({
      id: 99,
      trip_id: 1,
      title: 'Heimathafen',
      category: 'Flughafen',
      is_home: 1,
      image_url: null,
      note: null,
      note_format: 'text',
      maps_link: null,
      lat: null,
      lng: null,
      created_by: 1,
      address: null,
      start_date: null,
      end_date: null,
      checkin: null,
      checkout: null,
      contact: null,
      amount: null,
      paid_by_user_id: null,
      budget_expense_id: null,
      done: 0,
    });

    expect(editSpotForm.value.is_home).toBe(true);

    // Wechsel von Transit/Home zu Unterkunft -> is_home = false
    editSpotForm.value.category = 'Unterkunft';
    await new Promise((r) => setTimeout(r, 10));
    expect(editSpotForm.value.is_home).toBe(false);
  });
});
