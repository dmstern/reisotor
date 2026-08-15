import { afterEach, describe, expect, it, vi } from 'vitest';

// Regressionsnetz für createGithubIssue() (routes/feedback.ts's einziger externer Aufruf): das
// "Feature aus, wenn Token fehlt"-Verhalten (analog push.ts's VAPID-Keys), die exakte
// Request-Form gegen die GitHub-REST-API, und dass ein Fehlschlag (HTTP-Fehler oder Netzwerk)
// als { ok: false } zurückkommt statt zu werfen - anders als mapsLink.ts's stiller Fallback muss
// der Fehler hier aber inhaltlich erkennbar bleiben, damit routes/feedback.ts ihn an die
// Nutzer:in durchreichen kann.
describe('createGithubIssue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO;
  });

  it('reports disabled and never calls fetch when GITHUB_TOKEN is unset', async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { createGithubIssue, githubIssuesEnabled } = await import('../../src/utils/githubIssue.js');

    expect(githubIssuesEnabled).toBe(false);
    const result = await createGithubIssue({ title: 'x', body: 'y', labels: [] });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs title/body/labels with a bearer token to the configured repo', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('https://api.github.com/repos/someone/somerepo/issues');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
      expect(JSON.parse(init.body as string)).toEqual({
        title: 'Bug X',
        body: 'Beschreibung',
        labels: ['bug', 'from-app'],
      });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ number: 42, html_url: 'https://github.com/someone/somerepo/issues/42' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { createGithubIssue } = await import('../../src/utils/githubIssue.js');

    const result = await createGithubIssue({ title: 'Bug X', body: 'Beschreibung', labels: ['bug', 'from-app'] });
    expect(result).toEqual({ ok: true, number: 42, url: 'https://github.com/someone/somerepo/issues/42' });
  });

  it('defaults to the dmstern/reisotor repo when GITHUB_REPO is unset', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe('https://api.github.com/repos/dmstern/reisotor/issues');
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ number: 1, html_url: 'https://x' }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { createGithubIssue } = await import('../../src/utils/githubIssue.js');

    await createGithubIssue({ title: 'x', body: 'y', labels: [] });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns ok:false with the status when GitHub rejects the request', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 422 })));
    vi.resetModules();
    const { createGithubIssue } = await import('../../src/utils/githubIssue.js');

    const result = await createGithubIssue({ title: 'x', body: 'y', labels: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('422');
  });

  it('returns ok:false instead of throwing on a network failure', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network down'))));
    vi.resetModules();
    const { createGithubIssue } = await import('../../src/utils/githubIssue.js');

    const result = await createGithubIssue({ title: 'x', body: 'y', labels: [] });
    expect(result.ok).toBe(false);
  });
});
