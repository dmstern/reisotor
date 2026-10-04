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
   - `PackingListView.vue` → `/trip/1/packing`
   - `TodoView.vue` → `/trip/1/todo`
   - `DiaryView.vue` → `/trip/1/diary`
   - `BudgetView.vue` → `/trip/1/budget`
   - `DashboardView.vue` → `/trip/1`
   - `SettingsView.vue` → `/settings`
   - `LoginView.vue` → `/login`
2. **Audit ausführen:** Führe `AUDIT_ROUTE=<route> npm run test:audit` aus (standardmäßig **ohne** `AUDIT_SCREENSHOTS=true`).
3. **Ergebnis bewerten:**
   - Wurden horizontale Overflows oder Berührungsziel-Verletzungen gefunden?
   - Treten Kollisionen bei stufenlos geöffneter Schublade auf Desktop auf?
4. **Defensiv beheben:** Behebe Layout-Kollisionen ausschließlich unter strikter Einhaltung von [`DESIGN.md`](../DESIGN.md) (Design-Tokens `--space-*`, `--color-*`, Container-Queries `@container app-main`, Flexbox-Wrapping). Keine ad-hoc Inline-Styles oder magische Pixelabstände!
5. **Screenshots nur auf Abruf:** Screenshots werden **niemals unaufgefordert** erstellt. Nur wenn die Nutzerin / der Nutzer explizit Screenshots verlangt, führe den Befehl mit `AUDIT_SCREENSHOTS=true` aus und verlinke die Bilder per Markdown im Walkthrough (niemals per `view_file` selbst öffnen).

---

## 4. Projektweiter Pre-Release-Gesamt-Audit (Meilenstein-Gate)

Vor großen Releases (z. B. Reisotor 2.0) oder Meilensteinen erfolgt die ganzheitliche Prüfung aller Bereiche der App.

### Grundregel: Keine diffusen monolithischen Mega-Prompts

Ein vollständiger UI-Check darf **niemals als ein einziger, unstrukturierter Durchlauf in einem einzigen Kontextfenster** beauftragt werden. Solche Aufträge führen bei LLMs zu kombinatorischer Überlastung und blinden Falsch-Positiven („Alles geprüft, sieht gut aus“).

Stattdessen **muss** eine systematische Aufteilung in 4 Fachdomänen (Divide & Conquer via Subagents) erfolgen:

- **Team 1 (Dashboard & Trips):** `/trip/1`, `/trips`
- **Team 2 (Spots & Touren):** `/trip/1/spots`, `/trip/1/excursions`
- **Team 3 (Listen & Content):** `/trip/1/packing`, `/trip/1/todo`, `/trip/1/diary`
- **Team 4 (Finanzen & Auth/Settings):** `/trip/1/budget`, `/settings`, `/profile`, `/login`

### Orchestrierungs-Prompt (Kopieren bei Release-Vorbereitung)

```text
/teamwork-preview Wir bereiten das Release vor. Führe ein vollständiges, strukturiertes UI- und Layout-Audit durch.

Vorgehensweise:
1. Teile die Anwendung in 4 parallele Subagents auf:
   - Team 1: Dashboard, Header, Navbar & Trip-Verwaltung (/trip/1, /trips)
   - Team 2: Spots, Touren & Kartenansichten (/trip/1/spots, /trip/1/excursions)
   - Team 3: Listen, Packliste, ToDo, Einkauf & Tagebuch (/trip/1/packing, /trip/1/todo, /trip/1/diary)
   - Team 4: Budget, Einstellungen, Profil & Auth (/trip/1/budget, /settings, /login)
2. Jeder Subagent nutzt e2e/tests/scratch/audit-template.spec.ts für seine Routen:
   - 320x568 (narrowMobile), 390x844 (mobile), 1080x900 (narrowDesktop) und 1280x800 (desktop)
   - Schubladen-Matrix (Desktop mit offener und geschlossener Schublade)
   - expectNoHorizontalOverflow(page)
   - Touch-Targets und Stacking Contexts
3. Führe die Ergebnisse in einem gemeinsamen Audit-Report zusammen und behebe gefundene Layout-Fehler defensiv mit Tokens.
```
