#!/usr/bin/env node

/**
 * Helper CLI for managing Reisotor's systematic GitHub PR review labels.
 *
 * Commands:
 *   sync                           Ensure all 7 `review:*` labels exist in the repo.
 *   set <pr> [options]             Update code-review, manual-test, discussion, and ready state.
 *   board                          Print a grouped Markdown overview of open PRs.
 */

import { execFileSync } from 'node:child_process';

const CODE_REVIEW_LABELS = {
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
  reviewed: {
    name: '👍️ review:reviewed',
    color: '0e8a16',
    description: 'Code-Review erfolgt und sauber (unabhängig von manuellem Test oder Gespräch)',
  },
};

const MANUAL_TEST_LABELS = {
  needed: {
    name: '🧪️ review:needs-manual-test',
    color: '0284c7',
    description: 'Manueller Test / visueller Check in UI oder App steht noch aus',
  },
  done: {
    name: '✅️ review:manually-tested',
    color: '10b981',
    description: 'Manueller Test / visueller Check wurde erfolgreich durchgeführt',
  },
};

const FLAG_LABELS = {
  discussed: {
    name: '💬️ review:discussed',
    color: '7057ff',
    description: 'PR/Ansatz wurde bereits gemeinsam besprochen und abgestimmt',
  },
  ready: {
    name: '🚀️ review:ready-to-merge',
    color: '1fbd48',
    description: 'Review grün, abgestimmt und getestet (oder Test n/a) – bereit für Merge',
  },
};

const BOARD_PRIORITY_ORDER = [
  'ready',
  'manual-pending',
  'needs-polish',
  'reviewed-only',
  'needed',
  'unlabeled',
];
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

  const resolveBySuffix = (suffix, fallbackName) => {
    const match = existing.find((label) => label.name.endsWith(suffix));

    return match ? match.name : fallbackName;
  };

  return {
    review: {
      needed: resolveBySuffix('review:needed', CODE_REVIEW_LABELS.needed.name),
      'needs-polish': resolveBySuffix(
        'review:needs-polish',
        CODE_REVIEW_LABELS['needs-polish'].name
      ),
      reviewed: resolveBySuffix('review:reviewed', CODE_REVIEW_LABELS.reviewed.name),
    },
    manualTest: {
      needed: resolveBySuffix('review:needs-manual-test', MANUAL_TEST_LABELS.needed.name),
      done: resolveBySuffix('review:manually-tested', MANUAL_TEST_LABELS.done.name),
    },
    discussed: resolveBySuffix('review:discussed', FLAG_LABELS.discussed.name),
    ready: resolveBySuffix('review:ready-to-merge', FLAG_LABELS.ready.name),
  };
}

/**
 * Idempotently create or update all 7 `review:*` labels in the GitHub repository.
 */
function syncLabels() {
  const allDefinitions = [
    ...Object.values(CODE_REVIEW_LABELS),
    ...Object.values(MANUAL_TEST_LABELS),
    ...Object.values(FLAG_LABELS),
  ];

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
      'Missing PR number. Usage: set <pr> [--review needed|needs-polish|reviewed] [--manual-test needed|done|none] [--discussed true|false] [--ready true|false]'
    );
  }

  const options = {
    prNumber: prNumber.replace(/^#/, ''),
    review: null,
    manualTest: null,
    discussed: null,
    ready: null,
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

    if (token === '--review') {
      if (!Object.hasOwn(CODE_REVIEW_LABELS, nextValue)) {
        throw new Error(
          `Unknown review state "${nextValue}". Allowed: ${Object.keys(CODE_REVIEW_LABELS).join(', ')}`
        );
      }

      options.review = nextValue;
      i++;
      continue;
    }

    if (token === '--manual-test') {
      if (!['needed', 'done', 'none'].includes(nextValue)) {
        throw new Error(`Unknown manual-test state "${nextValue}". Allowed: needed, done, none`);
      }

      options.manualTest = nextValue;
      i++;
      continue;
    }

    if (token === '--discussed') {
      options.discussed = parseBooleanOption(nextValue, '--discussed');
      i++;
      continue;
    }

    if (token === '--ready') {
      options.ready = parseBooleanOption(nextValue, '--ready');
      i++;
      continue;
    }

    throw new Error(`Unknown option "${token}".`);
  }

  return options;
}

/**
 * Stage exclusive selection changes within a group of mutually exclusive labels.
 */
function applyExclusiveGroup({ currentNames, groupMap, selectedKey, toAdd, toRemove }) {
  if (selectedKey === null) {
    return;
  }

  const targetName = selectedKey === 'none' ? null : groupMap[selectedKey];

  for (const candidateName of Object.values(groupMap)) {
    if (candidateName !== targetName && currentNames.has(candidateName)) {
      toRemove.push(candidateName);
    }
  }

  if (targetName && !currentNames.has(targetName)) {
    toAdd.push(targetName);
  }
}

/**
 * Stage additions or removals for a single boolean flag label.
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
 * Compute label additions and removals and apply them to the target PR.
 */
function setPrLabels(args) {
  const options = parseSetArguments(args);
  const labelMap = resolveRepoReviewLabels();
  const prData = runGhJson(['pr', 'view', options.prNumber, '--json', 'number,title,labels']);
  const currentNames = new Set((prData.labels ?? []).map((label) => label.name));

  const toAdd = [];
  const toRemove = [];

  applyExclusiveGroup({
    currentNames,
    groupMap: labelMap.review,
    selectedKey: options.review,
    toAdd,
    toRemove,
  });

  applyExclusiveGroup({
    currentNames,
    groupMap: labelMap.manualTest,
    selectedKey: options.manualTest,
    toAdd,
    toRemove,
  });

  applyFlagDiff({
    currentNames,
    labelName: labelMap.discussed,
    desiredState: options.discussed,
    toAdd,
    toRemove,
  });

  applyFlagDiff({
    currentNames,
    labelName: labelMap.ready,
    desiredState: options.ready,
    toAdd,
    toRemove,
  });

  if (
    options.ready === true &&
    currentNames.has(labelMap.manualTest.needed) &&
    !toRemove.includes(labelMap.manualTest.needed)
  ) {
    toRemove.push(labelMap.manualTest.needed);
  }

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
 * Classify a PR across all 4 review workflow dimensions.
 */
function classifyPr(prItem, labelMap) {
  const names = new Set((prItem.labels ?? []).map((label) => label.name));

  let reviewState = '—';

  if (names.has(labelMap.review.reviewed)) {
    reviewState = labelMap.review.reviewed;
  } else if (names.has(labelMap.review['needs-polish'])) {
    reviewState = labelMap.review['needs-polish'];
  } else if (names.has(labelMap.review.needed)) {
    reviewState = labelMap.review.needed;
  }

  let manualTestState = '—';

  if (names.has(labelMap.manualTest.done)) {
    manualTestState = labelMap.manualTest.done;
  } else if (names.has(labelMap.manualTest.needed)) {
    manualTestState = labelMap.manualTest.needed;
  }

  const isReady = names.has(labelMap.ready);
  const isDiscussed = names.has(labelMap.discussed);

  let priorityBucket = 'unlabeled';

  if (isReady) {
    priorityBucket = 'ready';
  } else if (names.has(labelMap.review['needs-polish'])) {
    priorityBucket = 'needs-polish';
  } else if (names.has(labelMap.manualTest.needed)) {
    priorityBucket = 'manual-pending';
  } else if (names.has(labelMap.review.reviewed)) {
    priorityBucket = 'reviewed-only';
  } else if (names.has(labelMap.review.needed)) {
    priorityBucket = 'needed';
  }

  return {
    number: prItem.number,
    title: prItem.title,
    isDraft: Boolean(prItem.isDraft),
    headRefName: prItem.headRefName,
    reviewState,
    manualTestState,
    isDiscussed,
    isReady,
    priorityBucket,
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

  classified.sort((first, second) => {
    const rankDiff =
      BOARD_PRIORITY_ORDER.indexOf(first.priorityBucket) -
      BOARD_PRIORITY_ORDER.indexOf(second.priorityBucket);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return second.number - first.number;
  });

  console.log('| PR | Titel | Code-Review | Manueller Test | Besprochen | Merge | Branch |');
  console.log('| :--- | :--- | :--- | :--- | :---: | :---: | :--- |');

  for (const row of classified) {
    const draftPrefix = row.isDraft ? '[Draft] ' : '';
    const escapedTitle = row.title.replaceAll('|', '\\|');
    const discussedCell = row.isDiscussed ? '💬️ Ja' : '—';
    const readyCell = row.isReady ? '🚀️ Bereit' : '—';

    console.log(
      `| #${row.number} | ${draftPrefix}${escapedTitle} | ${row.reviewState} | ${row.manualTestState} | ${discussedCell} | ${readyCell} | \`${row.headRefName}\` |`
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
      Create or update all 7 review:* labels in the GitHub repository.

  set <pr> [--review needed|needs-polish|reviewed]
           [--manual-test needed|done|none]
           [--discussed true|false] [--ready true|false] [--dry-run]
      Update code-review, manual-test, discussion, and ready labels on a PR.

  board
      Print a Markdown table of all open PRs across all review dimensions.`);
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
