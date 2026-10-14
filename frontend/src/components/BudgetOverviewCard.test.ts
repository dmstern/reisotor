// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import BudgetOverviewCard from './BudgetOverviewCard.vue';
import { useBudgetStore } from '../stores/budget';
import { useIconStyleStore } from '../stores/iconStyle';
import type { BudgetExpense } from '../api/types';

describe('BudgetOverviewCard', () => {
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
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

  function makeExpense(id: number, amount: number, title = 'Test'): BudgetExpense {
    return {
      id,
      trip_id: 1,
      title,
      category: null,
      amount,
      paid_by_user_id: 1,
      date: null,
      note: null,
      budget_id: null,
    };
  }

  it('renders nothing in overview-badges when expenses are empty', () => {
    const store = useBudgetStore();
    store.expenses = [];

    const { container, cleanUp } = mountCard();
    expect(container.querySelector('.overview-badges')).toBeNull();
    cleanUp();
  });

  it('renders single Ausgabe badge correctly when only one positive expense exists', () => {
    const store = useBudgetStore();
    store.expenses = [makeExpense(1, 45)];

    const { container, cleanUp } = mountCard();
    const badges = container.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent?.trim()).toBe('1 Ausgabe');
    expect(badges[0].classList.contains('badge--success')).toBe(false);
    cleanUp();
  });

  it('renders plural Ausgaben badge when multiple positive expenses exist and no incomes', () => {
    const store = useBudgetStore();
    store.expenses = [makeExpense(1, 45), makeExpense(2, 60)];

    const { container, cleanUp } = mountCard();
    const badges = container.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent?.trim()).toBe('2 Ausgaben');
    expect(badges[0].classList.contains('badge--success')).toBe(false);
    cleanUp();
  });

  it('renders single Einnahme badge with success styling when only one negative amount exists', () => {
    const store = useBudgetStore();
    store.expenses = [makeExpense(1, -100, 'Zuschuss')];

    const { container, cleanUp } = mountCard();
    const badges = container.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent?.trim()).toBe('1 Einnahme');
    expect(badges[0].classList.contains('badge--success')).toBe(true);
    cleanUp();
  });

  it('renders separate Ausgaben and Einnahmen badges when both expenses and incomes exist', () => {
    const store = useBudgetStore();
    store.expenses = [
      makeExpense(1, 20),
      makeExpense(2, 30),
      makeExpense(3, 40),
      makeExpense(4, 50),
      makeExpense(5, 60),
      makeExpense(6, 70),
      makeExpense(7, -150, 'Pfand/Zuschuss'),
    ];

    const { container, cleanUp } = mountCard();
    const badges = container.querySelectorAll('.overview-badges .badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent?.trim()).toBe('6 Ausgaben');
    expect(badges[0].classList.contains('badge--success')).toBe(false);
    expect(badges[1].textContent?.trim()).toBe('1 Einnahme');
    expect(badges[1].classList.contains('badge--success')).toBe(true);
    cleanUp();
  });

  it('renders moneybag icon in total budget meter', () => {
    const iconStyle = useIconStyleStore();
    iconStyle.groups.categories = 'icons';

    const { container, cleanUp } = mountCard();
    const meterIcon = container.querySelector('.meter-head svg.tabler-icon-moneybag');
    expect(meterIcon).not.toBeNull();
    cleanUp();
  });
});
