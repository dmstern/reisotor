// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import {
  useLocationPickerMap,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  OWN_LOCATION_ICON,
} from './useLocationPickerMap';

describe('useLocationPickerMap', () => {
  it('exports correct fallback constants and icon def', () => {
    expect(FALLBACK_CENTER).toEqual({ lat: 48.5, lng: 10 });
    expect(FALLBACK_ZOOM).toBe(4);
    expect(OWN_LOCATION_ICON.id).toBe('compass');
  });

  it('initializes with default locatingSelf and locateError flags', () => {
    const mapEl = ref<HTMLDivElement | null>(null);
    const polaroidCardEl = ref<HTMLDivElement | null>(null);
    const modelValue = ref(null);
    const isDetailsVisible = ref(false);
    const hasMediaSlot = ref(false);
    const onManualCoordsSet = vi.fn();

    const map = useLocationPickerMap({
      mapEl,
      polaroidCardEl,
      modelValue,
      isDetailsVisible,
      hasMediaSlot,
      onManualCoordsSet,
    });

    expect(map.locatingSelf.value).toBe(false);
    expect(map.locateError.value).toBe(false);
  });
});
