#!/usr/bin/env node

/**
 * Helper CLI for managing Reisotor's systematic GitHub PR review labels.
 *
 * Commands:
 *   sync                           Ensure all 6 `review:*` labels exist in the repo.
 *   set <pr> [options]             Update exclusive status and orthogonal check flags.
 *   board                          Print a grouped Markdown overview of open PRs.
 */

import { execFileSync } from 'node:child_process';

const STATUS_LABELS = {
  needed: {
    name: '👀️ review:needed',
    color: 'fbca04',
    description: 'Wartet auf systematisches Code-Review (neu erstellt oder nach Fixes)',
  },
  'needs-polish': {
    name: '🛠️ review:needs-polish',
    color: 'd93f0b',
    description: 'Review abgeschlossen: Fixes, Tests oder Feinschliff vor dem Merge nötig',
  },
  'needs-manual-test': {
    name: '🧪️ review:needs-manual-test',
    color: '0284c7',
    description: 'Code-Review sauber – wartet auf manuellen Test / visuellen Check',
  },
  'ready-to-merge': {
    name: '🚀️ review:ready-to-merge',
    color: '1fbd48',
    description: 'Review grün, abgestimmt und getestet (oder Test n/a) – bereit für Merge',
  },
};

const FLAG_LABELS = {
  discussed: {
    name: '💬️ review:discussed',
    color: '7057ff',
    description: 'PR/Ansatz wurde bereits gemeinsam besprochen und abgestimmt',
  },
  'manually-tested': {
    name: '✅️ review:manually-tested',
    color: '10b981',
    description: 'Manueller Test / visueller Check wurde erfolgreich durchgeführt',
  },
};

const STATUS_ORDER = ['ready-to-merge', 'needs-manual-test', 'needs-polish', 'needed'];
const MAX_BOARD_PRS = 50;
const HELP_EXIT_CODE = 0;
const ERROR_EXIT_CODE = 1;
const MIN_ARGS_COUNT = 2;

/**
 * Execute the GitHub CLI (`gh`) and return trimmed stdout.
 */
function runGh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Execute `gh` and parse its JSON stdout.
 */
function runGhJson(args) {
  const output = runGh(args);

  if (!output) {
    return null;
  }

  return JSON.parse(output);
}

/**
 * Resolve exact label names configured on GitHub (fallback to canonical defaults).
 */
function resolveRepoReviewLabels() {
  const existing =
    runGhJson(['label', 'list', '--search', 'review:', '--limit', '50', '--json', 'name']) ?? [];
  const namesByKey = {};

  for (const [key, definition] of Object.entries(STATUS_LABELS)) {
    const suffix = `review:${key}`;
    const match = existing.find((label) => label.name.endsWith(suffix));

    namesByKey[key] = match ? match.name : definition.name;
  }

  for (const [key, definition] of Object.entries(FLAG_LABELS)) {
    const suffix = `review:${key}`;
    const match = existing.find((label) => label.name.endsWith(suffix));

    namesByKey[key] = match ? match.name : definition.name;
  }

  return namesByKey;
}

/**
 * Idempotently create or update all 6 `review:*` labels in the GitHub repository.
 */
function syncLabels() {
  const allDefinitions = [...Object.values(STATUS_LABELS), ...Object.values(FLAG_LABELS)];

  for (const definition of allDefinitions) {
    runGh([
      'label',
      'create',
      definition.name,
      '--color',
      definition.color,
      '--description',
      definition.description,
      '--force',
    ]);
    console.log(`✓ Synced label: ${definition.name}`);
  }
}

/**
 * Parse boolean flag values (`true`/`false`) for CLI options.
 */
function parseBooleanOption(rawValue, optionName) {
  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`Invalid value "${rawValue}" for ${optionName}. Expected "true" or "false".`);
}

/**
 * Parse CLI arguments for the `set` subcommand.
 */
function parseSetArguments(args) {
  const prNumber = args[0];

  if (!prNumber || prNumber.startsWith('--')) {
    throw new Error(
      'Missing PR number. Usage: set <pr> [--status ...] [--discussed true|false] [--manually-tested true|false]'
    );
  }

  const options = {
    prNumber: prNumber.replace(/^#/, ''),
    status: null,
    discussed: null,
    manuallyTested: null,
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    const token = args[i];

    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    const nextValue = args[i + 1];

    if (nextValue === undefined) {
      throw new Error(`Missing value after option "${token}".`);
    }

    if (token === '--status') {
      if (!Object.hasOwn(STATUS_LABELS, nextValue)) {
        throw new Error(
          `Unknown status "${nextValue}". Allowed: ${Object.keys(STATUS_LABELS).join(', ')}`
        );
      }

      options.status = nextValue;
      i++;
      continue;
    }

    if (token === '--discussed') {
      options.discussed = parseBooleanOption(nextValue, '--discussed');
      i++;
      continue;
    }

    if (token === '--manually-tested') {
      options.manuallyTested = parseBooleanOption(nextValue, '--manually-tested');
      i++;
      continue;
    }

    throw new Error(`Unknown option "${token}".`);
  }

  return options;
}

/**
 * Compute label additions and removals and apply them to the target PR.
 */
function setPrLabels(args) {
  const options = parseSetArguments(args);
  const labelMap = resolveRepoReviewLabels();
  const prData = runGhJson(['pr', 'view', options.prNumber, '--json', 'number,title,labels']);
  const currentNames = new Set((prData.labels ?? []).map((label) => label.name));

  const toAdd = [];
  const toRemove = [];

  if (options.status !== null) {
    const targetStatusName = labelMap[options.status];

    for (const statusKey of Object.keys(STATUS_LABELS)) {
      const candidateName = labelMap[statusKey];

      if (candidateName !== targetStatusName && currentNames.has(candidateName)) {
        toRemove.push(candidateName);
      }
    }

    if (!currentNames.has(targetStatusName)) {
      toAdd.push(targetStatusName);
    }
  }

  applyFlagDiff({
    currentNames,
    labelName: labelMap.discussed,
    desiredState: options.discussed,
    toAdd,
    toRemove,
  });
  applyFlagDiff({
    currentNames,
    labelName: labelMap['manually-tested'],
    desiredState: options.manuallyTested,
    toAdd,
    toRemove,
  });

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log(
      `PR #${prData.number}: Labels bereits aktuell (${[...currentNames].join(', ') || 'keine'}).`
    );
    return;
  }

  if (options.dryRun) {
    console.log(`[dry-run] PR #${prData.number}: +[${toAdd.join(', ')}] -[${toRemove.join(', ')}]`);
    return;
  }

  const editArgs = ['pr', 'edit', String(prData.number)];

  for (const labelName of toAdd) {
    editArgs.push('--add-label', labelName);
  }

  for (const labelName of toRemove) {
    editArgs.push('--remove-label', labelName);
  }

  runGh(editArgs);
  console.log(
    `PR #${prData.number} aktualisiert: +[${toAdd.join(', ')}] -[${toRemove.join(', ')}]`
  );
}

/**
 * Stage additions or removals for a single orthogonal boolean flag label.
 */
function applyFlagDiff({ currentNames, labelName, desiredState, toAdd, toRemove }) {
  if (desiredState === null) {
    return;
  }

  if (desiredState && !currentNames.has(labelName)) {
    toAdd.push(labelName);
    return;
  }

  if (!desiredState && currentNames.has(labelName)) {
    toRemove.push(labelName);
  }
}

/**
 * Classify a PR into its primary review status bucket and flag booleans.
 */
function classifyPr(prItem, labelMap) {
  const names = new Set((prItem.labels ?? []).map((label) => label.name));
  let matchedStatus = 'unlabeled';

  for (const statusKey of STATUS_ORDER) {
    if (names.has(labelMap[statusKey])) {
      matchedStatus = statusKey;
      break;
    }
  }

  return {
    number: prItem.number,
    title: prItem.title,
    isDraft: Boolean(prItem.isDraft),
    headRefName: prItem.headRefName,
    statusKey: matchedStatus,
    statusLabel: matchedStatus === 'unlabeled' ? '— (ohne Review-Label)' : labelMap[matchedStatus],
    discussed: names.has(labelMap.discussed),
    manuallyTested: names.has(labelMap['manually-tested']),
  };
}

/**
 * Render a grouped Markdown board of all open pull requests.
 */
function printBoard() {
  const labelMap = resolveRepoReviewLabels();
  const pullRequests =
    runGhJson([
      'pr',
      'list',
      '--limit',
      String(MAX_BOARD_PRS),
      '--json',
      'number,title,labels,isDraft,headRefName',
    ]) ?? [];

  if (pullRequests.length === 0) {
    console.log('Keine offenen Pull Requests gefunden.');
    return;
  }

  const classified = pullRequests.map((prItem) => classifyPr(prItem, labelMap));
  const sortOrder = [...STATUS_ORDER, 'unlabeled'];

  classified.sort((first, second) => {
    const rankDiff = sortOrder.indexOf(first.statusKey) - sortOrder.indexOf(second.statusKey);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return second.number - first.number;
  });

  console.log('| PR | Titel | Status | Besprochen | Manuell getestet | Branch |');
  console.log('| :--- | :--- | :--- | :---: | :---: | :--- |');

  for (const row of classified) {
    const draftPrefix = row.isDraft ? '[Draft] ' : '';
    const escapedTitle = row.title.replaceAll('|', '\\|');
    const discussedCell = row.discussed ? '💬️ Ja' : '—';
    const testedCell = row.manuallyTested ? '✅️ Ja' : '—';

    console.log(
      `| #${row.number} | ${draftPrefix}${escapedTitle} | ${row.statusLabel} | ${discussedCell} | ${testedCell} | \`${row.headRefName}\` |`
    );
  }
}

/**
 * Print CLI usage help.
 */
function printHelp() {
  console.log(`Usage: node pr-labels.mjs <command> [args]

Commands:
  sync
      Create or update all 6 review:* labels in the GitHub repository.

  set <pr> [--status needed|needs-polish|needs-manual-test|ready-to-merge]
           [--discussed true|false] [--manually-tested true|false] [--dry-run]
      Update exclusive review status and/or orthogonal flags on a PR.

  board
      Print a Markdown table of all open PRs grouped by review status.`);
}

function main() {
  const args = process.argv.slice(MIN_ARGS_COUNT);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(HELP_EXIT_CODE);
  }

  if (command === 'sync') {
    syncLabels();
    return;
  }

  if (command === 'set') {
    setPrLabels(args.slice(1));
    return;
  }

  if (command === 'board') {
    printBoard();
    return;
  }

  throw new Error(`Unknown command "${command}". Run with --help for usage.`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(ERROR_EXIT_CODE);
}
