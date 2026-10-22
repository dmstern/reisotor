import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { checkNotes } from './check-release-notes.mjs';

describe('check-release-notes script', () => {
  test('validates correct formatting', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'feature.md'),
        '### Test Feature\n\n- ✨ **Tolles Feature**: Ein neues Feature für Urlaube.\n'
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.totalEntries, 1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('flags invalid formatting without emoji or bold keyword', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'feature.md'),
        '### Test Feature\n\n- Kein Emoji und kein Schlagwort: Einfach so Text.\n'
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].type, 'FORMAT');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('passes cleanly on repository pending directory', () => {
    const result = checkNotes({ exitOnError: false });
    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.totalEntries > 0);
  });
});
