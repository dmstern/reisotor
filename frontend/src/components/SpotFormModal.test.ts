// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SpotFormModal from './SpotFormModal.vue';
import type { Spot, User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('SpotFormModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const dummyUser: User = {
    id: 1,
    username: 'Max',
    avatar: '🦊',
    email: 'max@example.com',
  };

  const dummySpot: Spot = {
    id: 42,
    trip_id: 1,
    title: 'Traumstrand',
    category: 'Strand',
    created_by: 1,
    is_home: 0,
    address: 'Küstenstraße 1',
  } as unknown as Spot;

  function mountModal(props: any) {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(SpotFormModal, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders "Neuer Spot" modal when show is true and spot is null', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).toContain('Neuer Spot');
    expect(document.body.textContent).toContain('Urlaubsort');
    expect(document.body.textContent).toContain('Hinzufügen');
    cleanUp();
  });

  it('renders "Spot bearbeiten" modal when editing an existing spot', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: dummySpot,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).toContain('Spot bearbeiten');
    expect(document.body.textContent).toContain('Speichern');
    expect(document.body.textContent).toContain('Löschen');
    cleanUp();
  });

  it('does not render modal content when show is false and spot is null', async () => {
    const { cleanUp } = mountModal({
      show: false,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).not.toContain('Spot bearbeiten');
    expect(document.body.textContent).not.toContain('Neuer Spot');
    cleanUp();
  });

  it('renders TourAssignDropdown ("Tour zuordnen") button in edit mode', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: dummySpot,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    const tourAssignBtn = document.querySelector('.tour-assign-btn');
    expect(tourAssignBtn).not.toBeNull();
    expect(tourAssignBtn?.textContent).toContain('Tour zuordnen');
    cleanUp();
  });

  it('renders "Tour zuordnen" and "Datum hinzufügen" buttons in create mode', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    const tourAssignBtn = document.querySelector('.tour-assign-btn');
    expect(tourAssignBtn).not.toBeNull();
    expect(tourAssignBtn?.textContent).toContain('Tour zuordnen');

    const addScheduleBtn = document.querySelector('.add-schedule-btn');
    expect(addScheduleBtn).not.toBeNull();
    expect(addScheduleBtn?.textContent).toContain('Datum hinzufügen');
    cleanUp();
  });

  it('allows adding and removing a scheduled date in create mode', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    const addScheduleBtn = document.querySelector('.add-schedule-btn') as HTMLButtonElement;
    expect(addScheduleBtn).not.toBeNull();
    addScheduleBtn.click();
    await nextTick();

    const dateInput = document.querySelector('.add-schedule-popover input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();

    dateInput.value = '2026-10-22';
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    const submitBtn = Array.from(document.querySelectorAll('.add-schedule-popover button')).find(
      (b) => b.textContent?.includes('Hinzufügen')
    ) as HTMLButtonElement;
    expect(submitBtn).toBeDefined();
    submitBtn.click();
    await nextTick();

    // Check that schedule chip appears
    const chip = document.querySelector('.assign-chip--schedule');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain('22.10.2026');

    // Remove the chip
    const removeBtn = chip?.querySelector('.assign-chip-remove') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    removeBtn.click();
    await nextTick();

    expect(document.querySelector('.assign-chip--schedule')).toBeNull();
    cleanUp();
  });
});
