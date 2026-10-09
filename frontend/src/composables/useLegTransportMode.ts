import { computed, ref, type Ref } from 'vue';
import {
  DEFAULT_TRANSIT_OPTIONS,
  getCategoryFromType,
  type TransportCategory,
} from '../utils/legTransportConfig';

export interface UseLegTransportModeOptions {
  transportType: Ref<string>;
}

export function useLegTransportMode(options: UseLegTransportModeOptions) {
  const { transportType } = options;

  const transportCategory = ref<TransportCategory>('zu Fuß');
  const selectedTransitType = ref('Zug');

  const transitOptions = computed(() => {
    const current = transportType.value;
    if (
      current &&
      !['zu Fuß', 'Zu Fuß', 'Auto', 'Fahrrad'].includes(current) &&
      !DEFAULT_TRANSIT_OPTIONS.includes(current)
    ) {
      return [...DEFAULT_TRANSIT_OPTIONS, current];
    }
    return DEFAULT_TRANSIT_OPTIONS;
  });

  function selectCategory(
    cat: TransportCategory,
    callbacks?: {
      onÖpnvSelected?: () => void;
      onRoutableCategorySelected?: () => void;
    }
  ) {
    transportCategory.value = cat;
    if (cat === 'ÖPNV') {
      transportType.value = selectedTransitType.value || 'Zug';
      callbacks?.onÖpnvSelected?.();
    } else {
      transportType.value = cat;
      callbacks?.onRoutableCategorySelected?.();
    }
  }

  function selectTransit(val: string) {
    selectedTransitType.value = val;
    if (transportCategory.value === 'ÖPNV') {
      transportType.value = val;
    }
  }

  function initTransportMode(initialType?: string | null): TransportCategory {
    const type = initialType || 'zu Fuß';
    const cat = getCategoryFromType(type);
    transportCategory.value = cat;

    if (cat === 'ÖPNV') {
      selectedTransitType.value = type === 'ÖPNV' ? 'Zug' : type;
      transportType.value = selectedTransitType.value;
    } else {
      selectedTransitType.value = 'Zug';
      transportType.value = cat;
    }

    return cat;
  }

  return {
    transportCategory,
    selectedTransitType,
    transitOptions,
    selectCategory,
    selectTransit,
    initTransportMode,
  };
}
