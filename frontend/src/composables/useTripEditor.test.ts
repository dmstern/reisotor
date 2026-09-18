// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import { useTripEditor } from './useTripEditor';
import { useTripStore } from '../stores/trip';
import type { Trip } from '../api/types';

describe('useTripEditor', () => {
  let tripStore: ReturnType<typeof useTripStore>;

  const mockTrip: Trip = {
    id: 42,
    name: 'Italien 2026',
    destination: 'Toskana',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: null,
    image_url: null,
    packing_category_required: 1,
    weather_model: 'ecmwf_ifs025',
    lat: 43.5,
    lng: 11.2,
    owner_restricted: false,
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    tripStore = useTripStore();
    vi.spyOn(tripStore, 'deleteTrip').mockResolvedValue();
  });

  it('initializes with closed form and no editing trip', () => {
    const editor = useTripEditor();
    expect(editor.showForm.value).toBe(false);
    expect(editor.editingTrip.value).toBeNull();
  });

  it('openCreate opens form for a new trip', () => {
    const editor = useTripEditor();
    editor.openCreate();
    expect(editor.showForm.value).toBe(true);
    expect(editor.editingTrip.value).toBeNull();
  });

  it('openEdit opens form with editingTrip set', () => {
    const editor = useTripEditor();
    editor.openEdit(mockTrip);
    expect(editor.showForm.value).toBe(true);
    expect(editor.editingTrip.value).toEqual(mockTrip);
  });

  it('closeForm resets showForm and editingTrip', () => {
    const editor = useTripEditor();
    editor.openEdit(mockTrip);
    editor.closeForm();
    expect(editor.showForm.value).toBe(false);
    expect(editor.editingTrip.value).toBeNull();
  });

  it('onDelete does not delete when confirmation is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const editor = useTripEditor();
    editor.openEdit(mockTrip);

    await editor.onDelete();

    expect(confirmSpy).toHaveBeenCalled();
    expect(tripStore.deleteTrip).not.toHaveBeenCalled();
    expect(editor.showForm.value).toBe(true);
    expect(editor.editingTrip.value).toEqual(mockTrip);
  });

  it('onDelete deletes editingTrip and closes form when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const editor = useTripEditor();
    editor.openEdit(mockTrip);

    await editor.onDelete();

    expect(tripStore.deleteTrip).toHaveBeenCalledWith(42);
    expect(editor.showForm.value).toBe(false);
    expect(editor.editingTrip.value).toBeNull();
  });
});
