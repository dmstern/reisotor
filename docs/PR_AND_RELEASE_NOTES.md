# PR-Workflow: Screenshots & Release-Notes (Referenz)

Dieses Dokument enthält die ausführlichen Details zu Screenshots und Release-Notes, auf die [AGENTS.md](../AGENTS.md) verweist.

## 1. Screenshots & visuelle Verifikation im PR

- **Keine automatischen Screenshots im Standard-Workflow (Token-Schutz):**
  - Screenshots (weder Baseline-Updates noch Scratch-Screenshots) dürfen **niemals automatisch oder unaufgefordert** angefertigt werden, sondern ausschließlich auf explizite Aufforderung der Nutzerin / des Nutzers (z. B. _„Erstelle bitte Vorher-/Nachher-Screenshots“_ oder _„Aktualisiere die Screenshots“_).
  - **Kein Selbst-Inspizieren per `view_file`:** Wenn der Nutzer Screenshots anfordert, erzeugt der Agent diese, legt sie ab und verlinkt sie per Markdown (`![Label](URL)`) im Chat oder Walkthrough zur Ansicht. Der Agent ruft **niemals `view_file` auf Bilddateien auf**, da jedes Bild ~4.000 multimodale Tokens in den permanenten Kontext spült. Die visuelle Prüfung erfolgt rein durch das menschliche Auge.
- **Baseline-Images (`docs/screenshots/`):**
  - Bilden den aktuellen Stand aller relevanten Ansichten der gesamten App im Git-Repo ab (`<view>-desktop-light.png` etc.). Werden nur bei expliziter Aufforderung aktualisiert (per `npm run generate:screenshots`, wird nicht automatisch in der CI erzwungen). **Niemals willkürliche neue Dateinamen erfinden oder blind dort ablegen.** Im PR per Markdown verlinken (`![Label](URL)` ohne Backticks um die URL).
  - **Interaktiver HTML-Diff-Report (`e2e/.tmp/screenshot-diffs/index.html`):** Nach jedem Lauf von `npm run generate:screenshots` wird automatisch ein lokaler visueller Diff-Report generiert (3-Spalten-Gegenüberstellung: Vorher | Diff mit roten Pixelmatch-Markierungen | Nachher inkl. Pixelanzahl und Prozentabweichung).
  - **Differenzierte Schwellwerte:** UI-Seiten nutzen feine Schwellen (~0.6 % Desktop, ~0.3 % Mobile für Text/Layout), während Leaflet-Kartenflächen dynamisch erkannt werden und mit 2.0 % Toleranz vor OSM-Kachel- und Canvas-Anti-Aliasing-Rauschen geschützt sind.
  - **Git-HEAD-Fallback:** Wurden Screenshots auf der Festplatte vorab gelöscht, holt der Generator das Referenzbild automatisch per `git show HEAD:<pfad>` aus der Git-Datenbank.
  - **Diff erzwingen:** Mit `FORCE_SCREENSHOTS=1 npm run generate:screenshots` werden alle Abweichungen (> 0 px) bedingungslos als neue Baseline gespeichert.
- **Scratch-Screenshots für Detail-/Sonderfälle (nur bei expliziter Aufforderung):**
  - Ist eine sichtbare UI-Änderung nicht durch die regulären Baseline-Images abgedeckt (z. B. einzelner Dialog, Teilkomponente, Hover-/Fehlerzustand) und der Nutzer wünscht explizit Screenshots: Vorher- und Nachher-Screenshot anfertigen und direkt im Chat/Walkthrough verlinken (ohne `view_file` auf die Bilder).
  - Diese temporären Scratch-Screenshots gehören _nicht_ in `docs/screenshots/`, sondern können per GitHub-CLI (`gh`) als Attachment an den PR angehängt werden.

## 2. Release-Notes (Detail-Leitfaden & Entscheidungskriterien)

Bei Endnutzer-relevanten Änderungen Fragment unter `release-notes/pending/<slug>.md` anlegen. Keine Fragmente für rein interne Änderungen (Tests, CI, Demo-Daten, Refactorings ohne sichtbare Verhaltensänderung).

- **1 Fragment-Datei pro PR/Feature (Schutz vor Merge-Konflikten):**
  - Jeder PR bzw. jedes unabhängige Feature legt eine eigene Datei `release-notes/pending/<feature-slug>.md` an, damit parallele Branches und Worktrees niemals dieselbe Sammeldatei editieren.
  - Wird im selben Branch/Folge-PR an einem bereits in `release-notes/pending/` beschriebenen unveröffentlichten Feature weitergearbeitet, wird dessen bestehende Fragment-Datei aktualisiert statt einen zweiten Korrektur-Eintrag anzulegen.
- **Kanonische `### `-Kategorien (Verbot eigener Überschriften!):**
  Beim Build (`generate-build-info.mjs`) und Release (`release.yml`) werden alle Fragment-Dateien automatisch anhand ihrer `### `-Überschrift geclustert, zusammengeführt und nach Priorität sortiert. Eine Fragment-Datei kann auch mehrere `### `-Abschnitte enthalten, falls ein PR mehrere Bereiche berührt. Erlaubt sind ausschließlich:
  - `### Reisen und Urlaube`
  - `### Karte und Navigation`
  - `### Spots, Touren und Unterkünfte`
  - `### Budget und Kasse`
  - `### Kalender und Planung`
  - `### Listen, Notizen und Tagebuch`
  - `### Wetter`
  - `### Verwaltung und Benutzerkonten`
  - `### Design und Bedienung`
  - `### Datenschutz und Sicherheit`
  - `### Einstellungen, Benachrichtigungen und Synchronisation`
  - `### Demo und Feedback`
  - `### Weitere Verbesserungen und Fehlerbehebungen`
  - _(Sonderkategorie `### Highlights`: Technisch erlaubt, wird aber **nicht** von einzelnen PR-Agenten vergeben, sondern erst bei der Release-Kuratierung ausgewählt, da `### Highlights` im UI alle übrigen Kategorien in ein `<CollapsibleFieldset>` einklappt.)_
- **Entscheidungskriterien (Upgrade-Perspektive gegenüber dem letzten Release `$LAST_TAG`):**
  Vor dem Anlegen oder Bearbeiten kurz prüfen, ob die betroffene Funktion im letzten Release (`LAST_TAG=$(git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo "v1.0.0")`) schon existierte (`git log $LAST_TAG -- <pfad>` oder `git grep <begriff> $LAST_TAG`):
  1. **Feature gab es im letzten Release noch NICHT:**
     - **Wird im aktuellen PR neu eingeführt:** → **Eintrag MUSS angelegt werden** (`- ✨ **Neues Feature**: ...`).
     - **Wurde bereits nach dem letzten Release auf `main` eingeführt und wird jetzt nur nachgebessert:** → **KEIN neuer Eintrag** (höchstens existierendes Fragment in `pending/` präzisieren).
  2. **Feature gab es BEREITS im letzten Release:**
     - **Wurde jetzt verbessert, erweitert oder ein Fehler behoben:** → **Eintrag MUSS angelegt werden** (`- 💡 **Verbesserung**: ...` bzw. `- 🐛 **Bugfix**: ...`).
- **Format & Sprach-Hygiene (Endnutzer-Perspektive):**
  - Datei beginnt mit einer der kanonischen `### <Kategorie-Überschrift>`en, gefolgt von `- 🎯 **Schlagwort**: Beschreibung` pro Punkt (Deutsch, verständlich für nicht-technische Endnutzer:innen).
  - Striktes Verbot von Code-Backticks (`` `...` ``), CSS-Variablen (`--color-...`), Dateinamen/Komponenten-Namen (`FormField`, `.vue`) und Issue-/PR-Nummern (`#123`).
- **Validierung:** Vor jedem Commit mit Release-Notes `npm run check:release-notes` ausführen.
