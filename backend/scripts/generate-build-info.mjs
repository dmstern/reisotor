import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const repoRootDir = path.join(rootDir, '..');
const distDir = path.join(rootDir, 'dist');

// Version kommt aus der Root-package.json (einzige Versionsquelle fürs ganze Repo) statt aus der
// lokalen backend/package.json - Gegenstück zu frontend/vite.config.ts.
const pkg = JSON.parse(readFileSync(path.join(repoRootDir, 'package.json'), 'utf-8'));

let ref = 'unknown';
try {
  ref = execSync('git describe --tags --always', { cwd: rootDir }).toString().trim();
} catch {
  // Kein Git-Kontext beim Build (z. B. Release-Artefakt ohne .git-Verzeichnis) — 'unknown' bleibt.
}

const env =
  process.env.APP_ENV ??
  (process.env.GITHUB_REF?.startsWith('refs/tags/v') ? 'production' : 'development');
const versionSuffix = env === 'staging' ? '-staging' : env === 'production' ? '' : '-dev';
const computedVersion = `${pkg.version}${versionSuffix}`;

function readPendingReleaseNotes() {
  const pendingDir = path.join(repoRootDir, 'release-notes', 'pending');
  try {
    const fragmentFiles = readdirSync(pendingDir).filter((f) => f.endsWith('.md'));
    const notes = fragmentFiles
      .flatMap((f) => readFileSync(path.join(pendingDir, f), 'utf-8').split('\n'))
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim());
    return notes;
  } catch {
    return [];
  }
}

// Letzten Eintrag aus der Root-CHANGELOG.md fürs End-Nutzer-"Was ist neu" im About-Tab
// herausziehen (siehe release.yml, das dort pro Release einen Abschnitt "## [X.Y.Z] - Datum"
// einfügt) - bei fehlender/leerer Datei bleibt changelog schlicht null statt den Build fehlschlagen
// zu lassen.
function readLatestChangelogEntry() {
  let raw;
  try {
    raw = readFileSync(path.join(repoRootDir, 'CHANGELOG.md'), 'utf-8');
  } catch {
    return null;
  }
  // Datei an jeder "## ["-Überschrift (Zeilenanfang) aufteilen - der erste Treffer ist der
  // zuletzt eingefügte (release.yml fügt neue Einträge immer oben ein), robuster als ein
  // Lookahead-Regex-Ende, das an die Restlänge der Datei gebunden wäre.
  const first = raw.split(/\n(?=## \[)/).find((section) => section.startsWith('## ['));
  const heading = first?.match(/^## \[(.+?)\] - (\S+)/);
  if (!heading) return null;
  const [, version, date] = heading;
  const notes = first
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
  return { version, date, notes };
}

function determineChangelog() {
  if (env === 'staging' || env === 'development') {
    const pendingNotes = readPendingReleaseNotes();
    if (pendingNotes.length > 0) {
      return {
        version: computedVersion,
        date: new Date().toISOString().slice(0, 10),
        notes: pendingNotes,
      };
    }
    const latest = readLatestChangelogEntry();
    if (latest) {
      return {
        ...latest,
        version: computedVersion,
      };
    }
  }
  return readLatestChangelogEntry();
}

const buildInfo = {
  version: computedVersion,
  ref,
  builtAt: new Date().toISOString(),
  changelog: determineChangelog(),
};

mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
