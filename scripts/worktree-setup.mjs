#!/usr/bin/env node

/**
 * scripts/worktree-setup.mjs
 *
 * Bereitet einen Git-Worktree blitzschnell für lokales Testen vor:
 * 1. Erkennt automatisch, ob wir uns in einem Git-Worktree befinden.
 * 2. Verlinkt die 4 node_modules-Verzeichnisse (Root, backend, frontend, e2e)
 *    per Symlink aus dem Haupt-Repository (Dauer: < 0.1s, 0 MB Plattenplatz).
 * 3. Kopiert die .env-Datei aus dem Hauptordner, falls lokal noch nicht vorhanden.
 * 4. Legt eine isolierte Test-Datenbank mit Demo-Daten an (npm run seed:demo),
 *    falls backend/data.sqlite noch nicht existiert.
 * 5. Optional (--dev): Startet direkt im Anschluss den Dev-Server (npm run dev).
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIRS = [
  'node_modules',
  path.join('backend', 'node_modules'),
  path.join('frontend', 'node_modules'),
  path.join('e2e', 'node_modules'),
];

/**
 * Ermittelt Kontext: Befinden wir uns in einem Git-Worktree und wo liegt das Haupt-Repo?
 */
export function detectWorktreeContext(cwd = process.cwd()) {
  try {
    const gitCommonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const topLevel = execSync('git rev-parse --path-format=absolute --show-toplevel', {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const mainRepoDir = path.resolve(gitCommonDir, '..');
    const isWorktree = path.resolve(topLevel) !== path.resolve(mainRepoDir);

    return {
      isWorktree,
      mainRepoDir,
      currentDir: path.resolve(topLevel),
    };
  } catch {
    return {
      isWorktree: false,
      mainRepoDir: path.resolve(cwd),
      currentDir: path.resolve(cwd),
    };
  }
}

/**
 * Verlinkt node_modules aus dem Haupt-Repository in den aktuellen Worktree.
 */
export function ensureSymlinks({ currentDir, mainRepoDir, logger = console }) {
  let createdCount = 0;
  let existingCount = 0;
  const missingInMain = [];

  for (const relDir of MODULE_DIRS) {
    const targetInWorktree = path.join(currentDir, relDir);
    const sourceInMain = path.join(mainRepoDir, relDir);

    let exists = false;
    let isSymlink = false;

    try {
      const stat = fs.lstatSync(targetInWorktree);
      exists = true;
      isSymlink = stat.isSymbolicLink();
    } catch {
      exists = false;
    }

    if (exists) {
      if (isSymlink) {
        // Prüfen, ob der Symlink gültig ist
        if (fs.existsSync(targetInWorktree)) {
          existingCount++;
          continue;
        }
        // Toter Symlink: entfernen und neu verlinken
        fs.unlinkSync(targetInWorktree);
      } else {
        // Echtes Verzeichnis existiert bereits
        existingCount++;
        continue;
      }
    }

    // Prüfen, ob Hauptordner node_modules hat
    if (!fs.existsSync(sourceInMain)) {
      missingInMain.push(relDir);
      continue;
    }

    // Elternverzeichnis sicherstellen (z.B. backend/ für backend/node_modules)
    const parentDir = path.dirname(targetInWorktree);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.symlinkSync(sourceInMain, targetInWorktree, 'dir');
    logger.log(`🔗 Symlink erstellt: ${relDir} -> ${sourceInMain}`);
    createdCount++;
  }

  return { createdCount, existingCount, missingInMain };
}

/**
 * Kopiert die .env-Datei aus dem Hauptordner, falls im Worktree noch nicht vorhanden.
 */
export function ensureEnv({ currentDir, mainRepoDir, logger = console }) {
  const currentEnv = path.join(currentDir, '.env');
  const mainEnv = path.join(mainRepoDir, '.env');

  if (!fs.existsSync(currentEnv) && fs.existsSync(mainEnv)) {
    fs.copyFileSync(mainEnv, currentEnv);
    logger.log('📄 .env-Datei aus dem Haupt-Repository kopiert.');
    return true;
  }
  return false;
}

/**
 * Stellt sicher, dass eine lokale Test-Datenbank existiert.
 */
export function ensureDatabase({ currentDir, force = false, seedFn = null, logger = console }) {
  const dbPath = path.join(currentDir, 'backend', 'data.sqlite');
  const dbExists = fs.existsSync(dbPath);

  if (!dbExists || force) {
    logger.log(
      dbExists
        ? '🔄 Aktualisiere Test-Datenbank mit Demo-Daten (seed:demo:force)...'
        : '🌱 Keine lokale Test-Datenbank gefunden. Initialisiere mit Demo-Daten (seed:demo)...'
    );

    if (typeof seedFn === 'function') {
      seedFn({ force });
    } else {
      const cmd = force ? 'npm run seed:demo:force' : 'npm run seed:demo';
      execSync(cmd, { cwd: currentDir, stdio: 'inherit' });
    }
    return true;
  }

  logger.log('✓ Lokale Test-Datenbank (backend/data.sqlite) ist bereits vorhanden.');
  return false;
}

/**
 * Führt die vollständige Vorbereitung durch.
 */
export function setupWorktree({
  cwd = process.cwd(),
  forceSeed = false,
  seedFn = null,
  logger = console,
} = {}) {
  const context = detectWorktreeContext(cwd);

  if (context.isWorktree) {
    logger.log(`🌴 Git-Worktree erkannt (${path.basename(context.currentDir)}).`);
    logger.log(`📁 Haupt-Repository: ${context.mainRepoDir}`);

    const symlinkResult = ensureSymlinks({
      currentDir: context.currentDir,
      mainRepoDir: context.mainRepoDir,
      logger,
    });

    if (symlinkResult.missingInMain.length > 0) {
      logger.warn(
        `⚠️  Hinweis: Folgende Verzeichnisse fehlen im Hauptordner: ${symlinkResult.missingInMain.join(
          ', '
        )}.\nFühre bei Bedarf 'npm run install:all' im Hauptordner aus.`
      );
    }

    ensureEnv({
      currentDir: context.currentDir,
      mainRepoDir: context.mainRepoDir,
      logger,
    });
  } else {
    logger.log('🏠 Haupt-Repository erkannt.');
  }

  ensureDatabase({
    currentDir: context.currentDir,
    force: forceSeed,
    seedFn,
    logger,
  });

  return context;
}

// Direkte CLI-Ausführung
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const args = process.argv.slice(2);
  const shouldRunDev = args.includes('--dev') || args.includes('-d');
  const forceSeed = args.includes('--force-seed') || args.includes('-f');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Verwendung:
  node scripts/worktree-setup.mjs [Optionen]

Optionen:
  -d, --dev         Startet nach dem Setup direkt 'npm run dev'
  -f, --force-seed  Erzwingt das Neu-Anlegen der Demo-Datenbank (seed:demo:force)
  -h, --help        Zeigt diese Hilfe an
`);
    process.exit(0);
  }

  const context = setupWorktree({ forceSeed });

  if (shouldRunDev) {
    console.log('\n🚀 Starte Reisotor Dev-Server...\n');
    const child = spawn('npm', ['run', 'dev'], {
      cwd: context.currentDir,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code, signal) => {
      process.exit(code ?? (signal ? 1 : 0));
    });
  }
}
