# UI-Audit Prompt-Vorlagen

## Prompt 1: Gezielter View-Audit nach Änderungen / Refactorings

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
   - Falls du gefundene Layout-Kollisionen direkt behebst: Halte dich strikt an DESIGN.md (ausschließlich --space-* und --color-*-Tokens, keine Ad-hoc-Pixelwerte oder improvisierte Inline-Styles).
   - WICHTIG: Führe im Rahmen dieses Layout-Audits KEIN eigenmächtiges Groß-Refactoring durch – nutze für architektonisches Aufräumen stattdessen Prompt 3.
```

## Prompt 2: Umfassender Pre-Release-Audit (vor Meilensteinen / 2.0 Relaunch via Subagents)

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
3. Führe die Ergebnisse in einem gemeinsamen Audit-Report zusammen und behebe gefundene Layout-Fehler.
```

## Prompt 3: Design-System- & Clean-Code-Audit (View-Refactoring)

```text
Führe ein gründliches Code- und Design-System-Review für [VIEWNAME / DATEI, z. B. SpotsView.vue] durch.
Prüfe gnadenlos auf Einhaltung der Richtlinien aus DESIGN.md und AGENTS.md:

1. Design-System & UI-Primitives (DESIGN.md):
   - Keine freien px-Abstände oder Farben: Ersetze lokale Werte konsequent durch --space-* und --color-*-Tokens aus style.css.
   - Keine Re-Erfindung von UI-Elementen: Prüfe, wo bestehende Primitives (Button, IconButton, Card, Input, Badge, DetailRow, EmptyState unter components/primitives/) wiederverwendet werden müssen.
   - UI-Lib erweitern: Falls ein neues UI-Element sinnvoll und wiederverwendbar ist, extrahiere es als neues Primitiv nach components/primitives/ statt es lokal einzubetten.
   - Eckenrundung (Squircle vs. Kreisbogen), Typografie und Schatten (--shadow-sm/--shadow-md) strikt gemäß DESIGN.md einhalten.

2. Architektur & Wartbarkeit (AGENTS.md, SoC & SRP):
   - Komponenten-Zerlegung: Prüfe die Dateigröße. Ist die View zu monolithisch (>300–400 Zeilen), zerschneide sie nach dem Single Responsibility Principle (SRP) in fokussierte, lesbare Unterkomponenten (z. B. Listen-Item, Filterleiste, Header-Bereich).
   - Separation of Concerns: Darstellung/Layout in die View/Komponenten, Geschäftslogik/Zustand in Stores oder Composables.

3. Verifikation & Qualitätssicherung:
   - Führe npm run typecheck und die betroffenen Unit-Tests (npx -y vitest run <testdatei> --bail 1) aus.
   - Formatiere alle geänderten Dateien (npx -y prettier --write <datei>).
   - Fasse transparent zusammen: Welche Tokens wurden vereinheitlicht, welche Primitives wiederverwendet/neu erstellt und welche Komponenten extrahiert?
```
