# View- & Komponenten-Refactoring Prompts

Diese Prompts dienen der systematischen Qualitätsprüfung und Überarbeitung überlanger oder historisch gewachsener Views und Komponenten in Reisotor (z. B. im Rahmen von Refactoring-Tickets wie #446).

Statt einer oberflächlichen Code-Verschiebung folgt die Überarbeitung dem **SFC-Schichten-Modell (von innen nach außen entlang der Vue-Natur: `<script>` → `<template>` → `<style>`)**:

```mermaid
flowchart LR
    P1["Phase 1: Logik & State<br/><b>&lt;script setup&gt;</b><br/><i>Composables, Dead Code & State-Entflechtung</i>"]
    --> P2["Phase 2: UI & Deduplizierung<br/><b>&lt;template&gt;</b><br/><i>Subkomponenten, Primitives & Konsolidierung</i>"]
    --> P3["Phase 3: Tokens & Stresstest<br/><b>&lt;style&gt; & Browser</b><br/><i>Design-Tokens, Container Queries & Layout-Audit</i>"]
    --> P4["Phase 4: Review & Meta<br/><b>Branch & Meta-Lerneffekt</b><br/><i>Konsolidierung, PR-Bilanz & Prompt-Refinement</i>"]
```

> [!NOTE]
> **Projektweiter Pre-Release-Audit:** Für das ganzheitliche Testen der gesamten App vor Releases via paralleler Subagent-Teams siehe [`docs/UI_AUDIT_GUIDE.md`](UI_AUDIT_GUIDE.md#pre-release-gesamt-audit-orchestrierung--team-prompt).

---

## Kurz-Trigger für Sessions (Schnellstart)

Um in Agent-Sessions (Antigravity / Claude Code) für Refactoring-Tickets wie [#446](https://github.com/dmstern/reisotor/issues/446) nicht jedes Mal die langen Prompt-Blöcke kopieren zu müssen, reagieren Agenten auf folgende standardisierte Kurz-Trigger:

| Phase       | Kurz-Trigger                                                   | Fokus & Umfang                                                                                                 |
| :---------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Phase 1** | `Refactor Phase 1: <datei>`                                    | `<script setup>` entflechten, Dead Code tilgen, Composables erstellen. Template & Styles bleiben unangetastet. |
| **Phase 2** | `Refactor Phase 2: <datei>`                                    | `<template>` dekomponieren, Subkomponenten & Primitives nutzen, State & Assets lokalisieren.                   |
| **Phase 3** | `Refactor Phase 3: <datei>`                                    | `<style>` mit Design-Tokens säubern, `@media` restlos durch `@container` ersetzen & Layout-Audit.              |
| **Phase 4** | `Refactor Phase 4: <datei>`<br/>_(`Refactor Review: <datei>`)_ | Ganzheitlicher Branch-Check (`git diff main`), Rest-Altlasten tilgen, PR-Bilanz & Meta-Refinement der Prompts. |

> [!TIP]
> **Kontext-Disziplin & Session-Trennung:** Jede Phase baut auf dem sauberen Git-Stand der Vorphase auf und wird bevorzugt in einer **frischen Agent-Session / einem separaten Chat auf demselben Branch** ausgeführt (mit jeweils vorangehendem semantischem Commit). Dies verhindert Kontext-Drift, Token-Explosion und Error-Compounding, die bei unbeaufsichtigten Multi-Agent-Kaskaden auftreten würden.

_Beispiel-Eingabe im Chat:_

```text
Refactor Phase 1: frontend/src/views/ExcursionsView.vue
```

Sobald dieser Trigger fällt, zieht der Agent eigenständig die detaillierten Regeln und Prüfschritte der jeweiligen Phase heran.

---

## Phase 1: Logik- & State-Entflechtung (`<script setup>` & Composables)

Kopiere diesen Prompt für den ersten Schritt bei großen, historisch gewachsenen Komponenten.
**Ziel:** Den Script-Bereich massiv verschlanken, tote Altlasten eliminieren und saubere State-Schnittstellen schaffen. Das Template und die Styles bleiben in diesem Schritt im Wesentlichen unangetastet.

```text
Führe Phase 1 (Logik- & State-Entflechtung) für [KOMPONENTE / VIEW, z. B. frontend/src/views/SettingsView.vue] durch.
Ziel ist die Entflechtung des <script setup>-Bereichs, die Beseitigung von Altlasten und das Auslagern von Logik in fokussierte Composables.

1. Entrümpelung & Dead-Code-Beseitigung:
   - Identifiziere und lösche unbenutzte Imports, verwaiste ref()s/computed()s, tote Hilfsfunktionen und auskommentierten Code.
   - Beseitige frühere Agenten-Workarounds, redundante Berechnungen oder doppelte State-Haltungen.

2. State & Fachlogik in Composables extrahieren:
   - Lagere zusammenhängende Geschäfts-, Berechnungs-, Filter- oder Sortierlogik in neue, fokussierte Composables unter frontend/src/composables/ (z. B. useSettingsForm.ts, useTripPermissions.ts) oder Pinia-Stores aus.
   - Vermeide riesige "Sammelbecken"-Composables: Schneide Logik gezielt nach fachlichen Domänen (z. B. useUserManagement.ts, usePushSettings.ts).
   - Formular- & Modal-State entkoppeln: Vermeide übergroße "Super-Form"-Composables, die Add- UND Edit-Logik samt Drafts in ein einziges 300+-Zeilen-Objekt stopfen. Trenne Formulare nach Verwendungszweck (z. B. useAddExpenseForm vs. useEditExpenseForm) oder bereite den State so vor, dass Modals ihren lokalen Form-Lifecycle in Phase 2 selbst instanziieren können, anstatt monströse State-Objekte durch die Haupt-View zu schleusen.
   - Definiere klare TypeScript-Interfaces für Optionen und Rückgabewerte.
   - Halte das <script setup> der Hauptkomponente schlank: Es dient nur noch der Orchestrierung und Bereitstellung der Daten.

3. Template & Styles intakt lassen (Verhinderung von Prop-Drilling-Spaghetti):
   - Zerlege in diesem Schritt noch KEIN Template in Kindkomponenten! Zuerst muss der State sauber sein, damit wir in Phase 2 wissen, welche Subkomponente welche Schnittstelle benötigt.
   - Ändere keine CSS-Klassen oder Styles.

4. Verifikation & Qualitätssicherung:
   - Führe npm run typecheck und betroffene Unit-Tests aus (Backend: npx -y vitest run <testdatei> --bail 1, Frontend: npm --prefix frontend test -- <testdatei> --bail 1).
   - Formatiere alle geänderten und neu erstellten Dateien (npx -y prettier --write <datei>).
   - Fasse transparent zusammen: Welche Composables wurden erstellt, wie viel Dead Code wurde gelöscht und um wie viele Zeilen ist das <script setup> geschrumpft?
   - Hinweis: Nach erfolgreichem Review folgt Phase 2 (UI-Dekomposition & Deduplizierung).
```

---

## Phase 2: UI-Dekomposition & Deduplizierung (`<template>`, Subkomponenten & Primitives)

Kopiere diesen Prompt für den zweiten Schritt, nachdem der State sauber in Composables entflochten ist.
**Ziel:** Das Template modularisieren, redundante UI-Muster zusammenführen und bestehende Design-System-Primitives einbinden.

```text
Führe Phase 2 (UI-Dekomposition & Deduplizierung) für [KOMPONENTE / VIEW, z. B. frontend/src/views/SettingsView.vue] durch.
Der Script-State ist bereits sauber entflochten. Nun wird das <template> modularisiert und auf Wiederverwendbarkeit getrimmt.

1. Deduplizierung & Konsolidierung (Gemeinsamkeiten vereinen statt klonen):
   - Analysiere wiederkehrende DOM-Muster im Template (z. B. ähnliche Cards, Listeneinträge, Filterleisten).
   - Führe ähnliche Abschnitte zu EINER flexiblen, wiederverwendbaren Subkomponente zusammen, statt blind 3 leicht unterschiedliche Varianten zu kopieren.

2. UI-Primitives sofort nutzen (components/primitives/):
   - Ersetze lokale HTML-Ad-hoc-Elemente (z. B. eigene <button class="btn...">, Badge-Pills oder Card-Container) direkt durch bestehende Primitives:
     Button, IconButton, Card, Badge, Input, DetailRow, EmptyState.
   - Falls ein neues UI-Element mehrfach nützlich ist: Als neues Primitiv unter frontend/src/components/primitives/ anlegen.

3. Subkomponenten & Dialoge schnüren:
   - Kapsele große Modals, Drawers oder eigenständige Abschnitte in neue Kindkomponenten unter frontend/src/components/...
   - Nutze saubere TypeScript defineProps<{...}>() und defineEmits<{...}>(). Da der State in Phase 1 modularisiert wurde, binde Subkomponenten entweder direkt an das passende Composable an oder übergebe minimale, fokussierte Props.
   - Vermeide monolithisches Prop-Drilling ganzer Composable-Return-Typen (z. B. props.form: ReturnType<typeof useForm>) und Destrukturierungen in <script setup>, die Reaktivität gefährden. Modals/Drawers mit isoliertem Formular-Lifecycle sollten ihr Composable bevorzugt direkt selbst instanziieren.

4. Lokalisierung & Refinement von State und Assets:
   - Sobald Subkomponenten stehen: Prüfe, ob in Phase 1 erstellte Composables, Helper oder Icon-Definitionen, die ausschließlich in einer einzigen Subkomponente benötigt werden, direkt dorthin umgezogen oder feiner aufgeteilt werden können (z. B. tab-spezifische Reset-Logik direkt im Tab halten; Sektions-Icons direkt in der Subkomponente instanziieren statt im globalen Tab-Composable).
   - Bereinige historische CSS-Klassennamen aus Copy-Paste-Ursprüngen, damit sie zum neuen Kontext passen.

5. Verifikation & Qualitätssicherung:
   - Führe npm run typecheck und betroffene Tests aus.
   - Schreibe gezielte Unit-Tests (frontend/src/components/<Name>.test.ts) für neue, deduplizierte Kernkomponenten (insbesondere Toolbars, Formularfeld-Gruppen oder Dropdowns) und führe sie isoliert aus (npm --prefix frontend test -- <testdatei>).
   - Formatiere alle geänderten Dateien (npx -y prettier --write <datei>).
   - Fasse transparent zusammen: Welche Subkomponenten wurden extrahiert, welche Primitives wurden wiederverwendet und welche Redundanzen wurden eliminiert?
   - Hinweis: Nach erfolgreichem Review folgt Phase 3 (Design-Tokens & Layout-Härtung).
```

---

## Phase 3: Design-Tokens, Container-Queries & Layout-Härtung (`<style>` & Browser-Stresstest)

Kopiere diesen Prompt für den dritten Schritt, wenn Struktur und Komponenten stehen.
**Ziel:** CSS-Bereinigung mit Design-Tokens und visueller Härtung gegen Viewports und stufenlose Engezustände im echten Browser.

```text
Führe Phase 3 (Design-Tokens & Layout-Härtung) für [KOMPONENTE / VIEW, z. B. frontend/src/views/SettingsView.vue] durch.
Prüfe auf Einhaltung der Richtlinien aus DESIGN.md und führe einen Browser-Stresstest durch:

1. Design-Tokens & CSS-Bereinigung:
   - Keine freien Pixelwerte oder Ad-hoc-Farben: Ersetze lokale Werte konsequent durch --space-*, --font-size-*, --radius-* und --color-*-Tokens aus style.css.
   - Eckenrundungen (Squircle vs. Kreisbogen), Typografie und Schatten (--shadow-sm/--shadow-md) strikt gemäß DESIGN.md vereinheitlichen.
   - Additive Token-Ergänzungen in style.css: Fehlt für kleine UI-Elemente (z. B. Sub-Badges, Kalender-Pillen, Metatags) ein kleinerer Radius- oder Abstandswert im Design-System, darf dieser additiv in style.css ergänzt werden (z. B. --radius-xs: 6px; und --radius-xs-squircle inklusive Squircle-Feature-Query), anstatt unsaubere Ad-hoc-Pixelwerte im Komponenten-Style zu belassen.
   - Beseitige CSS-Hacks früherer Agenten (!important, negative Margins, willkürliche Z-Indizes) durch sauberes Flexbox/Grid.

2. Container-Queries & Enge-Resilienz (Ersetzen statt Duplizieren):
   - Keine starren Pixelbreiten in Subkomponenten.
   - Ersetze bestehende @media-Breakpoints innerhalb von .app-main restlos durch @container app-main (max-width/min-width: ...) oder flexibles Flexbox-Wrapping (flex-wrap: wrap).
   - Keine redundanten @media-Blöcke parallel stehen lassen: Alte @media-Regeln müssen gelöscht werden, um CSS-Duplikate und unerwünschte Drawer-Effekte zu vermeiden.

3. Adversarial Browser-Stresstest (Playwright):
   - Nutze die Vorlage unter e2e/tests/scratch/audit-template.spec.ts für die Route [z. B. /settings bzw. /trip/1/excursions].
   - 3-Viewport-Matrix: narrowMobile (320x568px), mobile (390x844px), desktop (1280x800px).
   - Enge-Matrix: Desktop mit maximal breit gezogener Schublade (setCalendarDrawerWidth(page, 500)) bzw. Spots-Spalte (setSpotsColumnWidth).
   - Checks: expectNoHorizontalOverflow(page), Touch-Targets auf Mobile (expectMinTouchTarget), lange Strings und expectNotCoveredBy().
   - Behebe gefundene Layout-Kollisionen direkt defensiv mit Tokens.
   - Scope-Disziplin: Härte primär die dekomponierten Subkomponenten und die View selbst. Externe, bereits eigenständige Komponenten nur anpassen, wenn der Stresstest auf der Route dort konkrete Kollisionen meldet.

4. Verifikation & Qualitätssicherung:
   - Führe npm run typecheck und AUDIT_ROUTE=<route> npm run test:audit aus.
   - Formatiere alle geänderten Dateien (npx -y prettier --write <datei>).
   - Binde Screenshots nur auf explizite Aufforderung in den Walkthrough ein.
   - Fasse transparent zusammen: Welche Tokens wurden vereinheitlicht und welche Layout-Kollisionen wurden behoben?
   - Hinweis: Nach erfolgreichem Abschluss folgt Phase 4 (Konsolidierung, Review & Meta-Refinement).
```

---

## Phase 4: Konsolidierung, Review & Meta-Refinement (Branch-Review & Prompt-Lerneffekte)

Kopiere diesen Prompt für den abschließenden Schritt nach Durchlauf der Phasen 1 bis 3 (oder nutze `Refactor Phase 4: <datei>` bzw. `Refactor Review: <datei>`).
**Ziel:** Ganzheitliche Konsolidierung aller Änderungen im Branch, Aufspüren von übrig gebliebenen Altlasten oder Redundanzen über alle Schichten hinweg, Vorbereitung der finalen PR-Bilanz und die iterative Schärfung des Refactoring-Prozesses auf Meta-Ebene.

```text
Führe Phase 4 (Konsolidierung, Review & Meta-Refinement) für [KOMPONENTE / VIEW, z. B. frontend/src/views/SettingsView.vue] durch.
Alle drei Schichten (<script>, <template>, <style>) wurden in den Vorphasen überarbeitet. Nun erfolgt die ganzheitliche Konsolidierung und der Meta-Review.

1. Branch-weites Diff- & Konsolidierungs-Review:
   - Analysiere das gesamte Diff des aktuellen Branches gegen main (git diff main...HEAD --stat).
   - Prüfe auf Rest-Altlasten über alle Phasen hinweg: Gibt es verwaiste Imports, ungenutzte Types/Interfaces, tote CSS-Klassen oder versehentlich stehen gelassene Debug-Logs/Kommentare?
   - Konsistenz-Check: Wurden Composables und Subkomponenten einheitlich benannt und modular in den vorgesehenen Verzeichnissen (frontend/src/composables/, frontend/src/components/...) abgelegt?

2. Finale Verifikation & CI-Readiness:
   - Führe npm run typecheck und die fokussierten Unit-Tests der neuen Subkomponenten/Composables aus (Backend: npx -y vitest run <testdatei> --bail 1, Frontend: npm --prefix frontend test -- <testdatei> --bail 1).
   - Stelle sicher, dass alle geänderten Dateien mit Prettier formatiert sind (npx -y prettier --write <dateien>).
   - Prüfe git status auf absolute Sauberkeit (keine ungetrackten Testdateien, Scratch-Specs oder temporäre Artefakte).

3. PR-Walkthrough & quantitative Bilanz:
   - Erstelle eine strukturierte Zusammenfassung für den PR:
     - Vorher/Nachher-Zeilenbilanz der Haupt-View / Komponente.
     - Liste neu entstandener Composables (inkl. fachlicher Domäne).
     - Liste neu entstandener Subkomponenten & genutzter Primitives.
     - Vereinheitlichte Design-Tokens und behobene Enge-/Layout-Probleme.

4. Meta-Evaluation des Refactoring-Workflows:
   - Reflektiere den Durchlauf: Gab es spezifische Hürden oder wiederkehrende Fallstricke (z. B. Reaktivitätsverlust beim Prop-Passing, Container-Query-Sonderfälle, unvollständige Mockups in Tests)?
   - Schärfe bei Bedarf direkt die Prompts in docs/AUDIT_PROMPTS.md oder die Design-Vorgaben in DESIGN.md additiv mit den neu gewonnenen Erkenntnissen nach, damit nachfolgende Refactorings automatisch davon profitieren.
```
