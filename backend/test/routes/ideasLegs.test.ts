import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('ideas with intermediate stops and legs (#361)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;
  let userId: number;
  let spotA: number;
  let spotB: number;
  let spotC: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    const userRes = built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('traveler', bcrypt.hashSync('secret-pass', 10), '🧳');
    userId = Number(userRes.lastInsertRowid);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'traveler', password: 'secret-pass' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Multi-Stop Reise', start_date: '2026-06-01', end_date: '2026-06-15' },
    });
    tripId = tripRes.json().id;

    async function createSpot(title: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/spots',
        headers: { cookie },
        payload: { trip_id: tripId, title, category: 'transport' },
      });
      return res.json().id as number;
    }

    spotA = await createSpot('Berlin Hbf');
    spotB = await createSpot('Frankfurt Flughafen');
    spotC = await createSpot('Mallorca Hotel');
  });

  it('rejects an arrival tour with less than 2 spots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Fehlerhafte Tour',
        role: 'arrival',
        spot_ids: [spotA],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates an arrival tour with 3 spots, 2 legs and budget integration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Anreise Mallorca',
        role: 'arrival',
        date: '2026-06-01',
        spot_ids: [spotA, spotB, spotC],
        legs: [
          {
            position: 0,
            from_spot_id: spotA,
            to_spot_id: spotB,
            transport_type: 'Zug',
            departure_time: '08:00',
            arrival_time: '12:00',
            seat: 'Wagen 5 Platz 42',
            amount: 59.9,
            paid_by_user_id: userId,
          },
          {
            position: 1,
            from_spot_id: spotB,
            to_spot_id: spotC,
            transport_type: 'Flug',
            departure_time: '14:30',
            arrival_time: '16:45',
            seat: '12A',
            luggage: '1 Koffer',
            amount: 150.0,
            paid_by_user_id: userId,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const tour = res.json();
    expect(tour.id).toBeDefined();
    expect(tour.role).toBe('arrival');
    expect(tour.spot_ids).toEqual([spotA, spotB, spotC]);
    expect(tour.departure_time).toBe('08:00');
    expect(tour.arrival_time).toBe('16:45');
    expect(tour.transport_type).toBe('Zug');
    expect(tour.legs).toHaveLength(2);
    expect(tour.legs[0].transport_type).toBe('Zug');
    expect(tour.legs[0].departure_time).toBe('08:00');
    expect(tour.legs[0].budget_expense_id).toBeDefined();
    expect(tour.legs[1].transport_type).toBe('Flug');
    expect(tour.legs[1].arrival_time).toBe('16:45');
    expect(tour.legs[1].budget_expense_id).toBeDefined();

    // Verify budget items were created
    const budgetRes = await app.inject({
      method: 'GET',
      url: `/api/budget?trip_id=${tripId}`,
      headers: { cookie },
    });
    const budgetItems = budgetRes.json();
    const trainExpense = budgetItems.find((b: { amount: number }) => b.amount === 59.9);
    const flightExpense = budgetItems.find((b: { amount: number }) => b.amount === 150.0);
    expect(trainExpense).toBeDefined();
    expect(trainExpense.category).toBe('Transport');
    expect(flightExpense).toBeDefined();
    expect(flightExpense.category).toBe('Transport');
  });

  it('updates legs and cleans up deleted leg budget items', async () => {
    // Create initial tour with 1 leg with expense
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Ausflug',
        spot_ids: [spotA, spotB],
        legs: [
          {
            position: 0,
            from_spot_id: spotA,
            to_spot_id: spotB,
            transport_type: 'Bus',
            amount: 25.0,
            paid_by_user_id: userId,
          },
        ],
      },
    });
    const tourId = createRes.json().id;
    const initialExpenseId = createRes.json().legs[0].budget_expense_id;
    expect(initialExpenseId).toBeDefined();

    // Update tour to remove the amount on leg
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/ideas/${tourId}`,
      headers: { cookie },
      payload: {
        title: 'Ausflug aktualisiert',
        spot_ids: [spotA, spotB],
        legs: [
          {
            position: 0,
            from_spot_id: spotA,
            to_spot_id: spotB,
            transport_type: 'Bus',
            amount: null,
            paid_by_user_id: null,
          },
        ],
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().legs[0].budget_expense_id).toBeNull();

    // Verify initial budget item was deleted
    const budgetRes = await app.inject({
      method: 'GET',
      url: `/api/budget?trip_id=${tripId}`,
      headers: { cookie },
    });
    const busExpense = budgetRes.json().find((b: { id: number }) => b.id === initialExpenseId);
    expect(busExpense).toBeUndefined();
  });

  it('updates a tour without HTTP 500 when ideas.budget_expense_id still points to a leg expense (#647)', async () => {
    // 1. Erstelle eine Tour mit Teilstrecke und Budget-Ausgabe
    const ideaCreate = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: '1.3 Tour',
        role: 'arrival',
        spot_ids: [spotA, spotB],
        legs: [
          {
            position: 0,
            from_spot_id: spotA,
            to_spot_id: spotB,
            transport_type: 'Zug',
            amount: 80.0,
            paid_by_user_id: userId,
          },
        ],
      },
    });
    expect(ideaCreate.statusCode).toBe(201);
    const legacyIdeaId = ideaCreate.json().id;
    const legExpenseId = ideaCreate.json().legs[0].budget_expense_id;
    expect(legExpenseId).toBeDefined();

    // 2. Simuliere Zustand direkt nach unvollständigem 1.3 -> 2.0 Backfill: ideas.budget_expense_id verweist auf dieselbe Ausgabe
    const { db } = await import('../../src/db/index.js');
    db.prepare('UPDATE ideas SET budget_expense_id = ? WHERE id = ?').run(
      legExpenseId,
      legacyIdeaId
    );

    // 3. Umbenennen in 2.0: Frontend sendet PUT ohne Top-Level amount/paid_by_user_id
    const renameRes = await app.inject({
      method: 'PUT',
      url: `/api/ideas/${legacyIdeaId}`,
      headers: { cookie },
      payload: {
        title: '1.3 Tour Umbenannt',
        spot_ids: [spotA, spotB],
        legs: [
          {
            position: 0,
            from_spot_id: spotA,
            to_spot_id: spotB,
            transport_type: 'Zug',
            amount: 80.0,
            paid_by_user_id: userId,
            budget_expense_id: legExpenseId,
          },
        ],
      },
    });

    expect(renameRes.statusCode).toBe(200);
    expect(renameRes.json().title).toBe('1.3 Tour Umbenannt');

    // Ausgabe existiert weiterhin im Budget und gehört dem Leg
    const budgetCheck = await app.inject({
      method: 'GET',
      url: `/api/budget?trip_id=${tripId}`,
      headers: { cookie },
    });
    const found = budgetCheck.json().find((b: { id: number }) => b.id === legExpenseId);
    expect(found).toBeDefined();

    // ideas.budget_expense_id ist nun bereinigt (NULL)
    const row = db
      .prepare('SELECT budget_expense_id FROM ideas WHERE id = ?')
      .get(legacyIdeaId) as { budget_expense_id: number | null };
    expect(row.budget_expense_id).toBeNull();
  });
});
