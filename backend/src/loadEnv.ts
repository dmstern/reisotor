import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Lädt Umgebungsvariablen aus einer lokalen `.env`-Datei, sofern vorhanden.
 * Nutzt das native `process.loadEnvFile()` von Node.js (ab Node 20.12+).
 * Bestehende Umgebungsvariablen in `process.env` werden nicht überschrieben.
 * Im Test-Modus (`NODE_ENV === 'test'`) wird das automatische Laden bewusst übersprungen.
 */
export function loadEnv(customPaths?: string[]): void {
  if (process.env.NODE_ENV === 'test' && !customPaths) return;
  if (typeof process.loadEnvFile !== 'function') return;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = customPaths ?? [
    path.resolve(currentDir, '../.env'), // backend/.env
    path.resolve(currentDir, '../../.env'), // <root>/.env
    path.resolve(process.cwd(), '.env'), // .env im aktuellen Arbeitsverzeichnis
  ];

  const seen = new Set<string>();
  for (const envPath of candidatePaths) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
      } catch {
        // Ignorieren falls nicht lesbar oder ungültig
      }
    }
  }
}

loadEnv();
