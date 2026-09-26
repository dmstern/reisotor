// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import BudgetPotCard from './BudgetPotCard.vue';
import { useBudgetStore } from '../stores/budget';
import type { Budget } from '../api/types';

describe('BudgetPotCard', () => {
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountCard(
    budget: Budget,
    categoryColors: Map<string, string> = new Map([['Essen', '#3b82f6']])
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetPotCard, { budget, categoryColors }),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders a close/remove button for category allocations and triggers removeAllocation on click', async () => {
    const store = useBudgetStore();
    store.allocations = [{ id: 42, budget_id: 1, category: 'Essen', amount: 150 }];
    const removeAllocationSpy = vi
      .spyOn(store, 'removeAllocation')
      .mockResolvedValue(undefined as never);

    const budget: Budget = {
      id: 1,
      trip_id: 1,
      name: 'Gemeinsames Budget',
      owner_id: null,
      target_amount: 300,
    };

    const { container, cleanUp } = mountCard(budget);

    // Make sure old DeleteButton/trash button is not used
    const deleteBtn = container.querySelector('.category-row .delete-btn');
    expect(deleteBtn).toBeNull();

    // Verify remove button with close icon is rendered
    const removeBtn = container.querySelector(
      '.category-row .remove-category-btn'
    ) as HTMLButtonElement | null;
    expect(removeBtn).not.toBeNull();
    expect(removeBtn?.getAttribute('aria-label')).toBe('Kategorie Essen aus dem Budget entfernen');
    expect(removeBtn?.getAttribute('title')).toBe('Kategorie „Essen“ aus dem Budget entfernen');

    // Click remove button
    removeBtn?.click();
    expect(removeAllocationSpy).toHaveBeenCalledWith(42);

    cleanUp();
  });
});
