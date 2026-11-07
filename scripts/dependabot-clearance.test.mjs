import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  evaluateCiStatus,
  evaluatePr,
  generateClearanceMarkdown,
  parsePrTarget,
  sortEvaluatedPrs,
} from './dependabot-clearance.mjs';

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
      parsePrTarget('chore(deps-dev): bump typescript-eslint', 'dependabot/npm_and_yarn/eslint'),
      'root'
    );
  });

  test('evaluates CI status correctly', () => {
    const checksPassed = [
      { name: 'Unit Tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'E2E Required', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ];
    assert.deepStrictEqual(evaluateCiStatus(checksPassed), {
      state: 'PASSED',
      passed: 2,
      failed: 0,
      pending: 0,
      total: 2,
      failedNames: [],
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

  test('evaluates PR verdict: GO, WAIT, STOP', () => {
    const prGo = {
      number: 101,
      title: 'chore(deps-dev): bump @types/node in /backend',
      headRefName: 'dependabot/npm_and_yarn/backend/node',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    };
    const evalGo = evaluatePr(prGo);
    assert.strictEqual(evalGo.verdict, 'GO');
    assert.strictEqual(evalGo.target, 'backend');

    const prConflict = {
      number: 102,
      title: 'chore(deps): bump foo',
      headRefName: 'dependabot/npm_and_yarn/foo',
      mergeable: 'CONFLICTING',
      statusCheckRollup: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    };
    const evalConflict = evaluatePr(prConflict);
    assert.strictEqual(evalConflict.verdict, 'STOP');

    const prFailedCi = {
      number: 103,
      title: 'chore(deps): bump vue in /frontend',
      headRefName: 'dependabot/npm_and_yarn/frontend/vue',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'Lint', status: 'COMPLETED', conclusion: 'FAILURE' }],
    };
    const evalFailed = evaluatePr(prFailedCi);
    assert.strictEqual(evalFailed.verdict, 'STOP');

    const prRunning = {
      number: 104,
      title: 'chore(deps): bump bar',
      headRefName: 'dependabot/npm_and_yarn/bar',
      mergeable: 'MERGEABLE',
      statusCheckRollup: [{ name: 'Build', status: 'IN_PROGRESS', conclusion: null }],
    };
    const evalRunning = evaluatePr(prRunning);
    assert.strictEqual(evalRunning.verdict, 'WAIT');
  });

  test('sorts evaluated PRs by verdict and priority order', () => {
    const prs = [
      { verdict: 'STOP', prio: 1, number: 1 },
      { verdict: 'GO', prio: 4, number: 2 }, // frontend
      { verdict: 'GO', prio: 1, number: 3 }, // root
      { verdict: 'GO', prio: 2, number: 4 }, // backend
    ];
    const sorted = sortEvaluatedPrs(prs);
    assert.strictEqual(sorted[0].number, 3); // Root GO
    assert.strictEqual(sorted[1].number, 4); // Backend GO
    assert.strictEqual(sorted[2].number, 2); // Frontend GO
    assert.strictEqual(sorted[3].number, 1); // STOP
  });

  test('generates markdown report cleanly', () => {
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
    ]);
    assert.match(fullMd, /Dependabot Clearance Report/);
    assert.match(fullMd, /\[#42\]/);
    assert.match(fullMd, /GO \(Freigegeben\)/);
  });
});
