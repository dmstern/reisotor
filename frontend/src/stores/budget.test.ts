import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBudgetStore } from './budget';
import type { Budget, BudgetAllocation, BudgetExpense } from '../api/types';

// Regressionsnetz für die im Store zentralisierten Computeds (reines Wiring, die eigentliche
// Rechenlogik steckt in utils/budgetBalances.ts/budgetTargets.ts und ist dort bereits ausführlich
// getestet) - hier geht es nur darum, dass der Store sie mit den richtigen Feldern füttert.
describe('useBudgetStore computeds', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function budget(id: number, targetAmount: number | null, ownerId: number | null = null): Budget {
    return { id, trip_id: 1, name: `Topf ${id}`, owner_id: ownerId, target_amount: targetAmount };
  }
  function allocation(budgetId: number, category: string, amount: number): BudgetAllocation {
    return { id: Math.random(), budget_id: budgetId, category, amount };
  }
  function expense(
    amount: number,
    budgetId: number | null,
    category: string | null = null
  ): BudgetExpense {
    return {
      id: Math.random(),
      trip_id: 1,
      title: 'x',
      category,
      amount,
      paid_by_user_id: null,
      date: null,
      note: null,
      budget_id: budgetId,
    };
  }

  it('grandTotal picks target_amount over the allocation sum per pot when both are present', () => {
    const store = useBudgetStore();
    // Topf 1: einfacher Modus (target_amount gewinnt trotz vorhandener Allokationen).
    // Topf 2: detaillierter Modus (kein target_amount, Summe der Allokationen zählt).
    store.budgets = [budget(1, 300), budget(2, null)];
    store.allocations = [
      allocation(1, 'Sonstiges', 999),
      allocation(2, 'Essen', 100),
      allocation(2, 'Transport', 50),
    ];
    expect(store.grandTotal).toBe(450); // 300 (Topf 1) + 150 (Topf 2)
  });

  it('spentFor falls back to matching legacy expenses (budget_id null) by category for the shared budget', () => {
    const store = useBudgetStore();
    const shared = budget(1, null, null);
    store.budgets = [shared];
    store.allocations = [allocation(1, 'Essen', 100)];
    store.expenses = [expense(20, null, 'Essen'), expense(5, null, 'Transport')];
    expect(store.spentFor(shared, 'Essen')).toBe(20);
    expect(store.spentFor(shared, 'Transport')).toBe(5);
    expect(store.spentFor(shared, 'Sonstiges')).toBe(0);
  });

  it('totalSpent excludes expenses linked to a private budget', () => {
    const store = useBudgetStore();
    store.budgets = [budget(1, null, null), budget(2, null, 42)];
    store.expenses = [expense(50, 1), expense(500, 2)];
    expect(store.totalSpent).toBe(50);
  });

  it('remaining goes negative once totalSpent exceeds grandTotal', () => {
    const store = useBudgetStore();
    store.budgets = [budget(1, 100, null)];
    store.expenses = [expense(150, 1)];
    expect(store.remaining).toBe(-50);
  });
});
