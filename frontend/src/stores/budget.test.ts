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

  it('spentFor strictly matches category and does not leak into other categories of the same budget', () => {
    const store = useBudgetStore();
    const shared = budget(1, null, null);
    store.budgets = [shared];
    store.allocations = [
      allocation(1, 'Transport', 100),
      allocation(1, 'Essen & Trinken', 200),
      allocation(1, 'Unterkunft', 500),
    ];
    // Ausgabe von 23.45 € mit budget_id: 1 und Kategorie 'Transport' (wie im gemeldeten Bug)
    store.expenses = [expense(23.45, 1, 'Transport')];

    expect(store.spentFor(shared, 'Transport')).toBe(23.45);
    expect(store.spentFor(shared, 'Essen & Trinken')).toBe(0);
    expect(store.spentFor(shared, 'Unterkunft')).toBe(0);
  });

  it('spentFor counts categorized expenses in all budgets containing that category (Finanzguru-Modell)', () => {
    const store = useBudgetStore();
    const budget1 = budget(1, null, null);
    const budget2 = budget(2, null, null);
    store.budgets = [budget1, budget2];
    store.allocations = [
      allocation(1, 'Transport', 100),
      allocation(2, 'Transport', 50),
      allocation(2, 'Freizeit', 80),
    ];
    store.expenses = [expense(30, null, 'Transport')];

    expect(store.spentFor(budget1, 'Transport')).toBe(30);
    expect(store.spentFor(budget2, 'Transport')).toBe(30);
    expect(store.spentFor(budget2, 'Freizeit')).toBe(0);
  });

  it('isDuplicateCategory detects categories assigned to multiple budgets in the same scope', () => {
    const store = useBudgetStore();
    const shared1 = budget(1, null, null);
    const shared2 = budget(2, null, null);
    const private1 = budget(3, null, 42);

    store.budgets = [shared1, shared2, private1];
    store.allocations = [
      allocation(1, 'Transport', 100),
      allocation(1, 'Essen', 50),
      allocation(2, 'Transport', 80),
      allocation(3, 'Transport', 40), // privat, nicht im geteilten Scope
    ];

    // 'Transport' ist in shared1 und shared2 vorhanden -> Warnung
    expect(store.isDuplicateCategory(1, 'Transport')).toBe(true);
    expect(store.isDuplicateCategory(2, 'Transport')).toBe(true);

    // 'Essen' ist nur in shared1 vorhanden -> keine Warnung
    expect(store.isDuplicateCategory(1, 'Essen')).toBe(false);

    // 'Transport' in private1 ist das einzige private Budget von User 42 mit dieser Kategorie -> keine Warnung
    expect(store.isDuplicateCategory(3, 'Transport')).toBe(false);
  });

  it('isolates private and shared expenses across budgets', () => {
    const store = useBudgetStore();
    const shared = budget(1, null, null);
    const personal = budget(2, null, 42);
    store.budgets = [shared, personal];
    store.allocations = [allocation(1, 'Souvenirs', 100), allocation(2, 'Souvenirs', 50)];

    // Geteilte Ausgabe
    const sharedExp = expense(25, 1, 'Souvenirs');
    // Private Ausgabe von User 42
    const personalExp = expense(15, 2, 'Souvenirs');

    store.expenses = [sharedExp, personalExp];

    expect(store.spentFor(shared, 'Souvenirs')).toBe(25);
    expect(store.spentFor(personal, 'Souvenirs')).toBe(15);
  });
});
