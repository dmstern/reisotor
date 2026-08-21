import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const buildInfo = {
  version: pkg.version,
  ref,
  builtAt: new Date().toISOString(),
  changelog: readLatestChangelogEntry(),
};

mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
