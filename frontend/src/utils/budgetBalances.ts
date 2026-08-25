import type { Budget, BudgetExpense, BudgetTransfer, User } from '../api/types';

export interface Balance {
  user: User;
  paid: number;
  fairShare: number;
  net: number;
}

export interface SettlementSuggestion {
  from: User;
  to: User;
  amount: number;
}

const BALANCE_EPSILON = 0.01;

/** Eine Ausgabe zählt zur gleichmäßig aufgeteilten Gruppen-Schuld, wenn sie keinem Budget
 *  zugeordnet ist (Alt-Ausgaben/legacy) ODER einem geteilten Budget (owner_id null). Ausgaben in
 *  einem persönlichen Budget sind reines Einzel-Tracking und fließen NICHT in den
 *  Schulden-Ausgleich ein. Fällt "offen" auf geteilt zurück, falls das verknüpfte Budget nicht
 *  auflösbar ist (sollte durch die serverseitige Privatsphäre-Filterung ohnehin nicht vorkommen). */
export function isSharedExpense(expense: BudgetExpense, budgets: Budget[]): boolean {
  if (expense.budget_id == null) return true;
  const budget = budgets.find((b) => b.id === expense.budget_id);
  return budget == null || budget.owner_id == null;
}

/** Jede geteilte Ausgabe wird zu gleichen Teilen unter allen Nutzer:innen aufgeteilt (unabhängig
 *  davon, wer sie eingetragen hat); Überweisungen gelten als Schuldenrückzahlung, nicht als eigene
 *  Ausgabe. Ausgaben aus privaten Budget-Töpfen fließen nicht ein (siehe isSharedExpense).
 *  Extrahiert aus BudgetView.vue's ehemals dort inline liegenden `balances`-Computed, damit die
 *  Berechnung ohne Vue-Komponente/Mounting testbar ist. */
export function computeBalances(
  users: User[],
  expenses: BudgetExpense[],
  transfers: BudgetTransfer[],
  budgets: Budget[]
): Balance[] {
  const n = users.length;
  if (n === 0) return [];
  const sharedExpenses = expenses.filter((e) => isSharedExpense(e, budgets));
  const totalSpent = sharedExpenses.reduce((s, e) => s + e.amount, 0);
  const fairShare = totalSpent / n;
  return users.map((u) => {
    const paid = sharedExpenses
      .filter((e) => e.paid_by_user_id === u.id)
      .reduce((s, e) => s + e.amount, 0);
    const received = transfers
      .filter((t) => t.to_user_id === u.id)
      .reduce((s, t) => s + t.amount, 0);
    const sent = transfers.filter((t) => t.from_user_id === u.id).reduce((s, t) => s + t.amount, 0);
    // Eine Überweisung ist eine Schuldenrückzahlung: wer sendet, baut Schulden ab (net steigt);
    // wer empfängt, hat bereits Ausgleich bekommen (net sinkt).
    const net = paid - fairShare + sent - received;
    return { user: u, paid, fairShare, net };
  });
}

/** Splitwise-artige Schulden-Vereinfachung ("simplify debts"): reduziert N sich überkreuzende
 *  Netto-Salden auf höchstens N-1 konkrete Überweisungsvorschläge (größter Schuldner zahlt
 *  größtem Gläubiger, greedy). Kein global-minimales Transaktionsset (das wäre ein NP-schweres
 *  Subset-Sum-Problem), aber der in der Praxis übliche, deterministische Heuristik-Ansatz - ersetzt
 *  den bisherigen, nur für exakt 2 Personen funktionierenden Sonderfall computeTwoPersonSummary
 *  (für genau 2 unausgeglichene Personen liefert diese Funktion automatisch genau 1 Vorschlag). */
export function computeSettlementSuggestions(balances: Balance[]): SettlementSuggestion[] {
  const debtors = balances
    .filter((b) => b.net < -BALANCE_EPSILON)
    .map((b) => ({ user: b.user, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > BALANCE_EPSILON)
    .map((b) => ({ user: b.user, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const suggestions: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;
    if (amount > 0) {
      suggestions.push({ from: debtor.user, to: creditor.user, amount });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount <= BALANCE_EPSILON) i++;
    if (creditor.amount <= BALANCE_EPSILON) j++;
  }
  return suggestions;
}
