// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetPotCard from './BudgetPotCard.vue';
import { useBudgetStore } from '../stores/budget';
import type { Budget } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve({ categories: [] });
      return Promise.resolve([]);
    }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

describe('BudgetPotCard', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountCard(budget: Budget) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetPotCard, { budget }),
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

  it('attributes unassigned shared expenses (budget_id null) to simple pot when it is the only shared pot', async () => {
    const store = useBudgetStore();
    const sharedPot: Budget = {
      id: 1,
      trip_id: 1,
      name: 'Urlaubskasse',
      owner_id: null,
      target_amount: 500,
    };
    store.budgets = [sharedPot];
    store.allocations = [];
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Supermarkt (ohne Topf)',
        amount: 85,
        paid_by_user_id: 1,
        category: 'Essen',
        date: null,
        note: null,
        budget_id: null,
      },
    ];

    const { cleanUp } = mountCard(sharedPot);
    await nextTick();

    const meterRow = document.querySelector('.total-row .meter-row');
    expect(meterRow?.textContent).toContain('85.00');
    expect(meterRow?.textContent).toContain('500.00');

    cleanUp();
  });

  it('does not attribute unassigned expenses when multiple shared pots exist', async () => {
    const store = useBudgetStore();
    const pot1: Budget = {
      id: 1,
      trip_id: 1,
      name: 'Roadtrip',
      owner_id: null,
      target_amount: 300,
    };
    const pot2: Budget = {
      id: 2,
      trip_id: 1,
      name: 'Camping',
      owner_id: null,
      target_amount: 200,
    };
    store.budgets = [pot1, pot2];
    store.allocations = [];
    // Ausgabe ohne budget_id: darf bei mehreren geteilten Töpfen ohne Kategorien nicht willkürlich in Topf 1 fließen
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Snacks',
        amount: 30,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: null,
      },
    ];

    const { cleanUp } = mountCard(pot1);
    await nextTick();

    const meterRow = document.querySelector('.total-row .meter-row');
    expect(meterRow?.textContent).toContain('0.00');
    expect(meterRow?.textContent).toContain('300.00');

    cleanUp();
  });

  it('displays category sum as placeholder for target input when categories exist', async () => {
    const store = useBudgetStore();
    const detailedPot: Budget = {
      id: 1,
      trip_id: 1,
      name: 'Hauptbudget',
      owner_id: null,
      target_amount: null,
    };
    store.budgets = [detailedPot];
    store.allocations = [
      { id: 10, budget_id: 1, category: 'Essen', amount: 250 },
      { id: 11, budget_id: 1, category: 'Transport', amount: 150 },
    ];
    store.expenses = [];

    const { cleanUp } = mountCard(detailedPot);
    await nextTick();

    const targetInput = document.querySelector(
      `#budget-target-${detailedPot.id}`
    ) as HTMLInputElement;
    expect(targetInput).not.toBeNull();
    // 250 + 150 = 400
    expect(targetInput.placeholder).toBe('400');

    cleanUp();
  });
});
