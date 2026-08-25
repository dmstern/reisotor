import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für die Budget-Routen (bisher komplett ungetestet): CRUD + Mitgliedschafts-Gating,
// die neuen Validierungen (positive Beträge, unterschiedliche/Mitglieds-Transfer-Parteien) und -
// als Kernstück - die echte Privatsphäre privater Budget-Töpfe (siehe CLAUDE.md/Plan: "nicht nur
// ein UI-Label").
describe('budget routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  async function register(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { cookie, userId: res.json().id as number };
  }

  async function createTrip(cookie: string, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name, start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    return res.json().id as number;
  }

  async function invite(ownerCookie: string, tripId: number, userId: number) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: userId },
    });
    expect(res.statusCode).toBe(201);
  }

  // Baut einen Trip mit zwei Mitgliedern für Tests, die Mitgliedschaft/Privatsphäre zwischen zwei
  // Personen prüfen müssen. `prefix` sorgt für eindeutige Nutzernamen/E-Mails über alle Tests der
  // Datei hinweg (beforeAll-Isolation, siehe CLAUDE.md).
  async function setupTripWithTwoMembers(prefix: string) {
    const owner = await register(`${prefix}owner`, `${prefix}owner@example.com`);
    const member = await register(`${prefix}member`, `${prefix}member@example.com`);
    const tripId = await createTrip(owner.cookie, `${prefix} Trip`);
    await invite(owner.cookie, tripId, member.userId);
    return { owner, member, tripId };
  }

  describe('expenses CRUD + validation', () => {
    it('lets a trip member create, update and soft-delete an expense; rejects non-members', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('exp1');
      const outsider = await register('exp1outsider', 'exp1outsider@example.com');

      const create = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, title: 'Zug', amount: 42 },
      });
      expect(create.statusCode).toBe(201);
      const expenseId = create.json().id;

      const outsiderCreate = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: outsider.cookie },
        payload: { trip_id: tripId, title: 'Fremd', amount: 10 },
      });
      expect(outsiderCreate.statusCode).toBe(403);

      const update = await app.inject({
        method: 'PUT',
        url: `/api/budget/${expenseId}`,
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, title: 'Zug 2. Klasse', amount: 45 },
      });
      expect(update.statusCode).toBe(200);
      expect(update.json().title).toBe('Zug 2. Klasse');

      const del = await app.inject({
        method: 'DELETE',
        url: `/api/budget/${expenseId}`,
        headers: { cookie: owner.cookie },
      });
      expect(del.statusCode).toBe(204);

      const list = await app.inject({
        method: 'GET',
        url: `/api/budget?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      expect(list.json().find((e: { id: number }) => e.id === expenseId)).toBeUndefined();
    });

    it('rejects an expense amount of 0 or negative', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('exp2');
      for (const amount of [0, -5]) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/budget',
          headers: { cookie: owner.cookie },
          payload: { trip_id: tripId, title: 'Ungueltig', amount },
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('rejects a transfer between the same user, to a non-member, or with amount <= 0', async () => {
      const { owner, member, tripId } = await setupTripWithTwoMembers('exp3');
      const outsider = await register('exp3outsider', 'exp3outsider@example.com');

      const selfTransfer = await app.inject({
        method: 'POST',
        url: '/api/budget/transfers',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          from_user_id: owner.userId,
          to_user_id: owner.userId,
          amount: 10,
        },
      });
      expect(selfTransfer.statusCode).toBe(400);

      const nonMemberTransfer = await app.inject({
        method: 'POST',
        url: '/api/budget/transfers',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          from_user_id: owner.userId,
          to_user_id: outsider.userId,
          amount: 10,
        },
      });
      expect(nonMemberTransfer.statusCode).toBe(400);

      const zeroTransfer = await app.inject({
        method: 'POST',
        url: '/api/budget/transfers',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          from_user_id: owner.userId,
          to_user_id: member.userId,
          amount: 0,
        },
      });
      expect(zeroTransfer.statusCode).toBe(400);

      const valid = await app.inject({
        method: 'POST',
        url: '/api/budget/transfers',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          from_user_id: owner.userId,
          to_user_id: member.userId,
          amount: 10,
        },
      });
      expect(valid.statusCode).toBe(201);
    });

    it('rejects a negative category allocation amount', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('exp4');
      const budgetRes = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Gemeinsam' },
      });
      const budgetId = budgetRes.json().id;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/budget/allocations',
        headers: { cookie: owner.cookie },
        payload: { budget_id: budgetId, category: 'Essen', amount: -1 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('target_amount (einfacher Modus)', () => {
    it('persists a target_amount and round-trips it via GET', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('ta1');
      const create = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Einfaches Budget', target_amount: 500 },
      });
      expect(create.statusCode).toBe(201);
      expect(create.json().target_amount).toBe(500);

      const list = await app.inject({
        method: 'GET',
        url: `/api/budget/budgets?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      const found = list.json().find((b: { id: number }) => b.id === create.json().id);
      expect(found.target_amount).toBe(500);
    });

    it('rejects a target_amount of 0', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('ta2');
      const res = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Ungueltig', target_amount: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('defaults target_amount to null when not provided', async () => {
      const { owner, tripId } = await setupTripWithTwoMembers('ta3');
      const res = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Detailliert' },
      });
      expect(res.json().target_amount).toBeNull();
    });
  });

  describe('private budget privacy', () => {
    it('hides a private budget, its allocations and its expenses from every other member', async () => {
      const { owner, member, tripId } = await setupTripWithTwoMembers('priv1');

      const privateBudget = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Mein Taschengeld', owner_id: owner.userId },
      });
      const privateBudgetId = privateBudget.json().id;

      const allocation = await app.inject({
        method: 'PUT',
        url: '/api/budget/allocations',
        headers: { cookie: owner.cookie },
        payload: { budget_id: privateBudgetId, category: 'Souvenirs', amount: 50 },
      });
      expect(allocation.statusCode).toBe(200);

      const expense = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Geheimes Geschenk',
          amount: 20,
          budget_id: privateBudgetId,
        },
      });
      expect(expense.statusCode).toBe(201);
      const expenseId = expense.json().id;

      // Besitzer sieht alles.
      const ownerBudgets = await app.inject({
        method: 'GET',
        url: `/api/budget/budgets?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      expect(ownerBudgets.json().some((b: { id: number }) => b.id === privateBudgetId)).toBe(true);

      const ownerAllocations = await app.inject({
        method: 'GET',
        url: `/api/budget/allocations?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      expect(
        ownerAllocations.json().some((a: { budget_id: number }) => a.budget_id === privateBudgetId)
      ).toBe(true);

      const ownerExpenses = await app.inject({
        method: 'GET',
        url: `/api/budget?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      expect(ownerExpenses.json().some((e: { id: number }) => e.id === expenseId)).toBe(true);

      // Zweites Mitglied sieht nichts davon.
      const memberBudgets = await app.inject({
        method: 'GET',
        url: `/api/budget/budgets?trip_id=${tripId}`,
        headers: { cookie: member.cookie },
      });
      expect(memberBudgets.json().some((b: { id: number }) => b.id === privateBudgetId)).toBe(
        false
      );

      const memberAllocations = await app.inject({
        method: 'GET',
        url: `/api/budget/allocations?trip_id=${tripId}`,
        headers: { cookie: member.cookie },
      });
      expect(
        memberAllocations.json().some((a: { budget_id: number }) => a.budget_id === privateBudgetId)
      ).toBe(false);

      const memberExpenses = await app.inject({
        method: 'GET',
        url: `/api/budget?trip_id=${tripId}`,
        headers: { cookie: member.cookie },
      });
      expect(memberExpenses.json().some((e: { id: number }) => e.id === expenseId)).toBe(false);
    });

    it('rejects write access to a private budget/allocation/expense from a non-owner member', async () => {
      const { owner, member, tripId } = await setupTripWithTwoMembers('priv2');

      const privateBudget = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Privat', owner_id: owner.userId },
      });
      const privateBudgetId = privateBudget.json().id;

      const allocation = await app.inject({
        method: 'PUT',
        url: '/api/budget/allocations',
        headers: { cookie: owner.cookie },
        payload: { budget_id: privateBudgetId, category: 'Sonstiges', amount: 30 },
      });
      const allocationId = allocation.json().id;

      const expense = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Privatausgabe',
          amount: 15,
          budget_id: privateBudgetId,
        },
      });
      const expenseId = expense.json().id;

      const renameAttempt = await app.inject({
        method: 'PUT',
        url: `/api/budget/budgets/${privateBudgetId}`,
        headers: { cookie: member.cookie },
        payload: { trip_id: tripId, name: 'Umbenannt' },
      });
      expect(renameAttempt.statusCode).toBe(403);

      const deleteAttempt = await app.inject({
        method: 'DELETE',
        url: `/api/budget/budgets/${privateBudgetId}`,
        headers: { cookie: member.cookie },
      });
      expect(deleteAttempt.statusCode).toBe(403);

      const allocationEditAttempt = await app.inject({
        method: 'PUT',
        url: '/api/budget/allocations',
        headers: { cookie: member.cookie },
        payload: { budget_id: privateBudgetId, category: 'Sonstiges', amount: 99 },
      });
      expect(allocationEditAttempt.statusCode).toBe(403);

      const allocationDeleteAttempt = await app.inject({
        method: 'DELETE',
        url: `/api/budget/allocations/${allocationId}`,
        headers: { cookie: member.cookie },
      });
      expect(allocationDeleteAttempt.statusCode).toBe(403);

      const expenseEditAttempt = await app.inject({
        method: 'PUT',
        url: `/api/budget/${expenseId}`,
        headers: { cookie: member.cookie },
        payload: {
          trip_id: tripId,
          title: 'Umgeschrieben',
          amount: 15,
          budget_id: privateBudgetId,
        },
      });
      expect(expenseEditAttempt.statusCode).toBe(403);

      const expenseDeleteAttempt = await app.inject({
        method: 'DELETE',
        url: `/api/budget/${expenseId}`,
        headers: { cookie: member.cookie },
      });
      expect(expenseDeleteAttempt.statusCode).toBe(403);

      const newExpenseIntoPrivateBudget = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: member.cookie },
        payload: { trip_id: tripId, title: 'Einschleusen', amount: 5, budget_id: privateBudgetId },
      });
      expect(newExpenseIntoPrivateBudget.statusCode).toBe(403);
    });

    it('keeps a shared budget and a legacy expense without budget_id visible to every member', async () => {
      const { owner, member, tripId } = await setupTripWithTwoMembers('priv3');

      const sharedBudget = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Gemeinsame Kasse' },
      });
      const sharedBudgetId = sharedBudget.json().id;

      const legacyExpense = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, title: 'Alt-Ausgabe', amount: 12 },
      });
      const legacyExpenseId = legacyExpense.json().id;

      for (const cookie of [owner.cookie, member.cookie]) {
        const budgets = await app.inject({
          method: 'GET',
          url: `/api/budget/budgets?trip_id=${tripId}`,
          headers: { cookie },
        });
        expect(budgets.json().some((b: { id: number }) => b.id === sharedBudgetId)).toBe(true);

        const expenses = await app.inject({
          method: 'GET',
          url: `/api/budget?trip_id=${tripId}`,
          headers: { cookie },
        });
        expect(expenses.json().some((e: { id: number }) => e.id === legacyExpenseId)).toBe(true);
      }
    });

    it('hides a soft-deleted private expense from the trash view of other members, but not the owner', async () => {
      const { owner, member, tripId } = await setupTripWithTwoMembers('priv4');

      const privateBudget = await app.inject({
        method: 'POST',
        url: '/api/budget/budgets',
        headers: { cookie: owner.cookie },
        payload: { trip_id: tripId, name: 'Privat Trash', owner_id: owner.userId },
      });
      const privateBudgetId = privateBudget.json().id;

      const expense = await app.inject({
        method: 'POST',
        url: '/api/budget',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Zu löschende Privatausgabe',
          amount: 8,
          budget_id: privateBudgetId,
        },
      });
      const expenseId = expense.json().id;

      await app.inject({
        method: 'DELETE',
        url: `/api/budget/${expenseId}`,
        headers: { cookie: owner.cookie },
      });

      const memberTrash = await app.inject({
        method: 'GET',
        url: `/api/trash?trip_id=${tripId}`,
        headers: { cookie: member.cookie },
      });
      expect(
        memberTrash
          .json()
          .some((e: { type: string; id: number }) => e.type === 'budget_item' && e.id === expenseId)
      ).toBe(false);

      const ownerTrash = await app.inject({
        method: 'GET',
        url: `/api/trash?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      });
      expect(
        ownerTrash
          .json()
          .some((e: { type: string; id: number }) => e.type === 'budget_item' && e.id === expenseId)
      ).toBe(true);
    });
  });
});
