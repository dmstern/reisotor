# UI-Audit-Guide & Prompt-Vorlagen für Reisotor

Dieser Leitfaden beschreibt das Vorgehen für UI-, Layout- und Container-Query-Audits in Reisotor sowie fertige Copy-Paste-Prompts für AI-Coding-Agenten (Antigravity / Claude Code).

---

## Warum dieser Prozess?

Klassische funktionale Tests (`expect(btn).toBeVisible()`) sind visuell blind: Sie prüfen nur die Existenz im DOM, nicht aber, ob ein Element durch einen Z-Index-Konflikt überlagert wird, Text bei schmalen Viewports umbricht oder ein Dropdown durch `overflow: hidden` abgeschnitten wird.

Zusätzlich verringern auf Desktop (≥ 1024px) stufenlos verstellbare Seitenelemente die Inhaltsbreite von `.app-main` bzw. der Karte drastisch:

- **Kalenderschublade (`Drawer.vue`)**: stufenlos von **280px bis 860px** verstellbar (Standard 360px).
- **Spots-Spalte (`.spots-col` in `ExcursionsView.vue`)**: stufenlos von **280px bis 75cqw** verstellbar (Standard 380px).

Wenn Nutzer diese Schubladen öffnen und breit ziehen, schrumpft der verbleibende Platz auf bis zu **340px**, während der Viewport (`window.innerWidth`) groß bleibt (1080px oder 1280px). Daher müssen Inhalts-Komponenten immer mit `@container app-main` und beiden extremen Breitezuständen getestet werden.

---

## Tooling & Infrastruktur im Repo

1. **`e2e/tests/helpers/layout.ts`**:
   - `VIEWPORTS.narrowMobile`: 320x568px (iPhone SE, schmale Android-Geräte).
   - `VIEWPORTS.mobile`: 390x844px (Standard-Smartphone).
   - `VIEWPORTS.narrowDesktop`: 1080x900px (Desktop-Schwelle).
   - `VIEWPORTS.desktop`: 1280x800px (Standard-Laptop).
   - `expectNoHorizontalOverflow(page)`: Prüft mathematisch auf horizontalen Scrollbar-Overflow.
   - `expectMinTouchTarget(locator, minSize)`: Prüft Mindestgröße (44x44px) auf Mobile.
   - `expectNotCoveredBy(page, target, blocker)`: Prüft Sichtbarkeit per `elementFromPoint()`.
   - `setCalendarDrawerOpen(page, open)`: Öffnet/schließt die Kalender-Schublade.
   - `setCalendarDrawerWidth(page, width)`: Verstellt die Breite der Kalenderschublade stufenlos (z. B. auf 500px für Enge-Stresstests).
   - `setSpotsColumnWidth(page, width)`: Verstellt die Spots-Spalte stufenlos.
   - `getAppMainContentWidth(page)`: Misst die tatsächliche gerenderte Breite von `.app-main`.

2. **Wiederverwendbare Vorlage**:
   - `e2e/tests/scratch/audit-template.spec.ts`
   - Skript in `package.json`: `npm run test:audit` bzw. `AUDIT_ROUTE=/trip/1/spots npm run test:audit`
   - Screenshots aktivieren: `AUDIT_SCREENSHOTS=true npm run test:audit`

3. **Mikro-Ebene: Storybook Stress-Fixtures**:
   - `frontend/src/stories/stressFixtures.ts`: Standardisierte Stresstests (extrem langes deutsches Kompositum `STRESS_STRINGS.longWord`, Fließtext, Sonderzeichen und rote gestrichelte Begrenzungsrahmen `STRESS_CONTAINERS.narrow` / `ultraNarrow`).
   - Ermöglicht das visuelle Testen einzelner Komponenten im isolierten Zustand (`npm --prefix frontend run storybook`).

---

## Kurzbefehle / Trigger-Phrasen für AI-Agenten (Einfachste Bedienung)

Statt lange Prompts zu kopieren, kannst du Antigravity oder Claude Code einfach einen dieser kurzen Sätze sagen:

### 1. Nach Änderungen / Refactorings:

> **„Mach ein UI-Audit zu dem Change von eben“**
> _(oder „Führe ein UI-Audit durch“, „Layout-Audit für die Änderungen“)_

**Was der Agent daraufhin automatisch tut:**

1. Prüft per `git status` / `git diff`, welche View geändert wurde (z. B. `SpotsView.vue` oder `ExcursionsView.vue`).
2. Leitet die zu testende Route ab (z. B. `/trip/1/spots`).
3. Führt `AUDIT_ROUTE=<route> AUDIT_SCREENSHOTS=true npm run test:audit` aus.
4. Testet automatisch die Viewport-Matrix (320px narrowMobile, 390px mobile, 1080px & 1280px Desktop) inkl. Schubladen-Zuständen (offen, geschlossen, stufenlos auf 500px verbreitert).
5. Erstellt Screenshots und bindet sie in den Walkthrough ein.
6. Behebt gefundene Layout-Kollisionen (Overflows, Container-Query-Fehler) direkt defensiv.

### 2. Vor Meilensteinen oder Relaunch (Vollständige App):

> **„Mach ein komplettes App-Audit“**
> _(oder „Full App Audit“, „Pre-Release UI Audit“)_

**Was der Agent daraufhin automatisch tut:**

1. Erkennt die Regel: **Kein monolithischer Durchlauf** im selben Kontext.
2. Teilt die App autonom in 4 parallele/geordnete Domänen auf:
   - **Team 1:** Dashboard, Header, Navbar & Trip-Verwaltung (`/trip/1`, `/trips`)
   - **Team 2:** Spots, Touren & Kartenansichten (`/trip/1/spots`, `/trip/1/excursions`)
   - **Team 3:** Listen, Packliste, ToDo & Tagebuch (`/trip/1/packing`, `/trip/1/todo`, `/trip/1/diary`)
   - **Team 4:** Budget, Einstellungen, Profil & Auth (`/trip/1/budget`, `/settings`, `/profile`, `/login`)
3. Führt die Audit-Matrix für alle 4 Bereiche durch (z. B. via Subagents / `/teamwork-preview`).
4. Erstellt einen konsolidierten Audit-Report mit Screenshots und behebt gefundene Inkonsistenzen.

---

## Detaillierte Copy-Paste-Prompts (Optional / Manuell)

Falls du dem Agenten manuelle Extra-Wünsche mitgeben oder den Prompt manuell feintunen möchtest:

### Prompt A: Gezielter View-Audit (nach Refactorings / Feature-Bau)

Kopiere diesen Prompt, wenn du eine spezifische Ansicht nach Änderungen gründlich prüfen lassen willst:

```text
Führe einen gezielten Adversarial-UI-Audit für [VIEWNAME, z. B. SpotsView / ExcursionsView] durch:
1. Nutze die Vorlage unter e2e/tests/scratch/audit-template.spec.ts für die Route [z. B. /trip/1/spots].
2. Teste die Viewport- & Drawer-Matrix:
   - narrowMobile (320x568px, iPhone SE) & mobile (390x844px) auf expectNoHorizontalOverflow(page)
   - narrowDesktop (1080x900px) & desktop (1280x800px) jeweils mit geschlossener, normal geöffneter UND maximal breit gezogener Schublade (setCalendarDrawerWidth(page, 500))
   - Bei Excursions/Spots: Prüfe zusätzlich stufenlose Verstellung der Spots-Spalte (setSpotsColumnWidth)
3. Stresse die UI gezielt:
   - Öffne Modals / Dropdowns und prüfe expectNotCoveredBy() bzw. ob Menüs abgeschnitten werden.
   - Teste mit langen Strings (Zeilenumbrüche / Text-Overflow) und leeren Zuständen (Empty States).
   - Prüfe Touch-Targets auf Mobile mit expectMinTouchTarget().
4. Binde Screenshots der repräsentativen Zustände (Mobile + Desktop, hell/dunkel) in den Walkthrough ein und berichte gefundene Layout-Kollisionen.
```

---

### Prompt B: Vollständiger Pre-Release-Audit (vor Meilensteinen / 2.0 Relaunch)

Kopiere diesen Prompt, wenn du vor einem großen Release die gesamte App autonom durchtesten lassen möchtest (dauert 1–2 Stunden via Subagents):

```text
/teamwork-preview Wir bereiten den 2.0 Relaunch vor. Führe ein vollständiges, strukturiertes UI- und Layout-Audit über alle Hauptbereiche der Anwendung durch.

Vorgehensweise:
1. Teile die Anwendung in 4 spezialisierte Subagents auf:
   - Team 1: Dashboard, Header, Navbar & Trip-Verwaltung (/trip/1, /trips)
   - Team 2: Spots, Touren & Kartenansichten (/trip/1/spots, /trip/1/excursions)
   - Team 3: Listen, Packliste, ToDo, Einkauf & Tagebuch (/trip/1/packing, /trip/1/todo, /trip/1/diary)
   - Team 4: Budget, Einstellungen, Profil & Auth (/trip/1/budget, /settings, /login)
2. Jeder Subagent nutzt die Vorlage e2e/tests/scratch/audit-template.spec.ts für seine jeweiligen Routen:
   - Prüfe 320x568 (narrowMobile), 390x844 (mobile), 1080x900 (narrowDesktop) und 1280x800 (desktop)
   - Teste die Schubladen-Matrix (Desktop mit geschlossener, geöffneter und stufenlos breit gezogener Schublade)
   - Führe expectNoHorizontalOverflow(page) aus
   - Prüfe Touch-Targets (min. 44px) und Stacking Contexts / verdeckte Buttons
3. Führe alle Erkenntnisse in einem gemeinsamen Audit-Report zusammen:
   - Welche Views weisen Overflow- oder Überlappungs-Probleme auf?
   - Wo versagen Container-Queries bei geöffneter oder verbreiterter Schublade?
   - Bereite gezielte Fixes für die gefundenen Schwachstellen vor.
```
