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

  it('liefert /trips/:id/region-info als Objekt statt der generischen []-Fallback-Antwort (Regressionsschutz: DashboardView.vue liest regionInfo.languages.length)', async () => {
    const info = await demoRequest<{ languages: string[]; currency: { code: string } | null }>('/trips/1/region-info?home_currency=EUR');
    expect(Array.isArray(info)).toBe(false);
    expect(info.languages.length).toBeGreaterThan(0);
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

  it('erlaubt das Ändern von Avatar und Benutzername in der Demo (Issue #234)', async () => {
    const updatedAvatar = await demoRequest<{ avatar: string }>('/users/me/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar: '🦊' }),
    });
    expect(updatedAvatar.avatar).toBe('🦊');

    const me = await demoRequest<{ avatar: string; username: string }>('/auth/me');
    expect(me.avatar).toBe('🦊');

    const updatedUser = await demoRequest<{ username: string }>('/users/me/username', {
      method: 'PUT',
      body: JSON.stringify({ username: 'NeuerName' }),
    });
    expect(updatedUser.username).toBe('NeuerName');
  });

  it('unterstützt Liken und Kommentieren ohne Fehler (Issue #234)', async () => {
    const likeRes = await demoRequest<{ liked: boolean }>('/spots/1/like', { method: 'POST' });
    expect(likeRes.liked).toBeDefined();

    const comment = await demoRequest<{ id: number; content: string; spot_id: number }>('/spots/1/comments', {
      method: 'POST',
      body: JSON.stringify({ content: 'Toller Ort!' }),
    });
    expect(comment.id).toBeDefined();
    expect(comment.content).toBe('Toller Ort!');
    expect(comment.spot_id).toBe(1);

    const comments = await demoRequest<Array<{ content: string }>>('/spots/comments?trip_id=1');
    expect(comments.some((c) => c.content === 'Toller Ort!')).toBe(true);
  });

  it('unterstützt Weg-Aufzeichnung inkl. Start/Stop/Punkte (Issue #234)', async () => {
    const createdTrack = await demoRequest<{ id: number; started_at: string }>('/tracks', {
      method: 'POST',
      body: JSON.stringify({ trip_id: 1, visibility: 'private' }),
    });
    expect(createdTrack.id).toBeDefined();
    expect(createdTrack.started_at).toBeTruthy();

    const points = await demoRequest<Array<{ id: number; lat: number; lng: number }>>(`/tracks/${createdTrack.id}/points`, {
      method: 'POST',
      body: JSON.stringify({ points: [{ lat: 38.7, lng: -9.1, recorded_at: new Date().toISOString() }] }),
    });
    expect(points.length).toBe(1);

    const fetchedPoints = await demoRequest<Array<{ lat: number }>>(`/tracks/${createdTrack.id}/points`);
    expect(fetchedPoints.length).toBe(1);

    const stoppedTrack = await demoRequest<{ ended_at: string }>(`/tracks/${createdTrack.id}/stop`, { method: 'POST' });
    expect(stoppedTrack.ended_at).toBeTruthy();
  });

  it('filtert Daten nach trip_id – ein neu angelegter Urlaub ist initial leer (Issue #234)', async () => {
    const newTrip = await demoRequest<{ id: number }>('/trips', {
      method: 'POST',
      body: JSON.stringify({ name: 'Neuer leerer Urlaub', destination: 'Paris' }),
    });
    expect(newTrip.id).toBeDefined();

    const spotsNewTrip = await demoRequest<unknown[]>(`/spots?trip_id=${newTrip.id}`);
    expect(spotsNewTrip).toEqual([]);

    const spotsDemoTrip = await demoRequest<unknown[]>('/spots?trip_id=1');
    expect(spotsDemoTrip.length).toBeGreaterThan(0);
  });

  it('unterstützt Feedback-Absenden in der Demo (Issue #234)', async () => {
    const res = await demoRequest<{ issueUrl: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Feedback', description: 'Bug report' }),
    });
    expect(res.issueUrl).toBeTruthy();
  });
});

