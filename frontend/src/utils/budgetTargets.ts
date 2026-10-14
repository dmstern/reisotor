import type { Budget, BudgetAllocation } from '../api/types';

/** Effektives Ziel eines Budgets: explizites target_amount gewinnt, falls gesetzt (einfacher
 *  Modus - eine Zahl, keine Unterkategorien nötig); sonst die Summe seiner Kategorie-Allokationen
 *  (detaillierter Modus). Dieselbe Regel wird sowohl für das Gesamtbudget-KPI als auch je
 *  Budget-Meter verwendet (siehe stores/budget.ts), damit beide nie auseinanderlaufen. */
export function effectiveBudgetTarget(budget: Budget, allocations: BudgetAllocation[]): number {
  if (budget.target_amount != null) return budget.target_amount;
  return allocations.filter((a) => a.budget_id === budget.id).reduce((s, a) => s + a.amount, 0);
}

/** Berechnet das Gesamtziel des Urlaubs. Nur gemeinsame Budgets (owner_id == null) fließen in das
 *  Trip-Gesamtbudget ein; private Töpfe einzelner Personen verwalten ihr eigenes isoliertes Limit
 *  und zählen nicht zum gemeinsamen Reisebudget. */
export function grandTotalTarget(budgets: Budget[], allocations: BudgetAllocation[]): number {
  return budgets
    .filter((b) => b.owner_id == null)
    .reduce((s, b) => s + effectiveBudgetTarget(b, allocations), 0);
}
