#!/usr/bin/env node

/**
 * scripts/check-release-notes.mjs
 *
 * Validiert die gesammelten Release-Notes-Fragmente unter `release-notes/pending/`.
 *
 * Regeln:
 * 1. Jede Datei muss mindestens eine kanonische `### <Kategorie>`-Überschrift aus SLUG_TITLES besitzen.
 * 2. Jede Zeile mit `- ` muss dem Format `- <emoji> **<Schlagwort>**: <Beschreibung>` folgen.
 * 3. Keine technischen Implementierungsdetails (Backticks, CSS-Variablen, Komponenten-/Dateinamen, Issue-Nummern).
 * 4. Keine 'Verbesserung' oder 'Korrektur' von unfertigen/unveröffentlichten Features:
 *    Wenn ein Feature erst im aktuellen Entwicklungszyklus (nach dem letzten Release-Tag)
 *    entstanden ist, darf kein Punkt über eine 'Verbesserung', 'Korrektur', 'Optimierung' oder
 *    einen 'Feinschliff' dieses Features angelegt werden. Für Endnutzer ist das Feature schlicht neu.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_TITLES, SLUG_TITLES } from '../backend/scripts/generate-build-info.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(REPO_ROOT, 'release-notes', 'pending');

const ALLOWED_TITLES_SET = new Set(CANONICAL_TITLES);

const TECHNICAL_JARGON_CHECKS = [
  {
    pattern: /`[^`]+`/,
    reason: 'Code-Backticks (`...`) sind in Endnutzer-Release-Notes nicht erlaubt',
  },
  {
    pattern: /\(#\d+\)|(?:^|\s)#\d+\b/,
    reason: 'Issue-/PR-Nummern (#123) sind in Endnutzer-Release-Notes nicht erlaubt',
  },
  {
    pattern: /--[a-z][a-z0-9-]*/i,
    reason: 'CSS-Variablen (--...) sind in Endnutzer-Release-Notes nicht erlaubt',
  },
  {
    pattern: /\b[A-Za-z0-9_-]+\.(?:vue|ts|js|mjs|css|scss)\b/,
    reason: 'Dateinamen (.vue, .ts etc.) sind in Endnutzer-Release-Notes nicht erlaubt',
  },
  {
    pattern: /\b(?:FormField|SegmentedToggle|CollapsibleFieldset|AppIcon|NavBar|TripMap)\b/,
    reason: 'Interne Komponenten-Namen sind in Endnutzer-Release-Notes nicht erlaubt',
  },
];

function getLastReleaseTag() {
  try {
    return execSync('git describe --tags --abbrev=0 --match "v*" 2>/dev/null', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    }).trim();
  } catch {
    try {
      const tags = execSync('git tag -l "v*" --sort=-v:refname 2>/dev/null', {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n');
      return tags[0] || 'v1.0.0';
    } catch {
      return 'v1.0.0';
    }
  }
}

const IMPROVEMENT_PATTERNS = [
  /\bverbesser/i,
  /\boptimier/i,
  /\bkorrektur\b/i,
  /\bbehoben\b/i,
  /\bbeseitigt\b/i,
  /\bfeinschliff\b/i,
  /\baufgeräumt/i,
  /\bvereinfacht/i,
  /\bharmonisch/i,
  /\bflüssiger/i,
  /\büberarbeitet/i,
  /\bpre-release\b/i,
  /\bbisherig/i,
  /\bfrüher/i,
  /\bentfernt redundant/i,
];

function isTouchedCodeOnlyNew(commitHash, lastTag) {
  if (!commitHash) {
    return false;
  }

  try {
    const touchedFiles = execSync(`git diff-tree --no-commit-id --name-only -r ${commitHash}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
      .split('\n')
      .filter(Boolean);

    const codeFiles = touchedFiles.filter(
      (codeFile) =>
        /\.(ts|vue|js|mjs)$/.test(codeFile) &&
        !codeFile.includes('.test.') &&
        !codeFile.includes('.stories.') &&
        !codeFile.startsWith('release-notes/') &&
        !codeFile.startsWith('docs/')
    );

    if (codeFiles.length === 0) {
      return false;
    }

    const existingFiles = codeFiles.filter((codeFile) => {
      try {
        execSync(`git cat-file -e "${lastTag}:${codeFile}" 2>/dev/null`, { cwd: REPO_ROOT });
        return true;
      } catch {
        return false;
      }
    });

    return existingFiles.length === 0;
  } catch {
    return false;
  }
}

function validateFileCategoryHeadings(filename, lines, errors) {
  const slug = filename.replace(/\.md$/, '');
  const prefixSlug = Object.keys(SLUG_TITLES).find(
    (key) => slug === key || slug.startsWith(`${key}--`)
  );
  let hasValidCategoryContext = Boolean(prefixSlug);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);

    if (headingMatch) {
      const hashes = headingMatch[1];
      const headingTitle = headingMatch[2].trim();

      if (hashes !== '###') {
        errors.push({
          file: filename,
          line: i + 1,
          type: 'INVALID_CATEGORY',
          message: `Kategorie-Überschriften müssen mit '### ' beginnen (gefunden: '${hashes} ${headingTitle}').`,
        });
        continue;
      }

      if (!ALLOWED_TITLES_SET.has(headingTitle)) {
        errors.push({
          file: filename,
          line: i + 1,
          type: 'INVALID_CATEGORY',
          message: `Ungültige Kategorie-Überschrift '### ${headingTitle}'. Erlaubt sind ausschließlich: ${CANONICAL_TITLES.map((title) => `'### ${title}'`).join(', ')}.`,
        });
        continue;
      }

      hasValidCategoryContext = true;
    } else if (line.startsWith('- ') && !hasValidCategoryContext) {
      errors.push({
        file: filename,
        line: i + 1,
        type: 'MISSING_CATEGORY',
        message: `Vor dem ersten Stichpunkt muss eine gültige Kategorie-Überschrift stehen (z. B. '### ${SLUG_TITLES['spots-tours']}').`,
      });
      hasValidCategoryContext = true;
    }
  }
}

function validateNoteJargon(filename, lineNo, fullText, errors) {
  for (const check of TECHNICAL_JARGON_CHECKS) {
    if (check.pattern.test(fullText)) {
      errors.push({
        file: filename,
        line: lineNo,
        type: 'TECHNICAL_JARGON',
        message: `${check.reason}. Bitte für nicht-technische Endnutzer:innen umformulieren.`,
      });
    }
  }
}

function validateNoteUnreleasedImprovement({
  filename,
  filePath,
  lineNo,
  title,
  fullText,
  lastTag,
  errors,
}) {
  const hasImprovementKw = IMPROVEMENT_PATTERNS.some((pattern) => pattern.test(fullText));

  if (!hasImprovementKw) {
    return;
  }

  let commitHash = '';

  try {
    commitHash = execSync(
      `git log -S ${JSON.stringify(title)} -n 1 --format="%H" -- ${JSON.stringify(path.relative(REPO_ROOT, filePath))}`,
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    ).trim();
  } catch {
    // Uncommitteter oder neuer Eintrag
  }

  if (isTouchedCodeOnlyNew(commitHash, lastTag)) {
    errors.push({
      file: filename,
      line: lineNo,
      title,
      type: 'UNRELEASED_IMPROVEMENT',
      message: `"${title}" beschreibt eine Verbesserung/Korrektur eines Features, dessen Code im letzten Release (${lastTag}) noch gar nicht existierte. Für Endnutzer ist das Feature neu – bitte als Teil des neuen Features beschreiben oder den Punkt ersatzlos streichen.`,
    });
  }
}

function validateFileNotes({ filename, filePath, lines, lastTag, errors }) {
  let fileEntries = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line.startsWith('- ')) {
      continue;
    }

    fileEntries++;
    const match = line.match(/^-\s+([^\s*]+)\s+\*\*([^*]+)\*\*:\s*(.+)$/);

    if (!match) {
      errors.push({
        file: filename,
        line: i + 1,
        type: 'FORMAT',
        message: `Ungültiges Format. Erwartet: '- 🎯 **Schlagwort**: Beschreibung'. Zeile: "${line}"`,
      });
      continue;
    }

    const [, , title, desc] = match;
    const fullText = `${title} ${desc}`;

    validateNoteJargon(filename, i + 1, fullText, errors);
    validateNoteUnreleasedImprovement({
      filename,
      filePath,
      lineNo: i + 1,
      title,
      fullText,
      lastTag,
      errors,
    });
  }

  return fileEntries;
}

export function checkNotes(options = {}) {
  const pendingDir = options.pendingDir || PENDING_DIR;
  const lastTag = options.lastTag || getLastReleaseTag();
  const exitOnError = options.exitOnError ?? true;

  if (!fs.existsSync(pendingDir)) {
    console.log(`ℹ️ Kein Verzeichnis ${pendingDir} gefunden. Nichts zu prüfen.`);
    return { errors: [], warnings: [], totalEntries: 0 };
  }

  const files = fs
    .readdirSync(pendingDir)
    .filter((file) => file.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️ Keine pending Release-Notes vorhanden.');
    return { errors: [], warnings: [], totalEntries: 0 };
  }

  console.log(
    `🔍 Prüfe Release-Notes in ${path.relative(REPO_ROOT, pendingDir)} gegen letzte Release-Version: ${lastTag}`
  );

  const errors = [];
  const warnings = [];
  let totalEntries = 0;

  for (const filename of files) {
    const filePath = path.join(pendingDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    validateFileCategoryHeadings(filename, lines, errors);
    totalEntries += validateFileNotes({ filename, filePath, lines, lastTag, errors });
  }

  console.log(`\nGeprüfte Einträge: ${totalEntries} in ${files.length} Dateien.`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  Hinweise (${warnings.length}):`);

    for (const w of warnings) {
      console.log(`  - [${w.file}:${w.line}] ${w.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ Fehlerhafte Release-Notes-Einträge gefunden (${errors.length}):`);

    for (const err of errors) {
      console.error(`  - [${err.file}:${err.line}] (${err.type}): ${err.message}`);
    }

    console.error(
      `\n💡 Tipp: Nutze ausschließlich kanonische '### '-Kategorien aus AGENTS.md und verzichte auf technischen Code-Jargon.`
    );

    if (exitOnError) {
      process.exit(1);
    }
  } else {
    console.log(`\n✅ Alle ${totalEntries} Release-Notes-Punkte sind valide.`);
  }

  return { errors, warnings, totalEntries };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkNotes();
}
