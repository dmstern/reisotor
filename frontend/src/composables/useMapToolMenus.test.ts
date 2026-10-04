// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useMapToolMenus, computeTeleportMenuPosition } from './useMapToolMenus';
import { useLocationSharingStore } from '../stores/locationSharing';

describe('useMapToolMenus', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('computes teleport menu position correctly based on element bounds', () => {
    const el = document.createElement('button');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      left: 200,
      right: 250,
      width: 50,
      height: 40,
      x: 200,
      y: 100,
      toJSON: () => {},
    });

    const triggerRef = ref(el);
    const pos = computeTeleportMenuPosition(triggerRef, undefined, 200);
    expect(pos.top).toBe('146px');
    expect(pos.left).toBe('200px');
  });

  it('toggles focus menu and invokes onFocusMenuOpen', () => {
    const onOpen = vi.fn();
    const menus = useMapToolMenus({ onFocusMenuOpen: onOpen });

    expect(menus.focusMenuOpen.value).toBe(false);
    menus.toggleFocusMenu();
    expect(menus.focusMenuOpen.value).toBe(true);
    expect(onOpen).toHaveBeenCalled();

    menus.toggleFocusMenu();
    expect(menus.focusMenuOpen.value).toBe(false);
  });

  it('selectFocus executes action and closes focus menu', () => {
    const menus = useMapToolMenus();
    menus.focusMenuOpen.value = true;

    const action = vi.fn();
    menus.selectFocus(action);

    expect(menus.focusMenuOpen.value).toBe(false);
    expect(action).toHaveBeenCalled();
  });

  it('toggles location menu and selectLocation closes it', () => {
    const menus = useMapToolMenus();

    expect(menus.locationMenuOpen.value).toBe(false);
    menus.toggleLocationMenu();
    expect(menus.locationMenuOpen.value).toBe(true);

    const action = vi.fn();
    menus.selectLocation(action);
    expect(menus.locationMenuOpen.value).toBe(false);
    expect(action).toHaveBeenCalled();
  });

  it('toggles share menu and chooses share duration', async () => {
    const locationSharing = useLocationSharingStore();
    const setDurationSpy = vi.spyOn(locationSharing, 'setDuration').mockResolvedValue();

    const menus = useMapToolMenus();

    expect(menus.shareMenuOpen.value).toBe(false);
    menus.toggleShareMenu();
    expect(menus.shareMenuOpen.value).toBe(true);

    await menus.chooseShareDuration('day');
    expect(menus.shareMenuOpen.value).toBe(false);
    expect(setDurationSpy).toHaveBeenCalledWith('day');
  });
});
