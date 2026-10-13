// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBudgetSources } from './useBudgetSources';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useBudgetStore } from '../stores/budget';

describe('useBudgetSources', () => {
  let spotsStore: ReturnType<typeof useSpotsStore>;
  let excursionsStore: ReturnType<typeof useExcursionsStore>;
  let budgetStore: ReturnType<typeof useBudgetStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    spotsStore = useSpotsStore();
    excursionsStore = useExcursionsStore();
    budgetStore = useBudgetStore();
  });

  it('filters accommodation spots', () => {
    spotsStore.spots = [
      { id: 1, title: 'Hotel Roma', category: 'Unterkunft', budget_expense_id: 101 } as any,
      { id: 2, title: 'Colosseum', category: 'Sehenswürdigkeit', budget_expense_id: null } as any,
    ];

    const { accommodations } = useBudgetSources();
    expect(accommodations.value.length).toBe(1);
    expect(accommodations.value[0].title).toBe('Hotel Roma');
  });

  it('resolves autoSourceFor accommodation expense', () => {
    spotsStore.spots = [
      { id: 45, title: 'Hotel Roma', category: 'Unterkunft', budget_expense_id: 200 } as any,
    ];

    const { autoSourceFor } = useBudgetSources();
    const source = autoSourceFor(200);

    expect(source).toEqual({
      label: 'Zur Unterkunft',
      path: '/excursions#spot-45',
    });
  });

  it('returns null if expense is not linked to accommodation or travel item', () => {
    spotsStore.spots = [];
    excursionsStore.excursions = [];

    const { autoSourceFor } = useBudgetSources();
    expect(autoSourceFor(999)).toBeNull();
  });

  it('computes category colors deterministically', () => {
    budgetStore.allocations = [
      { id: 1, budget_id: 1, category: 'Essen', amount: 100 },
      { id: 2, budget_id: 1, category: 'Transport', amount: 50 },
    ];

    const { categoryColors } = useBudgetSources();
    expect(categoryColors.value.has('Essen')).toBe(true);
    expect(categoryColors.value.has('Transport')).toBe(true);
  });
});
