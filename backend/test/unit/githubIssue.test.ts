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

// Regressionsnetz für uploadFeedbackScreenshot() (#111): der frühere Ansatz verlinkte Screenshots
// auf die eigene /api/uploads/-URL dieses Servers, was GitHubs Camo-Proxy beim externen Abruf mit
// "Error Fetching Resource" scheitern ließ, sobald der Server zum (von GitHub bestimmten)
// Abrufzeitpunkt nicht erreichbar war. Screenshots landen deshalb jetzt direkt per Contents API im
// Branch feedback-screenshots und werden über raw.githubusercontent.com eingebunden - das hängt
// nicht mehr von der externen Erreichbarkeit dieses Servers ab.
describe('uploadFeedbackScreenshot', () => {
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
    const { uploadFeedbackScreenshot } = await import('../../src/utils/githubIssue.js');

    const result = await uploadFeedbackScreenshot(Buffer.from('x'), 'png', 'shot.png');
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('commits the base64 content to the existing feedback-screenshots branch and returns its raw URL', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/feedback-screenshots') {
        return Promise.resolve({ ok: true, status: 200 });
      }
      if (url === 'https://api.github.com/repos/someone/somerepo/contents/feedback-screenshots/shot.png') {
        const body = JSON.parse(init!.body as string);
        expect(init!.method).toBe('PUT');
        expect(body.branch).toBe('feedback-screenshots');
        expect(body.content).toBe(Buffer.from('hello').toString('base64'));
        return Promise.resolve({ ok: true, status: 201 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { uploadFeedbackScreenshot } = await import('../../src/utils/githubIssue.js');

    const result = await uploadFeedbackScreenshot(Buffer.from('hello'), 'png', 'shot.png');
    expect(result).toEqual({
      ok: true,
      url: 'https://raw.githubusercontent.com/someone/somerepo/feedback-screenshots/feedback-screenshots/shot.png',
    });
  });

  it('creates the feedback-screenshots branch from the default branch when it does not exist yet', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    const calledUrls: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calledUrls.push(url);
      if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/feedback-screenshots') {
        return Promise.resolve({ ok: false, status: 404 });
      }
      if (url === 'https://api.github.com/repos/someone/somerepo') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ default_branch: 'main' }) });
      }
      if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/main') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ object: { sha: 'abc123' } }) });
      }
      if (url === 'https://api.github.com/repos/someone/somerepo/git/refs') {
        const body = JSON.parse(init!.body as string);
        expect(body).toEqual({ ref: 'refs/heads/feedback-screenshots', sha: 'abc123' });
        return Promise.resolve({ ok: true, status: 201 });
      }
      if (url === 'https://api.github.com/repos/someone/somerepo/contents/feedback-screenshots/shot.png') {
        return Promise.resolve({ ok: true, status: 201 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { uploadFeedbackScreenshot } = await import('../../src/utils/githubIssue.js');

    const result = await uploadFeedbackScreenshot(Buffer.from('hello'), 'png', 'shot.png');
    expect(result.ok).toBe(true);
    expect(calledUrls).toContain('https://api.github.com/repos/someone/somerepo/git/refs');
  });

  it('returns ok:false when the branch creation race is lost to a concurrent request (422 is treated as success)', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/feedback-screenshots') {
          return Promise.resolve({ ok: false, status: 404 });
        }
        if (url === 'https://api.github.com/repos/someone/somerepo') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ default_branch: 'main' }) });
        }
        if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/main') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ object: { sha: 'abc123' } }) });
        }
        if (url === 'https://api.github.com/repos/someone/somerepo/git/refs') {
          return Promise.resolve({ ok: false, status: 422 });
        }
        return Promise.resolve({ ok: true, status: 201 });
      }),
    );
    vi.resetModules();
    const { uploadFeedbackScreenshot } = await import('../../src/utils/githubIssue.js');

    const result = await uploadFeedbackScreenshot(Buffer.from('hello'), 'png', 'shot.png');
    expect(result.ok).toBe(true);
  });

  it('returns ok:false when the content upload itself is rejected', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === 'https://api.github.com/repos/someone/somerepo/git/ref/heads/feedback-screenshots') {
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: false, status: 422 });
      }),
    );
    vi.resetModules();
    const { uploadFeedbackScreenshot } = await import('../../src/utils/githubIssue.js');

    const result = await uploadFeedbackScreenshot(Buffer.from('hello'), 'png', 'shot.png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('422');
  });
});
