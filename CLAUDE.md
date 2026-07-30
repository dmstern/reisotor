# CLAUDE.md

Reisotor ist eine Vue 3 + Fastify-Web-App zur gemeinsamen Reiseplanung für zwei Personen (siehe
`README.md` für Features, Struktur und lokale Setup-/Deploy-Schritte). Diese Datei hält
Dev-Workflow-Konventionen für Claude Code fest, nicht das Setup selbst.

## Typecheck

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
cd frontend && npm run build   # führt vue-tsc --noEmit vor dem Vite-Build aus
```

## E2E-Tests (`/e2e`)

Committete Playwright-Suite, die beide Dev-Server automatisch startet und gegen eine frisch
geseedete, isolierte Test-Datenbank läuft (nie gegen echte Nutzdaten). Funktioniert identisch
lokal, in einer Cloud-Sandbox und wenn Claude Code direkt am GitHub-Repo arbeitet (z. B. über die
Claude-Mobile-App) — die gesamte Infrastruktur (Server-Autostart, Seed-Daten, Login) ist committet,
nicht an lokale Umgebungsdaten gebunden.

Läuft auf eigenen Ports (Backend 3100, Frontend 5273, via `CORS_ORIGIN`-Env-Var in
`backend/src/server.ts` konfigurierbar) — kollidiert nicht mit einem eventuell schon laufenden
echten lokalen Dev-Server auf 3000/5173, der muss dafür nicht gestoppt werden.

```bash
cd e2e
npm install                       # einmalig
npx playwright install chromium   # einmalig pro (frischer) Umgebung — lädt beim allerersten Lauf
                                   # das Browser-Binary herunter, kein Fehler/Hänger, nur einmaliger
                                   # Download
npm test                          # komplette Suite, startet/beendet beide Server automatisch
npx playwright show-report        # HTML-Report des letzten Laufs (u. a. Screenshots bei Fehlern)
```

### Wann einen neuen/aktualisierten Test schreiben?

Nicht nach jeder Anpassung. Die Suite ist ein Regressionsnetz für ein paar zentrale Abläufe
(Login-Gate, Kalender-Feature), keine vollständige Abdeckung. Einen Test ergänzen/anpassen, wenn
eine Änderung sichtbares Nutzerverhalten neu einführt oder grundlegend ändert und das wert ist,
gegen stille Regression abzusichern (Navigations-Logik, Positionierungs-/Layout-Bugs, Auth-Gating,
neue Kern-Abläufe). Triviale visuelle/Text-Anpassungen brauchen keinen neuen Test.

**Keine Pixel-Diff-Screenshot-Tests** (`toHaveScreenshot()`) verwenden — diese Dev-/Sandbox-Umgebung
ist von Playwright selbst als nicht offiziell unterstütztes OS markiert (Font-/Rendering-Drift
zwischen Maschinen macht Snapshot-Baselines unzuverlässig). Stattdessen Interaktion +
Zustands-/Sichtbarkeits-/BoundingBox-Assertions.

Datums-Annahmen aus `e2e/fixtures/seeded-data.json` lesen (wird zur Laufzeit von
`global-setup.ts` geschrieben), nicht hartcodieren — die Demo-Seed-Termine liegen relativ zu
"heute".

### Ad-hoc-Checks ("schau selbst nach, ob X funktioniert/gut aussieht")

Für spontane visuelle Verifikation einer einzelnen Änderung (kein dauerhafter Regressionstest):
eine kurze Wegwerf-Spec unter `e2e/tests/scratch/` schreiben (gitignored, nie committen), die zur
fraglichen Stelle navigiert, interagiert und `page.screenshot({ path: ... })` aufruft. Mit
`npx playwright test tests/scratch/<name>.spec.ts` ausführen (startet automatisch beide Server +
Login), den erzeugten Screenshot per Read-Tool selbst ansehen und bewerten, Datei danach löschen.
