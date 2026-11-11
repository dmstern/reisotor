import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { checkNotes } from './check-release-notes.mjs';

describe('check-release-notes script', () => {
  test('validates correct formatting with canonical category heading', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'feature.md'),
        '### Reisen und Urlaube\n\n- ✨ **Tolles Feature**: Ein neues Feature für Urlaube.\n'
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
        '### Reisen und Urlaube\n\n- Kein Emoji und kein Schlagwort: Einfach so Text.\n'
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].type, 'FORMAT');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('flags non-canonical invented category headings', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'feature.md'),
        '### Touren & Spots\n\n- ✨ **Neuer Ort**: Beschreibung.\n'
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      assert.ok(result.errors.some((err) => err.type === 'INVALID_CATEGORY'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('flags missing category heading when filename is not a canonical slug', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'random-pr-name.md'),
        '- ✨ **Neuer Ort**: Beschreibung ohne Überschrift.\n'
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      assert.ok(result.errors.some((err) => err.type === 'MISSING_CATEGORY'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('flags technical jargon such as backticks, CSS variables, or issue numbers', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'feature.md'),
        [
          '### Design und Bedienung',
          '',
          '- ✨ **Button (#696)**: Nutzt nun `--color-surface` und `FormField` in `App.vue`.',
        ].join('\n')
      );

      const result = checkNotes({ pendingDir: tempDir, lastTag: 'v1.3.0', exitOnError: false });
      const jargonErrors = result.errors.filter((err) => err.type === 'TECHNICAL_JARGON');
      assert.ok(jargonErrors.length >= 3);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('passes cleanly on repository pending directory', () => {
    const result = checkNotes({ exitOnError: false });
    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.totalEntries >= 0);
  });
});
