import { ref } from 'vue';

export type TierFeature = 'trips' | 'members' | 'uploads' | 'general';

const isOpen = ref(false);
const highlightedFeature = ref<TierFeature | null>(null);

export function useAccountTierModal() {
  function openAccountTierModal(feature?: TierFeature) {
    highlightedFeature.value = feature ?? null;
    isOpen.value = true;
  }

  function closeAccountTierModal() {
    isOpen.value = false;
    highlightedFeature.value = null;
  }

  return {
    isOpen,
    highlightedFeature,
    openAccountTierModal,
    closeAccountTierModal,
  };
}
