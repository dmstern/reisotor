# UI-Audit-Guide

Dieses Dokument beschreibt das Vorgehen für UI-, Layout- und Container-Query-Audits in Reisotor sowie Richtlinien für AI-Coding-Agenten (Antigravity / Claude Code) und Entwickler:innen. Konkrete Prompt-Vorlagen für Agenten finden sich in [`docs/AUDIT_PROMPTS.md`](AUDIT_PROMPTS.md).

---

## Der 2-Stufen-Workflow für View-Audits

Bei der Überarbeitung oder Überprüfung einer View gilt das Prinzip: **Erst Code & Architektur, dann Layout & Browser-Stresstest.**

1. **Stufe 1: Design-System & Clean Code (`Prompt 1` in `AUDIT_PROMPTS.md`)**
   - Monolithische Views (> 300–400 Zeilen) nach Single Responsibility (SRP) in fokussierte Unterkomponenten zerschneiden.
   - Harte Pixelwerte durch Design-Tokens (`--space-*`, `--color-*`) aus `style.css` ersetzen.
   - UI-Primitives (`Button`, `Card`, `Badge` etc.) wiederverwenden bzw. extrahieren.
2. **Stufe 2: Layout- & Adversarial-Audit (`Prompt 2` in `AUDIT_PROMPTS.md`)**
   - Die bereinigte View mit `e2e/tests/scratch/audit-template.spec.ts` im Browser stress-testen.
   - 3-Viewport-Matrix, Drawer-Engezustände und Overflows defensiv absichern.

Vor Releases oder Meilensteinen erfolgt die ganzheitliche Prüfung aller Bereiche via Subagents (**Stufe 3: Pre-Release-Audit**, `Prompt 3` in `AUDIT_PROMPTS.md`).

---

## Autonome UI-Audit-Kurzbefehle & Trigger-Phrasen

Reisotor besitzt ein spezialisiertes E2E-Layout-Audit-System (`e2e/tests/scratch/audit-template.spec.ts`), um visuelle Regressionen, Z-Index-Kollisionen und Container-Query-Probleme bei stufenlos verstellbaren Seitenelementen abzufangen. Wenn der Nutzer nach einem UI-, Layout- oder App-Audit fragt, MUSS der Agent folgendes Protokoll autonom ausführen:

1. **Trigger: „Mach ein UI-Audit zu dem Change von eben“** (oder _„UI-Audit machen“_, _„Layout-Audit für die Änderungen“_):
   - **Route ermitteln:** Prüfe `git status` / `git diff`, ermittle die modifizierte Frontend-Komponente und die Test-Route (`SpotsView.vue` -> `/trip/1/spots`, `ExcursionsView.vue` -> `/trip/1/excursions`, `PackingListView.vue` -> `/trip/1/packing`, `BudgetView.vue` -> `/trip/1/budget`, `DashboardView.vue` -> `/trip/1`, `SettingsView.vue` -> `/settings`, `LoginView.vue` -> `/login`).
   - **Audit ausführen:** Führe `AUDIT_ROUTE=<route> AUDIT_SCREENSHOTS=true npm run test:audit` aus.
   - **Prüfung:** Prüfe die 3 Viewports (320px `narrowMobile`, 390px `mobile`, 1280px `desktop` inkl. Drawer-Matrix & 500px Enge-Stresstest). Binde Screenshots (nur falls vom Nutzer gewünscht) in den Walkthrough ein und behebe gefundene Layout-Kollisionen direkt defensiv.
2. **Trigger: „Mach ein komplettes App-Audit“** (oder _„Full App Audit“_, _„Prerelease App Audit“_, _„Vollständiges UI-Audit“_):
   - **Niemals monolithisch im selben Kontext!** Teile die App sofort in 4 Domänen auf (Divide & Conquer via Subagents oder geordnet sequentiell):
     - **Team 1 (Dashboard & Trips):** `/trip/1`, `/trips`
     - **Team 2 (Spots & Touren):** `/trip/1/spots`, `/trip/1/excursions`
     - **Team 3 (Listen & Content):** `/trip/1/packing`, `/trip/1/todo`, `/trip/1/diary`
     - **Team 4 (Finanzen & Auth/Settings):** `/trip/1/budget`, `/settings`, `/profile`, `/login`
   - Jedes Team führt `AUDIT_ROUTE=<route> npm run test:audit` aus. Erstelle einen konsolidierten Audit-Report (Details siehe `docs/AUDIT_PROMPTS.md`).

---

## UI-Qualitätssicherung, Visual Verification & Adversarial Testing

Klassische funktionale E2E- und Unit-Tests sind visuell blind: `expect(btn).toBeVisible()` ist erfüllt, selbst wenn ein Button von einem Sticky Header verdeckt wird, Text auf 320px unglücklich umbricht oder ein Dropdown durch `overflow: hidden` abgeschnitten ist. Um Layout-Regressionen systematisch zu verhindern, gilt für KI-Agenten und Entwickler:

1. **Keine diffusen monolithischen Mega-Prompts („Geh durch die ganze App und klick alles an“):**
   Ein vollständiger UI-Check vor großen Meilensteinen oder Releases ist ausdrücklich gewollt und wertvoll, darf aber NIE als ein einziger, unstrukturierter Durchlauf in einem einzigen Kontextfenster beauftragt werden. Solche Aufträge führen bei LLMs zu kombinatorischer Überlastung und blinden Falsch-Positiven („Alles geprüft, sieht gut aus“). Stattdessen MUSS eine systematische Aufteilung erfolgen (Divide & Conquer – z. B. per Subagent-Team mit `/teamwork-preview` oder `/goal`, aufgeteilt nach Fachdomänen wie Dashboard/Trips, Spots/Touren, Listen/Packen, Budget/Settings, die jeweils isoliert die 3 Viewports auditieren).
2. **Die 3-Viewport-Regel (`VIEWPORTS` in `e2e/tests/helpers/layout.ts`):**
   Layouts und interaktive Elemente müssen auf mindestens 3 repräsentativen Bildschirmgrößen verifiziert werden:
   - `narrowMobile`: **320x568px** (iPhone SE klein / Androids – hier entstehen 80% aller Text-/Icon-Clashes und horizontalen Scrollbalken).
   - `mobile`: **390x844px** (Standard-Smartphone).
   - `desktop`: **1280x800px** (Standard-Desktop/Laptop).
     _(Optional für Zwischentests: `narrowDesktop` mit 1080x900px an der Desktop-Schwelle)._
3. **Mathematische Layout-Defensiv-Checks statt visueller Blindheit:**
   - **Kein horizontaler Overflow:** In Scratch-Specs immer `await expectNoHorizontalOverflow(page)` aus `helpers/layout.ts` aufrufen (`document.documentElement.scrollWidth <= window.innerWidth`). Kein Screen darf auf Mobile seitlich wackeln oder ausbrechen.
   - **Keine Element-Verdeckung:** Schwebende Menüs, Modals oder wichtige Buttons auf Kollision mit Backdrops oder Headern mittels `expectNotCoveredBy(page, target, blocker)` prüfen.
   - **Touch-Targets einhalten:** Interaktive Elemente auf Mobile mit `expectMinTouchTarget(locator)` auf mindestens 44x44px absichern.
4. **Adversarial Scratch-Spec Workflow (`audit-template.spec.ts`):**
   Für tiefes Testen nach Refactorings die Vorlage `e2e/tests/scratch/audit-template.spec.ts` heranziehen (oder anpassen) und gezielt Stress erzeugen (lange Strings ohne Leerzeichen, leere Listen, geöffnete Menüs).
5. **Visuelle Screenshots nur On-Demand (Token-Schutz gemäß AGENTS.md):**
   Screenshots werden von KI-Agenten **ausschließlich auf explizite Aufforderung** erstellt (z. B. für Vorher-/Nachher-Vergleiche im PR). Agenten dürfen Bilddateien niemals mit `view_file` öffnen, sondern binden sie per Markdown zur Prüfung durch den Menschen ein.
6. **Der Drawer-Sonderfall & Container-Queries (`@container app-main`):**
   Auf Desktop (≥ 1024px) existieren stufenlos in der Breite verstellbare Seitenelemente:
   - Die globale Kalenderschublade (`Drawer.vue`): stufenlos von **280px bis 860px** verstellbar (Standard: 360px).
   - Die Spots-Spalte (`.spots-col` in `ExcursionsView.vue`): stufenlos von **280px bis 75cqw** verstellbar (Standard: 380px).
     Wenn diese Elemente geöffnet und breit gezogen werden, schrumpft die Inhaltsbreite von `.app-main` bzw. der Karte drastisch (von 1280px auf bis zu 340px!).
   - **Verbot von `@media` für Inhalts-Komponenten:** Komponenten innerhalb von `.app-main` dürfen Breiten-Entscheidungen nicht über `@media (min-width: ...)` treffen (da `window.innerWidth` unverändert groß bleibt), sondern müssen `@container app-main (min-width: ...)` oder flexibles Flexbox-Wrapping (`flex-wrap: wrap`) nutzen.
   - **Desktop-Audit mit Stufenlos-Matrix:** Bei Desktop-Audits muss das Layout immer sowohl mit **geschlossener**, **normal geöffneter** (`setCalendarDrawerOpen`) als auch **stufenlos breit gezogener** Schublade (`setCalendarDrawerWidth(page, 500)`, `setSpotsColumnWidth`) verifiziert werden, um Enge-Stresszustände abzufangen.

---

## Tooling & Infrastruktur im Repo

1. **`e2e/tests/helpers/layout.ts` (E2E-Helper)**:
   - `VIEWPORTS.narrowMobile` (320x568px), `mobile` (390x844px), `narrowDesktop` (1080x900px), `desktop` (1280x800px).
   - `expectNoHorizontalOverflow(page)`: Prüft mathematisch auf horizontalen Scrollbar-Overflow.
   - `expectMinTouchTarget(locator, minSize)`: Prüft Mindestgröße (44x44px) auf Mobile.
   - `expectNotCoveredBy(page, target, blocker)`: Prüft Sichtbarkeit per `elementFromPoint()`.
   - `setCalendarDrawerOpen(page, open)` / `setCalendarDrawerWidth(page, width)`: Steuert die Kalenderschublade.
   - `setSpotsColumnWidth(page, width)`: Verstellt die Spots-Spalte stufenlos.
   - `getAppMainContentWidth(page)`: Misst die tatsächliche gerenderte Breite von `.app-main`.

2. **Wiederverwendbare Test-Vorlage**:
   - `e2e/tests/scratch/audit-template.spec.ts`
   - Befehl: `AUDIT_ROUTE=<route> npm run test:audit`
   - Mit Screenshots: `AUDIT_ROUTE=<route> AUDIT_SCREENSHOTS=true npm run test:audit`

3. **Mikro-Ebene: Storybook Stress-Fixtures**:
   - `frontend/src/stories/stressFixtures.ts`: Standardisierte Stresstests (extrem langes deutsches Kompositum `STRESS_STRINGS.longWord`, Fließtext, Sonderzeichen und rote gestrichelte Begrenzungsrahmen `STRESS_CONTAINERS.narrow` / `ultraNarrow`).
   - Ermöglicht das visuelle Testen einzelner Komponenten im isolierten Zustand (`npm --prefix frontend run storybook`).
