#!/usr/bin/env node

/**
 * scripts/dependabot-clearance.mjs
 *
 * Supervisor- & Clearance-Bot für Dependabot Pull Requests.
 *
 * Aufgaben:
 *  - Fragt offene Dependabot-PRs via GitHub CLI (gh) ab.
 *  - Überprüft CI-Status (Unit-Tests, E2E-Shards, Security-Audit, Lint).
 *  - Bewertet Konflikte und Mergeability.
 *  - Ermittelt die sichere Merge-Reihenfolge (Root -> Backend -> E2E -> Frontend).
 *  - Erstellt strukturierte Markdown-Reports (für Chat, GitHub Step Summary oder Issues).
 *  - Kann sichere PRs automatisch mergen (--auto-merge).
 *
 * Modi:
 *   --check         (Standard) Analysiert PRs und gibt Clearance-Report aus
 *   --auto-merge    Mergt alle freigegebenen PRs (Verdict: GO) automatisch in Reihenfolge
 *   --summary-file  Schreibt den Markdown-Report in die angegebene Datei
 */

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';

export function parsePrTarget(title, headRef = '') {
  const normalized = `${title} ${headRef}`.toLowerCase();
  if (normalized.includes('/backend') || normalized.includes('backend/')) return 'backend';
  if (normalized.includes('/frontend') || normalized.includes('frontend/')) return 'frontend';
  if (normalized.includes('/e2e') || normalized.includes('e2e/')) return 'e2e';
  return 'root';
}

export function evaluateCiStatus(statusCheckRollup = []) {
  if (!Array.isArray(statusCheckRollup) || statusCheckRollup.length === 0) {
    return { state: 'UNKNOWN', passed: 0, failed: 0, pending: 0, total: 0, failedNames: [] };
  }

  let passed = 0;
  let failed = 0;
  let pending = 0;
  const failedNames = [];

  for (const check of statusCheckRollup) {
    const status = check.status;
    const conclusion = check.conclusion;
    const name = check.name || 'Unknown Check';

    if (status === 'IN_PROGRESS' || status === 'QUEUED' || status === 'PENDING') {
      pending++;
    } else if (
      conclusion === 'FAILURE' ||
      conclusion === 'TIMED_OUT' ||
      conclusion === 'ACTION_REQUIRED' ||
      conclusion === 'CANCELLED'
    ) {
      failed++;
      failedNames.push(name);
    } else if (conclusion === 'SUCCESS' || conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') {
      passed++;
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
    passed,
    failed,
    pending,
    total: statusCheckRollup.length,
    failedNames,
  };
}

export function evaluatePr(pr) {
  const target = parsePrTarget(pr.title, pr.headRefName);
  const ci = evaluateCiStatus(pr.statusCheckRollup);

  let verdict = 'GO';
  let reason = 'Alle Checks bestanden, keine Konflikte.';

  if (pr.mergeable === 'CONFLICTING') {
    verdict = 'STOP';
    reason = 'Merge-Konflikte vorhanden (Rebase erforderlich).';
  } else if (ci.state === 'FAILED') {
    verdict = 'STOP';
    reason = `CI-Fehler in: ${ci.failedNames.slice(0, 3).join(', ')}`;
  } else if (ci.state === 'PENDING') {
    verdict = 'WAIT';
    reason = `CI läuft noch (${ci.pending} Check(s) ausstehend).`;
  } else if (ci.total === 0) {
    verdict = 'WAIT';
    reason = 'Noch keine CI-Checks registriert.';
  }

  const targetPriority = {
    root: 1,
    backend: 2,
    e2e: 3,
    frontend: 4,
  };
  const prio = targetPriority[target] || 5;

  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    target,
    prio,
    isMergeable: pr.mergeable === 'MERGEABLE',
    ci,
    verdict,
    reason,
  };
}

export function sortEvaluatedPrs(evaluations) {
  return [...evaluations].sort((a, b) => {
    const verdictWeight = { GO: 1, WAIT: 2, STOP: 3 };
    const diff = (verdictWeight[a.verdict] || 9) - (verdictWeight[b.verdict] || 9);
    if (diff !== 0) return diff;
    return a.prio - b.prio || a.number - b.number;
  });
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
    const verdictBadge =
      item.verdict === 'GO'
        ? '🟢 **GO (Freigegeben)**'
        : item.verdict === 'WAIT'
          ? '🟡 **WAIT (Läuft)**'
          : '🔴 **STOP (Gesperrt)**';

    const ciBadge =
      item.ci.state === 'PASSED'
        ? `✅ ${item.ci.passed}/${item.ci.total}`
        : item.ci.state === 'FAILED'
          ? `❌ ${item.ci.failed} Fehler`
          : `⏳ ${item.ci.pending} offen`;

    const prLink = item.url ? `[#${item.number}](${item.url})` : `#${item.number}`;
    lines.push(
      `| ${prLink} | \`${item.target}\` | ${ciBadge} | ${verdictBadge} | ${item.reason} |`
    );
  }

  const goCount = evaluations.filter((e) => e.verdict === 'GO').length;
  const stopCount = evaluations.filter((e) => e.verdict === 'STOP').length;
  const waitCount = evaluations.filter((e) => e.verdict === 'WAIT').length;

  lines.push('');
  lines.push(
    `**Zusammenfassung:** ${goCount} freigegeben, ${waitCount} in Prüfung, ${stopCount} gesperrt.`
  );

  return lines.join('\n');
}

export function fetchOpenDependabotPrs() {
  try {
    const stdout = execSync(
      'gh pr list --state open --json number,title,author,headRefName,mergeable,statusCheckRollup,url',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const prs = JSON.parse(stdout);
    // Nur von dependabot erstellte oder dependabot-branches
    return prs.filter(
      (pr) =>
        pr.author?.login === 'app/dependabot' ||
        pr.author?.login === 'dependabot[bot]' ||
        pr.headRefName?.startsWith('dependabot/')
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

export async function run() {
  const args = process.argv.slice(2);
  const autoMerge = args.includes('--auto-merge');
  const summaryFileArg = args.find((a) => a.startsWith('--summary-file='));
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
    const toMerge = evaluations.filter((e) => e.verdict === 'GO');
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
}

// Wenn direkt aufgerufen
if (process.argv[1] && process.argv[1].endsWith('dependabot-clearance.mjs')) {
  run().catch((err) => {
    console.error('Unerwarteter Fehler im Clearance-Bot:', err);
    process.exit(1);
  });
}
