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

### Das 4-Phasen-Modell des Release-Gates

Analog zum Komponenten-Refactoring wird das Pre-Release-Gate in vier streng getrennte Phasen unterteilt:

```mermaid
flowchart TD
    P0["<b>Phase 0: Visuelle Inspektion & Triage (Read-Only!)</b><br/><i>5 Prüf-Dimensionen pro Domäne. Kein Code wird geändert!</i>"]
    P0 --> P1["<b>Phase 1: Scope-Freeze & Triage-Freigabe</b><br/><i>Mensch/Lead bewertet Befunde: Freigabe vs. Einfrieren</i>"]
    P1 --> P2["<b>Phase 2: Minimal-Invasive Härtung & Polish</b><br/><i>Chirurgische CSS-/Token-Fixes. Keine Architektur-Umbauten!</i>"]
    P2 --> P3["<b>Phase 3: Finales Release-Gate</b><br/><i>Re-Verifikation, Axe-A11y, Typecheck, Lint, Release-Notes-Check</i>"]
```

### Interaktions-Ablauf in der Praxis (Mensch & Agent)

Folgendes Sequenzdiagramm veranschaulicht das Zusammenspiel zwischen Entwickler:in und Agenten über die Phasen hinweg:

```mermaid
sequenceDiagram
    autonumber
    actor Du as Du (Entwickler:in)
    participant A as Agent (Chat 1: Triage)
    participant B as Agent (Frischer Chat 2: Fix)

    Du->>A: "Mach ein Pre-Release-Audit" (oder "Release Audit Assess: Team 5")
    Note over A: Phase 0: Read-Only Check!<br/>320px/390px, Popovers, Hover, Tokens.<br/>0 Zeilen Code geändert.
    A-->>Du: Ampel-Tabelle (🔴 1 Blocker, 🟡 2 Polish, 🟢 3 OK)<br/>+ Fertiger Copy-Paste-Prompt für Phase 2 mit allen Befunden!

    Du->>B: [Kopiert den vorbereiteten Phase-2-Prompt 1:1 in Chat 2]
    Note over B: Phase 2: Liest Befunde direkt aus Prompt,<br/>chirurgische CSS-Fixes, Test & Commit.
    B-->>Du: "Fixes verifiziert & committet."

    Du->>B: "Release Audit Gate"
    Note over B: Phase 3: Typecheck, Lint,<br/>A11y (Axe), Release-Notes-Check.
    B-->>Du: "Alle Prüfungen grün. Bereit für Release!"
```

#### Wann du reviewen und wann du einen neuen Chat öffnen solltest:

1. **Nach Phase 0 (Dein Review & Handoff ohne Nachdenken):**
   - Der Agent liefert die Ampel-Befundtabelle (🔴 Blocker, 🟡 Polish, 🟢 OK) und generiert **automatisch am Ende einen vollständigen, kopierbaren Prompt-Block für Phase 2**.
   - Du musst nichts extra abfragen oder im Chat formulieren:
     - **Standardfall (Alles freigeben):** Du kopierst den fertigen Code-Block mit einem Klick in ein frisches Chat-Fenster.
     - **Auswahl anpassen:** Falls du einzelne Polish-Punkte nicht umsetzen möchtest, löschst du vor dem Absenden im neuen Chat einfach die entsprechenden Zeilen aus dem Prompt (oder sagst in Chat 1 kurz _„nur Punkt 1 und 2“_, woraufhin der Agent den Block aktualisiert ausgibt).
2. **Neuer Chat für Phase 2 (Token- & Kontext-Schutz):**
   - Im neuen Chat startet der Fix-Agent direkt mit den konkreten Befunden aus deinem Prompt – ohne den Ballast alter Test-Logs, aber mit 100% präzisem Arbeitsauftrag.
   - **Pflicht-Handoff am Ende von Phase 2:** Nach erfolgreichem Fix & Commit generiert der Agent IMMER unaufgefordert den vorbereiteten Trigger für den nächsten Schritt in einem kopierbaren Code-Block (z. B. `Release Audit Assess: Team <N+1>` für das nächste Team oder `Release Audit Gate`, falls alle Teams durchlaufen sind).
3. **Abschluss mit Phase 3 (Finales Gate):**
   - Im frischen Chat via `Release Audit Gate` alle automatisierten Schranken prüfen lassen. Wenn alle Tests grün sind, bescheinigt der Agent explizit den Gesamtabschluss des Audits („Pre-Release Audit erfolgreich abgeschlossen – Ready for Merge / Release“).

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

- _„Mach ein Pre-Release-Audit“_
- _„Pre-Release Audit starten“_
- _„Wir bereiten ein Release vor, auditier mal die App“_

**Striktes Protokoll für den Agenten:**

1. **Kein blinder Komplettdurchlauf:** Der Agent darf **niemals unaufgefordert alle 6 Teams auf einmal** in einer Session abfeuern (Gefahr von Kontext-Kollaps und Sycophancy).
2. **Git-Delta ermitteln:** Er ermittelt per Git, welche Frontend-Bereiche seit dem letzten Release-Tag tatsächlich verändert wurden:
   `git log $(git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo "v1.0.0")..HEAD --name-only frontend/`
3. **Fokussierte Empfehlung & Roadmap:** Er ordnet die Änderungen den betroffenen Teams zu (z. B. _„Seit v1.3.0 wurden vor allem Finanzen (Team 5) und Notizen/Listen (Team 4) verändert“_) und schlägt vor:
   - **Gezielter Check (Empfohlen):** Nur die veränderten Teams durchlaufen (spart massiv Tokens und Zeit).
   - **Vollständiger Meilenstein-Check:** Schrittweise von Team 1 bis 6.
4. **Sofortige Führung:** Der Agent schlägt direkt den ersten konkreten Schritt vor oder startet auf Bestätigung mit Phase 0 (`Release Audit Assess: Team <X>`).

---

### Kurz-Trigger für das Release-Gate

| Phase       | Kurz-Trigger                            | Beschreibung                                                                                                                                       |
| :---------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0** | `Release Audit Assess: <Team \| Route>` | **Reine Inspektion (Read-Only):** Testet die 5 Dimensionen, liefert Ampel-Tabelle und generiert direkt den fertigen Copy-Paste-Prompt für Phase 2. |
| **Phase 1** | _(Menschliche Entscheidung)_            | **Scope-Freeze:** Optionales Bereinigen der Befundliste im kopierten Prompt (Löschen unerwünschter Zeilen).                                        |
| **Phase 2** | `Release Audit Fix: <Team \| Route>`    | **Chirurgische Fixes:** Behebt die im Prompt übergebenen Punkte minimal-invasiv via Tokens/CSS.                                                    |
| **Phase 3** | `Release Audit Gate`                    | **Finales Gate:** Führt `npm run check`, E2E-, A11y- und Release-Notes-Tests aus.                                                                  |

---

### Phase 0: Visuelle Inspektion & Triage (`Release Audit Assess: <Team | Route>`)

Kopiere diesen Prompt oder nutze den Kurz-Trigger, um eine Domäne auditieren zu lassen:

````text
Release Audit Assess: [Team 1-6 oder Route, z. B. Team 5 (/trip/1/budget)]

Führe Phase 0 (Visuelle Inspektion & Triage) für den angegebenen Bereich durch.

STRIKTE VERHALTENSREGELN FÜR DIESE PHASE:
- Dies ist eine REINE INSPEKTION (Read-Only). Ändere KEINE einzige Datei im Repository!
- Nimm KEINE Refactorings vor und schreibe keinen Produktivcode.
- Sei schonungslos objektiv: Bestätige nicht einfach, dass alles gut aussieht, sondern suche aktiv nach Enge-Problemen, abgeschnittenen Popovers, falschen Z-Indizes und fehlenden Hover-Effekten.

Vorgehensweise:
1. Starte den fokussierten E2E-Layout-Check (bei Multi-Routen-Teams komma-separiert):
   AUDIT_ROUTE=<route1,route2> npm run test:audit
2. Untersuche den Quellcode der relevanten Vue-Komponenten auf die 5 Prüf-Dimensionen:
   - Enge-Resilienz (320px / 390px: Zahlen, Badges, Tabellen, nowrap vs. wrap)
   - Overlays & Popovers (Z-Index, Clipping bei overflow: hidden, Teleport-Nutzung)
   - Interaktionen (Hover-Effekte, Focus-Visible-Ringe, Touch-Targets >= 44px)
   - Token-Konsistenz (Abstände via --space-*, Pillen via --radius-pill, Schriftgrößen)
   - Desktop-Drawer (Inhaltsverhalten bei 500px Kalenderschublade)

Ergebnis:
1. Erstelle eine strukturierte Befund-Tabelle nach folgendem Format:

| Status | Route / Komponente | Viewport / Zustand | Befund / Problem | Minimal-invasiver Lösungsvorschlag |
| :--- | :--- | :--- | :--- | :--- |
| 🔴 Blocker | `/trip/1/budget` | 320px | Betrag bricht zweizeilig um | `white-space: nowrap` auf Badge |
| 🟡 Polish | `/trip/1/spots` | Desktop Hover | Kein `:focus-visible` Ring auf Filter | Outline via `--color-focus-ring` ergänzen |
| 🟢 OK | `/trip/1/calendar` | 1280px (500px Drawer) | Spaltenbreite passt sich harmonisch an | Kein Handlungsbedarf |

2. Gib eine kurze Zusammenfassung: Anzahl Blocker (🔴), Anzahl Polish (🟡), Triage-Empfehlung.

3. VORBEREITETER ÜBERGABE-PROMPT FÜR PHASE 2 (Pflicht):
Gib am Ende IMMER direkt einen fertigen, selbsttragenden Prompt-Block für den nächsten Chat aus, der alle empfohlenen Fixes (Blocker + Polish) enthält, sodass der Entwickler ohne Nachdenken den Prompt 1:1 in das neue Chat-Fenster kopieren kann:

👉 Nächster Schritt (In einem frischen Chat für Phase 2 ausführen):
Kopiere folgenden Prompt 1:1 in ein neues Chat-Fenster:

```text
Release Audit Fix: [Team X | Route]

Freigegebene Befunde zur Behebung aus Phase 0:
1. [Route / Komponente] ([Viewport/Zustand]): [Problem] -> Lösung: [Lösungsvorschlag]
2. [Route / Komponente] ([Viewport/Zustand]): [Problem] -> Lösung: [Lösungsvorschlag]
````

(Falls du einzelne Punkte ausschließen willst, lösche vor dem Absenden im neuen Chat einfach die betreffende Zeile heraus.)

````

---

### Phase 1: Scope-Freeze & Triage-Freigabe

Der Mensch oder Lead-Entwickler sichtet die Befund-Tabelle und entscheidet:

1. **Standardfall (Alles freigeben):** Den vorbereiteten Prompt-Block aus Phase 0 einfach 1:1 kopieren und in ein frisches Chat-Fenster für Phase 2 einfügen.
2. **Auswahl anpassen:** Falls einzelne Polish-Punkte nicht gewünscht sind, vor dem Absenden im neuen Chat einfach die entsprechende Zeile aus dem Prompt löschen (oder im alten Chat kurz rückmelden, z. B. _„nur Punkt 1 und 3 fixen“_, woraufhin der Agent den Block aktualisiert).
3. **Blocker (🔴):** Müssen vor Release behoben werden (echte Layout-Brüche, unbenutzbare UI).
4. **Polish (🟡):** Werden freigegeben, wenn sie mit 1–3 Zeilen CSS ohne Nebenwirkungen korrigiert werden können.
5. **Risikobehaftete Wünsche:** Alles, was ein größeres Komponenten-Refactoring erfordern würde, wird **eingefroren** und auf die Zeit nach dem Release verschoben.

---

### Phase 2: Minimal-Invasive Härtung & Polish (`Release Audit Fix: <Team | Route>`)

Kopiere den aus Phase 0 vorbereiteten Prompt (oder nutze die Vorlage) zur Behebung freigegebener Mängel:

```text
Release Audit Fix: [Team 1-6 oder Route, z. B. Team 5 (/trip/1/budget)]

Freigegebene Befunde zur Behebung aus Phase 0:
1. [Route / Komponente] ([Viewport/Zustand]): [Problem] -> Lösung: [Lösungsvorschlag]
2. [Route / Komponente] ([Viewport/Zustand]): [Problem] -> Lösung: [Lösungsvorschlag]

Behebe ausschließlich die oben aufgeführten freigegebenen Befunde für diesen Bereich.

STRIKTE VERHALTENSREGELN FÜR DIESE PHASE:
- Maximiere Einfachheit (KISS): Keine Umstrukturierung von Komponenten, keine neuen Props/Emits, keine Store-Änderungen!
- Ausschließlich zielgerichtete CSS-/Template-Korrekturen:
  * Design-Tokens (--space-*, --color-*, --radius-pill)
  * Flex-Verhalten (min-width: 0, flex-wrap: wrap, gap)
  * Text-Handling (overflow-wrap: break-word, text-overflow: ellipsis, white-space: nowrap)
  * Popover-Fixes (z-index, Positionierung, evtl. Teleport)
  * Interaktionen (:hover, :focus-visible Übergänge)
- Teste jeden Fix sofort gegen:
  AUDIT_ROUTE=<route> npm run test:audit
- Formatiere geänderte Dateien:
  npx -y prettier --write <geänderte-dateien>
- Schließe mit einem sauberen Commit ab:
  git commit -m "fix(ui): polish <domäne> layout & popover resilience"
- VORBEREITETER HANDOFF-PROMPT FÜR DEN NÄCHSTEN SCHRITT (Pflicht):
  Gib am Ende IMMER zwingend den nächsten Schritt prominent als kopierbaren Prompt-Block für den nächsten frischen Chat aus:
  * Wenn weitere Teams ausstehen (z. B. nach Team 3 kommt Team 4):
    👉 Nächster Schritt (In einem frischen Chat für Phase 0 ausführen):
    ```text
    Release Audit Assess: Team [N+1]
    ```
  * Wenn alle Teams durchlaufen sind (z. B. nach Team 6 oder nach Scope-Abschluss):
    👉 Nächster Schritt (In einem frischen Chat für das finale Gate ausführen):
    ```text
    Release Audit Gate
    ```
````

---

### Phase 3: Finales Release-Gate (`Release Audit Gate`)

Führt die finale Qualitätssicherung vor dem Tagging/Deployment durch:

```text
Release Audit Gate

Führe das finale Release-Gate durch, um die Stabilität und Sauberkeit des Releases zu zertifizieren.

Prüfschritte:
1. Statisches Gesamt-Gate (Lint, Format, Release-Notes, Typecheck Frontend & Backend): npm run check
2. Barrierefreiheit (Axe): npm run test:a11y
3. Layout-Regressionen: AUDIT_ROUTE=/trip/1 npm run test:audit

Ergebnis:
Gib eine klare Bestätigung im Chat aus:
- Sind alle Prüfungen grün?
- Gibt es verbleibende Warnungen?
- Ist das Release freigegeben?
- Falls alle Prüfungen erfolgreich sind: Gib explizit die Bestätigung aus, dass das Pre-Release-Audit für alle Bereiche vollständig abgeschlossen ist und der PR freigegeben / gemergt werden kann.
```
