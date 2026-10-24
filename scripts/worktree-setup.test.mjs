import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import {
  detectWorktreeContext,
  ensureDatabase,
  ensureEnv,
  ensureSymlinks,
  setupWorktree,
} from './worktree-setup.mjs';

describe('worktree-setup script', () => {
  test('detects worktree context in current repository', () => {
    const context = detectWorktreeContext();
    assert.ok(context.mainRepoDir);
    assert.ok(context.currentDir);
    // In our active worktree branch this should be true
    assert.strictEqual(typeof context.isWorktree, 'boolean');
  });

  test('ensureSymlinks creates symlinks for node_modules directories', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
    try {
      const mainRepo = path.join(tempDir, 'main');
      const worktree = path.join(tempDir, 'worktree');

      // Setup source directories in simulated main
      fs.mkdirSync(path.join(mainRepo, 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(mainRepo, 'backend', 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(mainRepo, 'frontend', 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(mainRepo, 'e2e', 'node_modules'), { recursive: true });

      fs.mkdirSync(worktree, { recursive: true });

      const silentLogger = { log() {}, warn() {}, error() {} };

      const res = ensureSymlinks({
        currentDir: worktree,
        mainRepoDir: mainRepo,
        logger: silentLogger,
      });

      assert.strictEqual(res.createdCount, 4);
      assert.strictEqual(res.existingCount, 0);
      assert.strictEqual(res.missingInMain.length, 0);

      // Verify symlinks exist and point to main
      assert.ok(fs.lstatSync(path.join(worktree, 'node_modules')).isSymbolicLink());
      assert.ok(fs.lstatSync(path.join(worktree, 'backend', 'node_modules')).isSymbolicLink());
      assert.ok(fs.lstatSync(path.join(worktree, 'frontend', 'node_modules')).isSymbolicLink());
      assert.ok(fs.lstatSync(path.join(worktree, 'e2e', 'node_modules')).isSymbolicLink());

      // Running a second time should not recreate but count as existing
      const res2 = ensureSymlinks({
        currentDir: worktree,
        mainRepoDir: mainRepo,
        logger: silentLogger,
      });
      assert.strictEqual(res2.createdCount, 0);
      assert.strictEqual(res2.existingCount, 4);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('ensureSymlinks handles missing folders in main repository gracefully', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
    try {
      const mainRepo = path.join(tempDir, 'main');
      const worktree = path.join(tempDir, 'worktree');

      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(worktree, { recursive: true });

      const silentLogger = { log() {}, warn() {}, error() {} };

      const res = ensureSymlinks({
        currentDir: worktree,
        mainRepoDir: mainRepo,
        logger: silentLogger,
      });

      assert.strictEqual(res.createdCount, 0);
      assert.strictEqual(res.missingInMain.length, 4);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('ensureEnv copies .env if present in main and absent in worktree', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
    try {
      const mainRepo = path.join(tempDir, 'main');
      const worktree = path.join(tempDir, 'worktree');

      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(worktree, { recursive: true });

      fs.writeFileSync(path.join(mainRepo, '.env'), 'SECRET_KEY=123\n');

      const silentLogger = { log() {}, warn() {}, error() {} };

      const copied = ensureEnv({
        currentDir: worktree,
        mainRepoDir: mainRepo,
        logger: silentLogger,
      });

      assert.strictEqual(copied, true);
      assert.strictEqual(fs.readFileSync(path.join(worktree, '.env'), 'utf-8'), 'SECRET_KEY=123\n');

      // Second run: already exists, should not copy
      const copiedAgain = ensureEnv({
        currentDir: worktree,
        mainRepoDir: mainRepo,
        logger: silentLogger,
      });
      assert.strictEqual(copiedAgain, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('ensureDatabase triggers seed when database does not exist', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
    try {
      fs.mkdirSync(path.join(tempDir, 'backend'), { recursive: true });

      let seedCalled = false;
      let seedForceArg = false;

      const silentLogger = { log() {}, warn() {}, error() {} };

      ensureDatabase({
        currentDir: tempDir,
        force: false,
        seedFn: ({ force }) => {
          seedCalled = true;
          seedForceArg = force;
          fs.writeFileSync(path.join(tempDir, 'backend', 'data.sqlite'), 'dummy db content');
        },
        logger: silentLogger,
      });

      assert.strictEqual(seedCalled, true);
      assert.strictEqual(seedForceArg, false);

      // Second run: database now exists, should not seed
      let seedCalledSecond = false;
      ensureDatabase({
        currentDir: tempDir,
        force: false,
        seedFn: () => {
          seedCalledSecond = true;
        },
        logger: silentLogger,
      });
      assert.strictEqual(seedCalledSecond, false);

      // Force run: should seed even if database exists
      let seedCalledForce = false;
      ensureDatabase({
        currentDir: tempDir,
        force: true,
        seedFn: ({ force }) => {
          seedCalledForce = true;
          assert.strictEqual(force, true);
        },
        logger: silentLogger,
      });
      assert.strictEqual(seedCalledForce, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('setupWorktree runs full flow with mock seed function', () => {
    const silentLogger = { log() {}, warn() {}, error() {} };
    let _seedCalled = false;
    const context = setupWorktree({
      seedFn: () => {
        _seedCalled = true;
      },
      logger: silentLogger,
    });
    assert.ok(context.currentDir);
    assert.strictEqual(typeof context.isWorktree, 'boolean');
  });
});
