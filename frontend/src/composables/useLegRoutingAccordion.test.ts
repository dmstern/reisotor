import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useLegRoutingAccordion } from './useLegRoutingAccordion';
import type { TransportCategory } from '../utils/legTransportConfig';

describe('useLegRoutingAccordion', () => {
  it('initializes open when routable and has coordinates', () => {
    const isRoutable = ref(true);
    const hasCoordinates = ref(true);
    const transportCategory = ref<TransportCategory>('Auto');

    const { isRoutingOpen, isRoutingDisabled, routingDisabledTitle } = useLegRoutingAccordion({
      isRoutable,
      hasCoordinates,
      transportCategory,
    });

    expect(isRoutingOpen.value).toBe(true);
    expect(isRoutingDisabled.value).toBe(false);
    expect(routingDisabledTitle.value).toBeUndefined();
  });

  it('closes automatically and provides title when ÖPNV category is selected', async () => {
    const isRoutable = ref(false);
    const hasCoordinates = ref(true);
    const transportCategory = ref<TransportCategory>('ÖPNV');

    const { isRoutingOpen, isRoutingDisabled, routingDisabledTitle } = useLegRoutingAccordion({
      isRoutable,
      hasCoordinates,
      transportCategory,
    });

    expect(isRoutingDisabled.value).toBe(true);
    expect(isRoutingOpen.value).toBe(false);
    expect(routingDisabledTitle.value).toContain('Für ÖPNV');
  });

  it('shows missing coordinates message when not routable due to lack of coords', () => {
    const isRoutable = ref(false);
    const hasCoordinates = ref(false);
    const transportCategory = ref<TransportCategory>('Auto');

    const { isRoutingDisabled, routingDisabledTitle } = useLegRoutingAccordion({
      isRoutable,
      hasCoordinates,
      transportCategory,
    });

    expect(isRoutingDisabled.value).toBe(true);
    expect(routingDisabledTitle.value).toContain('liegen keine Koordinaten');
  });

  it('allows manual open and close control', () => {
    const isRoutable = ref(true);
    const hasCoordinates = ref(true);
    const transportCategory = ref<TransportCategory>('Auto');

    const { isRoutingOpen, openRouting, closeRouting } = useLegRoutingAccordion({
      isRoutable,
      hasCoordinates,
      transportCategory,
    });

    closeRouting();
    expect(isRoutingOpen.value).toBe(false);

    openRouting();
    expect(isRoutingOpen.value).toBe(true);
  });
});
