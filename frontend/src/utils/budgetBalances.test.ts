import { describe, expect, it } from 'vitest';
import { computeBalances, computeSettlementSuggestions, isSharedExpense } from './budgetBalances';
import type { Balance } from './budgetBalances';
import type { Budget, BudgetExpense, BudgetTransfer, User } from '../api/types';

const userA: User = { id: 1, username: 'A', avatar: '🧑' };
const userB: User = { id: 2, username: 'B', avatar: '👩' };
const userC: User = { id: 3, username: 'C', avatar: '🐈' };

function expense(paidBy: number, amount: number, budgetId: number | null = null): BudgetExpense {
  return {
    id: Math.random(),
    trip_id: 1,
    title: 'x',
    category: null,
    amount,
    paid_by_user_id: paidBy,
    date: null,
    note: null,
    budget_id: budgetId,
  };
}

function transfer(from: number, to: number, amount: number): BudgetTransfer {
  return {
    id: Math.random(),
    trip_id: 1,
    from_user_id: from,
    to_user_id: to,
    amount,
    date: null,
    note: null,
  };
}

function sharedBudget(id: number): Budget {
  return { id, trip_id: 1, name: 'Gemeinsam', owner_id: null, target_amount: null };
}

function privateBudget(id: number, ownerId: number): Budget {
  return { id, trip_id: 1, name: 'Privat', owner_id: ownerId, target_amount: null };
}

describe('isSharedExpense', () => {
  it('treats an expense without budget_id as shared (legacy)', () => {
    expect(isSharedExpense(expense(userA.id, 10, null), [])).toBe(true);
  });

  it('treats an expense linked to a shared budget (owner_id null) as shared', () => {
    const budgets = [sharedBudget(1)];
    expect(isSharedExpense(expense(userA.id, 10, 1), budgets)).toBe(true);
  });

  it('treats an expense linked to a private budget as not shared', () => {
    const budgets = [privateBudget(1, userA.id)];
    expect(isSharedExpense(expense(userA.id, 10, 1), budgets)).toBe(false);
  });

  it('fails open to "shared" if the linked budget cannot be resolved', () => {
    expect(isSharedExpense(expense(userA.id, 10, 999), [])).toBe(true);
  });
});

describe('computeBalances', () => {
  it('returns [] for zero users', () => {
    expect(computeBalances([], [], [], [])).toEqual([]);
  });

  it('nets a single user to 0 (pays their own 100% fair share)', () => {
    const balances = computeBalances([userA], [expense(userA.id, 42)], [], []);
    expect(balances).toHaveLength(1);
    expect(balances[0].net).toBeCloseTo(0);
  });

  it('nets both users to 0 for an even split with no transfers', () => {
    const balances = computeBalances(
      [userA, userB],
      [expense(userA.id, 50), expense(userB.id, 50)],
      [],
      []
    );
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(0);
  });

  it('computes an uneven split correctly (A paid 100, B paid 0)', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 100)], [], []);
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(50);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(-50);
  });

  it('treats a transfer as debt settlement, not as an expense', () => {
    const balances = computeBalances(
      [userA, userB],
      [expense(userA.id, 100)],
      [transfer(userB.id, userA.id, 50)],
      []
    );
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(0);
  });

  it('does not throw when a transfer references a user not in the users array', () => {
    const stranger = 999;
    expect(() =>
      computeBalances(
        [userA, userB],
        [expense(userA.id, 100)],
        [transfer(stranger, userA.id, 20)],
        []
      )
    ).not.toThrow();
    const balances = computeBalances(
      [userA, userB],
      [expense(userA.id, 100)],
      [transfer(stranger, userA.id, 20)],
      []
    );
    // Der Transfer eines unbekannten Nutzers darf B's Saldo nicht beeinflussen.
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(-50);
  });

  it('excludes an expense linked to a private budget from the split entirely', () => {
    const budgets = [privateBudget(1, userA.id)];
    const balances = computeBalances([userA, userB], [expense(userA.id, 100, 1)], [], budgets);
    // Rein privat getrackte Ausgabe - fließt in keinen der beiden Salden ein.
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userA.id)!.paid).toBeCloseTo(0);
  });

  it('gives identical results for an expense on a shared budget and a legacy expense without budget_id', () => {
    const budgets = [sharedBudget(1)];
    const withSharedBudget = computeBalances(
      [userA, userB],
      [expense(userA.id, 80, 1)],
      [],
      budgets
    );
    const legacy = computeBalances([userA, userB], [expense(userA.id, 80, null)], [], []);
    expect(withSharedBudget.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(
      legacy.find((b) => b.user.id === userA.id)!.net
    );
    expect(withSharedBudget.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(
      legacy.find((b) => b.user.id === userB.id)!.net
    );
  });

  it('only splits the shared portion when private and shared expenses are mixed', () => {
    const budgets = [sharedBudget(1), privateBudget(2, userA.id)];
    const expenses = [
      expense(userA.id, 100, 1), // geteilt: zählt für den Split
      expense(userA.id, 999, 2), // privat: zählt NICHT für den Split
    ];
    const balances = computeBalances([userA, userB], expenses, [], budgets);
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(50);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(-50);
  });
});

function applySettlements(
  balances: Balance[],
  suggestions: ReturnType<typeof computeSettlementSuggestions>
) {
  const netByUser = new Map(balances.map((b) => [b.user.id, b.net]));
  for (const s of suggestions) {
    netByUser.set(s.from.id, (netByUser.get(s.from.id) ?? 0) + s.amount);
    netByUser.set(s.to.id, (netByUser.get(s.to.id) ?? 0) - s.amount);
  }
  return netByUser;
}

describe('computeSettlementSuggestions', () => {
  it('returns [] when everyone is already settled', () => {
    const balances = computeBalances(
      [userA, userB],
      [expense(userA.id, 50), expense(userB.id, 50)],
      [],
      []
    );
    expect(computeSettlementSuggestions(balances)).toEqual([]);
  });

  it('suggests exactly one transfer for the 2-person unsettled case', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 100)], [], []);
    const suggestions = computeSettlementSuggestions(balances);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].from.id).toBe(userB.id);
    expect(suggestions[0].to.id).toBe(userA.id);
    expect(suggestions[0].amount).toBeCloseTo(50);
  });

  it('produces only positive amounts and no self-transfers', () => {
    const balances = computeBalances(
      [userA, userB, userC],
      [expense(userA.id, 90), expense(userB.id, 30), expense(userC.id, 0)],
      [],
      []
    );
    const suggestions = computeSettlementSuggestions(balances);
    for (const s of suggestions) {
      expect(s.amount).toBeGreaterThan(0);
      expect(s.from.id).not.toBe(s.to.id);
    }
  });

  it('zeroes out every balance (within epsilon) once all suggestions are applied', () => {
    const balances = computeBalances(
      [userA, userB, userC],
      [expense(userA.id, 90), expense(userB.id, 30), expense(userC.id, 0)],
      [],
      []
    );
    const suggestions = computeSettlementSuggestions(balances);
    const resulting = applySettlements(balances, suggestions);
    for (const net of resulting.values()) {
      expect(Math.abs(net)).toBeLessThan(0.01);
    }
  });

  it('reduces a genuine 3-way cycle to at most N-1 suggestions and moves no more money than necessary', () => {
    // A zahlt 120, B zahlt 60, C zahlt 0 -> fairShare 60 -> net: A +60, B 0, C -60
    const balances = computeBalances(
      [userA, userB, userC],
      [expense(userA.id, 120), expense(userB.id, 60)],
      [],
      []
    );
    const suggestions = computeSettlementSuggestions(balances);
    expect(suggestions.length).toBeLessThanOrEqual(2);
    const totalMoved = suggestions.reduce((s, x) => s + x.amount, 0);
    const totalPositive = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
    expect(totalMoved).toBeLessThanOrEqual(totalPositive + 0.01);
    const resulting = applySettlements(balances, suggestions);
    for (const net of resulting.values()) {
      expect(Math.abs(net)).toBeLessThan(0.01);
    }
  });

  it('handles floating-point rounding from an uneven 3-way split (100 / 3)', () => {
    const balances = computeBalances([userA, userB, userC], [expense(userA.id, 100)], [], []);
    const suggestions = computeSettlementSuggestions(balances);
    const resulting = applySettlements(balances, suggestions);
    for (const net of resulting.values()) {
      expect(Math.abs(net)).toBeLessThan(0.01);
    }
  });

  it('is deterministic for the same input', () => {
    const balances = computeBalances(
      [userA, userB, userC],
      [expense(userA.id, 90), expense(userB.id, 30), expense(userC.id, 0)],
      [],
      []
    );
    const first = computeSettlementSuggestions(balances);
    const second = computeSettlementSuggestions(balances);
    expect(second).toEqual(first);
  });
});
