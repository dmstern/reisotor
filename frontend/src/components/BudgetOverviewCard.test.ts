// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetOverviewCard from './BudgetOverviewCard.vue';
import { useBudgetStore } from '../stores/budget';

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

describe('BudgetOverviewCard', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountCard() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetOverviewCard),
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

  it('renders badges with counts and gross sums for shared expenses and incomes', async () => {
    const store = useBudgetStore();
    store.budgets = [
      { id: 1, trip_id: 1, name: 'Gemeinsames Budget', owner_id: null, target_amount: 500 },
    ];
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Supermarkt',
        amount: 60,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: 1,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Tanken',
        amount: 40,
        paid_by_user_id: 2,
        category: null,
        date: null,
        note: null,
        budget_id: 1,
      },
      {
        id: 3,
        trip_id: 1,
        title: 'Pfand & Rückgabe',
        amount: -15,
        paid_by_user_id: null,
        category: null,
        date: null,
        note: null,
        budget_id: 1,
      },
    ];

    const { cleanUp } = mountCard();
    await nextTick();

    const badges = document.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(2);

    const expenseBadge = badges[0];
    expect(expenseBadge.textContent).toContain('2 Ausgaben');
    expect(expenseBadge.textContent).toContain('100.00');

    const incomeBadge = badges[1];
    expect(incomeBadge.textContent).toContain('1 Einnahme');
    expect(incomeBadge.textContent).toContain('+15.00');

    cleanUp();
  });

  it('excludes private expenses from the overview badges and totals', async () => {
    const store = useBudgetStore();
    store.budgets = [
      { id: 1, trip_id: 1, name: 'Urlaubskasse', owner_id: null, target_amount: 500 },
      { id: 2, trip_id: 1, name: 'Privates Taschengeld', owner_id: 99, target_amount: 200 },
    ];
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Gemeinsames Essen',
        amount: 50,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: 1,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Privates Souvenir',
        amount: 150,
        paid_by_user_id: 99,
        category: null,
        date: null,
        note: null,
        budget_id: 2,
      },
    ];

    const { cleanUp } = mountCard();
    await nextTick();

    const badges = document.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(1);

    const expenseBadge = badges[0];
    // Nur die geteilte Ausgabe von 50 € darf gezählt werden, nicht die 150 € aus dem privaten Topf
    expect(expenseBadge.textContent).toContain('1 Ausgabe');
    expect(expenseBadge.textContent).toContain('50.00');
    expect(expenseBadge.textContent).not.toContain('200.00');

    cleanUp();
  });
});
