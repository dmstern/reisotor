# UI-Audit-Guide

Dieses Dokument beschreibt das Vorgehen für UI-, Layout- und Container-Query-Audits in Reisotor sowie verbindliche Richtlinien für AI-Coding-Agenten (Antigravity / Claude Code) und Entwickler:innen.

> [!NOTE]
> **Vorgelagerte Code-Refactorings:** Für die strukturelle Überarbeitung überlanger oder historisch gewachsener Komponenten vor einem Layout-Audit siehe [`docs/AUDIT_PROMPTS.md`](AUDIT_PROMPTS.md) (SFC-Schichten-Modell: `<script>` → `<template>` → `<style>`). Dieser Leitfaden konzentriert sich auf die **visuelle Härtung, Enge-Resilienz und das automatisierte Layout-Testing**.

---

## 1. Die 3 goldenen Architektur-Regeln für Layouts in Reisotor

### Regel 1: Der Drawer-Effekt & Container-Queries (`@container app-main`)

In Reisotor existieren auf Desktop (≥ 1024px) stufenlos in der Breite verstellbare Seitenelemente:

- **Kalenderschublade (`Drawer.vue`):** stufenlos von **280px bis 860px** verstellbar (Standard: 360px).
- **Spots-Spalte (`.spots-col` in `ExcursionsView.vue`):** stufenlos von **280px bis 75cqw** verstellbar (Standard: 380px).

Wenn diese Elemente geöffnet und breit gezogen werden, schrumpft die Inhaltsbreite von `.app-main` bzw. der Kartenansicht selbst auf großen Monitoren drastisch (von 1280px auf bis zu 340px!).

- **Verbot von `@media` für Inhalts-Komponenten:** Komponenten innerhalb von `.app-main` dürfen Breiten-Entscheidungen nicht über `@media (min-width: ...)` treffen (da `window.innerWidth` unverändert groß bleibt), sondern müssen `@container app-main (min-width: ...)` oder flexibles Flexbox-Wrapping (`flex-wrap: wrap`) nutzen.
- **Stufenlos-Matrix:** Jede Ansicht muss Desktop-Engezustände bei maximal geöffneten Seitenelementen stabil aushalten.

### Regel 2: Die 3-Viewport-Matrix (`helpers/layout.ts`)

Layouts und interaktive Elemente müssen auf mindestens 3 repräsentativen Bildschirmgrößen verifiziert werden:

1. `narrowMobile`: **320x568px** (iPhone SE / kleine Androids – hier entstehen 80% aller Text-/Icon-Clashes und horizontalen Scrollbalken).
2. `mobile`: **390x844px** (Standard-Smartphone).
3. `desktop`: **1280x800px** (Standard-Desktop/Laptop) – immer mit geschlossener, normal geöffneter UND maximal breit gezogener Schublade (`setCalendarDrawerWidth(page, 500)`).
   _(Optional für Zwischentests: `narrowDesktop` mit 1080x900px an der Desktop-Schwelle)._

### Regel 3: Mathematische Layout-Defensiv-Checks statt visueller Blindheit

Klassische funktionale E2E-Tests (`expect(btn).toBeVisible()`) sind visuell blind: Ein Button gilt als sichtbar, selbst wenn er von einem Sticky Header verdeckt wird oder Text seitlich aus dem Bildschirm ausbricht.

- **Kein horizontaler Overflow:** In E2E-Tests immer `await expectNoHorizontalOverflow(page)` aus `helpers/layout.ts` aufrufen (`document.documentElement.scrollWidth <= window.innerWidth`). Kein Screen darf auf Mobile seitlich wackeln.
- **Touch-Targets einhalten:** Interaktive Elemente auf Mobile mit `expectMinTouchTarget(locator, 44)` auf mindestens 44x44px absichern.
- **Keine Element-Verdeckung:** Schwebende Menüs, Modals oder Aktions-Buttons auf Kollision mit Backdrops oder Headern mittels `expectNotCoveredBy(page, target, blocker)` prüfen.

---

## 2. Tooling & Infrastruktur im Repo

1. **`e2e/tests/helpers/layout.ts` (E2E-Helper)**:
   - `VIEWPORTS.narrowMobile` (320x568px), `mobile` (390x844px), `narrowDesktop` (1080x900px), `desktop` (1280x800px).
   - `expectNoHorizontalOverflow(page)`: Prüft mathematisch auf horizontalen Scrollbar-Overflow.
   - `expectMinTouchTarget(locator, minSize)`: Prüft Mindestgröße (44x44px) auf Mobile.
   - `expectNotCoveredBy(page, target, blocker)`: Prüft Sichtbarkeit per `elementFromPoint()`.
   - `setCalendarDrawerOpen(page, open)` / `setCalendarDrawerWidth(page, width)`: Steuert die Kalenderschublade.
   - `setSpotsColumnWidth(page, width)`: Verstellt die Spots-Spalte stufenlos.
   - `getAppMainContentWidth(page)`: Misst die tatsächliche gerenderte Breite von `.app-main`.

2. **Wiederverwendbare Playwright-Vorlage**:
   - Vorlage: `e2e/tests/scratch/audit-template.spec.ts`
   - **Standard-Befehl (Token-schonend ohne Screenshots):**
     ```bash
     AUDIT_ROUTE=<route> npm run test:audit
     ```
   - **Befehl mit Screenshots (nur auf explizite Nutzer-Aufforderung):**
     ```bash
     AUDIT_ROUTE=<route> AUDIT_SCREENSHOTS=true npm run test:audit
     ```

3. **Mikro-Ebene: Storybook Stress-Fixtures**:
   - `frontend/src/stories/stressFixtures.ts`: Standardisierte Stresstests (extrem langes deutsches Kompositum `STRESS_STRINGS.longWord`, Fließtext, Sonderzeichen und Begrenzungsrahmen `STRESS_CONTAINERS.narrow` / `ultraNarrow`).
   - Ermöglicht das visuelle Testen einzelner Komponenten im isolierten Zustand (`npm --prefix frontend run storybook`).

---

## 3. Lokaler Audit-Workflow (Einzelne View / Nach Refactoring)

Wird ausgeführt nach Änderungen an einer View, im Rahmen von Phase 3 eines Refactorings oder bei der Bearbeitung von UI-Layout-Bugs.

### Trigger-Phrasen für Agenten

- _„Mach ein UI-Audit zu dem Change von eben“_
- _„UI-Audit machen“_
- _„Layout-Audit für die Änderungen“_

### Autonomes Protokoll für den Agenten

1. **Route ermitteln:** Prüfe `git status` / `git diff` und ermittle die modifizierte Frontend-Komponente und die passende Route:
   - `SpotsView.vue` → `/trip/1/spots`
   - `ExcursionsView.vue` → `/trip/1/excursions`
   - `ScheduleView.vue` → `/trip/1/calendar` (sowie Desktop-Schublade `Drawer.vue`)
   - `PackingListView.vue` → `/trip/1/packing`
   - `ShoppingListView` (Tab) → `/trip/1/shopping`
   - `TodoView.vue` → `/trip/1/todo`
   - `NotesView.vue` → `/trip/1/notes`
   - `DiaryView.vue` → `/trip/1/diary`
   - `BudgetView.vue` → `/trip/1/budget`
   - `DashboardView.vue` → `/trip/1`
   - `TripsView.vue` → `/trips`
   - `SettingsView.vue` → `/settings`
   - `LoginView.vue` → `/login`
   - `SecurityCheckView.vue` → `/security-check`
   - `TrashView.vue` → `/trip/1/trash`
2. **Audit ausführen:** Führe `AUDIT_ROUTE=<route> npm run test:audit` aus (standardmäßig **ohne** `AUDIT_SCREENSHOTS=true`).
3. **Ergebnis bewerten:**
   - Wurden horizontale Overflows oder Berührungsziel-Verletzungen gefunden?
   - Treten Kollisionen bei stufenlos geöffneter Schublade auf Desktop auf?
4. **Defensiv beheben:** Behebe Layout-Kollisionen ausschließlich unter strikter Einhaltung von [`DESIGN.md`](../DESIGN.md) (Design-Tokens `--space-*`, `--color-*`, Container-Queries `@container app-main`, Flexbox-Wrapping). Keine ad-hoc Inline-Styles oder magische Pixelabstände!
5. **Screenshots nur auf Abruf:** Screenshots werden **niemals unaufgefordert** erstellt. Nur wenn die Nutzerin / der Nutzer explizit Screenshots verlangt, führe den Befehl mit `AUDIT_SCREENSHOTS=true` aus und verlinke die Bilder per Markdown im Walkthrough (niemals per `view_file` selbst öffnen).

---

## 4. Pre-Release-Stabilitäts-Gate (Ganzheitliches Release-Audit)

Vor großen Releases (z. B. neuen Minor- oder Major-Versionen) erfolgt die ganzheitliche Prüfung aller Bereiche der App.

### Leitphilosophie: Stabilisierung & Polishing statt blinder Groß-Refactorings!

Bis kurz vor einem Release werden oft noch Bugs behoben, neue Funktionen fertiggestellt und UI-Verbesserungen integriert. Dabei entstehen typische Last-Minute-Mängel:

- Abgeschnittene Popovers, Dropdowns oder Tooltips (`overflow: hidden` auf Elternelementen oder falscher Z-Index).
- Schlechte Umbrüche auf schmalen Viewports (320px/390px): Zahlenwerte, Währungen oder Datum-Badges brechen unleserlich um; es fehlt `min-width: 0` oder `overflow-wrap: break-word`.
- Fehlende oder inkonsistente `:hover`- und `:focus-visible`-Zustände.
- Abweichende Paddings und Abstände, die aus der Token-Skala (`--space-*`) herausfallen.
- Zu kleine, unleserliche Labels oder Icons.

> [!CAUTION]
> **Strikte Trennung von Inspektion & Behebung – Kein blindes Umbauen!**
> Ein Pre-Release-Audit darf **niemals als pauschaler „Such-und-Reparier-alles-auf-einmal“-Auftrag** an AI-Agenten gegeben werden!
> Solche Aufträge führen verlässlich zu drei Fehlern:
>
> 1. **Sycophancy („Nach dem Mund reden“):** Der Agent klickt oberflächlich durch und meldet „Alles perfekt“, übersieht aber abgeschnittene Modals oder wackelnde Mobile-Layouts.
> 2. **Aktionismus (Zerstörer-Refactoring):** Der Agent baut funktionierende Komponenten oder CSS-Grids eigenmächtig um und erzeugt kurz vor Release neue, schwere Regressionen.
> 3. **Kontext-Kollaps:** Das gleichzeitige Prüfen von 14 Routen und Bearbeiten von Dateien sprengt das Kontextfenster.
>
> **Verbindliche Regel:** Vor einem Release finden **KEINE Architektur-Refactorings** statt. Das Pre-Release-Gate dient ausschließlich der **visuellen Härtung, Konsistenz und chirurgischen Fehlerbehebung**.

---

### Das Modell des Release-Gates (1 Orchestrator-Chat + Sequenzielle Subagenten pro Team)

> [!NOTE]
> **1 Chat für dich – automatische Kontext-Isolation unter der Haube!**
> Du startest das Audit in **einem einzigen Chat** (z. B. mit `Release Audit Auto` oder _„Mach das Pre-Release-Audit fertig“_). Damit das Kontextfenster trotzdem niemals vollläuft oder unpräzise wird, liest der Haupt-Agent (Orchestrator) die Komponenten **nicht** selbst ein, sondern spawnt **nacheinander (sequenziell) für jedes Team einen eigenen `self`-Subagenten** mit einem 100 % frischen Kontextfenster. Jeder Subagent prüft, poliert und committet sein Team isoliert und gibt nur eine kompakte Befundtabelle an den Orchestrator zurück. Am Ende führt der Orchestrator einmalig das **`Release Audit Gate`** (`npm run check`, `test:a11y`) aus, aktualisiert den PR und präsentiert dir den fertigen Gesamtbericht.

```mermaid
flowchart TD
    Start["<b>Du im Haupt-Chat:</b><br/><i>Release Audit Auto</i>"] --> Orch["<b>Orchestrator-Agent</b><br/><i>Prüft offene/betroffene Teams via git log / gh pr view</i>"]
    subgraph Subagents["<b>Sequenzielle Subagenten (jeweils frisches Kontextfenster!)</b>"]
        T1["<b>Subagent Team X</b><br/><i>1. test:audit & 5 Dimensionen<br/>2. Chirurgische CSS-/Token-Fixes<br/>3. typecheck, eslint & git commit</i>"]
    end
    Orch -->|Spawnt nacheinander pro Team| T1
    T1 -->|Kompakte Befund-/Fix-Tabelle| Orch
    Orch -->|Alle Teams fertig| Gate["<b>Finales Release-Gate (1x am Ende)</b><br/><i>npm run check, Axe-A11y, PR-Update & Push</i>"]
    Gate --> Done["<b>Gesamtbericht an dich</b><br/><i>Ready to merge!</i>"]
```

### Interaktions-Ablauf in der Praxis (Fire & Forget mit sauberen Leitplanken)

```mermaid
sequenceDiagram
    autonumber
    actor Du as Du (Entwickler:in)
    participant O as Orchestrator (Haupt-Chat)
    participant S as Subagent (je Team frisch)

    Du->>O: "Release Audit Auto" (bzw. "Mach Team 4 bis 6 fertig")
    Note over O: Ermittelt offene Teams (z. B. Team 4, 5, 6)<br/>Liest selbst KEINEN Komponenten-Code!
    loop Für jedes offene Team (sequenziell!)
        O->>S: invoke_subagent("self") für Team X
        Note over S: Frischer Kontext!<br/>1. test:audit & 5 Dimensionen<br/>2. Chirurgische CSS-/Token-Fixes<br/>3. typecheck, eslint & git commit
        S-->>O: Kurze Befund-/Fix-Tabelle + Commit-Hash
    end
    Note over O: Führt Finales Gate aus:<br/>npm run check & npm run test:a11y<br/>Aktualisiert PR (gh pr edit) & git push
    O-->>Du: Konsolidierte Gesamt-Bilanz aller Teams + PR-Link
```

#### Warum die Subagenten strikt nacheinander (sequenziell) laufen müssen:

1. **Keine Port- & DB-Kollisionen bei Playwright:** `npm run test:audit` nutzt feste Test-Ports (3100/5273) und eine gemeinsame E2E-SQLite-DB. Parallele Subagenten würden sich gegenseitig abschießen.
2. **Saubere Git-Historie ohne `.git/index.lock`:** Da alle Teams im selben Worktree und Branch arbeiten, erzeugt die sequenzielle Abarbeitung pro Team genau einen sauberen, atomaren Commit (`fix(ui): polish <team> ...`).
3. **Sicherheitsschranke gegen Aktionismus:** Jeder Subagent darf ausschließlich risikoarme CSS-/Token-/Container-Fixes durchführen. Sollte ein Befund einen tieferen strukturellen Umbau erfordern, lässt der Subagent ihn unberührt und markiert ihn in seiner Rückmeldung als `⏭️ Übersprungen (Nach-Release)`.

---

### Die 6 Fachdomänen

Um das Kontextfenster zu schonen, wird die Anwendung in 6 klar abgegrenzte Domänen aufgeteilt:

- **Team 1 (Dashboard, Navigation & Trips):** `/trip/1`, `/trips` (Header, Navbar, Widgets, Reise-Wechsel)
- **Team 2 (Spots, Touren & Karten):** `/trip/1/spots`, `/trip/1/excursions` (MapLibre-Karte, Split-View, stufenlose Spots-Spalte, Bottom-Sheets)
- **Team 3 (Kalender & Zeitplan):** `/trip/1/calendar`, Desktop-Kalenderschublade `Drawer.vue` (Tages-/Wochenansicht, Drag-Handles, Termin-Modals, Export)
- **Team 4 (Listen, Notizen & Content):** `/trip/1/packing`, `/trip/1/shopping`, `/trip/1/todo`, `/trip/1/notes`, `/trip/1/diary` (Tabs in `ListenView`, Notizen-Grid & Rich-Text, Tagebuch-Timeline)
- **Team 5 (Finanzen & Budget):** `/trip/1/budget` (Budget-Töpfe, Transaktionslisten, Währungsumrechnung, Ausgleichs-Karten, Modals; Enge-Stresstest auf 320px)
- **Team 6 (Einstellungen, Auth & Hilfsansichten):** `/settings` (7 Tabs: Account, Users, App/Wetter, Trip, Notifications, Data, About), `/login`, `/security-check`, `/trip/1/trash`

---

### Die 5 Prüf-Dimensionen pro Domäne

Jeder Prüfdurchlauf analysiert systematisch folgende fünf Kriterien:

1. **Enge- & Overflow-Matrix (320x568px narrowMobile & 390x844px mobile):**
   - Gibt es horizontalen Scroll-Overflow (`expectNoHorizontalOverflow`)?
   - Brechen Zahlenwerte, Währungen oder Datum-Badges unschön um?
   - Fehlt bei Flex-Kindern `min-width: 0` oder `overflow-wrap: break-word`?
2. **Overlay-, Popover- & Modal-Matrix:**
   - Öffnen sich alle Dropdowns, Kontext-Menüs, Popovers und Filter-Sheets vollständig?
   - Werden Menüs durch `overflow: hidden` auf umliegenden Containern abgeschnitten?
   - Stimmen Z-Indizes gegenüber Sticky-Headern und Kartenelementen?
3. **Interaktionen, Hover- & Focus-States:**
   - Besitzen interaktive Kacheln, Buttons und Zeilen sichtbare, ruhige `:hover`- und `:focus-visible`-Zustände?
   - Werden Touch-Targets von mindestens 44x44px auf Mobile eingehalten (`expectMinTouchTarget`)?
4. **Visuelle Konsistenz & Design-Tokens:**
   - Halten alle Abstände die Token-Skala (`--space-xs` bis `--space-2xl`) ein?
   - Sind Sekundär- und Badge-Labels lesbar (nicht unter 11-12px) und semantisch gefärbt?
   - Werden für Badges/Pillen niemals `border-radius: 50%`, sondern `--radius-pill` verwendet?
5. **Desktop-Drawer-Stresstest (1280x800px mit Kalenderschublade auf 500px+):**
   - Hält der Inhaltsbereich die reduzierte Breite stabil aus?
   - Springen Elemente oder bricht das Layout unruhig um?

---

### Einstiegs-Phrasen & Verhalten bei allgemeiner Aufforderung

Fällt im Chat eine allgemeine Aufforderung wie:

- `Release Audit Auto`
- _„Mach ein Pre-Release-Audit“_
- _„Pre-Release Audit starten / fortsetzen“_

**Striktes Orchestrator-Protokoll für den Haupt-Agenten:**

1. **Kontext-Disziplin im Haupt-Chat:** Der Haupt-Agent darf **niemals selbst alle 6 Teams im eigenen Kontextfenster** untersuchen und bearbeiten (Gefahr von Kontext-Kollaps und Attention Dilution). Er agiert rein als **Orchestrator**.
2. **Status & Git-Delta ermitteln:**
   - Existiert bereits ein laufender Audit-Branch/PR (`gh pr view` / `git log main..HEAD --oneline`), prüft der Orchestrator, welche Teams bereits erledigt sind und welche noch ausstehen.
   - Bei einem Neustart ermittelt er per Git, welche Frontend-Bereiche seit dem letzten Release-Tag verändert wurden (`git log $(git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo "v1.0.0")..HEAD --name-only frontend/`), oder nimmt auf Wunsch alle Teams 1–6.
3. **Sequenzielle Subagenten-Orchestrierung (`invoke_subagent`):**
   - Für jedes ausstehende Team spawnt der Orchestrator **nacheinander (immer erst warten, bis das vorherige Team fertig ist!)** einen `self`-Subagenten (`TypeName: "self"`, `Workspace: "inherit"`) mit den Aufgaben aus dem Abschnitt _„Arbeitsauftrag pro Team-Subagent“_.
4. **Finales Gate & Abschlussbericht:**
   - Sobald das letzte Team abgeschlossen ist, führt der Orchestrator das `Release Audit Gate` (`npm run check`, `npm run test:a11y`) aus, aktualisiert den PR (`gh pr edit`), pusht den Branch (`git push`) und gibt die konsolidierte Gesamt-Übersicht aller Teams an die Nutzerin / den Nutzer aus.

---

### Kurz-Trigger für das Release-Gate

| Modus                          | Kurz-Trigger                     | Beschreibung                                                                                                                                                                    |
| :----------------------------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vollautomatisch (Default)**  | `Release Audit Auto`             | **Orchestrator + Subagenten:** Arbeitet alle offenen/betroffenen Teams nacheinander in isolierten Subagenten ab, führt am Ende das `Release Audit Gate` aus und updated den PR. |
| **Einzel-Team** _(optional)_   | `Release Audit: <Team \| Route>` | Prüft, poliert und committet genau ein einzelnes angegebenes Team direkt.                                                                                                       |
| **Abschluss-Gate** _(einzeln)_ | `Release Audit Gate`             | Führt isoliert `npm run check`, A11y- (Axe) und Release-Notes-Prüfungen für die Merge-Freigabe aus.                                                                             |

---

### Arbeitsauftrag pro Team-Subagent (`Release Audit: <Team | Route>`)

Diesen Auftrag übergibt der Orchestrator an jeden sequenziellen Team-Subagenten (bzw. führt ihn bei direktem Einzel-Aufruf `Release Audit: Team X` aus):

```text
Release Audit: [Team 1-6, z. B. Team 4 (Listen, Notizen & Content: /trip/1/packing, /trip/1/shopping, /trip/1/todo, /trip/1/notes, /trip/1/diary)]

Führe das komplette Release-Audit (Inspektion -> Chirurgische Fixes -> Verifikation & Eigen-Review -> Commit) für dieses Team durch.

STRIKTE LEITPLANKEN:
- Keine Architektur-Refactorings: Keine neuen Props/Emits, keine Store-Umbauten, keine Komponenten-Zerlegung!
- Ausschließlich risikoarme, zielgerichtete CSS-/Template-/Token-Korrekturen:
  * Design-Tokens (--space-*, --color-*, --radius-pill statt 50% oder magischer Pixel)
  * Container-Queries (@container app-main statt @media für Komponenten innerhalb von .app-main)
  * Enge-Resilienz (min-width: 0, flex-wrap: wrap, overflow-wrap: break-word, white-space: nowrap für Badges/Beträge)
  * Overlays & Popovers (z-index, kein Abschneiden durch overflow: hidden)
  * Interaktionen (:hover, :focus-visible Ringe via --color-focus-ring, Touch-Targets >= 44px)
- Sicherheitsschranke: Falls ein Befund einen tieferen strukturellen Umbau erfordern würde, führe ihn NICHT eigenmächtig durch, sondern vermerke ihn in der Tabelle als "⏭️ Übersprungen (Nach-Release)".

Vorgehensweise:
1. E2E-Layout-Audit ausführen (bei Multi-Routen-Teams komma-separiert):
   AUDIT_ROUTE=<route1,route2> npm run test:audit
2. Quellcode der relevanten Vue-Komponenten systematisch auf die 5 Prüf-Dimensionen untersuchen.
3. Gefundene Blocker (🔴) und klare Polish-Punkte (🟡) direkt minimal-invasiv im Code beheben.
4. Verifikation & Eigen-Review gegen DESIGN.md:
   - Falls Code geändert wurde: Erneut `AUDIT_ROUTE=<route1,route2> npm run test:audit` ausführen.
   - `npm run typecheck` und `npx -y eslint <geänderte-dateien>` prüfen.
   - Formatieren (`npx -y prettier --write <geänderte-dateien>`) und sauber committen (`git commit -m "fix(ui): polish <domäne> layout & token resilience"`).

Ergebnis (Rückmeldung an den Orchestrator bzw. Nutzer):
Gib eine kompakte Übersichtstabelle und den Commit-Hash zurück:

| Status | Route / Komponente | Viewport / Zustand | Befund | Durchgeführte Maßnahme |
| :--- | :--- | :--- | :--- | :--- |
| 🛠️ Behoben (🔴/🟡) | `/trip/1/budget` | 320px | Betrag bricht um | `white-space: nowrap` ergänzt |
| 🟢 OK | `/trip/1/notes` | 1280px (500px Drawer) | Grid bricht sauber via `@container` um | Kein Handlungsbedarf |
```

---

### Finales Release-Gate (`Release Audit Gate`)

Führt **einmalig ganz am Ende** (nachdem alle Teams abgeschlossen sind) die finale technische Qualitätssicherung vor dem Merge/Tagging durch:

```text
Release Audit Gate

Führe das finale Release-Gate durch, um die Gesamtstabilität des Branches nach Abschluss aller Teams zu zertifizieren.

Prüfschritte:
1. Statisches Gesamt-Gate (Lint, Format, Release-Notes, Typecheck Frontend & Backend): npm run check
2. Barrierefreiheit (Axe): npm run test:a11y
3. Layout-Regressionen Stichprobe: AUDIT_ROUTE=/trip/1 npm run test:audit

Ergebnis:
Gib eine klare Bestätigung im Chat aus:
- Sind alle automatisierten Prüfungen grün?
- Gibt es verbleibende Warnungen oder offene Punkte?
- Ist das Release freigegeben?
- Falls alle Prüfungen erfolgreich sind: Gib explizit die Bestätigung aus, dass das Pre-Release-Audit für alle Teams vollständig abgeschlossen ist und der PR gemergt werden kann.
```
