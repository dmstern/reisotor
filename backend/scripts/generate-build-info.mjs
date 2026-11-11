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
let versionSuffix = '-dev';

if (env === 'staging') {
  versionSuffix = '-staging';
} else if (env === 'production') {
  versionSuffix = '';
}

const computedVersion = `${pkg.version}${versionSuffix}`;

const SLUG_TITLES = {
  highlights: 'Highlights',
  trips: 'Reisen und Urlaube',
  map: 'Karte und Navigation',
  'spots-tours': 'Spots, Touren und Unterkünfte',
  budget: 'Budget und Kasse',
  calendar: 'Kalender und Planung',
  lists: 'Listen, Notizen und Tagebuch',
  weather: 'Wetter',
  admin: 'Verwaltung und Benutzerkonten',
  design: 'Design und Bedienung',
  privacy: 'Datenschutz und Sicherheit',
  'settings-sync': 'Einstellungen, Benachrichtigungen und Synchronisation',
  'demo-feedback': 'Demo und Feedback',
  improvements: 'Weitere Verbesserungen und Fehlerbehebungen',
};

const GROUP_PRIORITY = [
  'highlights',
  'trips',
  'map',
  'spots-tours',
  'budget',
  'calendar',
  'lists',
  'weather',
  'admin',
  'design',
  'privacy',
  'settings-sync',
  'demo-feedback',
  'improvements',
];

const TITLE_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TITLES).map(([slug, title]) => [title, slug])
);

const CANONICAL_TITLES = Object.values(SLUG_TITLES);

function slugToTitle(slug) {
  if (SLUG_TITLES[slug]) {
    return SLUG_TITLES[slug];
  }

  const prefixSlug = GROUP_PRIORITY.find((key) => slug.startsWith(`${key}--`));

  if (prefixSlug && SLUG_TITLES[prefixSlug]) {
    return SLUG_TITLES[prefixSlug];
  }

  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getGroupPriorityIndex(title) {
  const slug = TITLE_TO_SLUG[title];

  if (slug) {
    return GROUP_PRIORITY.indexOf(slug);
  }

  return -1;
}

function collectFragmentNotes(content, defaultTitle, groupedNotesMap) {
  const lines = content.split('\n');
  let currentTitle = defaultTitle;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = /^#{1,6}\s+(.+)$/.exec(line);

    if (headingMatch) {
      currentTitle = headingMatch[1].trim();
      continue;
    }

    if (!line.startsWith('- ')) {
      continue;
    }

    const note = line.slice(2).trim();

    if (!groupedNotesMap.has(currentTitle)) {
      groupedNotesMap.set(currentTitle, []);
    }

    groupedNotesMap.get(currentTitle).push(note);
  }
}

function readPendingReleaseNotes(customPendingDir) {
  const pendingDir = customPendingDir ?? path.join(repoRootDir, 'release-notes', 'pending');

  try {
    const fragmentFiles = readdirSync(pendingDir)
      .filter((file) => file.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b));

    const groupedNotesMap = new Map();

    for (const file of fragmentFiles) {
      const slug = file.replace(/\.md$/, '');
      const content = readFileSync(path.join(pendingDir, file), 'utf-8');
      collectFragmentNotes(content, slugToTitle(slug), groupedNotesMap);
    }

    const groups = Array.from(groupedNotesMap.entries())
      .filter(([, notes]) => notes.length > 0)
      .map(([title, notes]) => ({ title, notes }));

    groups.sort((a, b) => {
      const prioA = getGroupPriorityIndex(a.title);
      const prioB = getGroupPriorityIndex(b.title);

      if (prioA !== -1 && prioB !== -1) {
        return prioA - prioB;
      }

      if (prioA !== -1) {
        return -1;
      }

      if (prioB !== -1) {
        return 1;
      }

      return a.title.localeCompare(b.title);
    });

    const allNotes = groups.flatMap((group) => group.notes);

    return { groups, notes: allNotes };
  } catch {
    return { groups: [], notes: [] };
  }
}

// Einzelnen Abschnitt aus der CHANGELOG.md (beginnend mit "## [X.Y.Z] - Datum") parsen.
function parseChangelogSection(section) {
  const heading = section.match(/^## \[(.+?)\] - (\S+)/);

  if (!heading) {
    return null;
  }

  const [, version, date] = heading;

  const lines = section.split('\n').map((line) => line.trim());
  const groups = [];
  const allNotes = [];
  let currentGroup = null;

  for (const line of lines) {
    const subHeadingMatch = /^###\s+(.+)$/.exec(line);

    if (subHeadingMatch) {
      currentGroup = { title: subHeadingMatch[1].trim(), notes: [] };
      groups.push(currentGroup);
    } else if (line.startsWith('- ')) {
      const note = line.slice(2).trim();
      allNotes.push(note);

      if (currentGroup) {
        currentGroup.notes.push(note);
      }
    }
  }

  const result = { version, date, notes: allNotes };

  if (groups.length > 0) {
    result.groups = groups;
  }

  return result;
}

// Alle Einträge aus der Root-CHANGELOG.md fürs End-Nutzer-"Was ist neu" herausziehen
function readAllChangelogEntries() {
  let raw;

  try {
    raw = readFileSync(path.join(repoRootDir, 'CHANGELOG.md'), 'utf-8');
  } catch {
    return [];
  }

  const sections = raw.split(/\n(?=## \[)/).filter((section) => section.startsWith('## ['));
  return sections.map(parseChangelogSection).filter(Boolean);
}

// Findet bei Patch-Releases (z. B. 2.0.1) das zugehörige Basis-Release (z. B. 2.0.0),
// damit wichtige Highlights der aktuellen Versionen-Serie nicht verloren gehen.
function findBaseRelease(currentVersion, allEntries) {
  const cleanMatch = currentVersion.match(/(\d+)\.(\d+)\.(\d+)/);

  if (!cleanMatch) {
    return null;
  }

  const major = parseInt(cleanMatch[1], 10);
  const minor = parseInt(cleanMatch[2], 10);
  const patch = parseInt(cleanMatch[3], 10);

  // Nur wenn es sich um ein Patch-Release handelt (patch > 0)
  if (patch === 0) {
    return null;
  }

  // 1. Suche nach der Basis der aktuellen Minor-Reihe (z. B. 2.0.0 bei 2.0.1)
  const targetBaseVersion = `${major}.${minor}.0`;
  const exactBase = allEntries.find((e) => e.version === targetBaseVersion);

  if (exactBase) {
    return exactBase;
  }

  // 2. Fallback: Suche nach dem nächsten älteren Release mit patch === 0
  const olderBase = allEntries.find((entry) => {
    const match = entry.version.match(/^(\d+)\.(\d+)\.(\d+)$/);

    if (!match) {
      return false;
    }

    const eMajor = parseInt(match[1], 10);
    const eMinor = parseInt(match[2], 10);
    const ePatch = parseInt(match[3], 10);
    return ePatch === 0 && (eMajor < major || (eMajor === major && eMinor <= minor));
  });

  return olderBase ?? null;
}

function determineChangelog() {
  const allEntries = readAllChangelogEntries();

  let entry = null;

  if (env === 'staging' || env === 'development') {
    const pending = readPendingReleaseNotes();

    if (pending.notes.length > 0) {
      entry = {
        version: computedVersion,
        date: new Date().toISOString().slice(0, 10),
        notes: pending.notes,
        groups: pending.groups,
      };
    } else if (allEntries.length > 0) {
      entry = {
        ...allEntries[0],
        version: computedVersion,
      };
    }
  } else if (allEntries.length > 0) {
    entry = { ...allEntries[0] };
  }

  if (!entry) {
    return null;
  }

  const base = findBaseRelease(computedVersion, allEntries);

  if (base && base.version !== entry.version) {
    entry.baseRelease = {
      version: base.version,
      date: base.date,
      notes: base.notes,
      ...(base.groups ? { groups: base.groups } : {}),
    };
  }

  return entry;
}

export {
  SLUG_TITLES,
  GROUP_PRIORITY,
  CANONICAL_TITLES,
  slugToTitle,
  readPendingReleaseNotes,
  parseChangelogSection,
  readAllChangelogEntries,
  findBaseRelease,
  determineChangelog,
};

// Nur direkt ausführen, wenn die Datei als Skript aufgerufen wird
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const buildInfo = {
    version: computedVersion,
    ref,
    builtAt: new Date().toISOString(),
    changelog: determineChangelog(),
  };

  mkdirSync(distDir, { recursive: true });
  writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
}
