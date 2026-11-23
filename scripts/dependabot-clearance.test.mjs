import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  buildPrFeedbackComment,
  classifySemverBump,
  evaluateCiStatus,
  evaluatePr,
  extractVersionBumps,
  generateClearanceMarkdown,
  parsePrTarget,
  shouldPostComment,
  shouldRequestRebase,
  sortEvaluatedPrs,
} from './dependabot-clearance.mjs';

const REQUIRED_PASSING_CHECKS = [
  { name: 'Lint & Format Check', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { name: 'E2E Required', status: 'COMPLETED', conclusion: 'SUCCESS' },
];

describe('dependabot-clearance script', () => {
  test('correctly parses target directory from title and branch name', () => {
    assert.strictEqual(
      parsePrTarget(
        'chore(deps): bump vite in /frontend',
        'dependabot/npm_and_yarn/frontend/vite-1.0'
      ),
      'frontend'
    );
    assert.strictEqual(
      parsePrTarget(
        'chore(deps-dev): bump @types/node in /backend',
        'dependabot/npm_and_yarn/backend/node'
      ),
      'backend'
    );
    assert.strictEqual(
      parsePrTarget(
        'chore(deps-dev): bump @axe-core/playwright in /e2e',
        'dependabot/npm_and_yarn/e2e/axe'
      ),
      'e2e'
    );
    assert.strictEqual(
      parsePrTarget(
        'chore(deps): bump actions/checkout from 6 to 7',
        'dependabot/github_actions/actions/checkout-7'
      ),
      'github-actions'
    );
    assert.strictEqual(
      parsePrTarget('chore(deps-dev): bump typescript-eslint', 'dependabot/npm_and_yarn/eslint'),
      'root'
    );
  });

  test('classifies semver bumps and extracts single and grouped bumps', () => {
    assert.strictEqual(classifySemverBump('1.2.3', '2.0.0'), 'major');
    assert.strictEqual(classifySemverBump('v6', 'v7'), 'major');
    assert.strictEqual(classifySemverBump('5.1.0', '5.2.0'), 'minor');
    assert.strictEqual(classifySemverBump('5.1.0', '5.1.1'), 'patch');

    const singleBumps = extractVersionBumps('chore(deps): bump fastify from 5.1.0 to 6.0.0');
    assert.deepStrictEqual(singleBumps, [
      { pkg: 'fastify', from: '5.1.0', to: '6.0.0', bumpType: 'major' },
    ]);

    const groupBody = [
      'Bumps the minor-and-patch group in /frontend with 2 updates:',
      '| Package | From | To |',
      '| --- | --- | --- |',
      '| [@tabler/icons-vue](https://github.com/tabler/tabler-icons) | `3.50.0` | `3.51.0` |',
      '| [dompurify](https://github.com/cure53/DOMPurify) | `3.4.17` | `3.4.18` |',
    ].join('\n');
    const groupBumps = extractVersionBumps(
      'chore(deps): bump the minor-and-patch group in /frontend with 2 updates',
      groupBody
    );
    assert.deepStrictEqual(groupBumps, [
      { pkg: '@tabler/icons-vue', from: '3.50.0', to: '3.51.0', bumpType: 'minor' },
      { pkg: 'dompurify', from: '3.4.17', to: '3.4.18', bumpType: 'patch' },
    ]);
  });

  test('evaluates CI status correctly', () => {
    const checksPassed = [
      { name: 'Unit Tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'E2E Required', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ];
    assert.deepStrictEqual(evaluateCiStatus(checksPassed), {
      state: 'PASSED',
      passed: 2,
      succeeded: 2,
      skipped: 0,
      failed: 0,
      pending: 0,
      total: 2,
      failedNames: [],
      succeededNames: ['Unit Tests', 'E2E Required'],
    });

    const checksFailed = [
      { name: 'Frontend Unit Tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      { name: 'Backend Unit Tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ];
    const failedResult = evaluateCiStatus(checksFailed);
    assert.strictEqual(failedResult.state, 'FAILED');
    assert.strictEqual(failedResult.failed, 1);
    assert.deepStrictEqual(failedResult.failedNames, ['Frontend Unit Tests']);

    const checksPending = [
      { name: 'E2E Shard 1', status: 'IN_PROGRESS', conclusion: null },
      { name: 'Lint', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ];
    const pendingResult = evaluateCiStatus(checksPending);
    assert.strictEqual(pendingResult.state, 'PENDING');
    assert.strictEqual(pendingResult.pending, 1);
  });

  test('evaluates PR verdict: GO, WAIT, REVIEW, STOP', () => {
    const prGo = {
      number: 101,
      title: 'chore(deps-dev): bump @types/node from 26.6.5 to 26.6.6 in /backend',
      headRefName: 'dependabot/npm_and_yarn/backend/node',
      mergeable: 'MERGEABLE',
      statusCheckRollup: REQUIRED_PASSING_CHECKS,
    };
    const evalGo = evaluatePr(prGo);
    assert.strictEqual(evalGo.verdict, 'GO');
    assert.strictEqual(evalGo.target, 'backend');

    const prConflict = {
      number: 102,
      title: 'chore(deps): bump foo from 1.0.0 to 1.0.1',
      headRefName: 'dependabot/npm_and_yarn/foo',
      mergeable: 'CONFLICTING',
      statusCheckRollup: REQUIRED_PASSING_CHECKS,
    };
    const evalConflict = evaluatePr(prConflict);
    assert.strictEqual(evalConflict.verdict, 'STOP');
    assert.strictEqual(evalConflict.isConflicting, true);

    const prFailedCi = {
      number: 103,
      title: 'chore(deps): bump vue from 3.5.0 to 3.5.1 in /frontend',
      headRefName: 'dependabot/npm_and_yarn/frontend/vue',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'Lint', status: 'COMPLETED', conclusion: 'FAILURE' }],
    };
    const evalFailed = evaluatePr(prFailedCi);
    assert.strictEqual(evalFailed.verdict, 'STOP');

    const prRunning = {
      number: 104,
      title: 'chore(deps): bump bar from 1.0.0 to 1.0.1',
      headRefName: 'dependabot/npm_and_yarn/bar',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'Build', status: 'IN_PROGRESS', conclusion: null }],
    };
    const evalRunning = evaluatePr(prRunning);
    assert.strictEqual(evalRunning.verdict, 'WAIT');
  });

  test('blocks skipped-only CI and flags major, actions, and critical runtime minor bumps as REVIEW', () => {
    const prAllSkipped = {
      number: 201,
      title: 'chore(deps): bump foo from 1.0.0 to 1.0.1',
      headRefName: 'dependabot/npm_and_yarn/foo',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [
        { name: 'Lint & Format Check', status: 'COMPLETED', conclusion: 'SKIPPED' },
        { name: 'E2E Required', status: 'COMPLETED', conclusion: 'SKIPPED' },
      ],
    };
    assert.strictEqual(evaluatePr(prAllSkipped).verdict, 'STOP');

    const prMissingE2e = {
      number: 202,
      title: 'chore(deps): bump foo from 1.0.0 to 1.0.1',
      headRefName: 'dependabot/npm_and_yarn/foo',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [
        { name: 'Lint & Format Check', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'E2E Required', status: 'COMPLETED', conclusion: 'SKIPPED' },
      ],
    };
    assert.strictEqual(evaluatePr(prMissingE2e).verdict, 'STOP');

    const prMajor = {
      number: 203,
      title: 'chore(deps): bump eslint from 9.0.0 to 10.0.0',
      headRefName: 'dependabot/npm_and_yarn/eslint',
      mergeable: 'MERGEABLE',
      statusCheckRollup: REQUIRED_PASSING_CHECKS,
    };
    const evalMajor = evaluatePr(prMajor);
    assert.strictEqual(evalMajor.verdict, 'REVIEW');
    assert.match(evalMajor.reason, /Major-Update/);

    const prCriticalMinor = {
      number: 204,
      title: 'chore(deps): bump fastify from 5.1.0 to 5.2.0 in /backend',
      headRefName: 'dependabot/npm_and_yarn/backend/fastify',
      mergeable: 'MERGEABLE',
      statusCheckRollup: REQUIRED_PASSING_CHECKS,
    };
    const evalCriticalMinor = evaluatePr(prCriticalMinor);
    assert.strictEqual(evalCriticalMinor.verdict, 'REVIEW');
    assert.match(evalCriticalMinor.reason, /Kritisches Runtime-Paket/);

    const prCriticalPatch = {
      number: 205,
      title: 'chore(deps): bump fastify from 5.1.0 to 5.1.1 in /backend',
      headRefName: 'dependabot/npm_and_yarn/backend/fastify',
      mergeable: 'MERGEABLE',
      statusCheckRollup: REQUIRED_PASSING_CHECKS,
    };
    assert.strictEqual(evaluatePr(prCriticalPatch).verdict, 'GO');

    const prActions = {
      number: 206,
      title: 'chore(deps): bump actions/checkout from 6.0.0 to 6.1.0',
      headRefName: 'dependabot/github_actions/actions/checkout-6',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [
        { name: 'Lint & Format Check', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ],
    };
    assert.strictEqual(evaluatePr(prActions).verdict, 'REVIEW');
  });

  test('sorts evaluated PRs by verdict and priority order', () => {
    const prs = [
      { verdict: 'STOP', prio: 1, number: 1 },
      { verdict: 'REVIEW', prio: 1, number: 5 },
      { verdict: 'GO', prio: 4, number: 2 },
      { verdict: 'GO', prio: 1, number: 3 },
      { verdict: 'GO', prio: 2, number: 4 },
    ];
    const sorted = sortEvaluatedPrs(prs);
    assert.strictEqual(sorted[0].number, 3);
    assert.strictEqual(sorted[1].number, 4);
    assert.strictEqual(sorted[2].number, 2);
    assert.strictEqual(sorted[3].number, 5);
    assert.strictEqual(sorted[4].number, 1);
  });

  test('generates markdown report cleanly including REVIEW badge', () => {
    const emptyMd = generateClearanceMarkdown([]);
    assert.match(emptyMd, /Keine offenen Dependabot-PRs vorhanden/);

    const fullMd = generateClearanceMarkdown([
      {
        number: 42,
        url: 'https://github.com/dmstern/reisotor/pull/42',
        target: 'backend',
        verdict: 'GO',
        ci: { state: 'PASSED', passed: 10, total: 10, failed: 0, pending: 0 },
        reason: 'Alle Checks bestanden.',
      },
      {
        number: 43,
        url: 'https://github.com/dmstern/reisotor/pull/43',
        target: 'root',
        verdict: 'REVIEW',
        ci: { state: 'PASSED', passed: 10, total: 10, failed: 0, pending: 0 },
        reason: 'Major-Update.',
      },
    ]);
    assert.match(fullMd, /Dependabot Clearance Report/);
    assert.match(fullMd, /\[#42\]/);
    assert.match(fullMd, /GO \(Freigegeben\)/);
    assert.match(fullMd, /REVIEW \(Manuell\)/);
    assert.match(fullMd, /1 manuelles Review/);
  });

  test('builds idempotent PR feedback comments and rebase checks', () => {
    const evaluation = {
      number: 887,
      target: 'frontend',
      verdict: 'STOP',
      reason: 'CI-Fehler in: E2E Tests (Shard 6/20)',
    };
    const comment = buildPrFeedbackComment(evaluation);
    const marker = comment.split('\n')[0];

    assert.strictEqual(shouldPostComment([], marker), true);
    assert.strictEqual(shouldPostComment([{ body: comment }], marker), false);
    assert.strictEqual(shouldRequestRebase([]), true);
    assert.strictEqual(shouldRequestRebase([{ body: '@dependabot rebase' }]), false);
    assert.strictEqual(
      shouldRequestRebase([{ body: '@dependabot rebase' }, { body: comment }]),
      true
    );
  });
});
