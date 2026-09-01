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

```bash
# Root-Convenience-Befehle (können direkt aus dem Wurzelverzeichnis ausgeführt werden)
npm run dev             # Backend & Frontend parallel starten (concurrently)
npm run dev:backend     # Nur Backend Dev-Server starten (http://localhost:3000)
npm run dev:frontend    # Nur Frontend Dev-Server starten (http://localhost:5173)
npm run dev:demo        # Frontend im backend-losen Demo-Modus starten
npm run seed            # DB Seed (idempotent, 2 Nutzer + leere Trip-Zeile)
npm run seed:demo       # DB Seed (kompletter Beispiel-Urlaub)
npm run typecheck       # Frontend Typecheck (vue-tsc --noEmit)
npm run typecheck:all   # Typecheck für Frontend + Backend
npm run test            # Backend & Frontend Unit-Tests
npm run test:backend    # Backend Unit-Tests (vitest run)
npm run test:frontend   # Frontend Unit-Tests (vitest run)
npm run test:e2e        # E2E-Tests (playwright test)
npm run test:a11y       # Accessibility-Tests mit Axe (playwright test tests/accessibility.spec.ts)
npm run test:all        # Backend + Frontend + E2E Tests
npm run build           # Backend + Frontend Build
npm run build:backend   # Backend Build (tsc -> backend/dist)
npm run build:frontend  # Frontend Build (vue-tsc --noEmit + vite build -> frontend/dist)
npm run build:demo      # Demo-Mode Statik-Build
npm run build:landing   # Landingpage Statik-Build
npm run generate:screenshots # Generiert saubere Prod Baseline-Screenshots in Full HD unter docs/screenshots/

# Backend (Fastify + TypeScript + better-sqlite3, /backend)
cd backend
npm install
npm run seed        # legt 2 Nutzer + leere Trip-Zeile an (idempotent)
npm run seed:demo   # zusätzlich kompletter Beispiel-Urlaub mit Daten in allen Bereichen
npm run dev         # tsx watch auf http://localhost:3000
npm run build       # tsc -> backend/dist
npm test            # vitest run; npm run test:watch für Watch-Mode

# Frontend (Vite + Vue 3 + TypeScript, /frontend)
cd frontend
npm install
npm run dev      # Vite auf http://localhost:5173, proxied /api ans Backend
npm run dev:demo # Vite im backend-losen Demo-Modus (Hot-Reloading, kein Backend nötig)
npm run build    # vue-tsc --noEmit + vite build -> frontend/dist
npm test         # vitest run

# E2E (Playwright, /e2e) — siehe eigener Abschnitt unten
cd e2e && npm install && npx -y playwright install chromium && npm test
```

Einzelnen Test ausführen: `npx -y vitest run <pfad-zur-datei>` bzw. `npx -y vitest run -t "<name>"`
(aus `backend/` oder `frontend/`); für E2E `npx -y playwright test <pfad-zur-spec>` aus `e2e/`.

Node.js 20+ sowie `make`/`gcc`/`python3` nötig (native Module `better-sqlite3`, `bcrypt`). Volle
Setup-/Deploy-/Env-Var-Details: `README.md`.

## Typecheck & Linting

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
npm run typecheck    # aus dem Root (oder cd frontend && npm run typecheck)
npm run lint         # ESLint inkl. vuejs-accessibility
```

**Wichtig für AI-Agenten:**

- Immer `npm run typecheck` oder `npm --prefix frontend run typecheck` bzw. `npm run build` nutzen statt Roh-Aufrufen von `npx vue-tsc`.
- **Niemals interaktive `npx`-Aufrufe ohne `-y` / `--yes` starten!** Falls `npx` Pakete nachinstallieren will, fordert es eine interaktive Bestätigung an (`Need to install the following packages: ... Ok to proceed? (y)`), was in Hintergrundprozessen/Subagenten ohne TTY zum dauerhaften Aufhängen führt.
- Falls `npm run build` abbricht mit `vue-tsc: Kommando nicht gefunden`, zuerst `cd frontend && npm install` ausführen.
- Falls `npx` zwingend für Befehle genutzt werden muss, immer die Option `-y` mitgeben (`npx -y ...`).

## Sparsam mit Subagenten

Bei klar umrissenen Änderungen in diesem Repo (bekannte Datei(en)/Fehlermeldung, überschaubarer
Scope) direkt grep/Read/Edit verwenden statt einen Explore-/Plan-Subagenten zu spawnen — jeder
Spawn re-derived den kompletten Kontext neu und kostet dadurch oft mehr Tokens als die direkte
Suche selbst. Subagenten bleiben sinnvoll, wenn der Scope tatsächlich unklar/groß ist oder mehrere
unabhängige Bereiche parallel durchsucht werden müssen — dort leidet sonst die Trefferquote.

## Marketing-Landingpage + Demo-Build (GitHub Pages)

Neben dem normalen `npm run build` (echtes Backend-Deploy, siehe `.github/workflows/ci.yml`)
gibt es zwei zusätzliche statische Frontend-Builds für GitHub Pages (`frontend/landing.html`+
`frontend/src/views/LandingView.vue` sowie einen backend-losen Demo-Modus, siehe
`frontend/src/demo/`), veröffentlicht über `.github/workflows/pages-deploy.yml` bei jedem
Prod-Release-Tag. `frontend/npm run build:landing`/`build:demo` lokal bauen, `npm run dev:demo`
(oder `VITE_DEMO_MODE=true npm run dev`) für den Demo-Modus gegen den normalen Dev-Server. Bei PRs mit größeren UI-/Feature-
Änderungen prüfen, ob `frontend/public/landing/*`-Screenshots und die Feature-Texte in
`LandingView.vue` noch aktuell sind (Screenshot-Flow: kurze Playwright-Scratch-Spec wie bei den
PR-Screenshots, siehe unten) — bewusst nur als manueller Hinweis, kein CI-Enforcement.

Beim Neuaufnehmen von `frontend/public/landing/screenshot-dashboard-*`/`screenshot-mobile-*`
(gegen `VITE_DEMO_MODE=true npm run dev`, siehe oben) auf folgende Checkliste achten — sonst
schleichen sich Demo-/Dev-Artefakte ein, die im echten Marketing-Bild nichts verloren haben:

- **Wetter sichtbar**: `utils/weather.ts`'s `fetchWeatherForecast()` liefert im Demo-Modus
  (`DEMO_MODE`) ein festes Fake-Muster statt eines echten Open-Meteo-Fetches (der im Sandbox-Playwright
  ohne Internetzugriff sonst scheitert und "Wetterdaten konnten nicht geladen werden" zeigt) — sollte
  das je entfernt/geändert werden, sicherstellen, dass die Wetter-Karte im Screenshot trotzdem gefüllt ist.
- **Theme-Variante**: je einen Screenshot mit `colorScheme: 'light'` UND `'dark'` aufnehmen
  (`browser.newPage({ colorScheme })` in Playwright) — `LandingView.vue` bindet sie per
  `<picture>`/`<source media="(prefers-color-scheme: dark)">` ein.
- **Demo-Banner ausblenden**: `.demo-banner { display: none !important; }` per
  `page.addStyleTag(...)` vor dem Screenshot — der Banner ist ein Hinweis für die echte Live-Demo,
  kein gewollter Bestandteil des Marketing-Bilds.
- **PWA-Installationshinweis ausblenden**: ebenso `.pwa-pill.install { display: none !important; }`.
- **Kein DEV-Badge/keine orange Header-Umrandung**: setzt voraus, dass `demoClient.ts`'s
  `/build-info`-Stub `environment: 'production'` liefert (siehe Issue #219) — bei einem lokalen Demo-
  Dev-Server sollte das automatisch der Fall sein, sofern `main` aktuell ist.

## Konsistenz-Check bei Änderungen

Die App ist über viele Sessions gewachsen; dasselbe Konzept (Icon, Bezeichnung, Layout-/
Verhaltensmuster, Datenmodell-Feld) taucht oft an mehreren Stellen zugleich auf, ohne dass das
zentral dokumentiert ist. Bei jeder Änderung an UI-Bausteinen oder am Datenmodell
(`backend/src/db/index.ts`, `api/types.ts`) deshalb aktiv prüfen, ob dasselbe Muster noch anderswo
vorkommt (kurz grep auf Icon/Bezeichner/Komponente, nicht nur an der ursprünglich angefragten
Stelle):

- **Offensichtlich sinnvolle Folgeanpassung** (identisches Icon/Konzept an anderer Stelle, exakt
  gleiches Bug-Muster, klar auf dieselbe Baustelle begrenzt): direkt mit umsetzen, danach kurz
  erwähnen, was zusätzlich angepasst wurde — nicht vorher nachfragen.
- **Unklar, ob gewollt** (könnte an der anderen Stelle bewusst abweichen, größerer Umbau nötig,
  oder Konsistenz-Potenzial über eine 1:1-Wiederholung hinaus wie eine App-weite Vereinheitlichung
  mehrerer Views mit bisher unterschiedlichem Muster): die Beobachtung nennen und (z. B. per
  `AskUserQuestion`) nachfragen statt eigenmächtig zu entscheiden oder mitzuändern.

**Neue UI-Bausteine/Design-Anforderungen** (nicht nur reines Bugfix-Nachziehen): vor dem Bauen aktiv
im Rest der App nachschauen, was es dafür schon gibt (grep auf ähnliche Komponenten/Klassen/
Konzepte), statt eine zweite, leicht abweichende Variante danebenzubauen — siehe `DESIGN.md`,
Abschnitt "Konsistenz", für konkret schon aufgetretene Fälle (native `<select>` vs. custom
`Combobox.vue`, mehrere parallele Label-Stile, uneinheitliche Filter-/Gruppieren-/Sortieren-
Präsentation je View). Beim Erstellen neuer wiederverwendbarer UI-Komponenten (`frontend/src/components/*.vue`)
immer direkt eine zugehörige Storybook-Story-Datei (`*.stories.ts`) anlegen, damit Zustände der Komponente
isoliert getestet und dokumentiert sind.

Für Datenmodell-Änderungen gilt zusätzlich der Migrations-Check im nächsten Abschnitt. Bei neuen
UI-Elementen oder sichtbaren UI-Anpassungen zusätzlich `DESIGN.md` (Projekt-Root) konsultieren —
hält Farben/Abstände/Eckenrundung (Squircle-Prinzip)/Typografie/Breakpoints/Icon-Konventionen als
wiederverwendbare Prinzipien fest, damit neue Elemente bestehende Tokens/Muster nutzen statt neue
Werte ad hoc zu erfinden. Entsteht dabei ein neues, wiederverwendbares Prinzip, dort ergänzen statt
es nur implizit im CSS/einer Komponente stehen zu lassen.

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` (neue/entfernte Spalte oder Tabelle, umgebautes Feld)
braucht diesen Check, bevor sie als fertig gilt — nicht erst, wenn explizit danach gefragt wird:

1. **Ist das schon in Prod live?** Für Staging: `git merge-base origin/main HEAD`. Für Prod (Branch
   `deploy`, nur über Release-Tags): `git merge-base $(git describe --tags --match 'v*.*.*' --abbrev=0)
HEAD` — der letzte Tag markiert den zuletzt releaseden Stand. `git diff <dieser-commit> HEAD --
backend/src/db/index.ts` zeigt, was seitdem am Schema geändert wurde. Alles, was schon vorher drin
   war, kann echte Nutzdaten auf der echten `data.sqlite` enthalten (aktiv genutzte App, seit der
   offenen Registrierung potenziell auch von weiteren, eingeladenen Nutzer:innen).
2. **Rein additiv bleiben, wo möglich.** Neue Spalten/Tabellen nur über `ensureColumn` (nullable
   oder mit `DEFAULT`) bzw. `CREATE TABLE IF NOT EXISTS` — nie eine bestehende Tabelle mit einer
   `NOT NULL`-Spalte ohne Default versehen.
3. **Vor jedem `dropColumnIfExists`/Rename einer schon live gewesenen Spalte: Backfill davor.** Falls
   die Spalte echte Werte tragen könnte, deren fachliche Bedeutung im neuen Modell woanders landet,
   muss ein Backfill (`INSERT`/`UPDATE`) diese Werte migrieren, bevor die Spalte fällt — sonst gehen
   sie beim nächsten Deploy kommentarlos verloren. Muster: `if (hasColumn(table, col)) {
db.exec('INSERT/UPDATE ...'); dropColumnIfExists(table, col); }` — die Unterkunft→Spots- oder
   `packing_items.checked`-Migration in `backend/src/db/index.ts` als Vorlage nehmen. Ein reiner
   No-Op-Drop (Spalte war nie live oder nie befüllt) braucht keinen Backfill.
4. **Reihenfolge im Skript beachten.** Migrationen laufen beim Backend-Start synchron in
   Datei-Reihenfolge gegen den _tatsächlichen_ aktuellen DB-Zustand, nicht gegen den Skript-Text. Ein
   Backfill, der eine Spalte braucht, die selbst erst weiter unten per `ensureColumn` ergänzt wird,
   muss hinter diese Stelle gesetzt werden — sonst schlägt er auf einer frischen/Test-DB mit `no such
column` fehl (auf der echten Prod-DB fällt das nicht auf, weil die Spalte dort durch frühere
   Deploys schon längst existiert).
5. **Migrationstest ergänzen.** Für jeden Backfill einen Test analog zu
   `backend/test/unit/dbMigration.test.ts` schreiben: alten Schema-Stand in einer temporären
   SQLite-Datei nachbauen, `db/index.ts` importieren lassen und prüfen, dass die Daten im neuen
   Modell wiederzufinden sind.

Der Rollout-Mechanismus dafür existiert schon und braucht keine separate Migrations-Pipeline:
`deploy.sh` und die Pi-Cronjob-Skripte schließen `*.sqlite*` explizit von `rsync --delete` aus, die
Datenbank wird also nie überschrieben. Der Backend-Prozess führt `db/index.ts` bei jedem Neustart
erneut aus, wendet die additiven Migrationen (und ggf. Backfills) automatisch auf die bestehende
Datei an. Schema-Änderungen im Code committen reicht also aus — kein manueller Migrationsschritt auf
dem Server nötig.

## Unit-Tests (`backend/test/`, `frontend/src/**/*.test.ts`)

Vitest auf beiden Seiten, unabhängig konfiguriert (Backend: `backend/vitest.config.ts`; Frontend:
`test`-Key in `frontend/vite.config.ts`). Laufen ohne Browser/Server, deterministisch und schnell —
laufen deshalb automatisch in CI, direkt vor dem jeweiligen Build-Schritt in
`.github/workflows/ci.yml`. Ein fehlschlagender Unit-Test verhindert damit sowohl den
Staging- als auch den Tag-Produktions-Publish.

```bash
cd backend && npm test    # bzw. npm run test:watch für Watch-Mode
cd frontend && npm test
```

Backend-Tests laufen gegen eine isolierte `:memory:`-SQLite-Instanz pro Testdatei (siehe
`backend/test/helpers/buildTestApp.ts`), nie gegen echte Nutzdaten oder `data.sqlite`. Isolation ist
bewusst pro Testdatei, nicht pro einzelnem Test (`beforeAll` statt `beforeEach`) — Tests innerhalb
einer Datei legen dafür jeweils eigene, eindeutig identifizierbare Ressourcen an, statt sich auf eine
leere Tabelle zu verlassen.

**Umfang: Regressionsnetz statt Vollabdeckung** (dieselbe Philosophie wie bei E2E unten):
Regressionsnetz für echte Logik (Berechnungen, Regex-Parsing, Auth-Gating), keine vollständige
Abdeckung jeder Route/Funktion. Reine CRUD-Routen ohne Verzweigungslogik brauchen i. d. R. keinen
eigenen Test.

## E2E-Tests & Accessibility-Tests (`/e2e`)

Ergänzt die schnellen, browserlosen Unit-Tests oben um echte Klick-Interaktionen durch einen
Browser. Committete Playwright-Suite, die beide Dev-Server automatisch startet und gegen eine frisch
geseedete, isolierte Test-Datenbank läuft (nie gegen echte Nutzdaten) — läuft identisch lokal, in
einer Cloud-Sandbox und über die Claude-Mobile-App, da die gesamte Infrastruktur (Server-Autostart,
Seed-Daten, Login) committet ist. Eigene Ports (Backend 3100, Frontend 5273, über `CORS_ORIGIN` in
`backend/src/server.ts` konfigurierbar) — kollidiert nicht mit einem laufenden lokalen Dev-Server.

Inklusive automatisierter Barrierefreiheits-Tests via Axe (`@axe-core/playwright`):
`npm run test:a11y` testet Kernansichten der Anwendung ad-hoc lokal auf WCAG/ARIA-Konformität.

Läuft außerdem automatisch in CI (nach den Unit-Tests, vor dem Assemble-Schritt) — bei einem
Fehlschlag wird als Artefakt der HTML-Report samt Screenshots hochgeladen (`playwright-report`/
`test-results`).

**Token-sparend: die volle Suite (`npm test`) nicht routinemäßig lokal laufen lassen.** CI führt sie
bei jedem Push ohnehin gated aus — ein lokaler Vollauf kostet nur unnötig Tokens (komplette
Testausgabe landet im Kontextfenster). Lokal stattdessen gezielt einsetzen:

- `npx -y playwright test <pfad-zur-spec>` für eine einzelne, gerade geschriebene/geänderte Spec direkt
  nach dem Schreiben verifizieren.
- `npm run test:a11y` für Barrierefreiheits-Scans.
- Einen CI-E2E-Fehlschlag lokal reproduzieren/debuggen.
- Eine Wegwerf-Spec unter `e2e/tests/scratch/` für Ad-hoc-Checks/PR-Screenshots (siehe unten).

```bash
cd e2e
npm install                       # einmalig
npx -y playwright install chromium   # einmalig pro (frischer) Umgebung
npm test                          # komplette Suite, startet/beendet beide Server automatisch
npm run test:a11y                 # nur Accessibility-Scans (tests/accessibility.spec.ts)
npx -y playwright show-report        # HTML-Report des letzten Laufs
```

### Wann einen neuen/aktualisierten Test schreiben?

Nicht nach jeder Anpassung. Die Suite ist ein Regressionsnetz für die zentralen Abläufe der App
(Login-Gate, Kalender-Feature, Mitgliedschaft/Einladung, Echtzeit-Sync, …), keine vollständige
Abdeckung. Einen Test ergänzen/anpassen, wenn eine Änderung sichtbares Nutzerverhalten neu einführt
oder grundlegend ändert und das wert ist, gegen stille Regression abzusichern. Triviale visuelle/
Text-Anpassungen brauchen keinen neuen Test.

**Bestehende Tests immer direkt mit anpassen!** Wenn UI-Elemente (z.B. Buttons, Bezeichner, Icons) oder Funktionalitäten geändert, verschoben oder entfernt werden, MUSS die KI bei der Umsetzung **immer selbstständig kurz prüfen**, ob es für diesen Bereich bereits einen existierenden E2E-Test (`e2e/tests/*.spec.ts`) gibt. Ist das der Fall, muss der betroffene Test **direkt im selben Arbeitsschritt mit angepasst werden**, damit die CI danach nicht fehlschlägt.
Diese Test-Anpassungen müssen stets in einem separaten Commit vorgenommen werden (nach Conventional Commits geprefixt mit z. B. `test(<Context>): `).

**Neue Tests vorschlagen statt automatisch schreiben:** Nur wenn ein komplett neuer Use Case auffällt (neuer Kern-Ablauf, neu gefundener Bug), bei dem sich ein persistenter E2E-Test lohnen würde, dies am Ende kurz erwähnen und fragen, ob der Test **neu** ergänzt werden soll — keine unaufgeforderte Testarbeit für komplett neue Tests.

**Keine Pixel-Diff-Screenshot-Tests** (`toHaveScreenshot()`) oder statischen Overlap-/BoundingBox-Koordinatentests (`elementFromPoint`, `expectNotCoveredBy`) in die Haupt-E2E-Suite aufnehmen — Rendering-/Font-Drift und Subpixel-Verschiebungen machen solche assertions unzuverlässig und erzeugen Fehlalarme. Visuelle Layout-Prüfungen und Überlappungsschutz erfolgen primär über die Regeln in `DESIGN.md` (Abschnitt "Layout-Containment & Z-Index-Stapelung") sowie ad-hoc Scratch-Specs. Stattdessen Interaktion + funktionale Zustands-/Sichtbarkeits-Assertions verwenden.

Datums-Annahmen aus `e2e/fixtures/seeded-data.json` lesen (zur Laufzeit von `global-setup.ts`
geschrieben), nicht hartcodieren — die Demo-Seed-Termine liegen relativ zu "heute".

### Ad-hoc-Checks ("schau selbst nach, ob X funktioniert/gut aussieht")

Für spontane visuelle Verifikation einer einzelnen Änderung (kein dauerhafter Regressionstest): eine
kurze Wegwerf-Spec unter `e2e/tests/scratch/` schreiben (gitignored, nie committen), die **vor**
`page.goto(...)` `forceFontDisplayBlock(page)` (`e2e/tests/helpers/fonts.ts`) aufruft, dann zur
fraglichen Stelle navigiert, interagiert und `page.screenshot({ path: ... })` aufruft — sonst bleibt
es in einem frischen, headless Playwright-Kontext praktisch immer dauerhaft bei der Fallback-Schrift
statt Fira Sans, siehe Kommentar in `fonts.ts` (#197). Mit
`npx -y playwright test tests/scratch/<name>.spec.ts` ausführen, den Screenshot per Read-Tool selbst
ansehen und bewerten. Die Wegwerf-**Spec** danach löschen, das erzeugte **PNG** aber aufheben (bleibt
im gitignoreten `e2e/tests/scratch/`) — bei sichtbaren UI-Änderungen ist das der Kandidat für die
PR-Screenshots, siehe "Screenshots im PR selbst" unten.

## PR-Merge-Regel

Von Claude Code erstellte PRs gegen `main` **nicht automatisch mergen**, sobald CI grün ist —
stattdessen offen lassen und auf das Review des Nutzers warten (er checkt bewusst zuerst visuell
anhand der im PR angehängten Screenshots, siehe unten, statt direkt auf DEV zu
testen). Explizit auf einen Merge-Wunsch/eine Freigabe des Nutzers warten, auch wenn CI längst grün
ist. Nicht als Draft (`draft: false`) erstellen.

## Issues per PR automatisch schließen

Behebt ein PR ein oder mehrere GitHub-Issues, gehört ein von GitHub erkanntes Closing-Keyword in den
PR-Body (nicht nur eine bloße Erwähnung wie "Löst #101" oder "Betrifft #101") — sonst bleiben die
Issues nach dem Merge offen. GitHub erkennt dafür nur englische Schlüsselwörter unmittelbar vor der
Issue-Nummer, z. B. `Fixes #101`, `Closes #101`, `Resolves #101`. Bei mehreren Issues in einem PR
**vor jeder einzelnen Nummer erneut** ein solches Keyword wiederholen, nicht nur einmal vor der
ersten: `Fixes #101, #102, #103` schließt beim Merge nur `#101` — `Fixes #101, Fixes #102,
Fixes #103` (bzw. eine Zeile pro Issue) schließt alle drei.

## Screenshots im PR selbst

Jeder PR mit sichtbarer UI-Änderung/sichtbarem Bugfix bekommt Screenshots des betroffenen Bereichs
direkt im PR (Body oder Kommentar) — in den relevanten Viewports (mind. mobil ~390px UND Desktop
Full HD ~1920x1080px, bei reiner Desktop- oder Mobil-Änderung reicht der jeweils betroffene Viewport). Zweck: der
Nutzer soll das Ergebnis direkt auf GitHub sehen können, bevor überhaupt gemergt/deployt wird.

Technisch: Screenshots werden im Repo zentral unter `docs/screenshots/` abgelegt (organisiert nach View, z. B. `dashboard`, `calendar`, `spots`, `lists`, `budget`, `notes`, `diary`, `settings`, `trips`, `landing`). Dateien folgen dem Schema `docs/screenshots/<view>-desktop-light.png`, `<view>-desktop-dark.png`, `<view>-mobile-light.png`, `<view>-mobile-dark.png` (bzw. gezielten Unter-Element-Bezeichnungen bei Bedarf). Eine vollständige Baseline aller Ansichten in sauberer Produktionsdarstellung (ohne DEV-Badges, orange Border oder PWA-Pills) lässt sich jederzeit per `npm run generate:screenshots` (bzw. über die committete Tool-Spec `e2e/tests/tools/generate-baseline-screenshots.manual.spec.ts`) neu generieren.

Bei UI-Änderungen an einem Bereich MÜSSEN die entsprechenden Screenshots in `docs/screenshots/<filename>.png` (bzw. für alle Ansichten per `npm run generate:screenshots`) IMMER direkt auf dem Feature-Branch aktualisiert und committet werden. Im PR-Body/-Kommentar per Markdown-Bild-Syntax auf die `raw.githubusercontent.com`-/Blob-URL dieser Datei auf dem Feature-Branch verlinken — GitHub rendert das Bild inline und bietet im PR-Diff zusätzlich den automatischen Vorher/Nachher-Bildvergleich. Nach dem Merge bleibt so stets der aktuelle Stand der Dokumentation ohne veraltete PR-Ordner erhalten. Reine Text-/Backend-only-Änderungen brauchen keine Screenshots.

**Syntax-Falle:** `![Label](URL)` — die URL NICHT in Backticks setzen (kein ``![Label](`URL`)``).
Damit rendert GitHub das Bild nicht inline, sondern zeigt nur einen toten Link/Codeblock. Vor dem
Absenden den PR-Body kurz auf versehentlich mit Backticks umschlossene Bild-URLs prüfen (v. a. wenn
mehrere Screenshots im selben Body verlinkt werden — nur eines davon falsch zu formatieren passiert
leicht).

Dabei bewusst lokal bleiben (Wegwerf-Spec), nicht nach CI verlagern — spart Tokens ohne die
Trigger-Loop-/Angriffsflächen-Risiken eines CI-Jobs mit Rückschreibrechten auf den PR-Branch. Genauso
bewusst keine persistenten Specs dafür verwenden: Regressionstests unter `e2e/tests/` sollen bei
einer verletzten Erwartung rot werden, nicht nebenbei Bilder für ein manuelles Review erzeugen.

## Releases: Commit-Konvention + Release-Notes-Fragmente

`.github/workflows/release.yml` (per `workflow_dispatch` im Actions-Tab oder programmatisch
auslösbar, siehe README) ermittelt Versions-Bump und Changelog-Text automatisch, statt sie beim
Release-Ausführen manuell abzufragen. Damit das funktioniert, brauchen **alle** Commits (dieses
Repo mergt PRs als echten Merge-Commit, nicht Squash — jeder einzelne Commit landet in der
Historie und wird gescannt) zwei Dinge:

1. **Commit-Betreff lose im Conventional-Commits-Stil**, sofern der Commit eine funktionale
   Änderung enthält: `feat: …` für neue Features (in der echten App), `fix: …` für Bugfixes,
   `feat!: …` bzw. ein `BREAKING CHANGE: …`-Absatz im Body für inkompatible Änderungen. Der
   Release-Workflow scannt alle Commit-Betreffs/-Bodies seit dem letzten Tag: `!`/`BREAKING CHANGE` →
   Major-Bump, mindestens ein `feat:` → Minor-Bump, sonst Patch-Bump. Rein interne Änderungen
   (Refactoring, Doku, Tests, Demo-Daten, CI/Pipelines, Tooling) brauchen kein `feat:`-Präfix (sondern
   `chore:`, `refactor:`, `docs:`, `test:`, `build:` oder kein Präfix) — sie fließen einfach in den
   Patch-Bump.
2. **Release-Notes-Fragment nur bei sichtbarer Auswirkung für echte Endnutzer:innen der App**:
   - **KEIN Fragment anlegen** für interne/begleitende Bereiche: Änderungen an Demo-Daten
     (`frontend/src/demo/`, `backend/src/db/seedDemo.ts`), CI/CD-Pipelines (`.github/`), Dev-Workflow,
     Tooling, Build-Skripte, Infrastruktur/Deployment (`deploy.sh`, systemd, Pi-Skripte), Tests,
     Refactorings oder reine Dokumentation. Diese betreffen nicht die produktive Nutzung der App.
   - **VOR dem Anlegen bestehende Fragmente prüfen**: Vor dem Erstellen einer neuen Datei unter
     `release-notes/pending/` immer die dort bereits vorhandenen Dateien lesen! Existiert bereits ein
     Eintrag für denselben Bereich (z. B. "UI-Konsistenz in Formularfeldern verbessert" oder "Wettervorhersage-Anzeige
     optimiert"), diesen bestehenden Eintrag ergänzen/zusammenfassen statt ein zweites, ähnliches Fragment
     danebenzulegen. Ein neues Fragment wird NUR angelegt, wenn die Änderung für Endnutzer:innen tatsächlich
     neu/interessant ist und noch nicht von bestehenden pending Release Notes abgedeckt wird.
   - **Verständliche Sprache ohne technische Details**: Die Zielgruppe sind nicht-technisch-versierte
     Endnutzer:innen. Die Stichpunkte müssen einfach, klar und aus Nutzerperspektive formuliert sein
     ("Was bedeutet das konkret für die Person, die die App nutzt?"). **Absolut KEINE technischen Details**
     wie Komponentennamen (z. B. `Button.vue`), Refactoring-Begriffe, PR-/Issue-Nummern (`#123`), CSS-Klassen,
     Datenbank-Spalten, interne Skripte oder Entwickler-Tools (z. B. Storybook) verwenden!
   - **Fragment-Format**: Eine kleine Markdown-Datei unter `release-notes/pending/<kurzer-slug>.md`
     anlegen oder anpassen, Inhalt ein bis zwei `- `-Stichpunkte in leicht verständlicher Endnutzer-Sprache
     wie `CHANGELOG.md` (Deutsch).
   - **Automatischer Fallback**: Gibt es bis zum Release keine gesammelten Fragmente (weil z. B. nur
     interne Verbesserungen, Demo-Daten oder Pipeline-Updates stattfanden), fasst der Release-Workflow
     den Release-Eintrag automatisch endnutzerfreundlich als `- Verbesserungen unter der Haube.`
     zusammen.
