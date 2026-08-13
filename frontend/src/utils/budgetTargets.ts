import type { Budget, BudgetAllocation } from '../api/types';

/** Effektives Ziel eines Budgets: explizites target_amount gewinnt, falls gesetzt (einfacher
 *  Modus - eine Zahl, keine Unterkategorien nötig); sonst die Summe seiner Kategorie-Allokationen
 *  (detaillierter Modus). Dieselbe Regel wird sowohl für das Gesamtbudget-KPI als auch je
 *  Budget-Meter verwendet (siehe stores/budget.ts), damit beide nie auseinanderlaufen. */
export function effectiveBudgetTarget(budget: Budget, allocations: BudgetAllocation[]): number {
  if (budget.target_amount != null) return budget.target_amount;
  return allocations.filter((a) => a.budget_id === budget.id).reduce((s, a) => s + a.amount, 0);
}

export function grandTotalTarget(budgets: Budget[], allocations: BudgetAllocation[]): number {
  return budgets.reduce((s, b) => s + effectiveBudgetTarget(b, allocations), 0);
}
