export interface CreateIssueInput {
  title: string;
  body: string;
  labels: string[];
}

export interface GithubLabelSpec {
  name: string;
  color: string;
  description: string;
}

export type CreateIssueResult =
  { ok: true; number: number; url: string } | { ok: false; error: string; status?: number };

export const FEEDBACK_LABELS = {
  bug: {
    name: '\u{1F41B}\uFE0F bug',
    color: 'd73a4a',
    description: "Something isn't working",
  },
  feature: {
    name: '\u{1F31F}\uFE0F new-feature',
    color: 'a2eeef',
    description: 'New feature or request',
  },
  fromApp: {
    name: '\u{1F4F1}\uFE0F from-app',
    color: '1d76db',
    description: 'Aus der App eingereichtes Feedback',
  },
  communityInstance: {
    name: '\u{1F310}\uFE0F community-instance',
    color: '0e8a16',
    description: 'Feedback von einer externen Community-Instanz',
  },
  needsTriage: {
    name: '\u{1F50D}\uFE0F needs-triage',
    color: 'fbca04',
    description: 'Muss noch gesichtet und eingeordnet werden',
  },
} as const satisfies Record<string, GithubLabelSpec>;

const DEFAULT_GITHUB_LABEL_COLOR = 'ededed';
const HTTP_STATUS_NOT_FOUND = 404;
const LABEL_SYNC_TIMEOUT_MS = 5_000;
const syncedLabels = new Set<string>();

import { getEffectiveSetting } from '../instanceSettings.js';

export type UploadScreenshotResult = { ok: true; url: string } | { ok: false; error: string };

const getGithubToken = () => getEffectiveSetting('github_token', 'GITHUB_TOKEN').trim();
export const getGithubRepo = () =>
  getEffectiveSetting('github_repo', 'GITHUB_REPO', 'dmstern/reisotor').trim();

// Eigener, ansonsten ungenutzter Branch statt des Default-Branchs: Screenshots landen so nicht in
// der normalen Commit-Historie/dem normalen Diff von main, sondern nur in diesem Ablage-Branch.
const SCREENSHOT_BRANCH = 'feedback-screenshots';

function githubApiHeaders() {
  return {
    Authorization: `Bearer ${getGithubToken()}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'reisotor-feedback',
  };
}

// Legt SCREENSHOT_BRANCH beim allerersten Feedback-Screenshot einmalig an (vom Default-Branch
// abgezweigt) - die Contents-API kann Dateien nur auf einem bereits existierenden Branch anlegen.
async function ensureScreenshotBranch(): Promise<{ ok: true } | { ok: false; error: string }> {
  const repo = getGithubRepo();
  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/${SCREENSHOT_BRANCH}`,
    { headers: githubApiHeaders(), signal: AbortSignal.timeout(10_000) }
  );

  if (refRes.ok) {
    return { ok: true };
  }

  if (refRes.status !== 404) {
    return { ok: false, error: `GitHub-Branch-Abfrage fehlgeschlagen (Status ${refRes.status}).` };
  }

  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: githubApiHeaders(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!repoRes.ok) {
    return { ok: false, error: `GitHub-Repo-Abfrage fehlgeschlagen (Status ${repoRes.status}).` };
  }

  const { default_branch: defaultBranch } = (await repoRes.json()) as { default_branch: string };

  const defaultRefRes = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/${defaultBranch}`,
    { headers: githubApiHeaders(), signal: AbortSignal.timeout(10_000) }
  );

  if (!defaultRefRes.ok) {
    return {
      ok: false,
      error: `GitHub-Default-Branch-Abfrage fehlgeschlagen (Status ${defaultRefRes.status}).`,
    };
  }

  const { object } = (await defaultRefRes.json()) as { object: { sha: string } };

  const createRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${SCREENSHOT_BRANCH}`, sha: object.sha }),
    signal: AbortSignal.timeout(10_000),
  });

  // 422 = Branch wurde zwischenzeitlich von einer parallelen Anfrage angelegt - kein echter Fehler.
  if (!createRefRes.ok && createRefRes.status !== 422) {
    return {
      ok: false,
      error: `GitHub-Branch-Anlage fehlgeschlagen (Status ${createRefRes.status}).`,
    };
  }

  return { ok: true };
}

/** Committet einen Feedback-Screenshot per GitHub Contents API in SCREENSHOT_BRANCH und liefert
 *  dessen raw.githubusercontent.com-URL zurück. Anders als der frühere Ansatz (Link auf die eigene,
 *  selbstgehostete /api/uploads/-Datei) hängt die Sichtbarkeit des Bilds im GitHub-Issue damit nicht
 *  von der externen Erreichbarkeit dieses Servers zum (späteren, von GitHub selbst bestimmten)
 *  Abrufzeitpunkt ab - raw.githubusercontent.com wird direkt von GitHub ausgeliefert, kein
 *  Camo-Proxy-Fetch auf eine Fremd-URL nötig. Der GITHUB_TOKEN braucht dafür zusätzlich zu
 *  "Issues: Read and write" auch "Contents: Read and write" auf diesem Repo (siehe README).
 */
export async function uploadFeedbackScreenshot(
  buffer: Buffer,
  extension: string,
  filename = `${Date.now()}.${extension}`
): Promise<UploadScreenshotResult> {
  const token = getGithubToken();
  const repo = getGithubRepo();

  if (!token) {
    return {
      ok: false,
      error: 'Auf diesem Server ist kein GitHub-Zugang (GITHUB_TOKEN) eingerichtet.',
    };
  }

  const branchResult = await ensureScreenshotBranch();

  if (!branchResult.ok) {
    return branchResult;
  }

  const path = `feedback-screenshots/${filename}`;
  let res: Response;

  try {
    res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Feedback-Screenshot hinzufügen: ${filename}`,
        content: buffer.toString('base64'),
        branch: SCREENSHOT_BRANCH,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: 'Screenshot konnte nicht zu GitHub hochgeladen werden.' };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `GitHub hat den Screenshot-Upload abgelehnt (Status ${res.status}).`,
    };
  }

  return {
    ok: true,
    url: `https://raw.githubusercontent.com/${repo}/${SCREENSHOT_BRANCH}/${path}`,
  };
}

// Wie push.ts's VAPID-Keys: Feature ist optional, ohne gesetzten Token bleibt die App lauffähig,
// nur ohne In-App-Feedback (siehe routes/feedback.ts).
export const githubIssuesEnabled = !!process.env.GITHUB_TOKEN;

/** Stellt best-effort sicher, dass alle angegebenen Labels im Ziel-Repository mit passender Farbe
 *  und Beschreibung existieren (und färbt ggf. noch ungefärbte Default-Labels nach). Ein Fehler
 *  blockiert niemals das eigentliche Anlegen des Issues.
 */
export async function ensureGithubLabels(labels: readonly GithubLabelSpec[]): Promise<void> {
  const token = getGithubToken();
  const repo = getGithubRepo();

  if (!token) {
    return;
  }

  for (const label of labels) {
    const cacheKey = `${repo}::${label.name}`;

    if (syncedLabels.has(cacheKey)) {
      continue;
    }

    const encodedName = encodeURIComponent(label.name);
    const labelUrl = `https://api.github.com/repos/${repo}/labels/${encodedName}`;

    try {
      const getRes = await fetch(labelUrl, {
        headers: githubApiHeaders(),
        signal: AbortSignal.timeout(LABEL_SYNC_TIMEOUT_MS),
      });

      if (getRes.status === HTTP_STATUS_NOT_FOUND) {
        await fetch(`https://api.github.com/repos/${repo}/labels`, {
          method: 'POST',
          headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: label.name,
            color: label.color,
            description: label.description,
          }),
          signal: AbortSignal.timeout(LABEL_SYNC_TIMEOUT_MS),
        });
        syncedLabels.add(cacheKey);
        continue;
      }

      if (!getRes.ok) {
        continue;
      }

      const existing = (await getRes.json()) as { color?: string; description?: string | null };
      const needsColorUpdate =
        !existing.color || existing.color.toLowerCase() === DEFAULT_GITHUB_LABEL_COLOR;
      const needsDescriptionUpdate = !existing.description && Boolean(label.description);

      if (needsColorUpdate || needsDescriptionUpdate) {
        await fetch(labelUrl, {
          method: 'PATCH',
          headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            color: needsColorUpdate ? label.color : existing.color,
            description: needsDescriptionUpdate ? label.description : (existing.description ?? ''),
          }),
          signal: AbortSignal.timeout(LABEL_SYNC_TIMEOUT_MS),
        });
      }

      syncedLabels.add(cacheKey);
    } catch {
      // Best-effort: Label-Abgleich darf die Issue-Erstellung niemals blockieren
    }
  }
}

/** Legt ein echtes GitHub-Issue über die REST-API an. Anders als mapsLink.ts's best-effort-fetch
 *  (dort ist ein Fehlschlag ein akzeptabler stiller Fallback) wird hier der Fehler an den Aufrufer
 *  durchgereicht – Issue-Erstellung ist der eigentliche Zweck des Aufrufs, kein Nice-to-have. Der
 *  verwendete Token sollte ein fine-grained PAT sein, das ausschließlich "Issues: Read and write"
 *  sowie (für uploadFeedbackScreenshot oben) "Contents: Read and write" auf genau diesem Repo
 *  erlaubt (siehe README) – selbst bei Kompromittierung dieses Codepfads bleibt der mögliche
 *  Schaden auf Issues und den feedback-screenshots-Branch beschränkt.
 */
export async function createGithubIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
  const token = getGithubToken();
  const repo = getGithubRepo();

  if (!token) {
    return {
      ok: false,
      status: 503,
      error: `Auf diesem Server ist kein GitHub-Zugang (GITHUB_TOKEN) eingerichtet. Bei selbstgehosteten Instanzen können Fehler und Feedback direkt auf GitHub gemeldet werden: https://github.com/${repo}/issues`,
    };
  }

  const uniqueLabels = [...new Set(input.labels.map((label) => label.trim()).filter(Boolean))];
  let res: Response;

  try {
    res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'reisotor-feedback',
      },
      body: JSON.stringify({ title: input.title, body: input.body, labels: uniqueLabels }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error:
        'Meldung konnte nicht an GitHub übermittelt werden (Verbindungsfehler). Bitte später erneut versuchen.',
    };
  }

  if (!res.ok) {
    let detail = `Status ${res.status}`;

    if (res.status === 401) {
      detail = 'Status 401 – Der hinterlegte GitHub-Token ist ungültig oder abgelaufen';
    } else if (res.status === 403) {
      detail = 'Status 403 – Fehlende Berechtigung oder GitHub-Rate-Limit erreicht';
    } else if (res.status === 404) {
      detail = `Status 404 – GitHub-Repository '${repo}' nicht gefunden`;
    }

    return {
      ok: false,
      status: 502,
      error: `GitHub hat die Meldung abgelehnt (${detail}).`,
    };
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { ok: true, number: data.number, url: data.html_url };
}
