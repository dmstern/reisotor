import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { TransportCategory } from '../utils/legTransportConfig';

export interface MiniMapHandle {
  render?: () => void;
  invalidateSize?: () => void;
}

export interface UseLegRoutingAccordionOptions {
  isRoutable: Ref<boolean> | ComputedRef<boolean>;
  hasCoordinates: Ref<boolean> | ComputedRef<boolean>;
  transportCategory: Ref<TransportCategory> | ComputedRef<TransportCategory>;
}

export function useLegRoutingAccordion(options: UseLegRoutingAccordionOptions) {
  const { isRoutable, hasCoordinates, transportCategory } = options;

  const isRoutingOpen = ref(true);
  const miniMapRef = ref<MiniMapHandle | null>(null);

  watch(isRoutingOpen, async (open) => {
    if (open) {
      await nextTick();
      setTimeout(() => {
        miniMapRef.value?.invalidateSize?.();
        miniMapRef.value?.render?.();
      }, 150);
    }
  });

  const isRoutingDisabled = computed(() => !isRoutable.value);

  const routingDisabledTitle = computed(() => {
    if (transportCategory.value === 'ÖPNV') {
      return 'Für ÖPNV ist aktuell noch keine Routenberechnung möglich – bitte trage die Routendetails daher selbst ein.';
    }
    if (!hasCoordinates.value) {
      return 'Für diese Teilstrecke liegen keine Koordinaten für Start oder Ziel vor.';
    }
    return undefined;
  });

  watch(
    isRoutingDisabled,
    (disabled) => {
      if (disabled) {
        isRoutingOpen.value = false;
      }
    },
    { immediate: true }
  );

  function openRouting() {
    isRoutingOpen.value = true;
  }

  function closeRouting() {
    isRoutingOpen.value = false;
  }

  return {
    isRoutingOpen,
    miniMapRef,
    isRoutingDisabled,
    routingDisabledTitle,
    openRouting,
    closeRouting,
  };
}
