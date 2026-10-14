import { computed } from 'vue';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { deriveTravelItems } from '../utils/deriveTravelItems';

export interface BudgetAutoSource {
  label: string;
  path: string;
}

export function useBudgetSources() {
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();

  const accommodations = computed(() =>
    spotsStore.spots.filter((s) => s.category === 'Unterkunft')
  );

  const travelItems = computed(() =>
    deriveTravelItems(excursionsStore.excursions, spotsStore.spots)
  );

  function autoSourceFor(expenseId: number): BudgetAutoSource | null {
    const accommodation = accommodations.value.find((a) => a.budget_expense_id === expenseId);
    if (accommodation) {
      return { label: 'Zur Unterkunft', path: `/excursions#spot-${accommodation.id}` };
    }
    const travelItem = travelItems.value.find((t) => t.budget_expense_id === expenseId);
    if (travelItem) {
      return { label: 'Zur Reise', path: `/excursions#excursion-${travelItem.id}` };
    }
    return null;
  }

  return {
    accommodations,
    travelItems,
    autoSourceFor,
  };
}
