import type { BudgetExpense, BudgetTransfer, User } from '../api/types';

export interface Balance {
  user: User;
  paid: number;
  fairShare: number;
  net: number;
}

export type TwoPersonSummary =
  | { settled: true }
  | { settled: false; debtor: User; creditor: User; amount: number };

/** Jede Ausgabe wird zu gleichen Teilen unter allen Nutzer:innen aufgeteilt (unabhängig davon, wer
 *  sie eingetragen hat); Überweisungen gelten als Schuldenrückzahlung, nicht als eigene Ausgabe.
 *  Extrahiert aus BudgetView.vue's ehemals dort inline liegenden `balances`/`twoPersonSummary`-
 *  Computeds, damit die Berechnung ohne Vue-Komponente/Mounting testbar ist. */
export function computeBalances(users: User[], expenses: BudgetExpense[], transfers: BudgetTransfer[]): Balance[] {
  const n = users.length;
  if (n === 0) return [];
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const fairShare = totalSpent / n;
  return users.map((u) => {
    const paid = expenses.filter((e) => e.paid_by_user_id === u.id).reduce((s, e) => s + e.amount, 0);
    const received = transfers.filter((t) => t.to_user_id === u.id).reduce((s, t) => s + t.amount, 0);
    const sent = transfers.filter((t) => t.from_user_id === u.id).reduce((s, t) => s + t.amount, 0);
    // Eine Überweisung ist eine Schuldenrückzahlung: wer sendet, baut Schulden ab (net steigt);
    // wer empfängt, hat bereits Ausgleich bekommen (net sinkt).
    const net = paid - fairShare + sent - received;
    return { user: u, paid, fairShare, net };
  });
}

export function computeTwoPersonSummary(balances: Balance[]): TwoPersonSummary | null {
  if (balances.length !== 2) return null;
  const [a, b] = balances;
  if (Math.abs(a.net) < 0.01) return { settled: true };
  const [debtor, creditor] = a.net < 0 ? [a, b] : [b, a];
  return { settled: false, debtor: debtor.user, creditor: creditor.user, amount: Math.abs(a.net) };
}
