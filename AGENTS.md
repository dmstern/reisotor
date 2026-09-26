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

- **Einzelne Tests ausführen (strikte Pflicht für Agenten):** `npx -y vitest run <pfad-zur-datei> --bail 1` bzw. `npx -y vitest run -t "<name>" --bail 1` (Backend/Frontend) oder `npx -y playwright test <pfad-zur-spec>` (E2E). Niemals gesamte Test-Suiten im Chat ausführen.
- **Voraussetzungen:** Node.js 20+ sowie `make`/`gcc`/`python3` für native Module (`better-sqlite3`, `bcrypt`). Volle Setup-/Deploy-/Env-Var-Details: `README.md`.

## UI-Audits & Layout-Testing

**Befehle für UI-Audits (Nur bei dedizierten Audits oder expliziter Aufforderung):**

- `npm run test:audit` - Adversarial UI-Layout-Audit mit Viewport- & Drawer-Matrix
- Bei gezielten UI-Audits: Route ermitteln und `AUDIT_ROUTE=<route> npm run test:audit` ausführen. **Nicht** bei normalen Bugfixes oder kleineren UI-Änderungen im Chat ausführen (erzeugt massive Test-Logs; für Standard-Änderungen reichen fokussierte Unit-Tests).
- **Vollständige Details:** `docs/UI_AUDIT_GUIDE.md` (Trigger-Phrasen, 3-Viewport-Regel, Adversarial Testing)
- **Prompt-Vorlagen:** `docs/AUDIT_PROMPTS.md` (Gezielter View-Audit, Pre-Release-Audit via Subagents)

## Typecheck, Linting & Formatting

Vor dem Commit gezielt prüfen (am Ende der Aufgabe, nicht nach jedem Zwischenschritt):

```bash
npm run typecheck    # Typecheck (Frontend)
npx -y eslint <geänderte-datei>  # Gezielt nur geänderte Dateien linten statt gesamtes Repo
```

**Wichtig für AI-Agenten:**

- **Zwingende Formatierung vor jedem Commit:** Da die CI-Pipeline bei Code-Style-Abweichungen (Prettier) fehlschlägt, MUSS vor jedem `git commit` zwingend der Code formatiert werden. Um hunderte Zeilen unnötigen Terminal-Output im Chat zu vermeiden, formatiere gezielt nur die geänderten Dateien: `npx -y prettier --write <pfad-zur-datei>`. Das Root-Skript `npm run format` (über 600 Dateien) nur nutzen, wenn viele Dateien über das Repo verteilt geändert wurden.
- **Saubere, semantische Commits:** Niemals fachfremde oder voneinander unabhängige Änderungen gesammelt in einem riesigen "Alles-in-einem-Rutsch"-Commit am Ende zusammenfassen. Ein zusammenhängendes Feature (inklusive benötigtem Backend, Store, UI und zugehörigen Tests) darf und soll zusammenhängend committet werden. Verschiedene fachliche Themen, Refactorings, Agent-Konfigurationen oder unabhängige Features (z. B. Budgets, Karten-Fix, Listen) müssen jedoch zwingend in separaten, semantischen Commits isoliert werden, damit die Git-Historie nachvollziehbar bleibt und Features bei Bedarf sauber einzeln revertiert werden können.
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

- **Fokus wahren (Kein ungefragter Scope-Creep):** Nur die für die konkrete Aufgabe notwendigen Dateien anpassen. Keine eigenmächtigen Umbauten in weiteren Komponenten starten, nur weil dort ein ähnliches Muster existiert.
- Bei Unklarheit, ob eine Folgeanpassung gewollt ist → nachfragen statt eigenmächtig den Scope aufblähen.
- **Keine CSS-Kopien zwischen Views** → Primitiv-Komponenten verwenden/extrahieren
- **`style.css` nur für globale Basis-Styles** → Komponenten-Styles gehören in die jeweilige `.vue`-Datei
- **Neue UI-Bausteine** → `DESIGN.md` konsultieren; Storybook-Stories (`*.stories.ts`) **nur anlegen, wenn explizit im Prompt gefordert**.
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

## Token-Effizienz & Kontext-Disziplin (Verbindlich)

Aufgrund des hohen Kontext-Volumens bei iterativer Agentenarbeit gelten strikte Regeln zur Minimierung von Token-Verbrauch und Context-Größe:

1. **Thread-Hygiene & Abschluss-Erinnerung (Keine Endlos-Chats):**
   - Ein Chat sollte sich auf **genau eine fachlich zusammenhängende Aufgabe** (Feature, Bugfix, Refactoring) beschränken (Richtwert: maximal 30–50 Schritte).
   - **Verbindliche Aufforderung:** Sobald ein PR/Feature/Bugfix fertiggestellt, committet oder dokumentiert ist, MUSS der Agent am Ende seiner Nachricht explizit folgenden Hinweis geben:
     > 💡 **Tipp zur Token-Ersparnis:** Diese Aufgabe ist abgeschlossen. Bitte starte für das nächste Thema einen neuen Chat, um unnötigen Kontext-Ballast und Token-Kosten zu vermeiden.
2. **Keine unfiltrierten Voll-Testsuiten im Chat:**
   - **NIEMALS** im Agenten-Chat `npm test`, `npm run test:all`, `npm run test:frontend` oder `npm run test:backend` ausführen, wenn nur einzelne Dateien oder Komponenten geändert wurden. Das flutet den Gesprächsverlauf mit hunderten Zeilen unnötigem Reporter-Output.
   - **Immer gezielt testen:** Ausschließlich die betroffene Datei mit `--bail 1` aufrufen: `npx -y vitest run <pfad-zur-datei> --bail 1`.
   - Bei E2E: Ausschließlich die konkrete Spec ansteuern: `npx -y playwright test <spec>`.
3. **Kompakte Terminal-Outputs & Paging-Vermeidung:**
   - Diffs immer zuerst mit `git diff --stat` prüfen statt riesige Diffs in voller Länge in den Chat zu kippen.
   - Shell-Befehle mit potenziell langen Listen (`find`, `grep`, `cat`, Logfiles) immer begrenzen (`| head -n 30`) oder dedizierte Tools (`grep_search`, `find_by_name`) mit Parametern nutzen.
4. **Gezielte Recherche statt explorativer Endlos-Loops:**
   - Vor blindem Durchsuchen des Codes immer zuerst `ARCHITECTURE.md` und die Code-Map konsultieren statt 10-mal blind per `list_dir` / `grep` das Repo abzusuchen.
   - Wenn ein Problem nach 2–3 Versuchen nicht gelöst ist: Innehalten, Hypothese formulieren oder gezielte Rückfrage an den Nutzer stellen, statt in einer Schleife 20 weitere Werkzeugaufrufe zu probieren.
5. **Strikte Sparsamkeit bei Subagenten & autonomem Teamwork:**
   - Keine eigenständigen Multi-Agent-Kaskaden oder unbeschränkten autonomen Schleifen (wie `/teamwork-preview` oder offene `/goal`-Tasks ohne klare Abbruchbedingung) starten.
   - Bei klar umrissenen Änderungen direkt `grep_search`/`view_file`/`replace_file_content` nutzen statt Subagenten zu spawnen — jeder Spawn re-deriviert den kompletten Kontext neu. Subagenten bleiben die seltene Ausnahme für isolierte, parallele Lese-Recherchen.
6. **Keine unaufgeforderten Screenshots (Massiver Token-Treiber):**
   - Screenshots (Scratch-Specs, Baseline-Updates) dürfen **niemals automatisch oder unaufgefordert** angefertigt werden, sondern ausschließlich auf expliziten Nutzer-Wunsch.
   - Bilddateien dürfen vom Agenten **niemals mit `view_file` geöffnet werden** (spült ~4.000 multimodale Tokens pro Bild in den Kontext). Bilder nur erzeugen, ablegen und im Chat/Walkthrough per Markdown verlinken.

## PR-Workflow

**PR-Merge-Regel:** PRs **nicht automatisch mergen** sobald CI grün ist — auf Review/Freigabe des Nutzers warten (visueller Check anhand Screenshots).

**Issues schließen:** `Fixes #101`, `Closes #102` etc. (englische Keywords vor jeder Issue-Nummer wiederholen).

**Screenshots & visuelle Verifikation im PR (Strikte On-Demand-Pflicht):**

- **Keine automatischen Screenshots im Standard-Workflow (Token-Schutz):**
  - Der Agent darf Screenshots (weder Baseline-Updates noch Scratch-Screenshots) **NIEMALS automatisch oder unaufgefordert** anfertigen.
  - Screenshots werden **ausschließlich auf explizite Aufforderung der Nutzerin / des Nutzers** erstellt (z. B. _"Erstelle bitte Vorher-/Nachher-Screenshots"_ oder _"Aktualisiere die Screenshots"_).
  - **Kein Selbst-Inspizieren per `view_file`:** Wenn der Nutzer Screenshots anfordert, erzeugt der Agent diese, legt sie ab und verlinkt sie per Markdown (`![Label](URL)`) im Chat oder Walkthrough zur Ansicht. Der Agent ruft **niemals `view_file` auf Bilddateien auf**, da jedes Bild ~4.000 multimodale Tokens in den permanenten Kontext spült. Die visuelle Prüfung erfolgt rein durch das menschliche Auge in der Benutzeroberfläche.
- **Baseline-Images (`docs/screenshots/`):** Bilden stets den aktuellen Produktionsstand aller relevanten Ansichten der gesamten App im Git-Repo ab (`<view>-desktop-light.png` etc.). Werden nur bei expliziter Aufforderung aktualisiert (oder komplett per `npm run generate:screenshots:docker`). Im PR per Markdown verlinken (GitHub bietet so automatischen Vorher-/Nachher-Bildvergleich im Diff; **Syntax-Falle:** `![Label](URL)` ohne Backticks um die URL).
- **Scratch-Screenshots für Detail-/Sonderfälle (nur bei expliziter Aufforderung):** Ist eine sichtbare UI-Änderung nicht durch die regulären Baseline-Images abgedeckt (z. B. ein einzelner Dialog, Teilkomponente, Hover-/Fehlerzustand) und der Nutzer wünscht explizit Screenshots:
  - Vorher- und Nachher-Screenshot anfertigen und **direkt im Chat/Walkthrough verlinken**, damit der Nutzer das Ergebnis prüfen und freigeben kann (ohne dass der Agent sie selbst per `view_file` liest).
  - Diese temporären Scratch-Screenshots gehören _nicht_ in `docs/screenshots/`, sondern können per GitHub-CLI (`gh`) als Attachment an den PR angehängt werden.

**Release-Notes:** Bei Endnutzer-relevanten Änderungen Fragment unter `release-notes/pending/<slug>.md` anlegen. Keine Fragmente für interne Änderungen (Tests, CI, Demo-Daten, Refactoring). **Duplikate token-sparend vermeiden:** Zuerst kurz die Dateinamen in `release-notes/pending/` auflisten. Falls eine Datei inhaltlich/thematisch ähnlich klingt (z. B. `*budget*` bei Budget-Änderungen), nur diese eine Datei gezielt lesen und ergänzen, statt ein neues Fragment zu erstellen. Nicht blind alle existierenden Fragmente komplett durchlesen. Format: Datei beginnt mit `### Themen-Überschrift`, dann `- 🎯 **Schlagwort**: Beschreibung` pro Punkt (Deutsch, verständlich für nicht-technische Endnutzer:innen, keine Komponentennamen/PR-Nummern). Jeder Stichpunkt MUSS mit passendem Emoji + fettgedrucktem Stichwort beginnen.

**Saubere, semantische Commits:** Änderungen dürfen **niemals** am Ende über verschiedene Themen hinweg in einem einzigen riesigen Commit ("alles in einem Rutsch") zusammengefasst werden. Stattdessen immer semantisch zusammenhängend committen: Ein Feature oder Bugfix darf und soll Backend-, Store-, UI- und Test-Änderungen in einem gemeinsamen Commit bündeln, sofern sie direkt zusammengehören. Unabhängige Features, unterschiedliche Domänen (z. B. Budgets, Karte, Listen) oder interne Aufgaben (Agent-Konfigurationen, Tooling, Docs) müssen jedoch in getrennten Commits festgehalten werden, um eine saubere, Feature für Feature nachvollzieh- und revertierbare Git-Historie zu gewährleisten. Jeder Commit muss für sich formatiert (`npm run format`), typgeprüft und lauffähig sein.

**Commit-Konvention:** `feat:`, `fix:`, `feat!:` für funktionale Änderungen. `chore:`, `refactor:`, `docs:` für interne Änderungen.
