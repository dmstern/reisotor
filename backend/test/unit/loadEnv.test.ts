import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/loadEnv.js';

describe('loadEnv', () => {
  let tmpDir: string;
  const envKeysToClean = ['TEST_ENV_VAR', 'TEST_ENV_VAR_2', 'EXISTING_VAR'];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-env-test-'));
  });

  afterEach(() => {
    for (const key of envKeysToClean) {
      delete process.env[key];
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('bricht im Test-Modus (NODE_ENV=test) ohne customPaths sofort ab und lädt keine Dateien', () => {
    process.env.NODE_ENV = 'test';
    const fakeEnv = path.join(tmpDir, '.env');
    fs.writeFileSync(fakeEnv, 'TEST_ENV_VAR=should_not_load\n');

    loadEnv();
    expect(process.env.TEST_ENV_VAR).toBeUndefined();
  });

  it('lädt Umgebungsvariablen aus angegebenen Pfaden', () => {
    const fakeEnv = path.join(tmpDir, '.env');
    fs.writeFileSync(fakeEnv, 'TEST_ENV_VAR_2=loaded_successfully\n');

    loadEnv([fakeEnv]);
    expect(process.env.TEST_ENV_VAR_2).toBe('loaded_successfully');
  });

  it('überschreibt bestehende Umgebungsvariablen nicht', () => {
    process.env.EXISTING_VAR = 'pre-existing-value';
    const fakeEnv = path.join(tmpDir, '.env');
    fs.writeFileSync(fakeEnv, 'EXISTING_VAR=new-value-from-env\n');

    loadEnv([fakeEnv]);
    expect(process.env.EXISTING_VAR).toBe('pre-existing-value');
  });

  it('ignoriert nicht existierende Pfade ohne Fehler', () => {
    expect(() => loadEnv(['/path/does/not/exist/.env'])).not.toThrow();
  });
});
