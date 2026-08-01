import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

let ref = 'unknown';
try {
  ref = execSync('git describe --tags --always', { cwd: rootDir }).toString().trim();
} catch {
  // Kein Git-Kontext beim Build (z. B. Release-Artefakt ohne .git-Verzeichnis) — 'unknown' bleibt.
}

const buildInfo = {
  version: pkg.version,
  ref,
  builtAt: new Date().toISOString(),
};

mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
