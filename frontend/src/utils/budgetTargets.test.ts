import { describe, expect, it } from 'vitest';
import { effectiveBudgetTarget, grandTotalTarget } from './budgetTargets';
import type { Budget, BudgetAllocation } from '../api/types';

function budget(id: number, targetAmount: number | null): Budget {
  return { id, trip_id: 1, name: 'Topf', owner_id: null, target_amount: targetAmount };
}

function allocation(budgetId: number, category: string, amount: number): BudgetAllocation {
  return { id: Math.random(), budget_id: budgetId, category, amount };
}

describe('effectiveBudgetTarget', () => {
  it('uses target_amount when set and there are no allocations (einfacher Modus)', () => {
    expect(effectiveBudgetTarget(budget(1, 500), [])).toBe(500);
  });

  it('falls back to the sum of allocations when target_amount is null (detaillierter Modus)', () => {
    const allocations = [allocation(1, 'Essen', 100), allocation(1, 'Transport', 50)];
    expect(effectiveBudgetTarget(budget(1, null), allocations)).toBe(150);
  });

  it('prefers target_amount over the allocation sum when both are present', () => {
    const allocations = [allocation(1, 'Essen', 100), allocation(1, 'Transport', 50)];
    expect(effectiveBudgetTarget(budget(1, 500), allocations)).toBe(500);
  });

  it('returns 0 when neither target_amount nor any allocations exist', () => {
    expect(effectiveBudgetTarget(budget(1, null), [])).toBe(0);
  });

  it('only sums allocations belonging to the given budget', () => {
    const allocations = [allocation(1, 'Essen', 100), allocation(2, 'Sonstiges', 999)];
    expect(effectiveBudgetTarget(budget(1, null), allocations)).toBe(100);
  });
});

describe('grandTotalTarget', () => {
  it('sums the effective target across a mix of simple-mode and detailed-mode budgets', () => {
    const budgets = [budget(1, 500), budget(2, null)];
    const allocations = [allocation(2, 'Essen', 100), allocation(2, 'Transport', 50)];
    expect(grandTotalTarget(budgets, allocations)).toBe(650);
  });

  it('returns 0 for an empty list of budgets', () => {
    expect(grandTotalTarget([], [])).toBe(0);
  });
});
