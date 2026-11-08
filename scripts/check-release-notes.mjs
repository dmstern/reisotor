#!/usr/bin/env node

/**
 * scripts/check-release-notes.mjs
 *
 * Validiert die gesammelten Release-Notes-Fragmente unter `release-notes/pending/`.
 *
 * Regeln:
 * 1. Jede Datei muss gültige Release-Notes-Punkte im Format `- <emoji> **<Schlagwort>**: <Beschreibung>` enthalten.
 * 2. Keine 'Verbesserung' oder 'Korrektur' von unfertigen/unveröffentlichten Features:
 *    Wenn ein Feature erst im aktuellen Entwicklungszyklus (nach dem letzten Release-Tag)
 *    entstanden ist, darf kein Punkt über eine 'Verbesserung', 'Korrektur', 'Optimierung' oder
 *    einen 'Feinschliff' dieses Features angelegt werden. Für Endnutzer ist das Feature schlicht neu.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(REPO_ROOT, 'release-notes', 'pending');

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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line.startsWith('- ')) {
        continue;
      }

      totalEntries++;
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

      // Prüfe auf Verbesserungs-/Korrektur-Signalwörter
      const hasImprovementKw = IMPROVEMENT_PATTERNS.some((pattern) => pattern.test(fullText));

      if (hasImprovementKw) {
        // Prüfe Git-Historie: Wann wurde dieser Eintrag hinzugefügt?
        let commitHash = '';

        try {
          commitHash = execSync(
            `git log -S ${JSON.stringify(title)} -n 1 --format="%H" -- ${JSON.stringify(path.relative(REPO_ROOT, filePath))}`,
            { cwd: REPO_ROOT, encoding: 'utf-8' }
          ).trim();
        } catch {
          // Uncommitteter oder neuer Eintrag
        }

        const isOnlyNewCode = isTouchedCodeOnlyNew(commitHash, lastTag);

        // Falls ausschließlich Code-Dateien berührt wurden, die erst nach lastTag entstanden sind:
        if (isOnlyNewCode) {
          errors.push({
            file: filename,
            line: i + 1,
            title,
            type: 'UNRELEASED_IMPROVEMENT',
            message: `"${title}" beschreibt eine Verbesserung/Korrektur eines Features, dessen Code im letzten Release (${lastTag}) noch gar nicht existierte. Für Endnutzer ist das Feature neu – bitte als Teil des neuen Features beschreiben oder den Punkt ersatzlos streichen.`,
          });
        }
      }
    }
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
      `\n💡 Tipp: Features, die in ${lastTag} noch nicht existierten, dürfen keine separaten 'Verbesserungs-' oder 'Korrektur'-Einträge haben.`
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
