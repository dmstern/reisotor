import { describe, expect, it } from 'vitest';
import { computeBalances, computeTwoPersonSummary } from './budgetBalances';
import type { BudgetExpense, BudgetTransfer, User } from '../api/types';

const userA: User = { id: 1, username: 'A', avatar: '🧑' };
const userB: User = { id: 2, username: 'B', avatar: '👩' };

function expense(paidBy: number, amount: number): BudgetExpense {
  return { id: Math.random(), trip_id: 1, title: 'x', category: null, amount, paid_by_user_id: paidBy, date: null, note: null, budget_id: null };
}

function transfer(from: number, to: number, amount: number): BudgetTransfer {
  return { id: Math.random(), trip_id: 1, from_user_id: from, to_user_id: to, amount, date: null, note: null };
}

describe('computeBalances', () => {
  it('returns [] for zero users', () => {
    expect(computeBalances([], [], [])).toEqual([]);
  });

  it('nets a single user to 0 (pays their own 100% fair share)', () => {
    const balances = computeBalances([userA], [expense(userA.id, 42)], []);
    expect(balances).toHaveLength(1);
    expect(balances[0].net).toBeCloseTo(0);
  });

  it('nets both users to 0 for an even split with no transfers', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 50), expense(userB.id, 50)], []);
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(0);
  });

  it('computes an uneven split correctly (A paid 100, B paid 0)', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 100)], []);
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(50);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(-50);
  });

  it('treats a transfer as debt settlement, not as an expense', () => {
    const balances = computeBalances(
      [userA, userB],
      [expense(userA.id, 100)],
      [transfer(userB.id, userA.id, 50)],
    );
    expect(balances.find((b) => b.user.id === userA.id)!.net).toBeCloseTo(0);
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(0);
  });

  it('does not throw when a transfer references a user not in the users array', () => {
    const stranger = 999;
    expect(() =>
      computeBalances([userA, userB], [expense(userA.id, 100)], [transfer(stranger, userA.id, 20)]),
    ).not.toThrow();
    const balances = computeBalances([userA, userB], [expense(userA.id, 100)], [transfer(stranger, userA.id, 20)]);
    // Der Transfer eines unbekannten Nutzers darf B's Saldo nicht beeinflussen.
    expect(balances.find((b) => b.user.id === userB.id)!.net).toBeCloseTo(-50);
  });
});

describe('computeTwoPersonSummary', () => {
  it('returns null for anything other than exactly 2 balances', () => {
    expect(computeTwoPersonSummary([])).toBeNull();
    expect(computeTwoPersonSummary(computeBalances([userA], [], []))).toBeNull();
    const userC: User = { id: 3, username: 'C', avatar: '🐈' };
    expect(computeTwoPersonSummary(computeBalances([userA, userB, userC], [], []))).toBeNull();
  });

  it('reports settled when net is within the 0.01 epsilon', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 50), expense(userB.id, 50)], []);
    expect(computeTwoPersonSummary(balances)).toEqual({ settled: true });
  });

  it('identifies the debtor/creditor correctly when A owes B', () => {
    const balances = computeBalances([userA, userB], [expense(userB.id, 100)], []);
    const summary = computeTwoPersonSummary(balances);
    expect(summary).toMatchObject({ settled: false, amount: 50 });
    if (!summary || summary.settled) throw new Error('expected an unsettled summary');
    expect(summary.debtor.id).toBe(userA.id);
    expect(summary.creditor.id).toBe(userB.id);
  });

  it('identifies the debtor/creditor correctly the other way around (B owes A)', () => {
    const balances = computeBalances([userA, userB], [expense(userA.id, 100)], []);
    const summary = computeTwoPersonSummary(balances);
    expect(summary).toMatchObject({ settled: false, amount: 50 });
    if (!summary || summary.settled) throw new Error('expected an unsettled summary');
    expect(summary.debtor.id).toBe(userB.id);
    expect(summary.creditor.id).toBe(userA.id);
  });
});
