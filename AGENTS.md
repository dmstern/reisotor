# AGENTS.md

This file provides guidance to AI Coding Agents (Antigravity, Claude Code, Cursor AI, GitHub Copilot, etc.) when working with code in this repository.

Reisotor ist eine Vue 3 + Fastify-Web-App zur gemeinsamen Reiseplanung, ursprünglich für zwei
Personen pro Haushalt gebaut. Registrierung ist offen (E-Mail-Adresse, `routes/auth.ts`), Zugriff
auf einen Urlaub ist aber zusätzlich per Mitgliedschaft (`trip_members`) beschränkt — wer einen
Urlaub anlegt, ist zunächst allein darauf, weitere Personen müssen erst per Autocomplete-Suche
eingeladen werden. Siehe `README.md` für Features, lokale Setup-/Deploy-Schritte und
Umgebungsvariablen; **`ARCHITECTURE.md`** für die vollständige Architektur-Beschreibung (Backend,
Datenbank, Auth-Details, Frontend, Realtime/Offline, Deployment) **und eine Code-Map** (welche
Route/welcher Store/welche View zu welcher Domäne gehört) — beide Dateien werden nicht automatisch
geladen, bei Bedarf gezielt lesen statt den Code selbst zu explorieren/zu grep'en. Diese Datei hält
nur fest, was Claude Code bei **jeder** Session parat haben soll: Befehle und verbindliche
Arbeits-/Workflow-Konventionen.

## Setup & Befehle

Alle Workflows laufen zentral als Convenience-Skripte über die Root-[`package.json`](package.json) (`npm run dev`, `test`, `build`, `typecheck`, `lint`, `format`, `seed` etc.). Bei Bedarf direkt in `package.json` nachschlagen.

- **Einzelne Tests ausführen:** `npx -y vitest run <pfad-zur-datei>` bzw. `npx -y vitest run -t "<name>"` (Backend/Frontend) oder `npx -y playwright test <pfad-zur-spec>` (E2E).
- **Voraussetzungen:** Node.js 20+ sowie `make`/`gcc`/`python3` für native Module (`better-sqlite3`, `bcrypt`). Volle Setup-/Deploy-/Env-Var-Details: `README.md`.

## UI-Audits & Layout-Testing

**Kurz-Befehle für UI-Audits:**

- `npm run test:audit` - Adversarial UI-Layout-Audit mit Viewport- & Drawer-Matrix
- Bei UI-Änderungen: Route ermitteln und `AUDIT_ROUTE=<route> npm run test:audit` ausführen
- **Vollständige Details:** `docs/UI_AUDIT_GUIDE.md` (Trigger-Phrasen, 3-Viewport-Regel, Adversarial Testing)
- **Prompt-Vorlagen:** `docs/AUDIT_PROMPTS.md` (Gezielter View-Audit, Pre-Release-Audit via Subagents)

## Typecheck, Linting & Formatting

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
npm run typecheck    # aus dem Root (oder cd frontend && npm run typecheck)
npm run lint         # ESLint inkl. vuejs-accessibility
```

**Wichtig für AI-Agenten:**

- **Zwingende Formatierung vor jedem Commit:** Da die CI-Pipeline bei Code-Style-Abweichungen (Prettier) fehlschlägt, MUSS vor jedem `git commit` zwingend der Code formatiert werden. Führe dazu immer `npm run format` im Root-Verzeichnis aus, bevor du Änderungen committest. Es ist deutlich sauberer, wenn die korrekte Formatierung direkt Teil deines eigentlichen Feature- oder Bugfix-Commits ist, statt einen zusätzlichen "chore(Format)"-Commit oben auf den PR zu pushen.
- **Saubere, kleinteilige & semantische Commits:** Niemals alle Änderungen gesammelt in einem riesigen Commit am Ende ("alles in einem Rutsch") zusammenfassen. Immer kleinteilig, sauber und semantisch getrennt committen (Backend, Store, UI, Tests/Docs separat).
- Immer `npm run typecheck` oder `npm --prefix frontend run typecheck` bzw. `npm run build` nutzen statt Roh-Aufrufen von `npx vue-tsc`.
- **Niemals interaktive `npx`-Aufrufe ohne `-y` / `--yes` starten!** Falls `npx` Pakete nachinstallieren will, fordert es eine interaktive Bestätigung an (`Need to install the following packages: ... Ok to proceed? (y)`), was in Hintergrundprozessen/Subagenten ohne TTY zum dauerhaften Aufhängen führt.
- Falls `npm run build` abbricht mit `vue-tsc: Kommando nicht gefunden`, zuerst `cd frontend && npm install` ausführen.
- Falls `npx` zwingend für Befehle genutzt werden muss, immer die Option `-y` mitgeben (`npx -y ...`).

## Clean Code, Software-Design & Konsistenz (SoC, SRP, DRY, KISS)

Für alle Änderungen gelten folgende Software-Design-Prinzipien als verbindliche Richtschnur:

- **Clean Code**: Selbsterklärend, leicht lesbar, intentionsklar. Aussagekräftige Namen, keine magischen Zahlen/Strings, kleine fokussierte Funktionen, kein toter Code.
- **Separation of Concerns (SoC)**: Views → Darstellung/Layout; Pinia-Stores → globaler Zustand; Composables/Utils → fachliche Logik; Primitives → generische UI-Bausteine; Backend → Request-Handling/DB.
- **SRP**: Jede Komponente/Funktion hat genau eine Aufgabe.
- **KISS & YAGNI**: Einfachste Lösung wählen, kein Über-Engineering, bestehende App-Muster nutzen.
- **DRY**: Keine redundanten Kopien. Wiederverwendbare Logik → Composable/Utility/Primitiv-Komponente.

**Konsistenz-Check bei Änderungen:**

- Grep nach identischen Icons/Konzepten/Mustern im Rest der App
- Offensichtlich sinnvolle Folgeanpassung → direkt mit umsetzen
- Unklar ob gewollt → nachfragen statt eigenmächtig entscheiden
- **Keine CSS-Kopien zwischen Views** → Primitiv-Komponenten verwenden/extrahieren
- **`style.css` nur für globale Basis-Styles** → Komponenten-Styles gehören in die jeweilige `.vue`-Datei
- **Neue UI-Bausteine** → `DESIGN.md` konsultieren, Storybook-Story anlegen
- **Standard-CSS** statt manueller Webkit-Präfixe (LightningCSS macht Autoprefixing)

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` braucht diesen Check:

1. **Ist das schon in Prod live?** `git merge-base` gegen letzten Release-Tag prüfen
2. **Rein additiv bleiben:** `ensureColumn` (nullable/DEFAULT), `CREATE TABLE IF NOT EXISTS`
3. **Vor `dropColumnIfExists`: Backfill** falls Spalte echte Werte haben könnte
4. **Reihenfolge beachten:** Migrationen laufen gegen tatsächlichen DB-Zustand
5. **Migrationstest ergänzen** analog zu `backend/test/unit/dbMigration.test.ts`

Der Rollout-Mechanismus existiert: Backend führt `db/index.ts` bei jedem Start aus, wendet additive Migrationen automatisch an.

## Unit-Tests & E2E-Tests

**Unit-Tests:** Vitest (Backend: `:memory:` SQLite pro Datei; Frontend: isoliert). Laufen in CI vor Build. Regressionsnetz für echte Logik, keine Vollabdeckung.

**E2E-Tests:** Playwright mit Auto-Server-Start. Eigene Ports (3100/5273), isolierte Test-DB, committet. Accessibility-Tests via Axe (`npm run test:a11y`). Token-sparend nur gezielt nutzen:

- `npx -y playwright test <spec>` für einzelne Tests
- Bei CI-Fehlschlag lokal reproduzieren
- Scratch-Specs für Ad-hoc-Checks/PR-Screenshots

**Bestehende Tests bei Änderungen immer mit anpassen!** Neue persistente Tests nur vorschlagen, nicht unaufgefordert schreiben. Keine Pixel-Diff-Tests (`toHaveScreenshot()`) in die Haupt-Suite — stattdessen Interaktion + funktionale Assertions. Scratch-Specs vor `page.goto(...)` immer `forceFontDisplayBlock(page)` aufrufen (sonst Fallback-Font statt Fira Sans). Datums-Annahmen aus `e2e/fixtures/seeded-data.json` lesen, nicht hartcodieren.

## Sparsam mit Subagenten

Bei klar umrissenen Änderungen direkt grep/Read/Edit verwenden statt Explore-/Plan-Subagent spawnen — jeder Spawn re-deriviert kompletten Kontext neu und kostet oft mehr Tokens als direkte Suche. Subagenten bleiben sinnvoll bei unklarem/großem Scope oder parallelen unabhängigen Bereichen.

## PR-Workflow

**PR-Merge-Regel:** PRs **nicht automatisch mergen** sobald CI grün ist — auf Review/Freigabe des Nutzers warten (visueller Check anhand Screenshots).

**Issues schließen:** `Fixes #101`, `Closes #102` etc. (englische Keywords vor jeder Issue-Nummer wiederholen).

**Screenshots & visuelle Verifikation im PR:**

- **Baseline-Images (`docs/screenshots/`):** Bilden stets den aktuellen Produktionsstand aller relevanten Ansichten der gesamten App im Git-Repo ab. Sie folgen einem festen Schema (`<view>-desktop-light.png`, `<view>-mobile-dark.png` etc.) und werden bei Änderungen direkt aktualisiert (oder komplett per `npm run generate:screenshots:docker`). **Niemals willkürliche neue Dateinamen erfinden oder blind dort ablegen.** Im PR per Markdown verlinken (GitHub bietet so automatischen Vorher-/Nachher-Bildvergleich im Diff; **Syntax-Falle:** `![Label](URL)` ohne Backticks um die URL).
- **Scratch-Screenshots für Detail-/Sonderfälle:** Ist eine sichtbare UI-Änderung nicht durch die regulären Baseline-Images abgedeckt (z. B. ein einzelner Dialog, Teilkomponente, Hover-/Fehlerzustand):
  - Vorher- und Nachher-Screenshot anfertigen und **zuerst direkt im Chat/Walkthrough anzeigen**, damit der Nutzer das Ergebnis vorab prüfen und freigeben kann.
  - Diese temporären Scratch-Screenshots gehören _nicht_ in `docs/screenshots/`, sondern können per GitHub-CLI (`gh`) als Attachment an den PR angehängt werden.

**Release-Notes:** Bei Endnutzer-relevanten Änderungen Fragment unter `release-notes/pending/<slug>.md` anlegen. Keine Fragmente für interne Änderungen (Tests, CI, Demo-Daten, Refactoring). **VOR dem Anlegen bestehende Fragmente lesen** und ggf. ergänzen statt doppelt anlegen. Format: Datei beginnt mit `### Themen-Überschrift`, dann `- 🎯 **Schlagwort**: Beschreibung` pro Punkt (Deutsch, verständlich für nicht-technische Endnutzer:innen, keine Komponentennamen/PR-Nummern). Jeder Stichpunkt MUSS mit passendem Emoji + fettgedrucktem Stichwort beginnen.

**Saubere, kleinteilige & semantische Commits:** Änderungen dürfen **niemals** am Ende gesammelt in einem einzigen riesigen Commit ("alles in einem Rutsch") zusammengefasst werden. Stattdessen immer kleinteilig, sauber und semantisch zusammenhängend committen (z. B. Backend/Datenmodell, Store/Logik, UI/Komponente, Tests/Refactorings separat committen). Jeder Commit muss für sich formatiert (`npm run format`), typgeprüft und funktionsfähig sein.

**Commit-Konvention:** `feat:`, `fix:`, `feat!:` für funktionale Änderungen. `chore:`, `refactor:`, `docs:` für interne Änderungen.
