# Reisotor: Umfassender E2E-, UI/UX- und Architektur-Audit-Report

**Dokument-Version**: 1.0.0  
**Datum**: 2026-09-19  
**Verfasser**: Milestone 4 Worker (`teamwork_preview_worker`)  
**Status**: Erfolgreich abgeschlossen (100% Quality Gates & Audit Tests bestanden)  
**Artefakt-Verzeichnis**: `docs/screenshots/audit/`

---

## 1. Executive Summary

Im Rahmen des umfassenden Audits wurde die gesamte **Reisotor**-Webanwendung systematisch über alle Dimensionen hinweg geprüft und gehärtet:

- **16 Ansichten / Routen** wurden auf Layout-Integrität, Z-Index-Stapelung, visuelle Hierarchie und responsive Anpassungsfähigkeit analysiert.
- **4 Viewport-Größen** (Mobile Small 375px, Mobile Modern 390px, Tablet 768px, Desktop 1280px) wurden lückenlos abgedeckt.
- **Sämtliche Schubladen- und Sheet-Zustände** (Collapsed, Partial, Full bei Bottom Sheets; Closed, Standard, Wide, Maximized bei Desktop-Drawern) wurden auf flüssige Transitions und mathematisch exakte Snap-Höhen verifiziert.
- **5 reale Reiseszenarien** (Standard-Paarreise, Solo-Reisende, Gruppenreisen mit 3+ Mitgliedern, Reisen ohne Datum, Reisen ohne Zielort) wurden auf funktionale Fehlertoleranz und Edge-Case-Stabilität geprüft.
- **Alle aufgedeckten Mängel** aus den Bereichen Layout, ARIA-Barrierefreiheit, Design-System-Konsistenz (`DESIGN.md`) und Datenmodell-Resilienz wurden über die Milestones 1 bis 3 vollständig behoben.
- **Alle Qualitäts-Gates** (`format`, `typecheck:all`, `test:backend`, `test:frontend`, `test:a11y`, `build`) sowie die automatisierte Playwright-Audit-Suite (`audit-exhaustive.spec.ts` und `capture-remediations.spec.ts`) schließen mit **0 Fehlern, 0 Console-Errors, 0 Unhandled Page Exceptions und 0 horizontalen Overflows** ab.

---

## 2. Audit-Matrix & Untersuchungsumfang

### 2.1 Untersuchte Ansichten (16 / 16)

| #   | Ansicht / Route               | URL / Pfad                      | Geprüfte Schlüsselbereiche                                                              |
| --- | ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **Dashboard**                 | `/trip/:id`                     | Countdown, Wettervorhersage-Preview, Notizen-Preview, Strecken-Preview, Schnellaktionen |
| 2   | **Packliste**                 | `/trip/:id/listen?tab=packing`  | Segmentierung (Meine / Gemeinsam), Checkbox-Sortierung, Zuweisung, Inline-Add           |
| 3   | **Einkaufsliste**             | `/trip/:id/listen?tab=shopping` | Gruppierung nach Zeitraum/Käufer, Erledigt-Status, Segmented Control                    |
| 4   | **Todo-Liste**                | `/trip/:id/listen?tab=todo`     | Zuweisungs-Avatar-Chips, Inline-Edit, Datumswahl, Filterung                             |
| 5   | **Ausflüge & Spots**          | `/trip/:id/excursions`          | Leaflet-Karteninteraktion, Bottom Sheet Snap-States, Filter-Popovers, Tour-Zuweisung    |
| 6   | **Kalender (Mobile)**         | `/trip/:id/calendar`            | Tagesansicht, Programmpunkte, Event-Chips, responsive Navigation                        |
| 7   | **Kalender (Desktop-Drawer)** | Drawer in `App.vue`             | Side-Drawer Mount, Breitenanpassung (360px–800px), Maximierungs-Modus                   |
| 8   | **Budget & Ausgaben**         | `/trip/:id/budget`              | Ausgabenliste, Budget-Meter, Splitwise-Schuldenausgleich, Transfers, Währungen          |
| 9   | **Notizen & Ideen**           | `/trip/:id/notes`               | Rich-Text-Editor (TipTap), Tag-Filter, Ideen-Umwandlung in Kalenderpunkte               |
| 10  | **Reisetagebuch**             | `/trip/:id/diary`               | Datumsauswahl, Bildeinbindung, Card-Darstellung, Freitextformatierung                   |
| 11  | **Einstellungen**             | `/settings`                     | Icon-Styles, Farbschemata, Nutzerverwaltung, Währungseinstellungen, Version-Info        |
| 12  | **Urlaubsverwaltung**         | `/trips`                        | Trip-Karten, Modal für Mitgliederverwaltung, Anlage neuer Urlaube                       |
| 13  | **Authentifizierung**         | `/login`                        | Login- und Registrierungsformulare, Validierungsmeldungen                               |
| 14  | **Security Check**            | `/security-check`               | Captcha-/Roboter-Sicherheitsprüfung, Card-Styling, Rückmeldebotschaften                 |
| 15  | **Papierkorb**                | `/trip/:id/trash`               | Soft-Delete-Wiederherstellung, endgültiges Löschen, EmptyState                          |
| 16  | **Marketing Landing Page**    | `/landing.html`                 | Statischer Auftritt, Screenshot-Previews, responsive Darstellung                        |

### 2.2 Untersuchte Viewports (4 / 4)

| Name            | Dimensionen       | Relevanz / Geräteklasse                                               |
| --------------- | ----------------- | --------------------------------------------------------------------- |
| `mobile-small`  | **375 × 667 px**  | iPhone SE, schmale Viewport-Grenze, Formular-Umbruch, Button-Clipping |
| `mobile-modern` | **390 × 844 px**  | Standard-Smartphone-Auflösung (iPhone 13/14/15, Android Flagschiffe)  |
| `tablet`        | **768 × 1024 px** | iPad Hochformat, Desktop/Mobile-Breakpoint-Grenzbereich               |
| `desktop`       | **1280 × 800 px** | Standard-Laptop-Auflösung, Dual-Column-Layouts, Desktop-Drawer        |

### 2.3 Untersuchte Schubladen- & Drawer-Zustände

| Komponente                  | Zustand            | Verhalten / Verifikation                                                          |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| **Excursions Bottom Sheet** | `collapsed`        | Nur Handle und Header sichtbar (~56px Höhe), Karte voll bedienbar                 |
| **Excursions Bottom Sheet** | `partial` (middle) | 48% Viewport-Höhe, Liste angeschnitten, animierter Übergang                       |
| **Excursions Bottom Sheet** | `full`             | Exakt an `--sheet-max-height` geklemmt (`calc(100% - 56px - 8px)`), 0px Snap-Jump |
| **Desktop Calendar Drawer** | `closed`           | Eingeklappt, Tab sichtbar mit Squircle-Ecken                                      |
| **Desktop Calendar Drawer** | `standard open`    | 360px Standard-Breite links, Inhalt voll scrollbar                                |
| **Desktop Calendar Drawer** | `wide open`        | Per Drag-Handle auf 560px+ verbreitert                                            |
| **Desktop Calendar Drawer** | `maximized`        | Vollbild-Overlay mit zentriertem Schließen-Button                                 |

### 2.4 Untersuchte Reiseszenarien

1. **Standard-Paarreise (Lissabon Seed)**: Zwei aktive Mitglieder, vollständige Termine, Ausflüge, Ausgaben mit 50/50 Split.
2. **Solo-Reisende**: Einzelner Nutzer. Keine Käufer-Auswahl in Listen, automatische Umschaltung von `groupBy = 'buyer'` auf `'period'`, vereinfachter Budget-Status ohne Schulden-Ausgleich.
3. **Gruppenreise (3+ Personen)**: Verteilung von Todos auf mehrere Personen, mehrfache Avatar-Badges, Splitwise-Greedy-Ausgleichsalgorithmus.
4. **Reise ohne Datum**: Kein Reisezeitraum hinterlegt. Countdown und Wettervorhersage zeigen verständliche Hinweistexte ("Hinterlege einen Reisezeitraum..."), "Urlaub"-Button im Kalender führt nicht in Dead-Ends.
5. **Reise ohne Zielort**: Keine Geokoordinaten. Kartenansicht zentriert neutral, keine Endlos-Ladezustände oder JavaScript-Exceptions.

---

## 3. Behandelte Mängel & Architektonische Remediations

### 3.1 Milestone 1: Layout, Schubladen & Squircle-Design-Tokens

- **Problem 1: Kalender-Drawer Dual-Mount bei Viewport-Resize**:  
  Wenn ein Nutzer auf mobilen Geräten die Route `/trip/:id/calendar` aufrief und das Fenster anschließend auf Desktop-Breite (≥1024px) vergrößerte oder rotierte, blieb `ScheduleView` im Router-Outlet gemountet, während `App.vue` gleichzeitig die Drawer-Instanz von `ScheduleView` einblendete. Dies führte zu doppelten API-Abfragen und inkonsistentem Reaktionsverhalten.  
  _Lösung_: In `frontend/src/App.vue` überwacht ein reaktiver Watcher `isDesktop`. Wechselt der Viewport bei aktiver `calendar`-Route auf Desktop, wird die Route automatisch auf `/trip/:tripId` umgeschrieben und der Desktop-Drawer geöffnet (`drawers.openCalendar()`).

- **Problem 2: 38px-Sprung beim Loslassen des Bottom Sheets**:  
  In `frontend/src/views/ExcursionsView.vue` berechnete die JavaScript-Funktion `sheetHeightPx('full')` den Wert als `Math.min(window.innerHeight * 0.88, maxAvailable)`. Im CSS war `--sheet-max-height` jedoch als `calc(100% - 56px - 8px)` definiert. Auf einem 844px hohen Viewport resultierte dies in einem Höhenunterschied von 37,3px, der beim Loslassen der Zieh-Geste einen störenden visuellen Ruck verursachte.  
  _Lösung_: Angleichung von `sheetHeightPx('full')` an `maxAvailable`, sodass JS-Drag-Höhe und finales CSS-Snap exakt identisch sind.

- **Problem 3: Fehlende Squircle-Deklarationen (`corner-shape: squircle;`)**:  
  Gemäß `DESIGN.md` muss jede Regel mit `var(--radius-*-squircle)` zwingend auch `corner-shape: squircle;` deklarieren, um eine echte Superellipse zu zeichnen.  
  _Lösung_: Ergänzung von `corner-shape: squircle;` in 9 Komponenten: `Drawer.vue`, `TripSwitcher.vue`, `NotificationInbox.vue`, `ExcursionsView.vue`, `SearchFilterBar.vue`, `SpotOrderPicker.vue`, `ListSettingsMenu.vue`, `CreateUserDialog.vue` und `AttachmentPreviewModal.vue`.

### 3.2 Milestone 2: Komponenten, Barrierefreiheit & Primitives

- **Problem 4: Doppelte DOM-IDs in `DropdownItem.vue`**:  
  In `frontend/src/components/primitives/DropdownItem.vue` war eine statische ID (`auto-id-1788301175442-17`) hartkodiert. Beim Rendern mehrerer Multiselect-Dropdown-Items (z. B. in Filterleisten) führte dies zu identischen Checkbox-IDs und WCAG 4.1.1 Accessibility-Verletzungen.  
  _Lösung_: Verwendung der Vue 3 Funktion `useId()`, um garantiert eindeutige, SSR-sichere IDs für jede Checkbox und das zugehörige `<label for="...">` zu generieren.

- **Problem 5: Verschachtelte interaktive Steuerelemente in `TripsView.vue`**:  
  In `TripsView.vue` wurde `<Card interactive>` verwendet (welches `role="button"` und `tabindex="0"` rendert) und darin ein `<button class="trip-select">` verschachtelt. Dies verstößt gegen die WAI-ARIA- und HTML-Spezifikation (keine interaktiven Steuerelemente innerhalb von Buttons).  
  _Lösung_: Entfernung von `interactive` auf der äußeren Card und Fokussierung der Tastatur- und Klick-Interaktion ausschließlich auf den inneren Button mit sauberen Squircle-Fokus-Ringen.

- **Problem 6: Combobox Popover Overflow Clipping**:  
  In `frontend/src/components/Combobox.vue` war die Optionsliste absolut unterhalb des Eingabefeldes positioniert (`top: calc(100% + 2px)`). Befand sich die Combobox nahe dem unteren Bildschirmrand, ragten die Optionen aus dem Viewport heraus oder wurden abgeschnitten.  
  _Lösung_: Implementierung von `updatePlacement()`, das den verbleibenden Platz unterhalb misst. Bei weniger als 200px Platz klappt das Dropdown automatisch nach oben auf (`flipUp = true`), animiert über `@keyframes dropdown-unfold-up` mit dynamischer `max-height`.

- **Problem 7: Vereinheitlichung von Primitives (`Card`, `EmptyState`)**:  
  In `DiaryView.vue`, `SettingsView.vue`, `SecurityCheckView.vue` und `TrashView.vue` wurden rohe `<div class="card">` oder `<article class="card">` Tags sowie unformatierte `<p class="empty">` Absätze verwendet.  
  _Lösung_: Vollständige Umstellung auf `<Card>` und `<EmptyState>` Primitives. Beseitigung redundanter CSS-Klassen und Geisterselektoren.

### 3.3 Milestone 3: Reiseszenarien & Datenresilienz

- **Problem 8: Verwaiste Zuweisungen bei Mitgliedsentfernung**:  
  Wurde ein Mitglied aus einem Urlaub entfernt, blieben dessen IDs in `todo_items.assigned_to_user_id`, `shopping_items.assigned_to_user_id` und `packing_items.owner_id` bestehen. Im Frontend wurden diese Einträge unsichtbar, da die Filterung nur aktive Gruppenmitglieder berücksichtigte. Zudem führte die Einbeziehung verwaister Ausgaben in `budgetBalances.ts` zu verzerrten, nicht-ausgeglichenen Schuldenständen ($\sum \text{Netto} \neq 0$).  
  _Lösung_:
  1. Backend (`backend/src/routes/trips.ts`): Atomare Bereinigung innerhalb einer `db.transaction` beim Entfernen eines Mitglieds (Todos und Einkäufe werden auf `NULL` gesetzt, persönliche Packlisten-Items werden zu gemeinsamen Artikeln).
  2. Frontend: Robuste Fallbacks in `TodoView.vue`, `ShoppingListView.vue` und `PackingListView.vue`, sodass Items mit unbekannter ID als "Ehemaliges Mitglied" / unzugewiesen angezeigt werden.
  3. Budget-Berechnung: Nur von aktiven Mitgliedern getätigte Ausgaben fließen in den Schuldenausgleich ein, wodurch $\sum \text{fairShare} = \sum \text{paid}$ mathematisch garantiert ist.

- **Problem 9: Einkaufsliste-Segmentierung bei Solo-Urlauben**:  
  Wurde in `ShoppingListView.vue` die Gruppierung nach `'buyer'` (Käufer) im `localStorage` gespeichert und anschließend ein Solo-Urlaub geöffnet, blieb die Segmented Control in einem undefinierten Zustand.  
  _Lösung_: Ergänzung eines reaktiven Watchers auf `users`, der bei `users.length <= 1` automatisch auf `'period'` zurückstellt.

- **Problem 10: Dateless Trip Dead-End im Kalender**:  
  In `ScheduleView.vue` blendete der Button "Urlaub" bei Klick eine Sprungmarke zum ersten Urlaubstag an. Fehlt das Reisedatum, bewirkte der Klick nichts.  
  _Lösung_: Bindung des Buttons an `v-if="trip?.start_date"`.

- **Problem 11: Irreführender Wetter-Hinweis im Dashboard**:  
  Im Dashboard erschien bei Reisen ohne Datum der Hinweis `"Für die Urlaubstage liegt noch keine Vorhersage vor – Open-Meteo deckt nur die kommenden ~16 Tage ab..."`, obwohl schlicht kein Datum hinterlegt war.  
  _Lösung_: Differenzierte Anzeige: Fehlen Reisedaten, erscheint `"Hinterlege einen Reisezeitraum beim Urlaub, um hier die Wettervorhersage für die Urlaubstage zu sehen."`.

- **Problem 12: Design-Token-Harmonisierung**:  
  Ersetzung harter Tailwind-Hex-Codes (`#1d4ed8`, `#60a5fa`, `#2e7d32` etc.) in Dashboard-Vorschauen und Ausflugs-Chips durch semantische Variablen (`--color-accent-secondary`, `--color-success`, `--color-travel-tint` usw.).

---

## 4. Quality Gates & Test-Evidenzen

Alle definierten Quality Gates des Projekts wurden ausgeführt und mit folgenden Ergebnissen abgeschlossen:

| Quality Gate Befehl            | Zweck                                | Ergebnis / Metriken                                                |      Status       |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------ | :---------------: |
| `npm run format`               | Prettier Code-Formatting             | 100% aller Dateien entsprechen dem Codestyle, 0 Abweichungen       | **PASS** (Exit 0) |
| `npm run typecheck:all`        | Frontend + Backend TypeScript Check  | `vue-tsc --noEmit` & `tsc --noEmit`: 0 Typfehler                   | **PASS** (Exit 0) |
| `npm run test:backend`         | Fastify + SQLite Unit-Tests (Vitest) | **49 Testdateien**, **216 Tests** erfolgreich (Dauer: ~16.9s)      | **PASS** (Exit 0) |
| `npm run test:frontend`        | Vue 3 + Pinia Unit-Tests (Vitest)    | **60 Testdateien**, **401 Tests** erfolgreich (Dauer: ~18.5s)      | **PASS** (Exit 0) |
| `npm run test:a11y`            | Axe-Core Barrierefreiheits-Tests     | **6 Test-Suites**, **0 WCAG-Verletzungen** in allen Kernansichten  | **PASS** (Exit 0) |
| `npm run build`                | Produktions-Build (Vite + tsc)       | Rollup-Bundling und PWA-Generierung erfolgreich                    | **PASS** (Exit 0) |
| `audit-exhaustive.spec.ts`     | E2E Exhaustive Matrix Sweep          | **15 Test-Suites**, 0 Console Errors, 0 Page Errors, 0 Overflows   | **PASS** (Exit 0) |
| `capture-remediations.spec.ts` | Remediation Verification & Capture   | **8 Test-Suites**, alle 50 visuellen Artefakte erfolgreich erzeugt | **PASS** (Exit 0) |

---

## 5. Screenshot-Index & Visuelle Nachweise

Alle 50 Screenshot-Artefakte befinden sich im Verzeichnis `docs/screenshots/audit/` und sind relative Pfade bezogen auf das Projektverzeichnis.

### 5.1 Ansichten-Baselines (Desktop 1280px & Mobile 390px)

| Ansicht               | Desktop-Baseline (1280px)                                | Mobile-Baseline (390px)                                 |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **Dashboard**         | `docs/screenshots/audit/dashboard-desktop-baseline.png`  | `docs/screenshots/audit/dashboard-mobile-baseline.png`  |
| **Packliste**         | `docs/screenshots/audit/packing-desktop-baseline.png`    | `docs/screenshots/audit/packing-mobile-baseline.png`    |
| **Einkaufsliste**     | `docs/screenshots/audit/shopping-desktop-baseline.png`   | `docs/screenshots/audit/shopping-mobile-baseline.png`   |
| **Todo-Liste**        | `docs/screenshots/audit/todo-desktop-baseline.png`       | `docs/screenshots/audit/todo-mobile-baseline.png`       |
| **Ausflüge & Spots**  | `docs/screenshots/audit/excursions-desktop-baseline.png` | `docs/screenshots/audit/excursions-mobile-baseline.png` |
| **Kalender**          | `docs/screenshots/audit/calendar-desktop-baseline.png`   | `docs/screenshots/audit/calendar-mobile-baseline.png`   |
| **Budget & Finanzen** | `docs/screenshots/audit/budget-desktop-baseline.png`     | `docs/screenshots/audit/budget-mobile-baseline.png`     |
| **Notizen & Ideen**   | `docs/screenshots/audit/notes-desktop-baseline.png`      | `docs/screenshots/audit/notes-mobile-baseline.png`      |
| **Reisetagebuch**     | `docs/screenshots/audit/diary-desktop-baseline.png`      | `docs/screenshots/audit/diary-mobile-baseline.png`      |
| **Einstellungen**     | `docs/screenshots/audit/settings-desktop-baseline.png`   | `docs/screenshots/audit/settings-mobile-baseline.png`   |
| **Urlaubsverwaltung** | `docs/screenshots/audit/trips-desktop-baseline.png`      | `docs/screenshots/audit/trips-mobile-baseline.png`      |

### 5.2 Schubladen & Drawer-Zustände

| Komponente & Zustand                | Dateipfad                                                                 | Beschreibung                                                              |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Excursions Sheet (Collapsed)**    | `docs/screenshots/audit/remediation-excursions-sheet-collapsed-390px.png` | Eingeklappter Zustand; Karte vollflächig sichtbar, Handle am unteren Rand |
| **Excursions Sheet (Middle)**       | `docs/screenshots/audit/remediation-excursions-sheet-middle-390px.png`    | 48%-Snap-Zustand; Spots-Liste angeschnitten zur bequemen Bedienung        |
| **Excursions Sheet (Full)**         | `docs/screenshots/audit/remediation-excursions-sheet-full-390px.png`      | Vollbild-Zustand; bündig an Header abschließend ohne Höhen-Sprung         |
| **Desktop Drawer (Closed)**         | `docs/screenshots/audit/calendar-drawer-closed-desktop-baseline.png`      | Eingeklappter Kalender-Drawer; Squircle-Tab am linken Bildschirmrand      |
| **Desktop Drawer (Standard 360px)** | `docs/screenshots/audit/remediation-calendar-drawer-desktop-1280px.png`   | 360px breiter Kalender neben dem Hauptinhalt                              |
| **Desktop Drawer (Wide 560px)**     | `docs/screenshots/audit/calendar-drawer-wide-desktop-baseline.png`        | Verbreiterter Drawer nach manuellem Ziehen am Resize-Handle               |
| **Desktop Drawer (Maximized)**      | `docs/screenshots/audit/calendar-drawer-maximized-desktop-baseline.png`   | Vollbild-Kalenderansicht auf Desktop                                      |

### 5.3 Spezifische Remediation-Nachweise

| Remediation-Bereich                 | Dateipfad                                                                   | Nachgewiesenes Verhalten                                              |
| ----------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Kalender Mobile-Route (375px)**   | `docs/screenshots/audit/remediation-calendar-route-mobile-375px.png`        | Standalone-Route `/calendar` auf Mobile ohne Drawer-Duplikation       |
| **Squircles in Dialogen & Modals**  | `docs/screenshots/audit/remediation-squircles-modals-dialogs.png`           | `TripMembersDialog` mit konsistenten Squircle-Kurven nach `DESIGN.md` |
| **Squircles in Settings-Cards**     | `docs/screenshots/audit/remediation-squircles-settings-cards.png`           | Alle Settings-Sektionen verwenden saubere `<Card>` Superellipsen      |
| **Squircles auf Drawer-Tabs**       | `docs/screenshots/audit/remediation-squircles-drawer-tab.png`               | Tab-Knopf mit `corner-shape: squircle;` bündig anliegend              |
| **Combobox Upward-Flip**            | `docs/screenshots/audit/remediation-combobox-flip-up.png`                   | Dropdown klappt bei Platzmangel am unteren Rand sauber nach oben auf  |
| **DropdownItem Dynamic IDs**        | `docs/screenshots/audit/remediation-dropdownitem-dynamic-ids.png`           | SSR- und Test-sichere `useId()` Vergabe ohne Duplikate                |
| **Verwaiste Mitglieder (Todo)**     | `docs/screenshots/audit/remediation-unassigned-former-members-todo.png`     | Gelöschte Mitglieder-Todos erscheinen unter "Unzugeordnet"            |
| **Verwaiste Mitglieder (Shopping)** | `docs/screenshots/audit/remediation-unassigned-former-members-shopping.png` | Einkäufe ehemaliger Nutzer bleiben sichtbar und editierbar            |
| **Verwaiste Mitglieder (Packing)**  | `docs/screenshots/audit/remediation-unassigned-former-members-packing.png`  | Persönliche Items werden automatisch zu gemeinsamen Artikeln          |
| **EmptyState (Budget)**             | `docs/screenshots/audit/remediation-emptystate-budget.png`                  | Standardisierter `<EmptyState>` mit Sparschwein-Icon und Hilfetext    |
| **EmptyState (Todo)**               | `docs/screenshots/audit/remediation-emptystate-todo.png`                    | Standardisierter `<EmptyState>` in der Todo-Liste                     |
| **EmptyState (Shopping)**           | `docs/screenshots/audit/remediation-emptystate-shopping.png`                | Standardisierter `<EmptyState>` in der Einkaufsliste                  |
| **EmptyState (Tagebuch)**           | `docs/screenshots/audit/remediation-emptystate-diary.png`                   | Standardisierter `<EmptyState>` im Tagebuch                           |
| **Solo-Urlaub Einkaufsliste**       | `docs/screenshots/audit/remediation-solo-trip-shopping.png`                 | Keine überflüssige Käufer-Auswahl bei Einzelreisenden                 |
| **Urlaub ohne Datum (Kalender)**    | `docs/screenshots/audit/remediation-dateless-trip-schedule.png`             | Kein ins Leere führender "Urlaub"-Sprungknopf                         |
| **Urlaub ohne Datum (Wetter)**      | `docs/screenshots/audit/remediation-dateless-trip-weather.png`              | Verständlicher Hinweis zur Datumseingabe statt Open-Meteo-Meldung     |

---

## 6. Fazit

Der Zustand der Reisotor-Applikation entspricht nach Abschluss des Audits und der Milestones 1–4 vollständig den Vorgaben von `ORIGINAL_REQUEST.md`, `AGENTS.md` und `DESIGN.md`.

- Es existieren **keine versteckten Layout-Überläufe**, **keine Z-Index-Kollisionen** und **keine blockierenden Interaktionsfehler**.
- Alle Komponenten halten sich strikt an das Design-System (Primitives, Squircle-Tokens, semantische Farbvariablen).
- Die Testabdeckung über Unit-, E2E- und Accessibility-Suiten ist zu 100% grün.
- Die erstellten Dokumente und Screenshots bieten eine vollständige, nachvollziehbare Grundlage für die Abnahme des Pull Requests.
