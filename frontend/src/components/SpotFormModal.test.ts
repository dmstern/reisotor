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

  it('renders "Neuer Spot" modal when show is true and spot is null with clean defaults', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).toContain('Neuer Spot');
    expect(document.body.textContent).toContain('Hinzufügen');
    // Confusing SegmentedToggle with "Urlaubsort" is replaced by smart logic
    expect(document.body.textContent).not.toContain('Urlaubsort');
    // Subtle action to set home location if needed
    expect(document.body.textContent).toContain('Als Heimatort festlegen');
    const titleInput = document.querySelector(
      '[data-testid="spot-title-input"]'
    ) as HTMLInputElement;
    expect(titleInput.placeholder).toBe('Name des Spots...');
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

  it('renders "Teil der Urlaubsregion" toggle for transit spots (e.g. Flughafen)', async () => {
    const transitSpot: Spot = {
      ...dummySpot,
      id: 50,
      title: 'Flughafen Lissabon',
      category: 'Flughafen',
      is_home: 0,
    };
    const { cleanUp } = mountModal({
      show: true,
      spot: transitSpot,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).toContain('Teil der Urlaubsregion');
    expect(document.body.textContent).toContain('Liegt am Reiseziel');
    const switchEl = document.querySelector('#spotRegionToggle');
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute('aria-checked')).toBe('true');
    cleanUp();
  });

  it('renders "Teil der Urlaubsregion" toggle as inactive for home spots (is_home: 1)', async () => {
    const homeSpot: Spot = {
      ...dummySpot,
      id: 51,
      title: 'Zuhause',
      category: 'Zuhause',
      is_home: 1,
    };
    const { cleanUp } = mountModal({
      show: true,
      spot: homeSpot,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    expect(document.body.textContent).toContain('Teil der Urlaubsregion');
    expect(document.body.textContent).toContain('Liegt an der Heimat-Seite');
    const switchEl = document.querySelector('#spotRegionToggle');
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute('aria-checked')).toBe('false');
    cleanUp();
  });

  it('allows clicking "Als Heimatort festlegen" to reveal and activate the region toggle', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    const overrideBtn = document.querySelector('.spot-region-override-btn') as HTMLButtonElement;
    expect(overrideBtn).not.toBeNull();
    overrideBtn.click();
    await nextTick();

    expect(document.body.textContent).toContain('Teil der Urlaubsregion');
    expect(document.body.textContent).toContain('Liegt an der Heimat-Seite');
    const switchEl = document.querySelector('#spotRegionToggle');
    expect(switchEl).not.toBeNull();
    // After marking as home, vacation region toggle is false
    expect(switchEl?.getAttribute('aria-checked')).toBe('false');

    // Clicking switch toggles it back to active (Urlaubsregion)
    (switchEl as HTMLButtonElement).click();
    await nextTick();
    expect(switchEl?.getAttribute('aria-checked')).toBe('true');
    expect(document.body.textContent).toContain('Liegt am Reiseziel');
    cleanUp();
  });

  it('allows clicking the label to toggle the region switch', async () => {
    const transitSpot: Spot = {
      ...dummySpot,
      id: 52,
      title: 'Flughafen Berlin',
      category: 'Flughafen',
      is_home: 0,
    };
    const { cleanUp } = mountModal({
      show: true,
      spot: transitSpot,
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    const switchEl = document.querySelector('#spotRegionToggle') as HTMLButtonElement;
    expect(switchEl?.getAttribute('aria-checked')).toBe('true');

    const labelEl = document.querySelector('label[for="spotRegionToggle"]') as HTMLLabelElement;
    expect(labelEl).not.toBeNull();
    labelEl.click();
    await nextTick();

    expect(switchEl?.getAttribute('aria-checked')).toBe('false');
    expect(document.body.textContent).toContain('Liegt an der Heimat-Seite');
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

    const dateInput = document.querySelector(
      '.add-schedule-popover input[type="date"]'
    ) as HTMLInputElement;
    expect(dateInput).not.toBeNull();

    // Incomplete year from typing should not trigger submission
    dateInput.value = '0002-10-22';
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(document.querySelector('.assign-chip--schedule')).toBeNull();

    dateInput.value = '2026-10-22';
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
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

  it('pre-selects accommodation category and reveals accommodation fields when defaultCategory is passed', async () => {
    const { cleanUp } = mountModal({
      show: true,
      spot: null,
      defaultCategory: 'Unterkunft',
      tripId: 1,
      users: [dummyUser],
      spotScheduledDates: new Map(),
    });
    await nextTick();

    // Accommodation specific fields such as Check-in-Datum should be visible
    expect(document.body.textContent).toContain('Check-in-Datum');
    expect(document.body.textContent).toContain('Check-out-Datum');

    // Title placeholder should adapt to accommodation
    const titleInput = document.querySelector(
      '[data-testid="spot-title-input"]'
    ) as HTMLInputElement;
    expect(titleInput.placeholder).toBe('Name der Unterkunft...');
    cleanUp();
  });
});
