import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('trip categories routes', () => {
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
      payload: { name, start_date: '2026-06-01', end_date: '2026-06-15' },
    });
    return res.json().id as number;
  }

  it('erstellt, aktualisiert, benennt kaskadierend um und löscht eine Urlaubskategorie', async () => {
    const user = await register('catuser1', 'catuser1@example.com');
    const tripId = await createTrip(user.cookie, 'Kategorien Trip 1');

    // 1. Erstelle benutzerdefinierte Kategorie
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/categories`,
      headers: { cookie: user.cookie },
      payload: {
        type: 'expense',
        name: 'Tauchkurzz',
        icon: 'scuba-diving',
        emoji: '🤿',
        color: '#0ea5e9',
      },
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json();
    expect(created.name).toBe('Tauchkurzz');
    expect(created.icon).toBe('scuba-diving');
    expect(created.color).toBe('#0ea5e9');

    // 2. Lege eine Ausgabe mit dieser Kategorie an
    const expenseRes = await app.inject({
      method: 'POST',
      url: '/api/budget',
      headers: { cookie: user.cookie },
      payload: {
        trip_id: tripId,
        title: 'Open Water Kurs',
        category: 'Tauchkurzz',
        amount: 250,
      },
    });
    expect(expenseRes.statusCode).toBe(201);
    const expense = expenseRes.json();

    // 3. GET prüft usage_count
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/categories?type=expense`,
      headers: { cookie: user.cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const cats = getRes.json().categories;
    const tauchCat = cats.find((c: { name: string }) => c.name === 'Tauchkurzz');
    expect(tauchCat).toBeDefined();
    expect(tauchCat.usage_count).toBe(1);

    // 4. PUT benennt Kategorie um ("Tauchkurzz" -> "Tauchkurs")
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/trips/${tripId}/categories/${created.id}`,
      headers: { cookie: user.cookie },
      payload: {
        name: 'Tauchkurs',
        color: '#0284c7',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.name).toBe('Tauchkurs');
    expect(updated.color).toBe('#0284c7');

    // Kaskadierung prüfen: Die Ausgabe muss jetzt "Tauchkurs" als Kategorie haben
    const getExpenseRes = await app.inject({
      method: 'GET',
      url: `/api/budget?trip_id=${tripId}`,
      headers: { cookie: user.cookie },
    });
    const expenses = getExpenseRes.json();
    const updatedExpense = expenses.find((e: { id: number }) => e.id === expense.id);
    expect(updatedExpense.category).toBe('Tauchkurs');

    // 5. DELETE löscht Kategorie und setzt Kategorie der Ausgabe auf null
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/categories/${created.id}`,
      headers: { cookie: user.cookie },
    });
    expect(deleteRes.statusCode).toBe(200);

    const getExpenseAfterDelete = await app.inject({
      method: 'GET',
      url: `/api/budget?trip_id=${tripId}`,
      headers: { cookie: user.cookie },
    });
    const cleanedExpense = getExpenseAfterDelete
      .json()
      .find((e: { id: number }) => e.id === expense.id);
    expect(cleanedExpense.category).toBeNull();
  });

  it('blendet Standardkategorien aus und ein', async () => {
    const user = await register('catuser2', 'catuser2@example.com');
    const tripId = await createTrip(user.cookie, 'Kategorien Trip 2');

    // Standardkategorie ausblenden
    const hideRes = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/categories/hide`,
      headers: { cookie: user.cookie },
      payload: {
        type: 'expense',
        name: 'Flug & Anreise',
        is_hidden: true,
      },
    });
    expect(hideRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/categories?type=expense`,
      headers: { cookie: user.cookie },
    });
    const cats = getRes.json().categories;
    const flugCat = cats.find((c: { name: string }) => c.name === 'Flug & Anreise');
    expect(flugCat?.is_hidden).toBe(1);

    // Wieder einblenden
    const unhideRes = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/categories/hide`,
      headers: { cookie: user.cookie },
      payload: {
        type: 'expense',
        name: 'Flug & Anreise',
        is_hidden: false,
      },
    });
    expect(unhideRes.statusCode).toBe(200);

    const getRes2 = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/categories?type=expense`,
      headers: { cookie: user.cookie },
    });
    const flugCat2 = getRes2
      .json()
      .categories.find((c: { name: string }) => c.name === 'Flug & Anreise');
    expect(flugCat2?.is_hidden).toBe(0);
  });

  it('unterbindet Zugriff für Nicht-Mitglieder', async () => {
    const owner = await register('catowner', 'catowner@example.com');
    const stranger = await register('catstranger', 'catstranger@example.com');
    const tripId = await createTrip(owner.cookie, 'Privater Trip');

    const res = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/categories`,
      headers: { cookie: stranger.cookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
