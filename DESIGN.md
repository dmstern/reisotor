# DESIGN.md

Design-Prinzipien für Reisotor: was neue UI-Elemente über Farben, Abstände, Eckenrundung, Schatten,
Animationen, Typografie, Icons und Breakpoints hinweg konsistent halten soll. `frontend/src/style.css`
ist die Quelle der Wahrheit für die tatsächlichen Werte (CSS-Variablen im `:root`-Block) – diese
Datei hält die *Prinzipien* und *Faustregeln* dahinter fest, damit sie nicht nur implizit im CSS
stehen. Bei jedem neuen UI-Baustein oder jeder sichtbaren UI-Änderung hier kurz nachschauen, ob ein
bestehendes Muster zutrifft, statt ad hoc neue Werte zu erfinden – und diese Datei ergänzen, wenn
dabei ein neues, wiederverwendbares Prinzip entsteht.

Für architektonische/UX-Ablauf-Muster (Querverweise springen zur Ursprungs-View, Undo-Delete,
Echtzeit-Highlight, …) siehe stattdessen den Abschnitt "Konsistenz-Check bei Änderungen" in
`CLAUDE.md` – hier geht es nur um die visuelle Ebene.

## Konsistenz (wichtigstes Prinzip)

Dieselbe Art UI-Element muss überall in der App gleich aussehen und sich gleich verhalten –
unabhängig davon, mit welcher technischen Lösung sie an der jeweiligen Stelle gerade umgesetzt
wurde. Der Nutzer sieht keinen Unterschied zwischen "das ist ein natives `<select>`" und "das ist
eine custom Combobox.vue" – beide sind für ihn einfach "ein Dropdown" und müssen deshalb exakt
gleich hoch sein und gleich aussehen. Das gilt für jede der unten dokumentierten Kategorien:

- **Farben**: nur `--color-*`-Variablen, nie ein neuer Hex-Wert lokal (Abschnitt "Farben").
- **Abstände**: nur `--space-*`-Stufen, kein freier px-Wert (Abschnitt "Abstände").
- **Formen/Eckenrundung**: Kreisbogen vs. Squircle konsequent nach Elementtyp, nie gemischt
  innerhalb desselben Elementtyps (Abschnitt "Eckenrundung: Squircle-Prinzip").
- **Schatten**: nur `--shadow-sm`/`--shadow-md`, kein eigener `box-shadow` (Abschnitt "Schatten").
- **Animationen**: Timing/Easing nach Bewegungsgröße gestuft (0.15s Mikro-Interaktion / 0.2s Ein-
  Ausblenden & Listen / 0.25–0.3s große Bewegung), immer `ease`/`ease-in-out`, globale
  `list`/`fade`-Transition-Klassen statt lokaler Neuerfindung (Abschnitt "Animationen").
- **Typografie**: eine Schriftfamilie, Größen/Gewichte an bestehenden Textrollen orientieren
  (Abschnitt "Typografie").
- **Icons**: Emoji aus den bestehenden Registries (`sectionIcons.ts`, `spotCategory.ts`,
  `scheduleCategory.ts`), kein neues Icon für ein bereits vorhandenes Konzept (Abschnitt "Icons").
- **Formularfelder/Labels**: ein einziges Label-Muster app-weit (`components/FormField.vue`), auch
  für `<select>`, sobald es neben einem gelabelten Geschwisterfeld in derselben Flex-Zeile steht –
  ohne eigenes Label wird es vom Flex-Default `align-items: stretch` künstlich in die Höhe gezogen,
  der häufigste Grund für sichtbar unterschiedlich hohe Dropdowns (Abschnitt "Formularfelder").
- **Wiederkehrende Interaktionsmuster** (z. B. Filtern/Gruppieren/Sortieren, aktuell in
  Ausflüge/Spots, Einkauf, ToDo): dasselbe Konzept braucht dieselbe Präsentation überall (durchgehend
  Icon + Label, dieselbe Steuerelement-Art) – nicht in einer View Toggle-Buttons mit Icon, in der
  nächsten ein reiner Text-Label vor einem `<select>`.
- **Alles andere, was diese Liste (noch) nicht nennt**: Button-/Card-Stile, Empty-/Error-/
  Ladezustände, Hover-/Focus-Zustände, Copy-Ton – dasselbe Prinzip gilt sinngemäß, auch wenn es noch
  keinen eigenen Abschnitt dafür gibt. Beim Bauen aktiv mitdenken statt nur die oben gelisteten
  Kategorien als abschließend zu behandeln.

**Praktische Konsequenz beim Bauen/Ändern von UI:** vor jedem neuen UI-Baustein oder jeder
sichtbaren Design-Anpassung aktiv im Rest der App nachschauen, ob es dafür schon ein Muster/eine
Komponente/einen Token gibt (grep auf ähnliche Bezeichner/Klassen/Werte, nicht nur an der gerade
bearbeiteten Stelle schauen) – wiederverwenden statt eine zweite, leicht abweichende Variante
daneben zu bauen. Wird dabei eine neue Design-Anforderung erkennbar, die auch an anderen, gerade
nicht angefragten Stellen mit demselben Muster gelten würde: siehe CLAUDE.md, Abschnitt
"Konsistenz-Check bei Änderungen" für das Vorgehen dabei (dort jetzt: aktiv nachfragen statt
eigenmächtig zu entscheiden, ob mitgezogen wird oder nicht).

## Desktop UND Mobile – nie nur eines im Kopf

Reisotor wird an beiden Enden intensiv genutzt, zu unterschiedlichen Zeitpunkten der Reise: Desktop
vor allem VOR dem Urlaub (Planung – Reise/Unterkunft/Budget anlegen, Kalender befüllen, in Ruhe am
großen Bildschirm), Mobile (Handy vor allem, Tablet auch) vor allem WÄHREND des Urlaubs (unterwegs
nachschlagen, schnell einen Punkt abhaken, spontan etwas eintragen). Beide Enden sind damit nicht
"Haupt- und Nebenfall", sondern zwei gleichwertige Haupt-Nutzungssituationen zu unterschiedlichen
Zeiten – ein neues Feature, das nur für eines von beiden gut funktioniert, lässt die App in genau der
Phase im Stich, in der sie gerade gebraucht wird.

Bei jedem neuen UI-Baustein oder jeder sichtbaren Änderung deshalb aktiv beide Enden durchdenken/
-testen, nicht nur die Breite, an der man gerade selbst entwickelt/screenshotet:

- **Größenabhängige Layout-Entscheidungen** (Grid- vs. Bottom-Sheet-Modus, Spalten- vs. Stapel-
  Anordnung, Schubladen vs. eigene Route, …) müssen bei *allen* Kombinationen aus Fenster-/
  Gerätebreite UND gleichzeitig geöffneten Schubladen/Overlays plausibel aussehen – nicht nur beim
  Standard-Fall (Schublade zu, Fenster maximiert). Konkret aufgetretener Fall: `ExcursionsView.vue`s
  Umschalt-Schwelle für die Desktop-Spalten-Ansicht war so hoch angesetzt, dass sie bei geöffneter
  Kalender-Schublade auf gängigen Laptop-Breiten nie griff, obwohl rechnerisch noch genug Platz für
  eine (schmalere, aber weiterhin brauchbare) Spalten-Ansicht da gewesen wäre – die Ansicht fiel
  dadurch unnötig auf den beengteren mobilen Sheet-Modus zurück.
- **Ein Feature, das auf einer Bildschirmgröße lebt, muss auf der anderen einen (ggf. anderen, aber
  gleichwertigen) Zugang haben** – nicht einfach fehlen. Ein schwebendes Overlay, das auf Mobile von
  einem anderen, dort permanenten UI-Element (z. B. einem Bottom-Sheet) verdeckt wird, zählt als
  fehlend, auch wenn der Code es technisch rendert. Bei Platzmangel lieber in ein bestehendes,
  bereits sichtbares Element integrieren (z. B. denselben Teleport-Dock-Mechanismus wie ein
  verwandtes Feature) statt ein zusätzliches, permanent sichtbares Bedienelement obendrauf zu setzen
  ("schlau eingebaut, ohne die Oberfläche zu überfrachten").
- **Elemente, die sich an der Breite des umgebenden Containers orientieren** (z. B. `flex-basis:
  100%` für einen Absenden-Button, damit er auf Mobil die volle, gut antippbare Breite bekommt),
  auf einer breiten Desktop-Karte gegenprüfen – derselbe Wert, der auf Mobil genau richtig wirkt,
  kann auf einer 1400px-Karte überdimensioniert aussehen. Meist reicht ein einzelner
  `@media (min-width: 800px)`-Gegenwert, siehe `ShoppingListView.vue`/`TodoView.vue`.
- **Bedienbarkeit an sich**: Touch-Targets auf Mobil groß genug (siehe globale `min-height:44px`-
  Formularfeld-Regel), Anfasser/Drag-Interaktionen auf Desktop mit Maus testen (nicht nur mit
  Touch-Emulation), Hover-abhängige Zustände (z. B. ein nur bei `:hover` sichtbarer Anfasser) auf
  Touch-Geräten nicht als einzigen Zugang zu einer Funktion verwenden.

Nicht bei jeder trivialen Änderung ein vollständiges Cross-Device-Testprotokoll nötig – aber bei
jedem neuen Layout-Umbruch/jeder neuen Interaktion aktiv kurz "wie sieht das am jeweils anderen Ende
aus" durchdenken, statt es erst bei Nutzer:innen-Feedback zu bemerken.

## Farben

Alle Farben laufen über CSS-Variablen (`--color-*` im `:root`-Block), nie als Hex-Wert direkt in
einer Komponente. Grund: Dark Mode (`@media (prefers-color-scheme: dark)` + manueller Override via
`[data-theme]` auf `<html>`, siehe `stores/theme.ts`) überschreibt dieselben Variablennamen komplett
– eine hartkodierte Farbe in einer Komponente hätte keinen Dark-Mode-Gegenpart und bricht dort.
Neue Farbtöne immer als neue `--color-*`-Variable in beiden Blöcken (hell + `@media`/`[data-theme]`)
anlegen, nicht als lokaler Wert in der Komponente.

Semantische statt beschreibende Namen (`--color-danger`, nicht `--color-red`) – Töne können sich
ändern, die Bedeutung bleibt.

**Eine Bedeutung pro Farbe, nicht umgekehrt**: `--color-accent` ist app-weit fest für "Echtzeit-Update
von jemand anderem / wartet auf etwas / allgemeine Aufmerksamkeit" reserviert (`.new-highlight`,
`PendingSyncBadge.vue`, `OfflineIndicator.vue`, …) – ein zweites, fachlich unabhängiges Konzept nie
einfach denselben Ton mitbenutzen lassen, nur weil er ähnlich "passt". Konkret aufgetretener Fall:
`TripMap.vue`s Tage-Streifen zeigte anfangs ebenfalls `--color-accent` für "an diesem Tag ist etwas
geplant" – identisch zur Update-Farbe, an der Karte (wo beide Bedeutungen gleichzeitig auftreten
können: ein Tag kann sowohl geplante Einträge haben als auch gerade frisch synchronisiert worden sein)
nicht mehr unterscheidbar. Dafür gibt es jetzt `--color-scheduled` (sattes Hellblau) als eigenständigen
Ton. Bei einer neuen Farb-Kodierung deshalb immer zuerst prüfen, ob die gewünschte Bedeutung nicht
zufällig schon eine der bestehenden `--color-*`-Variablen besetzt, und im Zweifel lieber eine neue,
klar benannte Variable anlegen statt eine bestehende zweitzuverwenden.

## Abstände

`--space-1` (4px) bis `--space-6` (48px), verdoppelnd/gestuft. Für Innenabstände/Gaps immer diese
Stufen verwenden statt beliebiger px-Werte – macht Layouts über Views hinweg optisch konsistent und
Design-Anpassungen global statt Datei für Datei nötig.

**Beschreibungstext vor einer Karte/Liste/einem Grid**: eine erklärende `<p>`-Zeile direkt unter
einer Überschrift, gefolgt von der eigentlichen Karten-/Listen-Sektion, braucht sichtbar mehr Luft
nach unten als reine Fließtext-Abstände – mindestens `--space-3` (16px), bei einer Karten-lastigen
Sektion eher `--space-4` (24px), damit Text und Karte klar als zwei getrennte Blöcke wirken statt
aneinanderzukleben. Der globale `p`-Grundstil in `style.css` liefert bereits `margin: 0 0
var(--space-3)` – reicht meist von allein, sobald keine lokale Regel das wieder auf `margin: 0`
zurücksetzt.

Genau das ist der häufigste Stolperstein: Views nutzen dieselbe generische `.hint`-Klasse sowohl für
knapp unter einem Eingabefeld sitzende Mini-Hinweise (dort bewusst `margin: 0`, siehe z. B.
`TravelView.vue`) als auch für eine Seiten-Einleitung direkt vor der Kartenliste. Bei zwei
Klassen mit gleicher Spezifität (`.hint` und z. B. `.places-hint`) entscheidet dann die
Deklarations-Reihenfolge im Stylesheet, nicht die inhaltliche Absicht – eine spätere `.hint`-Regel
kann so ein vorher gesetztes `margin-bottom` stillschweigend wieder auf 0 kappen. Für einen
Seiten-Einleitungstext deshalb entweder eine eigene, von `.hint` unabhängige Klasse verwenden, oder
per Compound-Selektor (`.hint.places-hint { margin-bottom: var(--space-4); }`) höhere Spezifität
erzwingen, statt sich auf die Regel-Reihenfolge zu verlassen. Bei jeder neuen Einleitungszeile vor
einer Karten-/Listen-Sektion aktiv im gerenderten Ergebnis nachschauen, ob der Abstand tatsächlich
ankommt, statt sich auf eine bestehende `margin-bottom`-Deklaration allein zu verlassen.

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

Für taktile Pillen-Elemente (aktuell: `SegmentedToggle.vue`) gibt es zusätzlich ein zweites,
"weicheres" Paar – siehe Abschnitt "Weiches Material" weiter unten, nicht mit `--shadow-sm`/`-md`
mischen.

## Animationen

Kein zentrales `--transition-*`-Token bisher, aber ein klarer de-facto Standard über drei
Größenordnungen hinweg – neue Übergänge an einer dieser drei orientieren, nicht frei erfinden:

- **Mikro-Interaktionen** (Hover/Focus/Press an Buttons, Links, Chips): `0.15s ease`, meist auf
  `background`/`color`/`border-color`/`transform` (siehe `style.css`s `button`-Grundregel).
- **Ein-/Ausblenden & Listen-Umsortieren**: `0.2s ease-in-out`, zentral als wiederverwendbare
  Vue-Transition-Klassen in `style.css` definiert – `<TransitionGroup name="list">` für
  CRUD-/Sortier-Interaktionen in Listen (Ein-/Ausblenden + sanftes Gleiten an die neue Position,
  inkl. `translateY(-6px) scale(0.98)` beim Ein-/Ausblenden) und `<Transition name="fade">` für
  einfaches Ein-/Ausblenden ohne Liste. `Modal.vue`s `modal-fade` folgt demselben `0.2s
  ease-in-out`, ergänzt um ein leichtes Scale/Translate am `.modal` selbst. Diese globalen Klassen
  verwenden statt einer lokalen, komponenteneigenen Transition – neue Listen/Modals/Ein-Ausblend-
  Stellen binden sich an `name="list"`/`name="fade"` an, statt eigene Timings zu erfinden.
- **Größere Bewegungen** (Drawer/Schublade rein-/rausfahren): `0.25s`–`0.3s ease` – etwas länger als
  die anderen beiden Stufen, weil die zurückgelegte Strecke selbst größer ist.

Durchgehend `ease`/`ease-in-out`, nie eine "bouncy"/Spring-artige Easing-Funktion – passt zum
insgesamt eher zurückhaltenden, nativen App-Gefühl statt auffälliger Spielereien.

## Weiches Material (taktile Pillen)

Für Segmented-Controls (`SegmentedToggle.vue`) und ähnliche Umschalter, die wie ein greifbares,
leicht gepolstertes physisches Objekt wirken sollen, gibt es zusätzlich zu `--shadow-sm`/`-md` ein
eigenes Token-Paar:

- `--shadow-inset`: eine leicht eingelassene Rinne für die Track-Fläche (der Bereich, in dem der
  Thumb gleitet) – simuliert per `inset`-Schatten, dass die Fläche selbst zurückversetzt statt nur
  eine zweite flache Ebene ist.
- `--shadow-pill-raised`: eine sanfte Abhebung für den gleitenden Thumb selbst – ein weicher, diffuser
  (zweistufiger) Drop-Shadow, sonst nichts.

**Bewusst KEIN Glanzrand/Highlight-Inset** (z. B. `inset 0 1px 0 rgba(255,255,255,…)`) und **kein**
zusätzlicher Gewichts-Schatten obendrauf – eine frühere Version hatte beides kombiniert und wirkte
dadurch eher wie ein glänzender 2000er-Web-Button bzw. Neumorphismus als modern/dezent. Die Faustregel
für "weich, aber aktuell" statt "retro": **ein** ruhiger, mehrstufiger Drop-Shadow pro Ebene (Träger
+ mehr Blur/weniger Deckkraft in der zweiten Stufe für einen weichen statt harten Rand) plus reichlich
Rundung (siehe unten) – keine Lichtkanten, keine gestapelten Inset-Schatten, kein
Hell/Dunkel-Kontrast, der wie eine physische Fase/Kante aussehen soll. Bei jeder künftigen Anpassung
dieser Tokens diese Faustregel zuerst gegenprüfen, bevor eine weitere Schatten-Ebene ergänzt wird.

Beide wie `--shadow-sm`/`-md` je einmal hell (`:root`) und einmal dunkel (beide Dark-Mode-Blöcke)
definiert – nie eine eigene `rgba()`/`box-shadow`-Kombination lokal in einer Komponente bauen, und nie
mehr als diese eine zentrale Stelle pro Token anfassen müssen, um den Look global zu verändern.
Zusätzlich sorgt `--texture-grain` (ein per SVG-`feTurbulence` erzeugtes, extrem dezentes
Rausch-Muster als `background-image` mit `background-blend-mode: overlay`) für einen angenehm
griffigen statt komplett flachen/plastikigen Flächen-Eindruck auf dem Track – theme-unabhängig
(keine eigene Dark-Mode-Variante nötig, der Blend-Mode passt sich automatisch an). Dieses
Rausch-Muster ist der einzige bewusst "physische" Rest des Materials und bleibt unverändert, auch wenn
die Schatten-Tiefe wie oben reduziert wird.

Diese Pillen sind bewusst immer **voll rund** (`border-radius: 999px`, kein Squircle) statt der
normalen Card/Button-Squircle-Regel – ein Segmented-Control ist konzeptionell näher an den anderen
"vollständig runden" Elementen (Pillen/Chips, siehe Abschnitt "Eckenrundung") als an einer
Card/einem Button.

Aktuell nur auf `SegmentedToggle.vue` angewendet. Eine App-weite Ausweitung dieses weicheren
Materials auf normale Buttons/Cards wäre eine größere Design-Entscheidung (siehe `CLAUDE.md`,
Abschnitt "Konsistenz-Check bei Änderungen") und sollte erst nach Rücksprache erfolgen, nicht
automatisch bei der nächsten Gelegenheit an einem Button/einer Card mitgezogen werden.

## Typografie

`--font-sans` (Fira Sans, selbst gehostet als Latin-Subset-WOFF2 – siehe Kommentar in `style.css`
oben, funktioniert offline). Keine weiteren Schriftfamilien einführen.

**Alle tatsächlich genutzten (Fettung × Schnitt)-Kombinationen brauchen einen echten `@font-face` -
nicht nur alle genutzten `font-weight`-Stufen (aktuell 400/500/600/700) normal, sondern dieselben
Stufen auch **kursiv**, sobald irgendwo `<em>`/`font-style: italic` mit diesem Gewicht zusammentrifft
(z. B. `RichTextEditor.vue`s Kursiv-Knopf `<em>K</em>` innerhalb eines `font-weight:600`-Buttons,
oder von Nutzer:innen im Editor kombiniertes Fett+Kursiv). Fehlt der passende Schnitt, rendert der
Browser einen "faux"/synthetischen Schnitt (schräg gestelltes Kursiv bzw. künstlich verdicktes Fett)
statt eines tatsächlich dafür gezeichneten Buchstabens – sieht in Fira Sans (mit klar unterschiedlich
gestalteten dezidierten Schnitten) sichtbar unrunder/inkonsistenter aus als der Rest der Schrift. Bei
einer neuen Stelle, die eine bisher ungenutzte Kombination einführt (neue `font-weight`-Stufe, neues
`italic`-Vorkommen an einer bereits genutzten Stufe): grep auf `font-weight:`/`italic` in
`frontend/src` gegen die in `style.css` vorhandenen `@font-face`-Blöcke prüfen, fehlenden Schnitt
nachziehen statt den Browser synthetisieren zu lassen.

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
Beispiel-/Formatierungshinweis erhalten. **Auch `<select>`-Felder in FormField wrappen**, sobald sie
in derselben Flex-Row wie mindestens ein FormField-umwickeltes Geschwisterfeld stehen (z. B.
gemeinsam in einem `.add-form`/`.edit-form` mit `flex-wrap: wrap`) – ohne eigenes Label ist ein
`<select>` niedriger als ein FormField (Label-Zeile + Feld), und das Default-`align-items: stretch`
des Flex-Containers zieht das unbeschriftete `<select>` dann auf die Höhe des Nachbarfelds in die
Länge. Ergebnis: ungleich hohe, "verrutscht" wirkende Felder in derselben Zeile – genau das Muster,
das zu vermeiden ist. Ein einzelnes `<select>` ganz allein auf eigener Zeile (kein FormField-Nachbar
in derselben Flex-Row) darf ohne Wrapper bleiben.

Kein zweites, abweichendes Label-Muster parallel zu FormField einführen (z. B. ein eigenes
`.date-label`/`.field-label` mit eigener Schriftgröße) – selbst wenn optisch ähnlich, ergibt das exakt
dieselbe Höhen-Inkonsistenz wie beim `<select>` oben, sobald beide Muster in derselben Zeile landen.
`TripForm.vue`/`TravelView.vue` sind die eine bewusste Ausnahme: dort trägt *jedes* Feld durchgehend
deren eigenes `<label>Text<input/></label>`-Muster (kein Mix mit FormField in derselben Datei), daher
dort keine Migration nötig.

Icon-Wahl folgt den anderswo in der App etablierten Emoji (z. B. 📅 Datum, 🕒 Uhrzeit, 📍 Ort/Adresse,
🗺️ Maps-Link, 📞 Kontakt, 💶 Betrag, 📝 Notiz, 🏷️ Kategorie, 🧑 Person/Bearbeiter:in, 🤝 Bezahlt
von/geteilt) – kein neues Icon erfinden, wenn ein bestehendes Konzept schon eins hat.

Achtung bei bereits vorhandenem Flex-Row-Layout eines Formulars (z. B. `.add-form input, .add-form
select { flex: 1; min-width: …px; }`): diese Selektoren zielten bisher direkt auf `<input>`/`<select>`,
die jetzt eine Ebene tiefer in `.form-field` sitzen. Selektor auf `.form-field` ummünzen
(`.add-form .form-field { flex: 1; … }`), sonst greift `flex`/`min-width` ins Leere (nur echte
Flex-Items eines Flex-Containers reagieren darauf) und das Feld schrumpft auf seine Inhaltsbreite
zusammen.

## Bei neuen Elementen

1. Existiert schon eine passende Farbe/ein passender Radius-/Schatten-/Abstands-Wert/Breakpoint/
   Icon/Animations-Timing? → verwenden, nicht neu erfinden.
2. Handelt es sich um eine Card/Button/Input/Modal/Drawer? → Squircle-Paar setzen (siehe oben).
3. Neues wiederkehrendes Muster nötig? → hier dokumentieren, damit es beim nächsten Mal gefunden
   statt neu erfunden wird (siehe auch `CLAUDE.md`, Abschnitt "Konsistenz-Check bei Änderungen").
