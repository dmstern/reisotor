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

  it('automatically populates title, category, image, address, amount, dates, checkin/checkout and pin from booking link (issue #607)', async () => {
    const { api } = await import('../api/client');
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'Grand Hotel Wien',
      imageUrl: 'https://images.example.com/hotel.jpg',
      images: ['https://images.example.com/hotel.jpg', 'https://images.example.com/room.jpg'],
      category: 'Unterkunft',
      address: 'Kärntner Ring 9, 1010 Wien',
      amount: 280,
      checkin: '15:00',
      checkout: '11:00',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      contact: '+43 1 515800',
      sourceUrl: 'https://www.booking.com/hotel/at/grand-hotel-wien.html',
      lat: 48.2014,
      lng: 16.3712,
    });

    const { spotForm, spotManualPin, onSpotMapsLinkUpdate } = useSpotForm({
      tripId: 1,
      users: ref([]),
      spotScheduledDates: ref(new Map()),
    });

    onSpotMapsLinkUpdate('https://www.booking.com/hotel/at/grand-hotel-wien.html');

    // Warten auf api.get Auflösung
    await new Promise((r) => setTimeout(r, 20));

    expect(spotForm.value.title).toBe('Grand Hotel Wien');
    expect(spotForm.value.category).toBe('Unterkunft');
    expect(spotForm.value.image_url).toBe('https://images.example.com/hotel.jpg');
    expect(spotForm.value.address).toBe('Kärntner Ring 9, 1010 Wien');
    expect(spotForm.value.amount).toBe('280');
    expect(spotForm.value.checkin).toBe('15:00');
    expect(spotForm.value.checkout).toBe('11:00');
    expect(spotForm.value.start_date).toBe('2026-09-10');
    expect(spotForm.value.end_date).toBe('2026-09-15');
    expect(spotForm.value.contact).toBe('+43 1 515800');
    expect(spotForm.value.link).toBe('https://www.booking.com/hotel/at/grand-hotel-wien.html');
    expect(spotManualPin.value).toEqual({ lat: 48.2014, lng: 16.3712 });
  });

  it('updates both spotManualPin and editSpotManualPin when editing an existing spot (issue #607)', async () => {
    const { api } = await import('../api/client');
    vi.mocked(api.get).mockResolvedValueOnce({
      name: 'Adlon Berlin',
      imageUrl: 'https://images.example.com/adlon.jpg',
      category: 'Unterkunft',
      address: 'Unter den Linden 77, 10117 Berlin',
      amount: 450,
      lat: 52.516,
      lng: 13.38,
    });

    const { startEditSpot, editSpotForm, spotManualPin, editSpotManualPin, onSpotMapsLinkUpdate } =
      useSpotForm({
        tripId: 1,
        users: ref([]),
        spotScheduledDates: ref(new Map()),
      });

    startEditSpot({
      id: 5,
      trip_id: 1,
      title: 'Alte Unterkunft',
      category: 'Unterkunft',
      is_home: 0,
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

    onSpotMapsLinkUpdate('https://www.trivago.de/de/srl/hotel-adlon-berlin');

    await new Promise((r) => setTimeout(r, 20));

    expect(editSpotForm.value.title).toBe('Adlon Berlin');
    expect(spotManualPin.value).toEqual({ lat: 52.516, lng: 13.38 });
    expect(editSpotManualPin.value).toEqual({ lat: 52.516, lng: 13.38 });
  });
});
