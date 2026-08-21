import { beforeEach, describe, expect, it, vi } from 'vitest';

// demoClient.ts nutzt localStorage (Browser-API) - der Testlauf läuft aber bewusst mit
// environment: 'node' (siehe vite.config.ts's test-Kommentar, kein DOM für plain-Function-Tests
// nötig). Ein einfacher In-Memory-Stub statt eines vollen jsdom-Setups reicht hier aus. Muss VOR
// dem (dynamischen) Import von demoClient.ts gesetzt sein, da das Modul beim Laden bereits
// loadStore() aufruft.
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

vi.stubGlobal('localStorage', createMemoryStorage());

const { demoRequest, resetDemoStore } = await import('./demoClient');

describe('demoClient (Issue #172: backend-loser Demo-Build)', () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it('liefert /auth/me einen festen Demo-User, ohne dass eine Session nötig ist', async () => {
    const user = await demoRequest<{ id: number; username: string }>('/auth/me');
    expect(user.id).toBe(1);
    expect(user.username).toBeTruthy();
  });

  it('GET auf eine bekannte Sammlung liefert den vorbefüllten Demo-Datensatz', async () => {
    const todos = await demoRequest<Array<{ id: number; title: string }>>('/todos?trip_id=1');
    expect(todos.length).toBeGreaterThan(0);
  });

  it('POST legt einen neuen Eintrag mit id an und macht ihn über ein folgendes GET sichtbar', async () => {
    const created = await demoRequest<{ id: number; title: string }>('/todos?trip_id=1', {
      method: 'POST',
      body: JSON.stringify({ title: 'Neuer Punkt', trip_id: 1 }),
    });
    expect(created.id).toBeDefined();

    const todos = await demoRequest<Array<{ id: number; title: string }>>('/todos?trip_id=1');
    expect(todos.some((t) => t.id === created.id && t.title === 'Neuer Punkt')).toBe(true);
  });

  it('PUT aktualisiert einen bestehenden Eintrag anhand seiner id in der URL', async () => {
    const [first] = await demoRequest<Array<{ id: number; title: string }>>('/todos?trip_id=1');
    const updated = await demoRequest<{ id: number; title: string }>(`/todos/${first.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Geändert' }),
    });
    expect(updated.title).toBe('Geändert');
  });

  it('DELETE entfernt einen Eintrag aus der Sammlung', async () => {
    const [first] = await demoRequest<Array<{ id: number }>>('/todos?trip_id=1');
    await demoRequest(`/todos/${first.id}`, { method: 'DELETE' });
    const remaining = await demoRequest<Array<{ id: number }>>('/todos?trip_id=1');
    expect(remaining.some((t) => t.id === first.id)).toBe(false);
  });

  it('resetDemoStore() macht eine zuvor angelegte Änderung rückgängig', async () => {
    await demoRequest('/todos?trip_id=1', { method: 'POST', body: JSON.stringify({ title: 'Wird zurückgesetzt' }) });
    resetDemoStore();
    const todos = await demoRequest<Array<{ title: string }>>('/todos?trip_id=1');
    expect(todos.some((t) => t.title === 'Wird zurückgesetzt')).toBe(false);
  });

  it('unbekannte Pfade schlagen nie fehl (GET liefert [], Mutationen no-op)', async () => {
    const result = await demoRequest<unknown[]>('/push/preferences');
    expect(result).toEqual([]);
    await expect(demoRequest('/push/subscribe', { method: 'POST', body: '{}' })).resolves.toBeUndefined();
  });
});
