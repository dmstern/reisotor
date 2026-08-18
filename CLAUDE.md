# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run dev     # Vite auf http://localhost:5173, proxied /api ans Backend
npm run build   # vue-tsc --noEmit + vite build -> frontend/dist
npm test        # vitest run

# E2E (Playwright, /e2e) — siehe eigener Abschnitt unten
cd e2e && npm install && npx playwright install chromium && npm test
```

Einzelnen Test ausführen: `npx vitest run <pfad-zur-datei>` bzw. `npx vitest run -t "<name>"`
(aus `backend/` oder `frontend/`); für E2E `npx playwright test <pfad-zur-spec>` aus `e2e/`.

Node.js 20+ sowie `make`/`gcc`/`python3` nötig (native Module `better-sqlite3`, `bcrypt`). Volle
Setup-/Deploy-/Env-Var-Details: `README.md`.

## Typecheck

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
cd frontend && npm run build   # führt vue-tsc --noEmit vor dem Vite-Build aus
```

## Sparsam mit Subagenten

Bei klar umrissenen Änderungen in diesem Repo (bekannte Datei(en)/Fehlermeldung, überschaubarer
Scope) direkt grep/Read/Edit verwenden statt einen Explore-/Plan-Subagenten zu spawnen — jeder
Spawn re-derived den kompletten Kontext neu und kostet dadurch oft mehr Tokens als die direkte
Suche selbst. Subagenten bleiben sinnvoll, wenn der Scope tatsächlich unklar/groß ist oder mehrere
unabhängige Bereiche parallel durchsucht werden müssen — dort leidet sonst die Trefferquote.

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
Präsentation je View).

Für Datenmodell-Änderungen gilt zusätzlich der Migrations-Check im nächsten Abschnitt. Bei neuen
UI-Elementen oder sichtbaren UI-Anpassungen zusätzlich `DESIGN.md` (Projekt-Root) konsultieren —
hält Farben/Abstände/Eckenrundung (Squircle-Prinzip)/Typografie/Breakpoints/Icon-Konventionen als
wiederverwendbare Prinzipien fest, damit neue Elemente bestehende Tokens/Muster nutzen statt neue
Werte ad hoc zu erfinden. Entsteht dabei ein neues, wiederverwendbares Prinzip, dort ergänzen statt
es nur implizit im CSS/einer Komponente stehen zu lassen.

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` (neue/entfernte Spalte oder Tabelle, umgebautes Feld)
braucht diesen Check, bevor sie als fertig gilt — nicht erst, wenn explizit danach gefragt wird:

1. **Ist das schon in Prod live?** `git merge-base origin/prod HEAD` (bzw. `origin/main`) gibt den
   letzten gemeinsamen Commit; `git diff <dieser-commit> HEAD -- backend/src/db/index.ts` zeigt, was
   seitdem am Schema geändert wurde. Alles, was schon vorher drin war, kann echte Nutzdaten auf der
   echten `data.sqlite` enthalten (aktiv genutzte App, seit der offenen Registrierung potenziell auch
   von weiteren, eingeladenen Nutzer:innen).
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
   Datei-Reihenfolge gegen den *tatsächlichen* aktuellen DB-Zustand, nicht gegen den Skript-Text. Ein
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
`.github/workflows/build-deploy.yml`. Ein fehlschlagender Unit-Test verhindert damit sowohl den
`main`→Staging- als auch den `prod`→Produktions-Deploy.

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

## E2E-Tests (`/e2e`)

Ergänzt die schnellen, browserlosen Unit-Tests oben um echte Klick-Interaktionen durch einen
Browser. Committete Playwright-Suite, die beide Dev-Server automatisch startet und gegen eine frisch
geseedete, isolierte Test-Datenbank läuft (nie gegen echte Nutzdaten) — läuft identisch lokal, in
einer Cloud-Sandbox und über die Claude-Mobile-App, da die gesamte Infrastruktur (Server-Autostart,
Seed-Daten, Login) committet ist. Eigene Ports (Backend 3100, Frontend 5273, über `CORS_ORIGIN` in
`backend/src/server.ts` konfigurierbar) — kollidiert nicht mit einem laufenden lokalen Dev-Server.

Läuft außerdem automatisch in CI (nach den Unit-Tests, vor dem Assemble-Schritt) — bei einem
Fehlschlag wird als Artefakt der HTML-Report samt Screenshots hochgeladen (`playwright-report`/
`test-results`).

**Token-sparend: die volle Suite (`npm test`) nicht routinemäßig lokal laufen lassen.** CI führt sie
bei jedem Push ohnehin gated aus — ein lokaler Vollauf kostet nur unnötig Tokens (komplette
Testausgabe landet im Kontextfenster). Lokal stattdessen gezielt einsetzen:
- `npx playwright test <pfad-zur-spec>` für eine einzelne, gerade geschriebene/geänderte Spec direkt
  nach dem Schreiben verifizieren.
- Einen CI-E2E-Fehlschlag lokal reproduzieren/debuggen.
- Eine Wegwerf-Spec unter `e2e/tests/scratch/` für Ad-hoc-Checks/PR-Screenshots (siehe unten).

```bash
cd e2e
npm install                       # einmalig
npx playwright install chromium   # einmalig pro (frischer) Umgebung
npm test                          # komplette Suite, startet/beendet beide Server automatisch
npx playwright show-report        # HTML-Report des letzten Laufs
```

### Wann einen neuen/aktualisierten Test schreiben?

Nicht nach jeder Anpassung. Die Suite ist ein Regressionsnetz für die zentralen Abläufe der App
(Login-Gate, Kalender-Feature, Mitgliedschaft/Einladung, Echtzeit-Sync, …), keine vollständige
Abdeckung. Einen Test ergänzen/anpassen, wenn eine Änderung sichtbares Nutzerverhalten neu einführt
oder grundlegend ändert und das wert ist, gegen stille Regression abzusichern. Triviale visuelle/
Text-Anpassungen brauchen keinen neuen Test.

**Vorschlagen statt automatisch schreiben:** Fällt während der Umsetzung eines Features ein Use
Case auf, bei dem sich ein persistenter e2e-Test lohnen würde (neuer Kern-Ablauf, ein gerade selbst
gefundener/gefixter Bug mit echtem Regressionsrisiko, ein Zusammenspiel mehrerer Komponenten, das
leicht wieder kaputtgehen kann), das am Ende kurz erwähnen und fragen, ob der Test ergänzt werden
soll — nicht mehr automatisch mitschreiben, um bei kleineren/experimentellen Änderungen keine
unaufgeforderte Testarbeit (und Tokens) zu erzeugen. Gilt auch fürs Umbauen/Erweitern bestehender
Specs.

**Keine Pixel-Diff-Screenshot-Tests** (`toHaveScreenshot()`) — diese Umgebung ist von Playwright
nicht offiziell unterstützt (Font-/Rendering-Drift macht Snapshot-Baselines unzuverlässig).
Stattdessen Interaktion + Zustands-/Sichtbarkeits-/BoundingBox-Assertions.

Datums-Annahmen aus `e2e/fixtures/seeded-data.json` lesen (zur Laufzeit von `global-setup.ts`
geschrieben), nicht hartcodieren — die Demo-Seed-Termine liegen relativ zu "heute".

### Ad-hoc-Checks ("schau selbst nach, ob X funktioniert/gut aussieht")

Für spontane visuelle Verifikation einer einzelnen Änderung (kein dauerhafter Regressionstest): eine
kurze Wegwerf-Spec unter `e2e/tests/scratch/` schreiben (gitignored, nie committen), die zur
fraglichen Stelle navigiert, interagiert und `page.screenshot({ path: ... })` aufruft. Mit
`npx playwright test tests/scratch/<name>.spec.ts` ausführen, den Screenshot per Read-Tool selbst
ansehen und bewerten, Datei danach löschen.

## PR-Merge-Regel

Von Claude Code erstellte PRs gegen `main` **nicht automatisch mergen**, sobald CI grün ist —
stattdessen offen lassen und auf das Review des Nutzers warten (er checkt bewusst zuerst visuell
anhand der im PR angehängten Screenshots, siehe unten, statt direkt auf `dev.reise.ruebenherz.de` zu
testen). Explizit auf einen Merge-Wunsch/eine Freigabe des Nutzers warten, auch wenn CI längst grün
ist. Nicht als Draft (`draft: false`) erstellen.

## Screenshots im PR selbst

Jeder PR mit sichtbarer UI-Änderung/sichtbarem Bugfix bekommt Screenshots des betroffenen Bereichs
direkt im PR (Body oder Kommentar) — in den relevanten Viewports (mind. mobil ~390px UND Desktop
~1280px, bei reiner Desktop- oder Mobil-Änderung reicht der jeweils betroffene Viewport). Zweck: der
Nutzer soll das Ergebnis direkt auf GitHub sehen können, bevor überhaupt gemergt/deployt wird.

Technisch: Screenshots per Playwright erzeugen (Wegwerf-Spec-Kniff oben), dann NICHT im
gitignoreten `e2e/tests/scratch/` belassen, sondern committen (z. B. unter
`docs/pr-screenshots/<kurzer-slug>/` auf demselben Feature-Branch) und im PR-Body/-Kommentar per
Markdown-Bild-Syntax auf die `raw.githubusercontent.com`-/Blob-URL dieses Branches verlinken — GitHub
rendert das inline (kein direkter Bild-Upload-Endpunkt in dieser Umgebung verfügbar). Reine
Text-/Backend-only-Änderungen brauchen keine Screenshots.

Dabei bewusst lokal bleiben (Wegwerf-Spec), nicht nach CI verlagern — spart Tokens ohne die
Trigger-Loop-/Angriffsflächen-Risiken eines CI-Jobs mit Rückschreibrechten auf den PR-Branch. Genauso
bewusst keine persistenten Specs dafür verwenden: Regressionstests unter `e2e/tests/` sollen bei
einer verletzten Erwartung rot werden, nicht nebenbei Bilder für ein manuelles Review erzeugen.
