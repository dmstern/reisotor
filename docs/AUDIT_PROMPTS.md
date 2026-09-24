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
