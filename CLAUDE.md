# CLAUDE.md

Reisotor ist eine Vue 3 + Fastify-Web-App zur gemeinsamen Reiseplanung für zwei Personen (siehe
`README.md` für Features, Struktur und lokale Setup-/Deploy-Schritte). Diese Datei hält
Dev-Workflow-Konventionen für Claude Code fest, nicht das Setup selbst.

## Typecheck

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
cd frontend && npm run build   # führt vue-tsc --noEmit vor dem Vite-Build aus
```

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` (neue/entfernte Spalte oder Tabelle, umgebautes
Feld) braucht diesen Check, bevor sie als fertig gilt — nicht erst, wenn explizit danach gefragt
wird:

1. **Ist das schon in Prod live?** Prüfen, ob die betroffene Spalte/Tabelle bereits Teil des
   letzten Prod-Deploys ist: `git merge-base origin/prod HEAD` (bzw. `origin/main`, falls der
   Branch von dort abzweigt) gibt den letzten gemeinsamen Commit; ein `git diff <dieser-commit>
   HEAD -- backend/src/db/index.ts` zeigt, was seitdem am Schema geändert wurde. Alles, was schon
   vorher drin war, kann echte Nutzdaten auf der echten `data.sqlite` enthalten (die App wird
   aktiv von zwei echten Nutzer:innen für echte Reiseplanung verwendet).
2. **Rein additiv bleiben, wo möglich.** Neue Spalten/Tabellen nur über `ensureColumn` (nullable
   oder mit `DEFAULT`) bzw. `CREATE TABLE IF NOT EXISTS` — nie eine bestehende Tabelle mit einer
   `NOT NULL`-Spalte ohne Default versehen.
3. **Vor jedem `dropColumnIfExists`/Rename einer schon live gewesenen Spalte: Backfill davor.**
   Falls die Spalte echte Werte tragen könnte, deren fachliche Bedeutung im neuen Modell woanders
   landet, muss ein Backfill (`INSERT`/`UPDATE`) diese Werte migrieren, bevor die Spalte fällt —
   sonst gehen sie beim nächsten Deploy kommentarlos verloren. Muster: `if (hasColumn(table, col))
   { db.exec('INSERT/UPDATE ...'); dropColumnIfExists(table, col); }` (siehe die
   `packing_items.checked`- bzw. `ideas.date`-Migration in `backend/src/db/index.ts` als Vorlage).
   Ein reiner No-Op-Drop (Spalte war nie live oder nie befüllt) braucht keinen Backfill.
4. **Reihenfolge im Skript beachten.** Migrationen laufen beim Backend-Start synchron in
   Datei-Reihenfolge gegen den *tatsächlichen* aktuellen DB-Zustand, nicht gegen den Skript-Text.
   Ein Backfill, der eine Spalte braucht, die selbst erst weiter unten per `ensureColumn` ergänzt
   wird, muss hinter diese Stelle gesetzt werden — sonst schlägt er auf einer frischen/Test-DB mit
   `no such column` fehl (auf der echten Prod-DB fällt das nicht auf, weil die Spalte dort durch
   frühere Deploys schon längst existiert).
5. **Migrationstest ergänzen.** Für jeden Backfill einen Test analog zu
   `backend/test/unit/dbMigration.test.ts` schreiben: alten Schema-Stand in einer temporären
   SQLite-Datei nachbauen, `db/index.ts` importieren lassen und prüfen, dass die Daten im neuen
   Modell wiederzufinden sind.

Der eigentliche Rollout-Mechanismus dafür existiert schon und braucht keine separate
Migrations-Pipeline: `deploy.sh` und die Pi-Cronjob-Skripte schließen `*.sqlite*` explizit von
`rsync --delete` aus, die Datenbank wird also nie überschrieben. Der Backend-Prozess führt
`db/index.ts` bei jedem Neustart erneut aus, wendet die additiven Migrationen (und ggf. Backfills)
automatisch auf die bestehende Datei an. Schema-Änderungen im Code committen reicht also aus —
kein manueller Migrationsschritt auf dem Server nötig.

## Unit-Tests (`backend/test/`, `frontend/src/**/*.test.ts`)

Vitest auf beiden Seiten, unabhängig konfiguriert (Backend: `backend/vitest.config.ts`; Frontend:
`test`-Key in `frontend/vite.config.ts`). Laufen ohne Browser/Server, deterministisch und schnell —
laufen deshalb automatisch in CI, direkt vor dem jeweiligen Build-Schritt in
`.github/workflows/build-deploy.yml`. Ein fehlschlagender Unit-Test verhindert damit sowohl den
`main`→Staging- als auch den `prod`→Produktions-Deploy (die E2E-Suite unten läuft im selben
Workflow ebenfalls automatisch und gated genauso, ist nur spürbar langsamer wegen Browser-Start).

```bash
cd backend && npm test    # bzw. npm run test:watch für Watch-Mode
cd frontend && npm test
```

Backend-Tests laufen gegen eine isolierte `:memory:`-SQLite-Instanz pro Testdatei (siehe
`backend/test/helpers/buildTestApp.ts`), nie gegen echte Nutzdaten oder `data.sqlite`. Isolation ist
bewusst pro Testdatei, nicht pro einzelnem Test (`beforeAll` statt `beforeEach`) — Tests innerhalb
einer Datei legen dafür jeweils eigene, eindeutig identifizierbare Ressourcen an, statt sich auf
eine leere Tabelle zu verlassen. Bei wachsender Suite ließe sich das mit `vi.resetModules()` in
`beforeEach` auf echte Pro-Test-Isolation umstellen.

`backend/src/utils/mapsLink.ts`s `resolveLatLng()` hat einen echten `fetch()`-Fallback (Kurzlink-
Redirect-Auflösung, 5s Timeout) — bleibt bewusst ungetestet (würde Netzwerk-Mocking brauchen, für
einen Best-Effort-Fallback aktuell nicht des Aufwands wert). Der direkte Parse-Pfad davor
(`parseLatLngFromText`) ist dagegen vollständig getestet.

### Umfang: Regressionsnetz statt Vollabdeckung

Dieselbe Philosophie wie bei der E2E-Suite unten ("Wann einen neuen/aktualisierten Test
schreiben?"): Regressionsnetz für echte Logik (Berechnungen, Regex-Parsing, Auth-Gating), keine
vollständige Abdeckung jeder Route/Funktion. Reine CRUD-Routen ohne Verzweigungslogik brauchen i. d.
R. keinen eigenen Test.

## E2E-Tests (`/e2e`)

Ergänzt die schnellen, browserlosen Unit-Tests oben um echte Klick-Interaktionen durch einen
Browser. Committete Playwright-Suite, die beide Dev-Server automatisch startet und gegen eine frisch
geseedete, isolierte Test-Datenbank läuft (nie gegen echte Nutzdaten). Funktioniert identisch
lokal, in einer Cloud-Sandbox und wenn Claude Code direkt am GitHub-Repo arbeitet (z. B. über die
Claude-Mobile-App) — die gesamte Infrastruktur (Server-Autostart, Seed-Daten, Login) ist committet,
nicht an lokale Umgebungsdaten gebunden.

Läuft auf eigenen Ports (Backend 3100, Frontend 5273, via `CORS_ORIGIN`-Env-Var in
`backend/src/server.ts` konfigurierbar) — kollidiert nicht mit einem eventuell schon laufenden
echten lokalen Dev-Server auf 3000/5173, der muss dafür nicht gestoppt werden.

Läuft außerdem automatisch in CI (`.github/workflows/build-deploy.yml`, nach den Unit-Tests, vor dem
Assemble-Schritt) — bei einem Fehlschlag wird als Artefakt der HTML-Report samt Screenshots
hochgeladen (`playwright-report`/`test-results`), abrufbar über den jeweiligen Workflow-Run.

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
