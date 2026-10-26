#!/usr/bin/env node

/**
 * scripts/security-check.mjs
 *
 * Zentrales Sicherheits- & Dependency-Cooldown-Tooling für Reisotor (Issue #548).
 *
 * Modi:
 *   --check       (Standard) Prüft Dependency-Policies und klassifiziert CVEs
 *   --fix         Führt zweistufigen Auto-Fix mit Cooldown-Schutz aus
 *   --update      Aktualisiert Abhängigkeiten unter Einhaltung der Reifezeit (--before)
 *
 * Optionen:
 *   --cooldown-days=<N>   Reifezeit in Tagen (Standard: 3 bei --fix, 7 bei --update)
 *   --summary-file=<pfad> Schreibt den Markdown-Report in die angegebene Datei
 *   --strict-all          Lässt --check auch bei Breaking- oder Minor-CVEs fehlschlagen
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_DIRS = ['.', 'backend', 'frontend', 'e2e'];

/**
 * Berechnet ein ISO-8601-Cutoff-Datum für npm --before=<ISO>.
 * Wirft einen RangeError bei days <= 0 oder ungültiger Zahl.
 */
export function computeCooldownDate(days, now = new Date()) {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0) {
    throw new RangeError(`Cooldown days must be a positive finite number, got: ${days}`);
  }
  const baseTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(baseTime)) {
    throw new TypeError(`Invalid date provided for now: ${now}`);
  }
  const targetTime = baseTime - d * 24 * 60 * 60 * 1000;
  return new Date(targetTime).toISOString();
}

/**
 * Prüft package.json auf verbotene Floating-Tags (@latest, @next, *),
 * oder ungesicherte Protokolle (http://, git://).
 */
export function validatePackageJsonPolicies(pkgJson, filePath = 'package.json') {
  const violations = [];
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

  for (const section of sections) {
    const deps = pkgJson?.[section];
    if (!deps || typeof deps !== 'object') continue;

    for (const [dep, rawSpec] of Object.entries(deps)) {
      if (typeof rawSpec !== 'string') continue;
      const spec = rawSpec.trim();

      if (
        spec === 'latest' ||
        spec === 'next' ||
        spec === '*' ||
        spec.endsWith('@latest') ||
        spec.endsWith('@next') ||
        spec.endsWith('@*')
      ) {
        violations.push({
          file: filePath,
          section,
          dependency: dep,
          specifier: rawSpec,
          reason: `Floating or unpinned tag/version specifier "${rawSpec}" is prohibited.`,
        });
      } else if (spec.startsWith('http://') || spec.startsWith('git://')) {
        violations.push({
          file: filePath,
          section,
          dependency: dep,
          specifier: rawSpec,
          reason: `Insecure protocol specifier "${rawSpec}" is prohibited.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Klassifiziert den Output von `npm audit --json` in autoFixable und manualBreaking.
 */
export function classifyAuditReport(auditJson, dirName = '.') {
  const counts = auditJson?.metadata?.vulnerabilities || {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  const autoFixable = [];
  const manualBreaking = [];
  const vulns = auditJson?.vulnerabilities || {};

  for (const [name, vuln] of Object.entries(vulns)) {
    const fix = vuln?.fixAvailable;
    const isAutoFixable =
      fix === true || (typeof fix === 'object' && fix !== null && !fix.isSemVerMajor);
    const isManualBreaking =
      fix === false || (typeof fix === 'object' && fix !== null && fix.isSemVerMajor === true);

    const baseEntry = {
      name,
      severity: vuln?.severity || 'unknown',
      isDirect: Boolean(vuln?.isDirect),
      via: Array.isArray(vuln?.via) ? vuln.via : [],
    };

    if (isAutoFixable) {
      autoFixable.push(baseEntry);
    } else if (isManualBreaking) {
      manualBreaking.push({
        ...baseEntry,
        targetPkg: typeof fix === 'object' && fix !== null ? fix.name : name,
        targetVersion: typeof fix === 'object' && fix !== null ? fix.version : undefined,
        reason:
          typeof fix === 'object' && fix !== null && fix.isSemVerMajor
            ? `Major version upgrade required (${fix.name}@${fix.version})`
            : 'No automated non-breaking fix available',
      });
    }
  }

  return {
    dir: dirName,
    counts,
    autoFixable,
    manualBreaking,
  };
}

/**
 * Formatiert die Prüfergebnisse als GitHub-kompatibles Markdown.
 */
export function formatSecurityMarkdown(results, policyViolations = [], mode = 'check') {
  const lines = [];

  const title = mode === 'fix' ? 'Security Audit & Auto-Fix Report' : 'Security Audit Report';
  lines.push(`## 🛡️ ${title}`);
  lines.push('');

  // Policy Violations Section
  if (policyViolations.length > 0) {
    lines.push('### ❌ Dependency Policy Verstöße');
    lines.push('');
    lines.push('| Datei | Paket | Version / Specifier | Grund |');
    lines.push('|---|---|---|---|');
    for (const v of policyViolations) {
      lines.push(`| \`${v.file}\` | \`${v.dependency}\` | \`${v.specifier}\` | ${v.reason} |`);
    }
    lines.push('');
  } else {
    lines.push(
      '✅ **Dependency-Policy:** Keine verbotenen Floating-Versionen (`@latest`, `*`) oder unsicheren Protokolle gefunden.'
    );
    lines.push('');
  }

  // Summary Table
  lines.push('### 📊 Übersicht nach Verzeichnis');
  lines.push('');
  lines.push(
    '| Verzeichnis | Total | Low | Moderate | High | Critical | Auto-Fixable | Breaking / Manuell |'
  );
  lines.push('|---|---|---|---|---|---|---|---|');

  let totalAuto = 0;
  let totalManual = 0;

  for (const r of results) {
    const c = r.counts;
    const autoCount = r.autoFixable.length;
    const manualCount = r.manualBreaking.length;
    totalAuto += autoCount;
    totalManual += manualCount;

    const autoBadge = autoCount > 0 ? `⚠️ **${autoCount}**` : '0';
    const manualBadge = manualCount > 0 ? `ℹ️ ${manualCount}` : '0';

    lines.push(
      `| \`${r.dir}\` | ${c.total || 0} | ${c.low || 0} | ${c.moderate || 0} | ${c.high || 0} | ${c.critical || 0} | ${autoBadge} | ${manualBadge} |`
    );
  }
  lines.push('');

  // Auto-Fixable CVEs
  if (totalAuto > 0) {
    lines.push('### ⚠️ Automatisch behebbare Sicherheitslücken (Non-Breaking)');
    lines.push('');
    lines.push('| Verzeichnis | Paket | Severity | Direkt | Behebung |');
    lines.push('|---|---|---|---|---|');
    for (const r of results) {
      for (const a of r.autoFixable) {
        lines.push(
          `| \`${r.dir}\` | \`${a.name}\` | **${a.severity}** | ${a.isDirect ? 'Ja' : 'Nein'} | Automatisch behebbar (\`npm run security:fix\`) |`
        );
      }
    }
    lines.push('');
  }

  // Manual Breaking CVEs
  if (totalManual > 0) {
    lines.push('### ℹ️ Manuelle Major-Upgrades erforderlich (Breaking Changes)');
    lines.push('');
    lines.push('> [!NOTE]');
    lines.push(
      '> Diese CVEs können nicht ohne potentiell brechende Änderungen (Major Upgrade) oder manuelles Eingreifen behoben werden. Sie werden nicht automatisch per `--force` überschrieben, um Regressionen zu vermeiden.'
    );
    lines.push('');
    lines.push('| Verzeichnis | Paket | Severity | Direkt | Erforderliches Upgrade / Grund |');
    lines.push('|---|---|---|---|---|');
    for (const r of results) {
      for (const m of r.manualBreaking) {
        lines.push(
          `| \`${r.dir}\` | \`${m.name}\` | ${m.severity} | ${m.isDirect ? 'Ja' : 'Nein'} | ${m.reason} |`
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Führt `npm audit --json` in einem Verzeichnis aus.
 */
export function runNpmAudit(dir) {
  try {
    const stdout = execSync('npm audit --json', {
      cwd: path.resolve(dir),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch {
        // Fallback unten
      }
    }
    throw new Error(`Failed to run npm audit in ${dir}: ${error.message}`);
  }
}

/**
 * Führt `npm audit fix --legacy-peer-deps [--before=<iso>]` in einem Verzeichnis aus.
 */
export function runNpmAuditFix(dir, cooldownIso = null) {
  const args = ['audit', 'fix', '--legacy-peer-deps'];
  if (cooldownIso) {
    args.push(`--before=${cooldownIso}`);
  }
  const cmd = `npm ${args.join(' ')}`;
  execSync(cmd, {
    cwd: path.resolve(dir),
    stdio: 'inherit',
    encoding: 'utf-8',
  });
}

/**
 * Führt `npm update --legacy-peer-deps [--before=<iso>]` in einem Verzeichnis aus.
 */
export function runNpmUpdate(dir, cooldownIso = null) {
  const args = ['update', '--legacy-peer-deps'];
  if (cooldownIso) {
    args.push(`--before=${cooldownIso}`);
  }
  const cmd = `npm ${args.join(' ')}`;
  execSync(cmd, {
    cwd: path.resolve(dir),
    stdio: 'inherit',
    encoding: 'utf-8',
  });
}

export function parseArgs(rawArgs) {
  let mode = 'check';
  let cooldownDays = null;
  let summaryFile = null;
  let strictAll = false;

  for (const arg of rawArgs) {
    if (arg === '--check') mode = 'check';
    else if (arg === '--fix') mode = 'fix';
    else if (arg === '--update') mode = 'update';
    else if (arg === '--strict-all') strictAll = true;
    else if (arg.startsWith('--cooldown-days=')) {
      cooldownDays = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--summary-file=')) {
      summaryFile = arg.split('=')[1];
    }
  }

  if (cooldownDays === null) {
    cooldownDays = mode === 'update' ? 7 : 3;
  }

  return { mode, cooldownDays, summaryFile, strictAll };
}

// Hauptlogik für CLI-Ausführung
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const { mode, cooldownDays, summaryFile, strictAll } = parseArgs(process.argv.slice(2));

  console.log(`🛡️  Reisotor Security Tooling (Modus: ${mode})`);

  // 1. Policy-Validierung aller package.json-Dateien
  const policyViolations = [];
  for (const dir of TARGET_DIRS) {
    const pkgPath = path.resolve(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const content = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const violations = validatePackageJsonPolicies(content, path.join(dir, 'package.json'));
      policyViolations.push(...violations);
    }
  }

  if (mode === 'fix') {
    const cooldownIso = computeCooldownDate(cooldownDays);
    console.log(`⏳ Auto-Fix aktiv (Stufe 1 Cooldown-Grenze: ${cooldownIso})...`);

    for (const dir of TARGET_DIRS) {
      console.log(`\n🔍 Prüfe Verzeichnis "${dir}" auf behebbare CVEs...`);
      const initialReport = classifyAuditReport(runNpmAudit(dir), dir);

      if (initialReport.autoFixable.length > 0) {
        console.log(
          `  -> ${initialReport.autoFixable.length} auto-fixable CVEs gefunden. Führe Stufe 1 (mit Cooldown) aus...`
        );
        try {
          runNpmAuditFix(dir, cooldownIso);
        } catch (e) {
          console.warn(`  ⚠️ Warnung bei Stufe-1-Fix in ${dir}:`, e.message);
        }

        // Re-Audit nach Stufe 1
        const intermediateReport = classifyAuditReport(runNpmAudit(dir), dir);
        if (intermediateReport.autoFixable.length > 0) {
          console.log(
            `  -> ${intermediateReport.autoFixable.length} auto-fixable CVEs verbleiben. Führe Stufe 2 (ohne Cooldown) aus...`
          );
          try {
            runNpmAuditFix(dir, null);
          } catch (e) {
            console.warn(`  ⚠️ Warnung bei Stufe-2-Fix in ${dir}:`, e.message);
          }
        }
      } else {
        console.log(`  -> Keine auto-fixable CVEs vorhanden.`);
      }
    }
  } else if (mode === 'update') {
    const cooldownIso = computeCooldownDate(cooldownDays);
    console.log(`⏳ Aktualisiere Abhängigkeiten (Cooldown-Grenze: ${cooldownIso})...`);
    for (const dir of TARGET_DIRS) {
      console.log(`\n📦 npm update in "${dir}"...`);
      try {
        runNpmUpdate(dir, cooldownIso);
      } catch (e) {
        console.warn(`  ⚠️ Warnung bei update in ${dir}:`, e.message);
      }
    }
  }

  // Abschließende Bestandsaufnahme
  const results = TARGET_DIRS.map((dir) => {
    const auditJson = runNpmAudit(dir);
    return classifyAuditReport(auditJson, dir);
  });

  const markdown = formatSecurityMarkdown(results, policyViolations, mode);
  console.log('\n' + markdown);

  if (summaryFile) {
    const summaryPath = path.resolve(summaryFile);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, markdown, 'utf-8');
    console.log(`\n📄 Markdown-Report nach ${summaryPath} geschrieben.`);
  }

  // Exit-Code-Bestimmung
  if (policyViolations.length > 0) {
    console.error(
      `\n❌ FEHLER: ${policyViolations.length} Dependency-Policy-Verstoß/Verstöße gefunden!`
    );
    process.exit(1);
  }

  if (strictAll) {
    const hasAnyVuln = results.some((r) => (r.counts.total || 0) > 0);
    if (hasAnyVuln) {
      console.error('\n❌ FEHLER: Sicherheitslücken gefunden (--strict-all aktiv).');
      process.exit(1);
    }
  } else {
    const hasHighOrCriticalAuto = results.some((r) =>
      r.autoFixable.some((v) => v.severity === 'high' || v.severity === 'critical')
    );
    if (hasHighOrCriticalAuto) {
      console.error(
        '\n❌ FEHLER: Es existieren noch automatisch behebbare High- oder Critical-Sicherheitslücken! Bitte führe "npm run security:fix" aus.'
      );
      process.exit(1);
    }
  }

  console.log('\n✨ Sicherheitsprüfung erfolgreich bestanden.');
  process.exit(0);
}
