import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import type { Budget, BudgetAllocation, BudgetExpense, BudgetTransfer, User } from '../api/types';
import { computeBalances, computeSettlementSuggestions, isSharedExpense } from '../utils/budgetBalances';
import { effectiveBudgetTarget, grandTotalTarget } from '../utils/budgetTargets';
import { useUndoableDelete } from '../composables/useUndoableDelete';

export interface BudgetFormInput {
  name: string;
  owner_id?: number;
  target_amount?: number;
}

export interface ExpenseInput {
  trip_id: number;
  title: string;
  category?: string;
  amount: number;
  paid_by_user_id?: number;
  date?: string;
  note?: string;
  budget_id?: number;
}

export interface TransferInput {
  trip_id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  date?: string;
  note?: string;
}

/** Zentralisiert Fetching + Berechnungen für die Budget-Domäne (vorher lauter lokale Refs/Computeds
 *  in BudgetView.vue, dupliziert in DashboardView.vue's Budget-Kachel) - reine Wiring-Logik, keine
 *  eigene Rechenlogik (die bleibt in utils/budgetBalances.ts + utils/budgetTargets.ts, damit sie
 *  unabhängig von einer Pinia-Instanz testbar bleibt). */
export const useBudgetStore = defineStore('budget', () => {
  const users = ref<User[]>([]);
  const expenses = ref<BudgetExpense[]>([]);
  const budgets = ref<Budget[]>([]);
  const allocations = ref<BudgetAllocation[]>([]);
  const transfers = ref<BudgetTransfer[]>([]);
  const loaded = ref(false);

  // Weicher Löschvorgang serverseitig (siehe routes/budget.ts) + 60s Rückgängig-Fenster
  // clientseitig (useUndoableDelete.ts) - eigene Instanz für Ausgaben und Überweisungen, da beide
  // Listen unabhängig voneinander per Id nummeriert sind.
  const expenseUndo = useUndoableDelete();
  const transferUndo = useUndoableDelete();

  async function load(tripId: number) {
    try {
      const [u, e, b, a, tr] = await Promise.all([
        api.get<User[]>('/users'),
        api.get<BudgetExpense[]>(`/budget?trip_id=${tripId}`),
        api.get<Budget[]>(`/budget/budgets?trip_id=${tripId}`),
        api.get<BudgetAllocation[]>(`/budget/allocations?trip_id=${tripId}`),
        api.get<BudgetTransfer[]>(`/budget/transfers?trip_id=${tripId}`),
      ]);
      users.value = u;
      expenses.value = e;
      budgets.value = b;
      allocations.value = a;
      transfers.value = tr;
    } catch {
      // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll
      // trotzdem mit dem rendern, was da ist (siehe api/client.ts's Offline-Fallback-Konzept).
    } finally {
      loaded.value = true;
    }
  }

  function userName(id: number | null) {
    if (id == null) return 'Gemeinsam';
    return users.value.find((u) => u.id === id)?.username ?? '?';
  }
  function userAvatar(id: number | null) {
    if (id == null) return '🤝';
    return users.value.find((u) => u.id === id)?.avatar ?? '❓';
  }
  function budgetLabel(budget: Budget) {
    return budget.owner_id == null ? '🤝 Gemeinsam' : `${userAvatar(budget.owner_id)} ${userName(budget.owner_id)}`;
  }

  // --- Budgets (persönlich oder geteilt) ---
  function allocationsFor(budgetId: number) {
    return allocations.value.filter((a) => a.budget_id === budgetId);
  }
  function budgetTarget(budget: Budget) {
    return effectiveBudgetTarget(budget, allocations.value);
  }

  const grandTotal = computed(() => grandTotalTarget(budgets.value, allocations.value));

  // "Ausgegeben" zählt bewusst nur geteilte Ausgaben (dieselbe Definition wie die Schulden-
  // Berechnung unten, siehe utils/budgetBalances.ts's isSharedExpense) - eine private Ausgabe ist
  // nicht "des Urlaubs" Geld, sondern reines Einzel-Tracking. Sichtbare, bewusste Verhaltens-
  // änderung ggü. vorher (dort zählten ausnahmslos alle Ausgaben).
  const totalSpent = computed(() =>
    expenses.value.filter((e) => isSharedExpense(e, budgets.value)).reduce((s, e) => s + e.amount, 0),
  );
  const remaining = computed(() => grandTotal.value - totalSpent.value);

  /** Ausgaben ohne budget_id (u. a. automatisch aus Unterkunft/Reise erzeugte) werden dem
   *  geteilten Budget anhand des Kategorienamens zugeordnet, damit sie in der Aufschlüsselung
   *  auftauchen, ohne dass jede Alt-Ausgabe nachträglich manuell zugewiesen werden muss. */
  function spentFor(budget: Budget, category: string) {
    return expenses.value
      .filter((e) => {
        if (e.budget_id === budget.id) return true;
        if (e.budget_id == null && budget.owner_id == null && (e.category ?? '') === category) return true;
        return false;
      })
      .reduce((s, e) => s + e.amount, 0);
  }

  const expenseCategories = computed(() => {
    const set = new Set<string>();
    allocations.value.forEach((a) => set.add(a.category));
    expenses.value.forEach((e) => e.category && set.add(e.category));
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  });

  // --- Salden / Schulden (Berechnung in utils/budgetBalances.ts) ---
  const balances = computed(() => computeBalances(users.value, expenses.value, transfers.value, budgets.value));
  const settlementSuggestions = computed(() => computeSettlementSuggestions(balances.value));

  async function addBudget(tripId: number, input: BudgetFormInput) {
    const created = await api.post<Budget>('/budget/budgets', { trip_id: tripId, ...input });
    budgets.value.push(created);
    return created;
  }

  async function updateBudget(id: number, input: BudgetFormInput) {
    const updated = await api.put<Budget>(`/budget/budgets/${id}`, input);
    const idx = budgets.value.findIndex((b) => b.id === id);
    if (idx !== -1) budgets.value[idx] = updated;
    return updated;
  }

  async function removeBudget(id: number) {
    await api.delete(`/budget/budgets/${id}`);
    budgets.value = budgets.value.filter((b) => b.id !== id);
    allocations.value = allocations.value.filter((a) => a.budget_id !== id);
  }

  async function saveAllocation(budgetId: number, category: string, amount: number) {
    const updated = await api.put<BudgetAllocation>('/budget/allocations', { budget_id: budgetId, category, amount });
    const idx = allocations.value.findIndex((a) => a.id === updated.id);
    if (idx !== -1) allocations.value[idx] = updated;
    else allocations.value.push(updated);
    return updated;
  }

  async function removeAllocation(id: number) {
    await api.delete(`/budget/allocations/${id}`);
    allocations.value = allocations.value.filter((a) => a.id !== id);
  }

  // --- Ausgaben (Bezahlungen) ---
  async function submitExpense(body: ExpenseInput) {
    const created = await api.post<BudgetExpense>('/budget', body);
    expenses.value.unshift(created);
    return created;
  }

  async function updateExpense(id: number, body: ExpenseInput) {
    const updated = await api.put<BudgetExpense>(`/budget/${id}`, body);
    const idx = expenses.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) expenses.value[idx] = updated;
    return updated;
  }

  async function removeExpense(id: number) {
    await api.delete(`/budget/${id}`);
    expenseUndo.markPendingDelete(id, () => {
      expenses.value = expenses.value.filter((e) => e.id !== id);
    });
  }

  async function restoreExpense(id: number) {
    expenseUndo.clearPending(id);
    await api.post(`/trash/budget_item/${id}/restore`);
  }

  // --- Überweisungen ---
  async function submitTransfer(body: TransferInput) {
    const created = await api.post<BudgetTransfer>('/budget/transfers', body);
    transfers.value.unshift(created);
    return created;
  }

  async function removeTransfer(id: number) {
    await api.delete(`/budget/transfers/${id}`);
    transferUndo.markPendingDelete(id, () => {
      transfers.value = transfers.value.filter((t) => t.id !== id);
    });
  }

  async function restoreTransfer(id: number) {
    transferUndo.clearPending(id);
    await api.post(`/trash/budget_transfer/${id}/restore`);
  }

  return {
    users,
    expenses,
    budgets,
    allocations,
    transfers,
    loaded,
    load,
    userName,
    userAvatar,
    budgetLabel,
    allocationsFor,
    budgetTarget,
    grandTotal,
    totalSpent,
    remaining,
    spentFor,
    expenseCategories,
    balances,
    settlementSuggestions,
    addBudget,
    updateBudget,
    removeBudget,
    saveAllocation,
    removeAllocation,
    submitExpense,
    updateExpense,
    removeExpense,
    restoreExpense,
    expenseUndo,
    submitTransfer,
    removeTransfer,
    restoreTransfer,
    transferUndo,
  };
});
