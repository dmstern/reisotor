# DESIGN.md

Design-Prinzipien für Reisotor: was neue UI-Elemente über Farben, Abstände, Eckenrundung, Icons
und Breakpoints hinweg konsistent halten soll. `frontend/src/style.css` ist die Quelle der Wahrheit
für die tatsächlichen Werte (CSS-Variablen im `:root`-Block) – diese Datei hält die *Prinzipien*
und *Faustregeln* dahinter fest, damit sie nicht nur implizit im CSS stehen. Bei jedem neuen
UI-Baustein oder jeder sichtbaren UI-Änderung hier kurz nachschauen, ob ein bestehendes Muster
zutrifft, statt ad hoc neue Werte zu erfinden – und diese Datei ergänzen, wenn dabei ein neues,
wiederverwendbares Prinzip entsteht.

Für architektonische/UX-Ablauf-Muster (Querverweise springen zur Ursprungs-View, Undo-Delete,
Echtzeit-Highlight, …) siehe stattdessen den Abschnitt "Konsistenz-Check bei Änderungen" in
`CLAUDE.md` – hier geht es nur um die visuelle Ebene.

## Farben

Alle Farben laufen über CSS-Variablen (`--color-*` im `:root`-Block), nie als Hex-Wert direkt in
einer Komponente. Grund: Dark Mode (`@media (prefers-color-scheme: dark)` + manueller Override via
`[data-theme]` auf `<html>`, siehe `stores/theme.ts`) überschreibt dieselben Variablennamen komplett
– eine hartkodierte Farbe in einer Komponente hätte keinen Dark-Mode-Gegenpart und bricht dort.
Neue Farbtöne immer als neue `--color-*`-Variable in beiden Blöcken (hell + `@media`/`[data-theme]`)
anlegen, nicht als lokaler Wert in der Komponente.

Semantische statt beschreibende Namen (`--color-danger`, nicht `--color-red`) – Töne können sich
ändern, die Bedeutung bleibt.

## Abstände

`--space-1` (4px) bis `--space-6` (48px), verdoppelnd/gestuft. Für Innenabstände/Gaps immer diese
Stufen verwenden statt beliebiger px-Werte – macht Layouts über Views hinweg optisch konsistent und
Design-Anpassungen global statt Datei für Datei nötig.

## Eckenrundung: Squircle-Prinzip

Basiswerte `--radius-sm` (10px) bis `--radius-xl` (32px) gelten für alles, was ein **normaler
Kreisbogen** bleiben soll: komplett runde Elemente (`border-radius: 50%`, z. B. `EditButton.vue`/
`DeleteButton.vue`, meist zusätzlich mit `corner-shape: round;` explizit gemacht), Pillen sowie
kleine Chips/Badges.

**Cards, (nicht-runde) Buttons, Inputs, Modals und Drawer/Schubladen** bekommen stattdessen die
"squircle"-Variante (iOS-artige Superellipsen-Rundung statt Kreisbogen) – dafür IMMER beide Teile
zusammen auf derselben Regel setzen:

```css
border-radius: var(--radius-md-squircle); /* nicht --radius-md! */
corner-shape: squircle;
```

Warum zwei getrennte Variablen-Sets: `corner-shape: squircle` konzentriert die Rundung stärker auf
den unmittelbaren Eckpunkt als ein Kreisbogen – bei identischem `border-radius`-Wert sieht ein
Squircle sichtbar *weniger* rund aus. Die `-squircle`-Variablen kompensieren das per `@supports
(corner-shape: squircle)`-Feature-Query um Faktor 1.75 (per Pixel-Vergleich ermittelt), damit ein
Squircle optisch genauso rund wirkt wie ein normaler Kreisbogen mit dem Basis-Radius. Ohne
Squircle-Unterstützung im Browser fallen `-squircle`-Variablen automatisch auf die Basiswerte
zurück (normaler Kreisbogen, kein optischer Bruch).

Häufigster Fehler: nur eine Hälfte des Paars setzen (z. B. `corner-shape: squircle` mit der
Basis-Variable statt der `-squircle`-Variante, oder umgekehrt) – dann kompensiert nichts und die
Rundung wirkt inkonsistent zu den übrigen Elementen. Bei einer PR-Selbstprüfung: jede neue
`border-radius`-Deklaration an einer Card/einem Button/Input/Modal/Drawer sollte eine
`-squircle`-Variable UND `corner-shape: squircle` auf derselben Regel haben.

## Schatten

`--shadow-sm`/`--shadow-md`, ebenfalls mit eigenen (dunkleren, undurchsichtigeren) Werten im Dark
Mode. Für neue schwebende Elemente (Dropdowns, Tooltips, Cards mit Hebung) eine der beiden Stufen
verwenden statt eines eigenen `box-shadow`-Werts.

## Typografie

`--font-sans` (Fira Sans, selbst gehostet als Latin-Subset-WOFF2 – siehe Kommentar in `style.css`
oben, funktioniert offline). Keine weiteren Schriftfamilien einführen.

## Breakpoints

Kein zentrales `--breakpoint-*`-Token, aber ein de-facto Standard: **800px** als Desktop-Schwelle
(`min-width: 800px` in `NavBar.vue`, `Drawer.vue`, `App.vue`; `max-width: 799px` als Gegenstück in
`AppHeader.vue`) – deckt sich mit dem in `CLAUDE.md` beschriebenen Desktop/Mobil-Split (feste
Schubladen vs. eigenständige Mobil-Routen). Ein paar Views weichen bewusst ab, wenn ihr Inhalt bei
800px noch zu eng wäre (`ShoppingListView.vue`/`TodoView.vue`/`PackingListView.vue`: 900px;
`CalendarWeek.vue`: 700px). Neue responsive Umbrüche: erst prüfen, ob 800px passt, bevor ein neuer
Wert eingeführt wird – Layout-Sprünge sollen möglichst an derselben Fensterbreite passieren wie der
Rest der App.

## Icons

Ausschließlich Emoji statt einer Icon-Font/SVG-Icon-Bibliothek (leichtgewichtig, kein zusätzlicher
Font-Ladevorgang, funktioniert offline). Zwei getrennte, in sich konsistente Icon-Systeme:

- **App-Bereiche** (Navigation, Dashboard-Kacheln, Schubladen-Tabs): zentrale Registry in
  `frontend/src/utils/sectionIcons.ts` (`SECTION_ICONS`). Ein Bereich hat *ein* Icon, das überall
  identisch verwendet wird – nie ein Icon lokal in einer Komponente neu hartkodieren, sondern aus
  dieser Registry importieren. Neuer App-Bereich → hier ergänzen, nicht ad hoc irgendwo inline.
- **Kategorien innerhalb eines Bereichs** (Kalender-Kategorien, Spot-Kategorien): eigene, getrennte
  Registries (`scheduleCategory.ts`, `spotCategory.ts`) – bewusst kein gemeinsames System mit
  `sectionIcons.ts`, da Kategorien pro Bereich unterschiedliche Bedeutung haben.

Kartenmarker (`TripMap.vue` u. a.) nutzen dieselben Emoji als Leaflet `divIcon`s statt der
Standard-Marker-Pins – auch dort aus den bestehenden Registries beziehen, nicht neu definieren.

- **Sichtbarkeits-Kennzeichnung (privat vs. geteilt)**: 🔒 für "nur für eine Person sichtbar", 🤝
  für "für alle Mitreisenden sichtbar" (z. B. Budget-Töpfe, `BudgetPotCard.vue`). Kein eigenes
  drittes System, sondern ein einfaches, wiederverwendbares Paar – bei jedem neuen "privat vs.
  geteilt"-Konzept dieselben zwei Emoji verwenden statt neue zu erfinden.

## Formularfelder in Anlege-/Bearbeiten-Dialogen

Reine Beschriftung eines Textfelds per HTML-`placeholder` verschwindet, sobald das Feld einen Wert
trägt – wer einen bereits ausgefüllten Dialog erneut öffnet (Bearbeiten) sieht dann nicht mehr, wofür
das Feld war. Für Text-/URL-/Nummer-/Zahl-Eingabefelder deshalb `components/FormField.vue` als
Wrapper verwenden statt das Eingabefeld nackt ins Formular zu setzen:

```html
<FormField icon="✏️" label="Titel">
  <input v-model="form.title" type="text" placeholder="Titel" required />
</FormField>
```

Icon + kleines Label bleiben dauerhaft über dem Feld sichtbar, der `placeholder` bleibt zusätzlich als
Beispiel-/Formatierungshinweis erhalten. `<select>`-Felder brauchen das i. d. R. nicht (die gewählte
Option bleibt immer sichtbar, anders als ein `placeholder`) – ebenso Felder mit einem bereits
bestehenden eigenen Label-Wrapper (`.date-label`, `.field-label`, `TripForm.vue`s
`<label>Text<input/></label>`-Muster). Icon-Wahl folgt den anderswo in der App etablierten Emoji
(z. B. 📅 Datum, 📍 Ort/Adresse, 🗺️ Maps-Link, 📞 Kontakt, 💶 Betrag, 📝 Notiz, 🏷️ Kategorie) – kein
neues Icon erfinden, wenn ein bestehendes Konzept schon eins hat.

Achtung bei bereits vorhandenem Flex-Row-Layout eines Formulars (z. B. `.add-form input, .add-form
select { flex: 1; min-width: …px; }`): diese Selektoren zielten bisher direkt auf das `<input>`, das
jetzt eine Ebene tiefer in `.form-field` sitzt. Selektor auf `.form-field` statt `input` ummünzen
(`.add-form .form-field, .add-form select { flex: 1; … }`), sonst greift `flex`/`min-width` ins Leere
(nur echte Flex-Items eines Flex-Containers reagieren darauf) und das Feld schrumpft auf seine
Inhaltsbreite zusammen.

## Bei neuen Elementen

1. Existiert schon eine passende Farbe/ein passender Radius-Wert/Breakpoint/Icon? → verwenden, nicht
   neu erfinden.
2. Handelt es sich um eine Card/Button/Input/Modal/Drawer? → Squircle-Paar setzen (siehe oben).
3. Neues wiederkehrendes Muster nötig? → hier dokumentieren, damit es beim nächsten Mal gefunden
   statt neu erfunden wird (siehe auch `CLAUDE.md`, Abschnitt "Konsistenz-Check bei Änderungen").
