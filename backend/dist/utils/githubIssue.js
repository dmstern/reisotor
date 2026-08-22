const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO ?? 'dmstern/reisotor';
// Eigener, ansonsten ungenutzter Branch statt des Default-Branchs: Screenshots landen so nicht in
// der normalen Commit-Historie/dem normalen Diff von main, sondern nur in diesem Ablage-Branch.
const SCREENSHOT_BRANCH = 'feedback-screenshots';
function githubApiHeaders() {
    return {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'reisotor-feedback',
    };
}
// Legt SCREENSHOT_BRANCH beim allerersten Feedback-Screenshot einmalig an (vom Default-Branch
// abgezweigt) - die Contents-API kann Dateien nur auf einem bereits existierenden Branch anlegen.
async function ensureScreenshotBranch() {
    const refRes = await fetch(`https://api.github.com/repos/${githubRepo}/git/ref/heads/${SCREENSHOT_BRANCH}`, { headers: githubApiHeaders(), signal: AbortSignal.timeout(10_000) });
    if (refRes.ok)
        return { ok: true };
    if (refRes.status !== 404) {
        return { ok: false, error: `GitHub-Branch-Abfrage fehlgeschlagen (Status ${refRes.status}).` };
    }
    const repoRes = await fetch(`https://api.github.com/repos/${githubRepo}`, {
        headers: githubApiHeaders(),
        signal: AbortSignal.timeout(10_000),
    });
    if (!repoRes.ok) {
        return { ok: false, error: `GitHub-Repo-Abfrage fehlgeschlagen (Status ${repoRes.status}).` };
    }
    const { default_branch: defaultBranch } = (await repoRes.json());
    const defaultRefRes = await fetch(`https://api.github.com/repos/${githubRepo}/git/ref/heads/${defaultBranch}`, { headers: githubApiHeaders(), signal: AbortSignal.timeout(10_000) });
    if (!defaultRefRes.ok) {
        return { ok: false, error: `GitHub-Default-Branch-Abfrage fehlgeschlagen (Status ${defaultRefRes.status}).` };
    }
    const { object } = (await defaultRefRes.json());
    const createRefRes = await fetch(`https://api.github.com/repos/${githubRepo}/git/refs`, {
        method: 'POST',
        headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${SCREENSHOT_BRANCH}`, sha: object.sha }),
        signal: AbortSignal.timeout(10_000),
    });
    // 422 = Branch wurde zwischenzeitlich von einer parallelen Anfrage angelegt - kein echter Fehler.
    if (!createRefRes.ok && createRefRes.status !== 422) {
        return { ok: false, error: `GitHub-Branch-Anlage fehlgeschlagen (Status ${createRefRes.status}).` };
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
export async function uploadFeedbackScreenshot(buffer, extension, filename = `${Date.now()}.${extension}`) {
    if (!githubToken) {
        return { ok: false, error: 'Feedback ist auf diesem Server nicht konfiguriert.' };
    }
    const branchResult = await ensureScreenshotBranch();
    if (!branchResult.ok)
        return branchResult;
    const path = `feedback-screenshots/${filename}`;
    let res;
    try {
        res = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path}`, {
            method: 'PUT',
            headers: { ...githubApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Feedback-Screenshot hinzufügen: ${filename}`,
                content: buffer.toString('base64'),
                branch: SCREENSHOT_BRANCH,
            }),
            signal: AbortSignal.timeout(15_000),
        });
    }
    catch {
        return { ok: false, error: 'Screenshot konnte nicht zu GitHub hochgeladen werden.' };
    }
    if (!res.ok) {
        return { ok: false, error: `GitHub hat den Screenshot-Upload abgelehnt (Status ${res.status}).` };
    }
    return { ok: true, url: `https://raw.githubusercontent.com/${githubRepo}/${SCREENSHOT_BRANCH}/${path}` };
}
// Wie push.ts's VAPID-Keys: Feature ist optional, ohne gesetzten Token bleibt die App lauffähig,
// nur ohne In-App-Feedback (siehe routes/feedback.ts).
export const githubIssuesEnabled = !!githubToken;
/** Legt ein echtes GitHub-Issue über die REST-API an. Anders als mapsLink.ts's best-effort-fetch
 *  (dort ist ein Fehlschlag ein akzeptabler stiller Fallback) wird hier der Fehler an den Aufrufer
 *  durchgereicht – Issue-Erstellung ist der eigentliche Zweck des Aufrufs, kein Nice-to-have. Der
 *  verwendete Token sollte ein fine-grained PAT sein, das ausschließlich "Issues: Read and write"
 *  sowie (für uploadFeedbackScreenshot oben) "Contents: Read and write" auf genau diesem Repo
 *  erlaubt (siehe README) – selbst bei Kompromittierung dieses Codepfads bleibt der mögliche
 *  Schaden auf Issues und den feedback-screenshots-Branch beschränkt.
 */
export async function createGithubIssue(input) {
    if (!githubToken) {
        return { ok: false, error: 'Feedback ist auf diesem Server nicht konfiguriert.' };
    }
    let res;
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
    }
    catch {
        return { ok: false, error: 'Meldung konnte nicht an GitHub übermittelt werden. Bitte später erneut versuchen.' };
    }
    if (!res.ok) {
        return { ok: false, error: `GitHub hat die Meldung abgelehnt (Status ${res.status}).` };
    }
    const data = (await res.json());
    return { ok: true, number: data.number, url: data.html_url };
}
