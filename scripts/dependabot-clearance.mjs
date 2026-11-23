#!/usr/bin/env node

/**
 * scripts/dependabot-clearance.mjs
 *
 * Supervisor- & Clearance-Bot für Dependabot Pull Requests.
 *
 * Aufgaben:
 *  - Fragt offene Dependabot-PRs via GitHub CLI (gh) ab.
 *  - Überprüft CI-Status (inkl. Pflicht-Checks, keine rein übersprungenen Läufe).
 *  - Bewertet Konflikte, Mergeability sowie SemVer-Risiken (Major / kritische Runtime-Pakete).
 *  - Ermittelt die sichere Merge-Reihenfolge (Root -> Backend -> E2E -> Frontend -> Actions).
 *  - Erstellt strukturierte Markdown-Reports (für Chat, GitHub Step Summary oder Issues).
 *  - Kann sichere PRs automatisch mergen (--auto-merge) und blockierte PRs kommentieren (--manage-prs).
 *
 * Modi:
 *   --check         (Standard) Analysiert PRs und gibt Clearance-Report aus (read-only)
 *   --auto-merge    Mergt alle freigegebenen PRs (Verdict: GO) automatisch in Reihenfolge
 *   --manage-prs    Postet idempotente Hinweise/Rebase-Befehle auf STOP/REVIEW-PRs
 *   --summary-file  Schreibt den Markdown-Report in die angegebene Datei
 */

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';

const MAX_FAILED_NAMES_DISPLAY = 3;
const PRIO_ROOT = 1;
const PRIO_BACKEND = 2;
const PRIO_E2E = 3;
const PRIO_FRONTEND = 4;
const PRIO_GITHUB_ACTIONS = 5;
const PRIO_DEFAULT = 6;
const VERDICT_WEIGHT_GO = 1;
const VERDICT_WEIGHT_WAIT = 2;
const VERDICT_WEIGHT_REVIEW = 3;
const VERDICT_WEIGHT_STOP = 4;
const VERDICT_WEIGHT_DEFAULT = 9;
const SEMVER_RADIX = 10;

export const CRITICAL_RUNTIME_PACKAGES = new Set([
  'fastify',
  '@fastify/session',
  '@fastify/cookie',
  'better-sqlite3',
  'bcrypt',
]);

export const REQUIRED_CHECKS_BY_TARGET = {
  root: ['E2E Required', 'Lint & Format Check'],
  backend: ['E2E Required', 'Lint & Format Check'],
  e2e: ['E2E Required', 'Lint & Format Check'],
  frontend: ['E2E Required', 'Lint & Format Check'],
  'github-actions': ['Lint & Format Check'],
};

const TARGET_PRIORITY = {
  root: PRIO_ROOT,
  backend: PRIO_BACKEND,
  e2e: PRIO_E2E,
  frontend: PRIO_FRONTEND,
  'github-actions': PRIO_GITHUB_ACTIONS,
};

export function parsePrTarget(title, headRef = '') {
  const normalized = `${title} ${headRef}`.toLowerCase();

  if (
    normalized.includes('github_actions') ||
    normalized.includes('github-actions') ||
    normalized.includes('actions/')
  ) {
    return 'github-actions';
  }

  if (normalized.includes('/backend') || normalized.includes('backend/')) {
    return 'backend';
  }

  if (normalized.includes('/frontend') || normalized.includes('frontend/')) {
    return 'frontend';
  }

  if (normalized.includes('/e2e') || normalized.includes('e2e/')) {
    return 'e2e';
  }

  return 'root';
}

function parseSemverParts(rawVersion) {
  if (typeof rawVersion !== 'string') {
    return null;
  }

  const cleaned = rawVersion.trim().replace(/^v/i, '');
  const segments = cleaned.split('.');

  if (segments.length === 0) {
    return null;
  }

  const major = Number.parseInt(segments[0], SEMVER_RADIX);
  const minor = segments.length > 1 ? Number.parseInt(segments[1], SEMVER_RADIX) : 0;
  const patch = segments.length > 2 ? Number.parseInt(segments[2], SEMVER_RADIX) : 0;

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return { major, minor, patch };
}

export function classifySemverBump(fromVersion, toVersion) {
  const fromParts = parseSemverParts(fromVersion);
  const toParts = parseSemverParts(toVersion);

  if (!fromParts || !toParts) {
    return 'unknown';
  }

  if (toParts.major > fromParts.major) {
    return 'major';
  }

  if (toParts.minor > fromParts.minor) {
    return 'minor';
  }

  if (toParts.patch > fromParts.patch) {
    return 'patch';
  }

  return 'unknown';
}

export function extractVersionBumps(title, body = '') {
  const bumps = [];
  const seenPackages = new Set();

  if (typeof title === 'string') {
    const titleMatch = title.match(
      /bump\s+([^\s]+)\s+from\s+(v?\d+(?:\.\d+)*)\s+to\s+(v?\d+(?:\.\d+)*)/i
    );

    if (titleMatch) {
      const pkg = titleMatch[1];
      const from = titleMatch[2];
      const to = titleMatch[3];
      bumps.push({
        pkg,
        from,
        to,
        bumpType: classifySemverBump(from, to),
      });
      seenPackages.add(pkg);
    }
  }

  if (typeof body !== 'string' || body.length === 0) {
    return bumps;
  }

  const rowPattern =
    /^\|\s*(?:\[([^\]]+)\]\([^)]+\)|`?([^|`\s]+)`?)\s*\|\s*`?(v?\d+(?:\.\d+)*)`?\s*\|\s*`?(v?\d+(?:\.\d+)*)`?\s*\|/i;

  for (const line of body.split('\n')) {
    const rowMatch = line.trim().match(rowPattern);

    if (!rowMatch) {
      continue;
    }

    const pkg = rowMatch[1] || rowMatch[2];
    const from = rowMatch[3];
    const to = rowMatch[4];

    if (!pkg || seenPackages.has(pkg)) {
      continue;
    }

    bumps.push({
      pkg,
      from,
      to,
      bumpType: classifySemverBump(from, to),
    });
    seenPackages.add(pkg);
  }

  return bumps;
}

const PENDING_STATUSES = new Set(['IN_PROGRESS', 'QUEUED', 'PENDING']);
const FAILED_CONCLUSIONS = new Set(['FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED', 'CANCELLED']);
const SKIPPED_CONCLUSIONS = new Set(['NEUTRAL', 'SKIPPED']);

function classifyCheckOutcome(check) {
  if (PENDING_STATUSES.has(check.status)) {
    return 'pending';
  }

  if (FAILED_CONCLUSIONS.has(check.conclusion)) {
    return 'failed';
  }

  if (check.conclusion === 'SUCCESS') {
    return 'succeeded';
  }

  if (SKIPPED_CONCLUSIONS.has(check.conclusion)) {
    return 'skipped';
  }

  return 'pending';
}

export function evaluateCiStatus(statusCheckRollup = []) {
  if (!Array.isArray(statusCheckRollup) || statusCheckRollup.length === 0) {
    return {
      state: 'UNKNOWN',
      passed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      pending: 0,
      total: 0,
      failedNames: [],
      succeededNames: [],
    };
  }

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  let pending = 0;
  const failedNames = [];
  const succeededNames = [];

  for (const check of statusCheckRollup) {
    const name = check.name || 'Unknown Check';
    const outcome = classifyCheckOutcome(check);

    if (outcome === 'failed') {
      failed++;
      failedNames.push(name);
    } else if (outcome === 'succeeded') {
      succeeded++;
      succeededNames.push(name);
    } else if (outcome === 'skipped') {
      skipped++;
    } else {
      pending++;
    }
  }

  let state = 'PASSED';

  if (failed > 0) {
    state = 'FAILED';
  } else if (pending > 0) {
    state = 'PENDING';
  }

  return {
    state,
    passed: succeeded + skipped,
    succeeded,
    skipped,
    failed,
    pending,
    total: statusCheckRollup.length,
    failedNames,
    succeededNames,
  };
}

function determineVerdict(pr, target, ci, bumps) {
  if (pr.mergeable === 'CONFLICTING') {
    return {
      verdict: 'STOP',
      reason: 'Merge-Konflikte vorhanden (Rebase erforderlich).',
    };
  }

  if (ci.state === 'FAILED') {
    return {
      verdict: 'STOP',
      reason: `CI-Fehler in: ${ci.failedNames.slice(0, MAX_FAILED_NAMES_DISPLAY).join(', ')}`,
    };
  }

  if (ci.state === 'PENDING') {
    return {
      verdict: 'WAIT',
      reason: `CI läuft noch (${ci.pending} Check(s) ausstehend).`,
    };
  }

  if (ci.total === 0) {
    return {
      verdict: 'WAIT',
      reason: 'Noch keine CI-Checks registriert.',
    };
  }

  if (ci.succeeded === 0) {
    return {
      verdict: 'STOP',
      reason: 'Alle CI-Checks wurden übersprungen (kein echter Testlauf).',
    };
  }

  const requiredChecks = REQUIRED_CHECKS_BY_TARGET[target] || [];
  const missingChecks = requiredChecks.filter((name) => !ci.succeededNames.includes(name));

  if (missingChecks.length > 0) {
    return {
      verdict: 'STOP',
      reason: `Pflicht-Check nicht erfolgreich: ${missingChecks.join(', ')}`,
    };
  }

  const majorBump = bumps.find((bump) => bump.bumpType === 'major');

  if (majorBump) {
    return {
      verdict: 'REVIEW',
      reason: `Major-Update (${majorBump.pkg} ${majorBump.from} → ${majorBump.to}) – manuelle Freigabe erforderlich.`,
    };
  }

  if (target === 'github-actions') {
    return {
      verdict: 'REVIEW',
      reason: 'GitHub-Actions-Update – manuelle Freigabe erforderlich.',
    };
  }

  const criticalMinorBump = bumps.find(
    (bump) => CRITICAL_RUNTIME_PACKAGES.has(bump.pkg) && bump.bumpType === 'minor'
  );

  if (criticalMinorBump) {
    return {
      verdict: 'REVIEW',
      reason: `Kritisches Runtime-Paket (${criticalMinorBump.pkg} ${criticalMinorBump.from} → ${criticalMinorBump.to}) – manuelle Freigabe erforderlich.`,
    };
  }

  return {
    verdict: 'GO',
    reason: 'Alle Checks bestanden, keine Konflikte.',
  };
}

export function evaluatePr(pr) {
  const target = parsePrTarget(pr.title, pr.headRefName);
  const ci = evaluateCiStatus(pr.statusCheckRollup);
  const bumps = extractVersionBumps(pr.title, pr.body || '');
  const { verdict, reason } = determineVerdict(pr, target, ci, bumps);
  const prio = TARGET_PRIORITY[target] || PRIO_DEFAULT;

  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    target,
    prio,
    bumps,
    isMergeable: pr.mergeable === 'MERGEABLE',
    isConflicting: pr.mergeable === 'CONFLICTING',
    comments: Array.isArray(pr.comments) ? pr.comments : [],
    ci,
    verdict,
    reason,
  };
}

export function sortEvaluatedPrs(evaluations) {
  const verdictWeight = {
    GO: VERDICT_WEIGHT_GO,
    WAIT: VERDICT_WEIGHT_WAIT,
    REVIEW: VERDICT_WEIGHT_REVIEW,
    STOP: VERDICT_WEIGHT_STOP,
  };

  return [...evaluations].sort((first, second) => {
    const diff =
      (verdictWeight[first.verdict] || VERDICT_WEIGHT_DEFAULT) -
      (verdictWeight[second.verdict] || VERDICT_WEIGHT_DEFAULT);

    if (diff !== 0) {
      return diff;
    }

    return first.prio - second.prio || first.number - second.number;
  });
}

function formatVerdictBadge(verdict) {
  if (verdict === 'GO') {
    return '🟢 **GO (Freigegeben)**';
  }

  if (verdict === 'WAIT') {
    return '🟡 **WAIT (Läuft)**';
  }

  if (verdict === 'REVIEW') {
    return '🟠 **REVIEW (Manuell)**';
  }

  return '🔴 **STOP (Gesperrt)**';
}

function formatCiBadge(ci) {
  if (ci.state === 'PASSED') {
    return `✅ ${ci.passed}/${ci.total}`;
  }

  if (ci.state === 'FAILED') {
    return `❌ ${ci.failed} Fehler`;
  }

  return `⏳ ${ci.pending} offen`;
}

export function generateClearanceMarkdown(evaluations) {
  if (evaluations.length === 0) {
    return `### 🛡️ Dependabot Clearance Report\n\nKeine offenen Dependabot-PRs vorhanden. Alles auf dem neuesten Stand! ✨\n`;
  }

  const lines = [
    `### 🛡️ Dependabot Clearance Report`,
    ``,
    `Aktuelle Prüfung offener Dependabot-PRs (${new Date().toISOString().split('T')[0]}):`,
    ``,
    `| PR | Bereich | CI-Status | Freigabe | Empfehlung / Grund |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const item of evaluations) {
    const verdictBadge = formatVerdictBadge(item.verdict);
    const ciBadge = formatCiBadge(item.ci);
    const prLink = item.url ? `[#${item.number}](${item.url})` : `#${item.number}`;
    lines.push(
      `| ${prLink} | \`${item.target}\` | ${ciBadge} | ${verdictBadge} | ${item.reason} |`
    );
  }

  const goCount = evaluations.filter((entry) => entry.verdict === 'GO').length;
  const waitCount = evaluations.filter((entry) => entry.verdict === 'WAIT').length;
  const reviewCount = evaluations.filter((entry) => entry.verdict === 'REVIEW').length;
  const stopCount = evaluations.filter((entry) => entry.verdict === 'STOP').length;

  lines.push('');
  lines.push(
    `**Zusammenfassung:** ${goCount} freigegeben, ${waitCount} in Prüfung, ${reviewCount} manuelles Review, ${stopCount} gesperrt.`
  );

  return lines.join('\n');
}

export function buildPrFeedbackComment(evaluation) {
  const marker = `<!-- dependabot-clearance-bot:${evaluation.verdict}:${evaluation.reason} -->`;
  const heading =
    evaluation.verdict === 'REVIEW'
      ? '🟠 **Dependabot Clearance: Manuelles Review erforderlich**'
      : '🔴 **Dependabot Clearance: Auto-Merge gesperrt**';

  return `${marker}\n${heading}\n\n- **Bereich:** \`${evaluation.target}\`\n- **Grund:** ${evaluation.reason}\n`;
}

export function shouldPostComment(comments = [], marker) {
  if (!Array.isArray(comments) || !marker) {
    return true;
  }

  return !comments.some(
    (comment) => typeof comment?.body === 'string' && comment.body.includes(marker)
  );
}

export function shouldRequestRebase(comments = []) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return true;
  }

  const latestComment = comments[comments.length - 1];
  const latestBody = typeof latestComment?.body === 'string' ? latestComment.body.trim() : '';

  return latestBody !== '@dependabot rebase';
}

export function fetchOpenDependabotPrs() {
  try {
    const stdout = execSync(
      'gh pr list --state open --json number,title,author,headRefName,mergeable,statusCheckRollup,url,body,comments',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const prs = JSON.parse(stdout);
    // Ausschließlich authentifizierte Dependabot-Autoren akzeptieren
    return prs.filter(
      (pr) => pr.author?.login === 'app/dependabot' || pr.author?.login === 'dependabot[bot]'
    );
  } catch (err) {
    console.warn(
      'Hinweis: Konnte GitHub PRs nicht abrufen (ggf. keine GH_CLI Authentifizierung vorhanden).',
      err.message
    );
    return [];
  }
}

export function mergePr(prNumber) {
  console.log(`🚀 Führe Merge für PR #${prNumber} aus...`);
  execFileSync('gh', ['pr', 'merge', String(prNumber), '--merge', '--delete-branch'], {
    stdio: 'inherit',
  });
}

export function postPrComment(prNumber, body) {
  execFileSync('gh', ['pr', 'comment', String(prNumber), '--body', body], {
    stdio: 'inherit',
  });
}

function manageBlockedPrs(evaluations) {
  const actionable = evaluations.filter(
    (entry) => entry.verdict === 'STOP' || entry.verdict === 'REVIEW'
  );

  for (const item of actionable) {
    try {
      if (item.isConflicting && shouldRequestRebase(item.comments)) {
        console.log(`🔄 Fordere Rebase für PR #${item.number} an...`);
        postPrComment(item.number, '@dependabot rebase');
      }

      const commentBody = buildPrFeedbackComment(item);
      const marker = commentBody.split('\n')[0];

      if (shouldPostComment(item.comments, marker)) {
        console.log(`💬 Hinterlasse Clearance-Hinweis auf PR #${item.number}...`);
        postPrComment(item.number, commentBody);
      }
    } catch (commentErr) {
      console.error(`⚠️ Fehler beim Kommentieren von PR #${item.number}:`, commentErr.message);
    }
  }
}

export async function run() {
  const args = process.argv.slice(2);
  const autoMerge = args.includes('--auto-merge');
  const managePrs = args.includes('--manage-prs') || autoMerge;
  const summaryFileArg = args.find((arg) => arg.startsWith('--summary-file='));
  const summaryFile = summaryFileArg ? summaryFileArg.split('=')[1] : null;

  console.log('🔍 Starte Dependabot Clearance Check...');
  const prs = fetchOpenDependabotPrs();
  const evaluations = sortEvaluatedPrs(prs.map(evaluatePr));
  const markdown = generateClearanceMarkdown(evaluations);

  console.log('\n' + markdown + '\n');

  if (summaryFile) {
    fs.writeFileSync(summaryFile, markdown, 'utf-8');
    console.log(`📝 Report nach ${summaryFile} geschrieben.`);
  }

  if (autoMerge) {
    const toMerge = evaluations.filter((entry) => entry.verdict === 'GO');

    if (toMerge.length === 0) {
      console.log('ℹ️ Keine PRs zur automatischen Freigabe/Merge bereit.');
    } else {
      console.log(`\n📦 Automatische Freigabe für ${toMerge.length} PR(s):`);

      for (const item of toMerge) {
        try {
          mergePr(item.number);
          console.log(`✅ PR #${item.number} erfolgreich gemergt.`);
        } catch (mergeErr) {
          console.error(`❌ Fehler beim Mergen von PR #${item.number}:`, mergeErr.message);
        }
      }
    }
  }

  if (managePrs) {
    manageBlockedPrs(evaluations);
  }
}

// Wenn direkt aufgerufen
if (process.argv[1] && process.argv[1].endsWith('dependabot-clearance.mjs')) {
  run().catch((err) => {
    console.error('Unerwarteter Fehler im Clearance-Bot:', err);
    process.exit(1);
  });
}
