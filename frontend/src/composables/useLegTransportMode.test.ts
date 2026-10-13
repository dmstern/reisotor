import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useLegTransportMode } from './useLegTransportMode';

describe('useLegTransportMode', () => {
  it('initializes with default zu Fuß category and transit type Zug', () => {
    const transportType = ref('zu Fuß');
    const { transportCategory, selectedTransitType, transitOptions } = useLegTransportMode({
      transportType,
    });

    expect(transportCategory.value).toBe('zu Fuß');
    expect(selectedTransitType.value).toBe('Zug');
    expect(transitOptions.value).toContain('Zug');
    expect(transitOptions.value).toContain('Bus');
  });

  it('handles selecting routable categories (Auto, Fahrrad, zu Fuß)', () => {
    const transportType = ref('zu Fuß');
    const onRoutable = vi.fn();
    const onÖpnv = vi.fn();

    const { selectCategory, transportCategory } = useLegTransportMode({
      transportType,
    });

    selectCategory('Auto', { onRoutableCategorySelected: onRoutable, onÖpnvSelected: onÖpnv });

    expect(transportCategory.value).toBe('Auto');
    expect(transportType.value).toBe('Auto');
    expect(onRoutable).toHaveBeenCalledTimes(1);
    expect(onÖpnv).not.toHaveBeenCalled();
  });

  it('handles selecting ÖPNV category and sets transportType to selected transit', () => {
    const transportType = ref('Auto');
    const onRoutable = vi.fn();
    const onÖpnv = vi.fn();

    const { selectCategory, selectTransit, transportCategory } = useLegTransportMode({
      transportType,
    });

    selectTransit('Straßenbahn');
    selectCategory('ÖPNV', { onRoutableCategorySelected: onRoutable, onÖpnvSelected: onÖpnv });

    expect(transportCategory.value).toBe('ÖPNV');
    expect(transportType.value).toBe('Straßenbahn');
    expect(onÖpnv).toHaveBeenCalledTimes(1);
    expect(onRoutable).not.toHaveBeenCalled();
  });

  it('updates transportType when selecting a transit type while in ÖPNV mode', () => {
    const transportType = ref('Zug');
    const { selectCategory, selectTransit } = useLegTransportMode({
      transportType,
    });

    selectCategory('ÖPNV');
    selectTransit('Fähre');

    expect(transportType.value).toBe('Fähre');
  });

  it('initTransportMode correctly maps ÖPNV subtype or defaults', () => {
    const transportType = ref('');
    const { initTransportMode, transportCategory, selectedTransitType } = useLegTransportMode({
      transportType,
    });

    const cat = initTransportMode('Bus');
    expect(cat).toBe('ÖPNV');
    expect(transportCategory.value).toBe('ÖPNV');
    expect(selectedTransitType.value).toBe('Bus');
    expect(transportType.value).toBe('Bus');

    const catAuto = initTransportMode('Auto');
    expect(catAuto).toBe('Auto');
    expect(transportCategory.value).toBe('Auto');
    expect(selectedTransitType.value).toBe('Zug');
    expect(transportType.value).toBe('Auto');
  });
});
