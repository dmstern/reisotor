export interface CreateIssueInput {
  title: string;
  body: string;
  labels: string[];
}

export type CreateIssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; error: string };

const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO ?? 'dmstern/reisotor';

// Wie push.ts's VAPID-Keys: Feature ist optional, ohne gesetzten Token bleibt die App lauffähig,
// nur ohne In-App-Feedback (siehe routes/feedback.ts).
export const githubIssuesEnabled = !!githubToken;

/** Legt ein echtes GitHub-Issue über die REST-API an. Anders als mapsLink.ts's best-effort-fetch
 *  (dort ist ein Fehlschlag ein akzeptabler stiller Fallback) wird hier der Fehler an den Aufrufer
 *  durchgereicht – Issue-Erstellung ist der eigentliche Zweck des Aufrufs, kein Nice-to-have. Der
 *  verwendete Token sollte ein fine-grained PAT sein, das ausschließlich "Issues: Read and write"
 *  auf genau diesem Repo erlaubt (siehe README) – selbst bei Kompromittierung dieses Codepfads bleibt
 *  der mögliche Schaden auf Issues beschränkt.
 */
export async function createGithubIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
  if (!githubToken) {
    return { ok: false, error: 'Feedback ist auf diesem Server nicht konfiguriert.' };
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'reisotor-feedback',
      },
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: 'Meldung konnte nicht an GitHub übermittelt werden. Bitte später erneut versuchen.' };
  }

  if (!res.ok) {
    return { ok: false, error: `GitHub hat die Meldung abgelehnt (Status ${res.status}).` };
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { ok: true, number: data.number, url: data.html_url };
}
