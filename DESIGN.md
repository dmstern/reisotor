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
  `list`/`fade`-Transition-Klassen statt lokaler Neuerfindung (Abschnitt "Animationen"). Für
  Zieh-Interaktionen (Anfasser/Sheets) zusätzlich die eigene Faustregel im Unterabschnitt
  "Zieh-Interaktionen" beachten – dort *bewusst* eine eigene, weichere Einrast-Kurve statt `ease`.
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

**Steuerungselement vs. Dateninhalt**: Flächen, die ein Werkzeug/eine Steuerung sind (Gruppieren-/
Sortieren-/Filtern-Leiste, Kategorie-/Touren-Navigationsleiste – der Nutzer interagiert mit der
Fläche selbst, sie zeigt keinen eigenen Inhalt) bekommen `--color-primary-tint` (das leichte
Markengrün) als Hintergrund statt des neutralen `--color-hover`/`--color-surface` – macht sie auf
einen Blick als "das ist Bedienung" erkennbar. Flächen, die Dateninhalt zeigen (Spot-/Ausflugs-Cards,
Listenzeilen – der Inhalt selbst ist relevant, nicht die Fläche als Werkzeug) bleiben bei
`--color-surface` (weiß/hell in Light Mode). Beispiele: `ExcursionsView.vue`s `.filter-bar` und
`.category-nav` (Steuerung, grün) vs. `SpotCard.vue`/`ExcursionCard.vue` (Dateninhalt, weiß).

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

**Über anderen Elementen liegen = Schatten haben.** Jedes Element, das sich sichtbar über den
Hintergrund/andere Inhalte legt (aufgeklapptes Panel, Schublade im geöffneten Zustand, Dropdown,
Modal, Popover), braucht einen Schatten (`--shadow-sm`/`-md`) – ohne ihn wirkt es wie ein
gleichrangiges Layout-Element statt einer bewusst "erhobenen" Fläche, die Nutzer:innen gerade selbst
geöffnet haben. Konkret aufgetretener Fall: `Drawer.vue`s Desktop-Panel hatte `box-shadow: none`
(Rest eines älteren Layouts, in dem das Panel randlos in eine feste Spalte floss) – wirkte dadurch
trotz sichtbarem Öffnen/Schließen-Zustand wie eine flache Nachbarspalte statt einer darüber liegenden
Schublade. Gilt für jeden neuen "erhobenen" Zustand, nicht nur offensichtliche Overlays.

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

**Landet ein Element durch eine Interaktion woanders als vorher, muss die Bewegung selbst animiert
sein** – nicht nur der Endzustand hübsch gestylt. Das schließt scheinbar "nur strukturelle" Wechsel
ein: eine aktive Hervorhebung, die zu einem anderen Tab/Nav-Item springt (siehe `NavBar.vue`s
`.nav-highlight`, `SegmentedToggle.vue`s `.segmented-thumb`, `ListenView.vue`s `.tab-underline` –
alle drei gleiten per `transform`/`width`, keins schaltet hart um), ein Panel, das sich öffnet und
dabei Inhalt zur Seite schiebt (`width`/`transform` in der oben genannten "größere Bewegungen"-Stufe),
oder ein neu einsortiertes Listen-Element (`<TransitionGroup name="list">`, siehe oben). Bei jedem
neuen UI-Zustand, der eine Position/Größe/Sichtbarkeit ändert: prüfen, ob der Wechsel gerade hart
umschaltet, und wenn ja, eine der drei Bewegungsgrößen-Stufen oben dafür verwenden statt es beim
ungeprüften Sprung zu belassen.

### Zieh-Interaktionen (Drag-to-Position): butterweich statt hakelig

Gilt für jeden per Maus/Touch frei ziehbaren Anfasser mit anschließendem Einrasten (Bottom-Sheet-
Griffe, Breiten-/Größen-Anfasser, künftige Slider mit festen Stufen) – nicht nur für die aktuell zwei
Umsetzungen (`ExcursionsView.vue`s Spots-Sheet-Anfasser `.sheet-handle`, `Drawer.vue`s
Breiten-Anfasser `.resize-handle`). Ohne die drei Punkte unten fühlt sich eine Zieh-Interaktion
selbst mit korrekter Logik "hakelig"/"störrisch" statt nativ-smooth an – das war konkret der Auslöser
für diesen Abschnitt (Nutzer-Vergleichsvideo gegen Google Maps' Bottom-Sheet).

1. **Während des aktiven Ziehens keine CSS-Transition auf der gezogenen Eigenschaft.** Eine an sich
   sinnvolle Einrast-Transition (siehe Punkt 3) darf nicht auch während des Ziehens selbst aktiv
   sein, sonst hinkt das Element dem Zeiger mit der vollen Transition-Dauer hinterher, statt 1:1 zu
   folgen. Dafür während des Drags eine eigene Zustands-Klasse setzen, die die Transition abschaltet
   (`.spots-col.dragging { transition: none; }` bzw. `.drawer.resizing .drawer-panel { transition:
   none; }`) – **und diese Klasse tatsächlich ans Root-/animierte Element binden**; ein reiner
   `resizing`/`dragging`-Ref im Script ohne `:class`-Bindung wirkt nicht (genau dieser Lapsus war der
   kollaterale Bug in `Drawer.vue`, den dieser Abschnitt jetzt festhält).
2. **Pro Zeigerbewegung direkt aufs DOM-Element schreiben statt über eine reaktive `:style`-Bindung.**
   Ein `ref<HTMLElement>` + `el.style.<prop> = …` im `pointermove`-Handler spart einen kompletten
   Vue-Render-Tick pro Event – bei hochfrequenten Events (Touch kann deutlich mehr als 60 Events/s
   liefern) macht das den Unterschied zwischen "folgt spürbar verzögert" und "folgt exakt". Siehe
   `applySheetHeight()`/`clearSheetHeightOverride()` in `ExcursionsView.vue` als Vorlage: der Ref hält
   während des Ziehens die Werte selbst, erst beim Loslassen übernimmt wieder die normale
   Klassen-/State-getriebene Bindung (inkl. der jetzt wieder aktiven Transition aus Punkt 3).
3. **Beim Loslassen bei mehreren festen Zielzuständen (nicht bei einem stufenlosen Anfasser wie
   `Drawer.vue`s Breite) nicht nur nach der End-Position entscheiden, sondern auch nach der
   Zieh-Geschwindigkeit ("Flick").** Ein kurzer, schneller Wisch legt kaum Distanz zurück und landet
   bei reiner Positions-Logik fast immer wieder beim Ausgangszustand ("poppt zurück") – bei einem
   knackigen Flick soll stattdessen trotzdem ein Zustand weitergeschaltet werden, unabhängig von der
   Distanz (wie bei Google Maps). Referenz-Implementierung: `dragFlickVelocity()` +
   `resolveSheetTargetState()` in `ExcursionsView.vue` (rollierendes Zeitfenster der letzten
   Zieh-Positionen, Geschwindigkeits-Schwellwert vor Distanz-Fallback).
4. **Eine eigene, weichere Kurve für die Einrast-Transition selbst**: `cubic-bezier(0.32, 0.72, 0, 1)`
   (iOS-artige Sheet-Kurve) statt des app-weiten `ease`/`ease-in-out` aus dem Abschnitt "Animationen"
   oben – bewusste Ausnahme, nur für das Einrasten nach einem Zieh-Loslassen, nicht für die drei dort
   beschriebenen Standard-Stufen. `ease` wirkt hier spürbar mechanischer als bei einem einfachen
   Ein-/Ausblenden, weil die Nutzer:in unmittelbar zuvor selbst mit dem Element interagiert hat.

**Stolperfalle, die es wert ist, dokumentiert zu bleiben**: `transform: translateY()` statt `height`
für die gezogene Positionierung (Höhen-Zustand collapsed/partial/full) wäre die naheliegende
zusätzliche Optimierung (GPU-Compositing statt Reflow/Repaint bei jedem Frame) – bei einem Element,
das eine Leaflet-Karte überlagert oder ihr benachbart ist (aktuell nur `.spots-col`), zeigte ein
Versuch damit aber ein nicht sauber eingrenzbares Race mit `TripMap.vue`s
`ResizeObserver`/`invalidateSize()`: die Karte sprang nach einem Fokus-Klick auf einen Spot in ca. 4
von 5 E2E-Läufen an eine falsche Position. Ursache trotz Analyse nicht abschließend gefunden –
`height` bleibt deshalb **für diese Höhen-Animation** bewusst die sicherere Wahl. Das betrifft
ausdrücklich nur `translateY()` für die Höhe, nicht `transform` generell an `.spots-col`: für den
Zusammen-/Ausklapp-Skalierungseffekt (Breite, `scaleX()`) läuft an genau diesem Element inzwischen
sehr wohl ein `transform` produktiv, ohne dass das Leaflet-Race dabei auftrat (vermutlich weil dabei
nur die Breite, nicht wie bei `translateY()` fortlaufend während eines aktiven Ziehens die Höhe
animiert wird – ungesichert, nur eine Beobachtung, kein bewiesener Kausalzusammenhang). Ein erneuter
`translateY()`-Versuch für die Höhe bleibt trotzdem offen, aber mit Vorsicht anzugehen.

**Zweiter, diesmal deterministischer Grund, der gegen `transform` auf `.spots-col` selbst sprach**
(egal ob für Höhe oder Breite/Skalierung): jedes `transform` außer `none` macht das Element zum
Containing Block für alle `position: fixed`-Nachfahren (CSS-Spezifikation, kein Bug/Browser-
Eigenheit) – `.spots-col` enthielt aber `.picker-backdrop` (Kategorie-/Status-/Info-Dropdowns,
`ExcursionsView.vue`), das bewusst `position: fixed; inset: 0;` nutzt, um den GESAMTEN Viewport
(inkl. der Karte darüber) statt nur die Sheet-Fläche abzudunkeln/für Außerhalb-Klicks zu schließen.
Ein `transform` direkt auf `.spots-col` hätte dieses Backdrop auf die (ggf. gerade verkleinerte)
Sheet-Fläche eingeschränkt. Betraf **jeden** `transform`-Versuch an diesem Element, nicht nur
`translateY()` für die Höhe, sondern auch `scaleX()` für die Breite (der Anlass, der diesen Absatz
ursprünglich ergänzt hat) – **inzwischen gelöst**: die drei Picker-Backdrop/-Menu-Paare sind per
`<Teleport to="body">` aus `.spots-col` herausgelöst, ihre Position wird beim Öffnen einmalig per
`getBoundingClientRect()` auf den auslösenden Button berechnet und als `position: fixed`
(`computeMenuStyle()` in `ExcursionsView.vue`) gesetzt statt sich auf `position: absolute` relativ
zum Button zu verlassen – identisches Muster wie `MapsAppPicker.vue`s Menü, das genau aus demselben
Grund (dort: `Modal.vue`s `overflow-y: auto` statt eines `transform`) bereits so gebaut war. `.spots-
col` selbst trägt seitdem `transform: scaleX()` für den Zusammen-/Ausklapp-Skalierungseffekt (siehe
dortiger Kommentar). Bei künftigen `transform`-Vorhaben an einem Element mit `position: fixed`-
Nachfahren: dasselbe Teleport-Muster ist der Standardweg, nicht erst neu erfinden.

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

Zwei umschaltbare Icon-Darstellungen statt ausschließlich Emoji: **Emoji** (Default, wie ursprünglich)
oder **Symbole** (`@tabler/icons-vue`, MIT-Lizenz, Outline- oder gefüllte Variante) – einstellbar in
den Profil-Einstellungen (`components/IconStyleSettings.vue`, gespeichert per
`frontend/src/stores/iconStyle.ts`, localStorage-Keys `reisotor-icon-style`/`reisotor-icon-variant`,
Geräte-lokal wie `calendarSettings.ts`/`weatherProvider.ts`). Beide Bibliotheken werden zur Build-Zeit
ins Bundle kompiliert (keine Icon-Font, kein CDN-Laden zur Laufzeit) und vom bestehenden
PWA-Service-Worker wie jeder andere App-Code precached – die ursprüngliche Offline-Begründung
("leichtgewichtig, kein zusätzlicher Font-Ladevorgang, funktioniert offline") bleibt für beide
Darstellungen gültig. Rendering läuft zentral über `components/AppIcon.vue` (nimmt ein `IconDef` aus
`utils/icon.ts`, löst je nach Einstellung zu Emoji-Text oder Tabler-Komponente auf; fehlt für ein Icon
die Tabler-Filled-Variante – nicht jedes Outline-Icon hat eine –, fällt automatisch auf Outline
zurück). Drei getrennte, in sich konsistente Icon-Systeme:

- **App-Bereiche** (Navigation, Dashboard-Kacheln, Schubladen-Tabs): zentrale Registry in
  `frontend/src/utils/sectionIcons.ts` (`SECTION_ICONS` fürs Emoji, `SECTION_ICON_DEFS` fürs
  `IconDef`-Pendant). Ein Bereich hat *ein* Icon, das überall identisch verwendet wird – nie ein Icon
  lokal in einer Komponente neu hartkodieren, sondern aus dieser Registry importieren. Neuer
  App-Bereich → hier (beide Maps) ergänzen, nicht ad hoc irgendwo inline.
- **Kategorien innerhalb eines Bereichs** (Kalender-Kategorien, Spot-Kategorien, Transportmittel,
  Wetter): eigene, getrennte Registries (`scheduleCategory.ts`, `spotCategory.ts`,
  `travelTypeIcon.ts`, `weather.ts`) – bewusst kein gemeinsames System mit `sectionIcons.ts`, da
  Kategorien pro Bereich unterschiedliche Bedeutung haben. Jede trägt neben dem Emoji-String
  zusätzlich ein `tabler: IconDef`-Feld – neues Konzept in einer dieser Registries → immer beide
  Felder ergänzen, nicht nur das Emoji.
- **Aktionen/Status** (Buttons, Toggle-Beschriftungen, Status-Badges – z. B. Bearbeiten/Löschen/
  Schließen, Privat/Geteilt, Erledigt/Nicht erledigt): `frontend/src/utils/actionIcons.ts`s
  `ACTION_ICONS` (analog zu `FORM_FIELD_ICONS` für Formularfeld-Label, siehe eigener Abschnitt unten).
  Ein Konzept-Icon pro Aktion, auch wenn mehrere App-Bereiche zufällig dieselbe Tabler-Komponente
  nutzen (z. B. `vacation` hier und `spotCategory.ts`s "Strand" – bewusst getrennt gehalten, ein
  Button-Aktion-Konzept und eine Spot-Kategorie sind unterschiedliche Dinge). Neues wiederkehrendes
  Aktions-/Status-Icon → hier ergänzen statt lokal in der Komponente ein eigenes `IconDef` zu bauen
  (Einzelfälle ohne Wiederverwendungspotenzial dürfen weiterhin lokal bleiben, siehe
  `LocationPicker.vue`s `OWN_LOCATION_ICON`).

**Icon-Stil pro Bereich einzeln einstellbar**: `AppIcon.vue`s Pflicht-Prop `group` (`IconGroup` aus
`stores/iconStyle.ts`s `ICON_GROUP_OPTIONS`: `navigation`, `categories`, `formFields`, `actions`)
ordnet jede Aufrufstelle einem groben Bereich zu. `groupOverrides` (`Partial<Record<IconGroup,
IconStyle>>`, `usePersistedRef`, localStorage `reisotor-icon-style-group-overrides`) erlaubt einen vom
globalen `style` abweichenden Stil je Bereich (z. B. Kategorien auf Symbole, Navigation weiter Emoji);
`iconStyle.styleForGroup(group)` löst das auf (Override falls gesetzt, sonst der globale Default) und
ist die Stelle, die `AppIcon.vue` intern aufruft – nie direkt `iconStyle.style` in einer Komponente
lesen, wenn ein `AppIcon` gerendert wird, sonst umgeht das den Override. UI dafür lebt eingeklappt
("Für einzelne Bereiche anpassen") in `IconStyleSettings.vue`, ein `SegmentedToggle.vue` (Standard/
Emoji/Symbole) pro Eintrag aus `ICON_GROUP_OPTIONS`.

**Farbcodierung wiederverwendet, nicht neu erfunden**: `AppIcon.vue`s optionale `color`-Prop
(Default `currentColor`) überschreibt die Icon-Farbe gezielt an einer Aufrufstelle. Für Symbol-Icons
im Dashboard-Widget-Kontext wird dafür **immer** dieselbe Akzentfarbe genutzt, die die Dashboard-
Kachel selbst schon für dieses Widget hat (`frontend/src/utils/widgetColors.ts`s `WIDGET_COLORS`,
ursprünglich aus `DashboardView.vue` extrahiert) – kein zweites, eigenes Farbschema fürs Icon
daneben. `NAV_LINK_COLORS` in derselben Datei überträgt dieselbe Farbzuordnung 1:1 auf die
NavBar-Icons, aktiv per `iconStyle.navColored` (`usePersistedRef`, localStorage
`reisotor-icon-nav-colored`, **Default `false`**, da die Navigation bisher immer einfarbig war – ein
bewussterer Stilbruch als bei den ohnehin schon farbig hinterlegten Dashboard-Kacheln, deshalb
Opt-in statt automatisch aktiv wie beim Dashboard). Checkbox dafür in `IconStyleSettings.vue`
("Icons in der Navigation einfärben"). Ein neues Widget/ein neuer Nav-Punkt mit eigenem Farbakzent →
in `WIDGET_COLORS` (und ggf. `NAV_LINK_COLORS`) ergänzen, nicht lokal eine Hex-Farbe in der
Komponente hartkodieren.

Kartenmarker (`utils/mapRoute.ts`, genutzt von `TripMap.vue`/`LocationPicker.vue`/
`ExcursionMiniMap.vue`) akzeptieren sowohl ein `IconDef` (Kategorie-/Ortsmarker, respektieren die
Einstellung – rohe Tabler-SVGs dafür kuratiert in `utils/tablerMarkerSvg.ts`, `?raw`-Importe aus dem
vanilla `@tabler/icons`-Paket) als auch einen rohen Emoji-String – Letzteres bewusst nur für das
Nutzer-Avatar (`auth.user.avatar`, `users.avatar`-Spalte): frei aus einem ~180-Emoji-Picker
gewähltes, gespeichertes Identitätsdatum ohne sinnvolles festes Tabler-Äquivalent, bleibt daher
**immer** Emoji, unabhängig von der Einstellung. Dieselbe Ausnahme gilt für jeden Avatar-Fallback
(z. B. `❓` für unbekannte Autor:innen, `🤝` als Platzhalter-"Avatar" für gemeinsame Budget-Töpfe/
Packlisten-Abschnitte ohne festen Besitzer) sowie für native `<select><option>`-Inhalte (können keine
Vue-Komponente rendern, brauchen also weiterhin einen rohen Emoji-String) und für rein dekorative,
einmalige Fließtext-Ausschmückung ohne wiederverwendetes Konzept (z. B. `SecurityCheckView.vue`s
Easter-Egg-Ladehinweise, `DashboardView.vue`s Abreise-Countdown-Sätze).

- **Sichtbarkeits-Kennzeichnung (privat vs. geteilt)**: 🔒 für "nur für eine Person sichtbar", 🤝
  für "für alle Mitreisenden sichtbar" (z. B. Budget-Töpfe, `BudgetPotCard.vue`). Kein eigenes
  drittes System, sondern ein einfaches, wiederverwendbares Paar – bei jedem neuen "privat vs.
  geteilt"-Konzept dieselben zwei Emoji verwenden statt neue zu erfinden. Als `IconDef`-Pendant
  `ACTION_ICONS.private`/`ACTION_ICONS.shared`.

## Formularfelder in Anlege-/Bearbeiten-Dialogen

Reine Beschriftung eines Textfelds per HTML-`placeholder` verschwindet, sobald das Feld einen Wert
trägt – wer einen bereits ausgefüllten Dialog erneut öffnet (Bearbeiten) sieht dann nicht mehr, wofür
das Feld war. Für Text-/URL-/Nummer-/Zahl-Eingabefelder deshalb `components/FormField.vue` als
Wrapper verwenden statt das Eingabefeld nackt ins Formular zu setzen:

```html
<FormField icon="title" label="Titel">
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

`icon` ist kein roher Emoji-String mehr, sondern ein `FormFieldIconKey` aus
`frontend/src/utils/formFieldIcons.ts`s `FORM_FIELD_ICONS` (z. B. `date` 📅, `time` 🕒, `location`
📍, `maps` 🗺️, `contact` 📞, `amount` 💶, `note` 📝, `category` 🏷️, `person` 🧑, `shared` 🤝, `title`
✏️, …) – kein neues Icon erfinden, wenn ein bestehendes Konzept schon eins hat, sondern dort
ergänzen. Ein fertiges `IconDef` (z. B. aus einer der Kategorie-Registries) ist ebenfalls erlaubt, für
Einzelfälle ohne geteiltes Konzept.

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
