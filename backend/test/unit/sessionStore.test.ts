import '../helpers/initMemoryDb.js';
import { describe, expect, it } from 'vitest';
import type { Session } from 'fastify';
import { SqliteSessionStore } from '../../src/sessionStore.js';

describe('SqliteSessionStore', () => {
  function makeSession(overrides: Record<string, unknown> = {}): Session {
    return {
      cookie: {
        originalMaxAge: 60_000,
        expires: new Date(Date.now() + 60_000),
        secure: false,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      },
      ...overrides,
    } as unknown as Session;
  }

  it('stores, retrieves, and destroys a session', async () => {
    const store = new SqliteSessionStore();
    const session = makeSession({ userId: 42, username: 'alice' });

    await new Promise<void>((resolve, reject) => {
      store.set('sid-1', session, (err) => (err ? reject(err) : resolve()));
    });

    const loaded = await new Promise<Session | null | undefined>((resolve, reject) => {
      store.get('sid-1', (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(loaded).toMatchObject({ userId: 42, username: 'alice' });

    await new Promise<void>((resolve, reject) => {
      store.destroy('sid-1', (err) => (err ? reject(err) : resolve()));
    });

    const afterDestroy = await new Promise<Session | null | undefined>((resolve, reject) => {
      store.get('sid-1', (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(afterDestroy).toBeNull();
  });

  it('evicts expired sessions on get (including exact expiry timestamp <= Date.now())', async () => {
    const { SqliteSessionStore } = await import('../../src/sessionStore.js');
    const store = new SqliteSessionStore();
    const expiredSession = makeSession({
      userId: 7,
      cookie: {
        originalMaxAge: 1000,
        expires: new Date(Date.now() - 1),
      },
    });

    await new Promise<void>((resolve, reject) => {
      store.set('sid-expired', expiredSession, (err) => (err ? reject(err) : resolve()));
    });

    const loaded = await new Promise<Session | null | undefined>((resolve, reject) => {
      store.get('sid-expired', (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(loaded).toBeNull();
  });

  it('compareAndSet updates when generation matches and rejects with ENOENT on mismatch or missing session', async () => {
    const { SqliteSessionStore } = await import('../../src/sessionStore.js');
    const store = new SqliteSessionStore();

    // 1. Missing session -> ENOENT
    const missingErr = await new Promise<(Error & { code?: string }) | undefined>((resolve) => {
      store.compareAndSet('sid-missing', 'gen-1', makeSession(), (err) =>
        resolve(err as Error & { code?: string })
      );
    });
    expect(missingErr).toBeInstanceOf(Error);
    expect(missingErr?.code).toBe('ENOENT');

    // 2. Legacy v10 session without __fastifySessionMetadata falls back to sessionId as generation
    const legacySession = makeSession({ userId: 10 });
    await new Promise<void>((resolve, reject) => {
      store.set('sid-legacy', legacySession, (err) => (err ? reject(err) : resolve()));
    });

    const upgradedSession = makeSession({
      userId: 10,
      __fastifySessionMetadata: { generation: 'gen-2' },
    });
    await new Promise<void>((resolve, reject) => {
      store.compareAndSet('sid-legacy', 'sid-legacy', upgradedSession, (err) =>
        err ? reject(err) : resolve()
      );
    });

    // 3. Stale generation -> ENOENT
    const mismatchErr = await new Promise<(Error & { code?: string }) | undefined>((resolve) => {
      store.compareAndSet('sid-legacy', 'wrong-gen', makeSession({ userId: 99 }), (err) =>
        resolve(err as Error & { code?: string })
      );
    });
    expect(mismatchErr).toBeInstanceOf(Error);
    expect(mismatchErr?.code).toBe('ENOENT');

    // 4. Matching generation -> updates session
    const nextSession = makeSession({
      userId: 11,
      __fastifySessionMetadata: { generation: 'gen-3' },
    });
    await new Promise<void>((resolve, reject) => {
      store.compareAndSet('sid-legacy', 'gen-2', nextSession, (err) =>
        err ? reject(err) : resolve()
      );
    });

    const loaded = await new Promise<Session | null | undefined>((resolve, reject) => {
      store.get('sid-legacy', (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(loaded).toMatchObject({
      userId: 11,
      __fastifySessionMetadata: { generation: 'gen-3' },
    });
  });
});
