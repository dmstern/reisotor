// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetSettlementCard from './BudgetSettlementCard.vue';
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

describe('BudgetSettlementCard', () => {
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
      render: () => h(BudgetSettlementCard),
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

  it('renders "0,00 € ausgeglichen" with neutral default badge when balance has minimal rounding difference', async () => {
    const store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
      { id: 3, username: 'Charlie', avatar: '🧑' },
    ];
    // 3 Personen, 100 € Ausgabe von Alice -> jede/r fairShare = 33.3333 €
    // Bob überweist 33.33 € an Alice -> Bobs Saldo = 0 - 33.3333 + 33.33 = -0.0033 €
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Gruppenkasse',
        amount: 100,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: null,
      },
    ];
    store.transfers = [
      {
        id: 1,
        trip_id: 1,
        from_user_id: 2,
        to_user_id: 1,
        amount: 33.33,
        date: null,
        note: null,
      },
      {
        id: 2,
        trip_id: 1,
        from_user_id: 3,
        to_user_id: 1,
        amount: 33.33,
        date: null,
        note: null,
      },
    ];

    const { cleanUp } = mountCard();
    await nextTick();

    const balanceRows = document.querySelectorAll('.balance-row');
    expect(balanceRows.length).toBe(3);

    // Bobs Zeile prüfen
    const bobRow = Array.from(balanceRows).find((r) => r.textContent?.includes('Bob'));
    expect(bobRow).toBeDefined();

    // Bob hat einen Restsaldo von rund -0.0033 €, muss nun aber neutral "0,00 € ausgeglichen" sein
    const badge = bobRow?.querySelector('.badge');
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains('badge--danger')).toBe(false);
    expect(badge?.classList.contains('badge--default')).toBe(true);
    expect(badge?.textContent).toContain('0,00');
    expect(badge?.textContent).toContain('ausgeglichen');
    expect(badge?.textContent).not.toContain('schuldet');

    cleanUp();
  });

  it('renders "schuldet 50.00 €" with danger badge when user genuinely owes money', async () => {
    const store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
    ];
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Essen',
        amount: 100,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: null,
      },
    ];

    const { cleanUp } = mountCard();
    await nextTick();

    const balanceRows = document.querySelectorAll('.balance-row');
    const bobRow = Array.from(balanceRows).find((r) => r.textContent?.includes('Bob'));
    const badge = bobRow?.querySelector('.badge');

    expect(badge?.classList.contains('badge--danger')).toBe(true);
    expect(badge?.textContent).toContain('schuldet');
    expect(badge?.textContent).toContain('50.00');

    cleanUp();
  });

  it('renders "bekommt 50.00 €" with success badge when user is owed money', async () => {
    const store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
    ];
    store.expenses = [
      {
        id: 1,
        trip_id: 1,
        title: 'Essen',
        amount: 100,
        paid_by_user_id: 1,
        category: null,
        date: null,
        note: null,
        budget_id: null,
      },
    ];

    const { cleanUp } = mountCard();
    await nextTick();

    const balanceRows = document.querySelectorAll('.balance-row');
    const aliceRow = Array.from(balanceRows).find((r) => r.textContent?.includes('Alice'));
    const badge = aliceRow?.querySelector('.badge');

    expect(badge?.classList.contains('badge--success')).toBe(true);
    expect(badge?.textContent).toContain('bekommt');
    expect(badge?.textContent).toContain('50.00');

    cleanUp();
  });
});
