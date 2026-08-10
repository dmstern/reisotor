<script setup lang="ts">
import { computed, nextTick, watch, ref } from 'vue';
import { MAX_DRAWER_WIDTH, MIN_DRAWER_WIDTH, useDrawersStore } from '../stores/drawers';

const props = defineProps<{
  side: 'left' | 'right';
  open: boolean;
  label: string;
  icon: string;
  width: number;
  hasUnseen?: boolean;
  /** Blendet nur die Lasche aus (den Klick-Einstieg), NICHT die Schublade selbst - die bleibt
   *  weiterhin über `open`/den Store programmatisch erreichbar. Aktuell ungenutzt (nur die
   *  Kalender-Schublade bleibt seit der Verschmelzung der Touren-Schublade in die Spots-Sicht
   *  übrig), die Drawer-Komponente unterstützt es aber weiterhin generisch. */
  hideTab?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'update:width', value: number): void }>();

const drawers = useDrawersStore();
const panelEl = ref<HTMLDivElement | null>(null);

function toggle() {
  emit('update:open', !props.open);
}

// Maximieren nur auf Desktop nutzbar (siehe .maximize-btn CSS) – Mobil verhält sich ohnehin
// bereits wie "maximiert" (Panel als Vollbild-Overlay). Zustand liegt zentral im Store statt lokal,
// da eine maximierte Schublade die jeweils andere automatisch zuklappen und deren Lasche
// deaktivieren muss (siehe drawers.maximize()).
const maximized = computed(() => drawers.maximizedSide === props.side);
const tabDisabled = computed(() => drawers.maximizedSide !== null && drawers.maximizedSide !== props.side);

// Der Wechsel zwischen "normal" (sticky, Flex-Geschwister) und "maximiert" (fixed, Vollbild) lässt
// sich nicht per reiner CSS-Transition animieren – der Sprung von sticky zu fixed ist nicht
// interpolierbar. Stattdessen FLIP-Technik: alte Bildschirmposition/-größe vor der Änderung messen,
// nach der Änderung erneut messen, die Differenz per (sehr wohl animierbarem) transform "rückgängig"
// setzen und dann zur Zielgröße zurück-transitionieren – so sieht der Nutzer ein flüssiges
// Auf-/Zuklappen statt eines harten Sprungs und versteht dadurch, was gerade passiert ist.
async function toggleMaximize() {
  const el = panelEl.value;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const first = el && !reduceMotion ? el.getBoundingClientRect() : null;

  if (maximized.value) {
    drawers.restoreMaximized();
  } else {
    drawers.maximize(props.side);
  }

  if (!el || !first) return;
  await nextTick();
  const last = el.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const scaleX = last.width ? first.width / last.width : 1;
  const scaleY = last.height ? first.height / last.height : 1;
  if (!dx && !dy && scaleX === 1 && scaleY === 1) return;

  el.style.transition = 'none';
  el.style.transformOrigin = 'top left';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
  void el.offsetWidth; // Reflow erzwingen, damit die Startposition tatsächlich gerendert wird.
  el.style.transition = 'transform 0.3s ease';
  el.style.transform = 'none';

  const cleanup = () => {
    el.style.transition = '';
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.removeEventListener('transitionend', cleanup);
  };
  el.addEventListener('transitionend', cleanup);
}

// Schließt man die gerade maximierte Schublade über ihre eigene Lasche, soll sie nicht als
// "maximiert" hängen bleiben (sonst zeigt der Store beim nächsten Öffnen wieder Vollbild an).
watch(
  () => props.open,
  (open) => {
    if (!open && maximized.value) drawers.restoreMaximized();
  },
);

// Anfasser zum Grösser-/Kleinerziehen der Schublade (Pointer Events statt separater Maus-/Touch-
// Handler, damit derselbe Code auch auf Tablets funktioniert).
const resizing = ref(false);
let startX = 0;
let startWidth = 0;

function onResizeStart(event: PointerEvent) {
  resizing.value = true;
  startX = event.clientX;
  startWidth = props.width;
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd);
  event.preventDefault();
}

function onResizeMove(event: PointerEvent) {
  if (!resizing.value) return;
  const delta = event.clientX - startX;
  // Linke Schublade: nach rechts ziehen vergrößert. Rechte Schublade: nach links ziehen vergrößert.
  const signedDelta = props.side === 'left' ? delta : -delta;
  const next = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, startWidth + signedDelta));
  emit('update:width', next);
}

function onResizeEnd() {
  resizing.value = false;
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
}
</script>

<template>
  <div class="drawer" :class="[side, { open, maximized }]" :style="{ '--drawer-width': `${width}px` }">
    <div class="drawer-backdrop" v-if="open" @click="emit('update:open', false)"></div>
    <div ref="panelEl" class="drawer-panel">
      <button
        v-if="open"
        type="button"
        class="maximize-btn"
        :aria-pressed="maximized"
        :aria-label="(maximized ? 'Verkleinern: ' : 'Maximieren: ') + label"
        :title="maximized ? 'Verkleinern' : 'Maximieren'"
        @click="toggleMaximize"
      >
        {{ maximized ? '🗗' : '⛶' }}
      </button>
      <button
        v-if="open"
        type="button"
        class="close-drawer-btn"
        :aria-label="'Schließen: ' + label"
        title="Schließen"
        @click="emit('update:open', false)"
      >
        ✕
      </button>
      <div class="drawer-content"><slot /></div>
    </div>
    <!-- Bewusst AUSSERHALB von .drawer-panel (statt wie früher darin verschachtelt): .drawer-panel
         ist scrollbar (overflow-y:auto) und clippt (overflow-x:hidden) alles, was über seinen
         eigenen Rand hinausragt – ein Anfasser, der teilweise außerhalb des Panels liegen soll (um
         nicht mit dem nativen Scrollbalken um dieselben Pixel zu konkurrieren), würde dort
         unsichtbar/nicht klickbar. Als Geschwister-Element mit eigener fixed-Positionierung (analog
         zu .drawer-panel selbst) liegt er stattdessen im eigens dafür vorgesehenen Zwischenraum
         zwischen Panel und Lasche (siehe --drawer-handle-gap unten), außerhalb jeder Clip-Box. -->
    <div
      v-if="open"
      class="resize-handle resize-grip"
      role="separator"
      aria-orientation="vertical"
      :aria-label="`Breite von ${label} anpassen`"
      @pointerdown="onResizeStart"
    ></div>
    <button
      v-if="!hideTab"
      type="button"
      class="drawer-tab"
      :aria-expanded="open"
      :aria-label="(open ? 'Schließen: ' : 'Öffnen: ') + label"
      :disabled="tabDisabled"
      @click="toggle"
    >
      <span class="tab-icon-wrap">
        <span class="tab-icon">{{ icon }}</span>
        <span v-if="hasUnseen" class="unseen-dot" aria-label="Neue Änderungen" />
      </span>
      <span class="tab-label">{{ label }}</span>
    </button>
  </div>
</template>

<style scoped>
.drawer {
  /* Fester Zwischenraum zwischen Schublade und Ausklapp-Lasche, in dem der Größen-Anfasser
     (.resize-handle) exklusiv liegt – überlappt dadurch nie mit dem nativen Scrollbalken des
     Panels (dessen Breite je nach Betriebssystem/Browser variiert), egal wie breit dieser
     tatsächlich ist. */
  --drawer-handle-gap: 12px;
}

/* Mobil (Default): Panel als fixed Overlay, Tab bleibt als touch-tauglicher Griff permanent am
   Bildschirmrand sichtbar. Wächst zusätzlich bei Hover (Desktop-Maus) für präziseres Klicken,
   ohne die Grundgröße dauerhaft so groß zu machen, dass sie Inhalte am Rand überlagert.
   Kalender/Touren nutzen Drawer.vue inzwischen nur noch auf Desktop (App.vue rendert es dort
   gar nicht mehr, siehe App.vue/router/index.ts – auf Mobil ersetzen eigene Seiten dieselben
   Schubladen-Inhalte), diese mobile Darstellung bleibt hier trotzdem als generisches, für sich
   responsives Verhalten der Komponente erhalten. */
.drawer-tab {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 13;
  min-height: 72px;
  width: 32px;
  padding: 8px 3px;
  border: 1px solid var(--color-border);
  corner-shape: squircle;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: left 0.25s ease, right 0.25s ease, width 0.15s ease, min-height 0.15s ease, transform 0.15s ease;
}

.drawer-tab:hover {
  width: 46px;
  min-height: 84px;
  color: var(--color-primary-dark);
}

.drawer-tab:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.drawer-tab:disabled:hover {
  width: 32px;
  min-height: 72px;
  color: var(--color-text-muted);
}

.drawer.left .drawer-tab {
  left: 0;
  border-left: none;
  border-radius: 0 var(--radius-sm-squircle) var(--radius-sm-squircle) 0;
}

.drawer.right .drawer-tab {
  right: 0;
  border-right: none;
  border-radius: var(--radius-sm-squircle) 0 0 var(--radius-sm-squircle);
}

/* Bei ausgeklappter Schublade übernimmt der Schließen-Button (oben im Panel) die Schließen-
   Funktion – die Lasche selbst wäre dann redundant und (da sie mobil ohnehin am äußersten Rand
   läge) auch optisch im Weg. Gilt jetzt für Mobil UND Desktop gleichermaßen (vorher nur Desktop,
   siehe @media weiter unten), auf Mobil ersetzt seitdem ebenfalls der Schließen-Button die Lasche
   statt sie nur an den (jetzt nicht mehr vorhandenen) Panel-Rand zu verschieben. */
.drawer.open .drawer-tab {
  display: none;
}

.tab-icon-wrap {
  position: relative;
  display: inline-flex;
}

.tab-icon {
  font-size: 1.1rem;
  line-height: 1;
}

/* Gegenstück zu NavBar.vue's .unseen-dot – dieselbe Bedeutung (jemand hat seit dem letzten Besuch
   etwas in dieser Schublade geändert), hier auf der seitlichen Lasche statt einem Nav-Item. */
.unseen-dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-surface);
}

.tab-label {
  font-size: 0.62rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  white-space: nowrap;
}

/* top:56px/bottom:0 (statt vorher unter Einbeziehung von --navbar-offset/60px) lässt die Schublade
   bewusst bis zum Viewport-Rand reichen und dabei die NavBar überdecken (egal ob sie gerade oben
   oder unten positioniert ist, siehe stores/navPosition.ts) – nutzt den Platz voll aus UND
   verhindert, dass ein Tippen auf die (sonst darunter noch sichtbare/klickbare) NavBar versehentlich
   in einen anderen Tab navigiert, während man denkt, die Schublade sei noch im Weg. */
.drawer-backdrop {
  position: fixed;
  top: var(--app-header-height, 56px);
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 11;
}

.drawer-panel {
  position: fixed;
  top: var(--app-header-height, 56px);
  bottom: 0;
  /* Volle Breite auf Mobil (statt vorher min(85vw, var(--drawer-width))) – ausgeklappt ist eine
     Schublade auf Mobil ohnehin bereits gleichbedeutend mit "maximiert" (kein eigener Maximieren-
     Button dort, siehe .maximize-btn unten), soll den verfügbaren Platz dafür auch komplett nutzen. */
  width: 100vw;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  corner-shape: squircle;
  z-index: 12;
  overflow-y: auto;
  /* Rein defensiv (kein bekannter aktueller Grund für horizontalen Überlauf) – .resize-handle liegt
     bewusst NICHT mehr innerhalb dieser Box (siehe dort), gerade damit overflow-x:hidden es nicht
     mit clippen kann. */
  overflow-x: hidden;
  transition: transform 0.25s ease;
}

.drawer.left .drawer-panel {
  left: 0;
  transform: translateX(-100%);
  border-radius: 0 var(--radius-md-squircle) var(--radius-md-squircle) 0;
}

.drawer.right .drawer-panel {
  right: 0;
  transform: translateX(100%);
  border-radius: var(--radius-md-squircle) 0 0 var(--radius-md-squircle);
}

.drawer.open .drawer-panel {
  transform: translateX(0);
}

.drawer-content {
  min-height: 100%;
}

/* Nur Positionierung/Größe hier – die eigentliche Anfasser-Optik (Hover-Hintergrund, zentrierter
   Griff-Strich) kommt aus der geteilten .resize-grip-Klasse (style.css), damit sie überall gleich
   aussieht (z. B. ExcursionsView.vue's Anfasser zwischen Spots-Liste und Karte nutzt dieselbe
   Klasse). */
/* Auf Mobil kein Anfasser: das Panel ist dort immer 100vw breit (siehe .drawer-panel oben), eine
   Größenänderung gibt es nicht. Erst auf Desktop wieder eingeblendet (siehe @media unten). */
.resize-handle {
  display: none;
}

/* Maximieren gibt es nur auf Desktop (siehe @media unten) – ausgeklappt ist eine Schublade auf
   Mobil dank voller Breite (.drawer-panel oben) ohnehin bereits gleichbedeutend mit "maximiert",
   ein zusätzlicher Button dafür wäre dort überflüssig. Schließen dagegen jetzt auch auf Mobil über
   diesen Button statt (wie vorher) ausschließlich über die (bei offener Schublade jetzt immer
   ausgeblendete, siehe .drawer.open .drawer-tab oben) Lasche oder den Backdrop-Klick. */
.maximize-btn {
  display: none;
}

.close-drawer-btn {
  display: flex;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 14;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
}

.close-drawer-btn:hover {
  color: var(--color-primary-dark);
}

/* Desktop: Panel wird echtes Flex-Geschwisterelement (schiebt den Arbeitsbereich zur Seite),
   kein Overlay/Backdrop mehr. App.vue setzt display:flex auf den umgebenden .app-shell-Container;
   die Reihenfolge der Flex-Kinder (Tab vs. Panel) steuert `order` statt DOM-Reihenfolge. */
@media (min-width: 800px) {
  .drawer {
    display: flex;
    align-items: stretch;
  }

  .drawer-backdrop {
    display: none;
  }

  /* position:sticky statt static: .drawer ist (wie .drawer-panel) auf die volle Höhe des
     Hauptinhalts gestreckt (.app-shell/.drawer align-items:stretch) – mit align-self:center hängt
     die vertikale Position des Tabs dadurch von der GESAMTEN Dokumenthöhe ab und "scrollt" bei
     langen Seiten sichtbar mit, statt am Viewport zu kleben. Sticky + top:50% + translateY(-50%)
     ist derselbe Trick wie beim Panel selbst (top: calc(...)), nur mit 50% als Schwelle: der Tab
     rutscht dadurch beim Scrollen nie höher als vertikal mittig im sichtbaren Bereich. */
  .drawer-tab {
    position: sticky;
    top: 50%;
    transform: translateY(-50%);
    min-height: auto;
    align-self: flex-start;
  }

  /* Auf Desktop ist der Tab ein echtes Flex-Geschwisterelement neben dem Hauptinhalt – eine
     Breitenänderung bei Hover (wie mobil) würde den Arbeitsbereich seitlich verschieben. Der
     Vergrößerungseffekt läuft hier stattdessen rein visuell zusätzlich über scale() (kombiniert
     mit dem translateY(-50%) von oben, sonst spränge der Tab beim Hover aus der Zentrierung), das
     nimmt keinen Platz im Flex-Layout ein und schiebt daher nichts. */
  .drawer-tab:hover {
    width: 32px;
    min-height: auto;
    transform: translateY(-50%) scale(1.4);
  }

  .drawer-tab:disabled:hover {
    transform: translateY(-50%);
  }

  .drawer.left .drawer-tab:hover {
    transform-origin: left center;
  }

  .drawer.right .drawer-tab:hover {
    transform-origin: right center;
  }

  /* left/right stammen aus der mobilen position:fixed-Darstellung und wirkten bei position:static
     bisher folgenlos mit (statische Elemente ignorieren sie komplett). Jetzt, wo der Tab auf
     Desktop position:sticky ist, würden sie sonst als (hier ungewollte) horizontale
     Sticky-Schwellen aktiv – die horizontale Position kommt auf Desktop ausschließlich aus dem
     Flex-`order`. Bewusst OHNE margin zum Panel hin (frühere Version hatte hier
     margin-left/-right: var(--drawer-handle-gap) für Abstand im geöffneten Zustand) – die Lasche
     ist jetzt bei geöffneter Schublade ohnehin komplett ausgeblendet (siehe .drawer.open
     .drawer-tab weiter unten), ein Abstand zum (dann unsichtbaren) Panel wird nicht mehr gebraucht.
     Ohne diesen Rest-Margin klebt die Lasche im geschlossenen Zustand jetzt korrekt direkt am
     Bildschirmrand statt mit ungewolltem Abstand davor zu schweben. */
  .drawer.left .drawer-tab {
    order: 2;
    left: auto;
  }
  .drawer.right .drawer-tab {
    order: 1;
    right: auto;
  }

  /* Auf Desktop ist .drawer-panel nicht mehr auf 85vw gedeckelt (siehe .drawer-panel weiter unten,
     width: var(--drawer-width)) – der Anfasser muss der ungeklammerten Breite folgen, sonst
     driftet er bei sehr breiten Schubladen vom tatsächlichen Panel-Rand weg. bottom:0 statt 60px,
     da hier keine untere Navigationsleiste im Weg ist (siehe .drawer-panel's eigenes bottom:auto/
     max-height weiter unten). display:flex hebt das mobile display:none wieder auf – nur auf
     Desktop gibt es (bei fester Panel-Breite statt 100vw) überhaupt etwas zum Anfassen. */
  .resize-handle {
    display: flex;
    bottom: 0;
  }
  .drawer.left .resize-handle {
    left: var(--drawer-width);
  }
  .drawer.right .resize-handle {
    right: var(--drawer-width);
  }

  .drawer-panel {
    /* sticky + max-height statt einfach relative: ohne eigene Höhenbegrenzung strecken
       align-items:stretch (.drawer/.app-shell) das Panel sonst auf die volle Höhe des
       Hauptinhalts – bei langen Seiten ragt das blickdichte Panel dann über den sichtbaren
       Bereich hinaus und überdeckt (höherer z-index) eine unten fixierte NavBar links/rechts.
       sticky hält es zusätzlich beim Scrollen des Hauptinhalts im Blickfeld. top/max-height
       beziehen zusätzlich --navbar-offset (NavBar.vue) ein: klebt die NavBar selbst "oben" fest,
       hat sie denselben sticky-top wie das Panel – ohne den Offset würde das Panel (höherer
       z-index) sie beim Scrollen überdecken statt sich darunter einzuordnen. */
    position: sticky;
    top: calc(var(--app-header-height, 56px) + var(--navbar-offset, 0px));
    bottom: auto;
    max-height: calc(100vh - var(--app-header-height, 56px) - var(--navbar-offset, 0px));
    transform: none;
    box-shadow: none;
    border-radius: 0;
    width: var(--drawer-width);
    transition: width 0.25s ease, opacity 0.2s ease;
  }
  .drawer.left .drawer-panel {
    order: 1;
    border-right: 1px solid var(--color-border);
  }
  .drawer.right .drawer-panel {
    order: 2;
    border-left: 1px solid var(--color-border);
  }

  .drawer:not(.open) .drawer-panel {
    width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    border: none;
  }

  /* Nur auf Desktop überhaupt vorhanden (mobil bleibt .maximize-btn display:none, siehe oben) – der
     Schließen-Button selbst ist bereits app-weit (auch mobil) fertig gestylt, hier kommt nur der
     Maximieren-Button dazu und rückt dafür etwas nach links, damit beide nebeneinander Platz haben. */
  .maximize-btn {
    display: flex;
    position: absolute;
    top: 8px;
    right: 44px;
    z-index: 14;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm-squircle);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.95rem;
    line-height: 1;
  }

  .maximize-btn:hover {
    color: var(--color-primary-dark);
  }

  /* Maximiert: Panel verlässt den Flex-Verbund und legt sich als Vollbild-Overlay über den
     Hauptbereich (ähnlich der mobilen Darstellung) – lässt aber oben/unten Platz für Header
     und NavBar frei (--navbar-offset/--navbar-bottom-offset, NavBar.vue), die auf Desktop im
     Gegensatz zu Mobil stets sichtbar bleiben sollen. Höherer z-index als Tabs (13) und Header/
     NavBar (11/10), damit die (bereits automatisch zugeklappte, deaktivierte) andere Lasche nicht
     mehr sichtbar durchscheint. */
  .drawer.maximized .drawer-panel {
    position: fixed;
    top: calc(var(--app-header-height, 56px) + var(--navbar-offset, 0px));
    bottom: var(--navbar-bottom-offset, 0px);
    left: 0;
    right: 0;
    width: auto;
    max-height: none;
    transform: none;
    border-radius: 0;
    z-index: 16;
  }

  .drawer.maximized .resize-handle {
    display: none;
  }
}
</style>
