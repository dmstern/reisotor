<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useNavConfigStore } from '../stores/navConfig';
import { useLiveSyncStore } from '../stores/liveSync';
import { useIsDesktop } from '../composables/useIsDesktop';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { NAV_LINKS, type NavLinkDef } from '../utils/navLinks';
import { NAV_LINK_COLORS } from '../utils/widgetColors';
import { useIconStyleStore } from '../stores/iconStyle';
import AppIcon from './AppIcon.vue';

const _auth = useAuthStore();
const _router = useRouter();
const route = useRoute();
const navPosition = useNavPositionStore();
const navConfig = useNavConfigStore();
const liveSync = useLiveSyncStore();
const isDesktop = useIsDesktop();
const iconStyle = useIconStyleStore();

// Schubladen (Drawer.vue) kleben ebenfalls "oben" fest und müssen wissen, wie viel Platz die
// NavBar dort tatsächlich einnimmt, um sie nicht zu überdecken – siehe --navbar-offset in
// style.css. Höhe hängt vom Breakpoint (mobil/Desktop) und der jeweiligen Positions-Einstellung
// ab, daher live per ResizeObserver statt fest verdrahtet.
const navEl = ref<HTMLElement | null>(null);
const isTop = computed(() =>
  isDesktop.value ? navPosition.desktop === 'top' : navPosition.mobile === 'top'
);
let resizeObserver: ResizeObserver | null = null;

function updateOffset() {
  const height = navEl.value ? navEl.value.getBoundingClientRect().height : 0;
  // Die schwebende "Liquid Glass"-Pille (mobile-bottom, siehe CSS unten) hat zusätzlich zu ihrer
  // eigenen Höhe noch einen Rand-Abstand zum Viewport-Rand (var(--space-3)) - der muss mit in den
  // reservierten Content-Abstand einfließen, sonst würde scrollbarer Inhalt optisch bis unter die
  // Pille statt sauber darüber enden. Nur für mobile-bottom relevant, nicht desktop-bottom (das
  // bleibt randlos flach, siehe @media(min-width:800px) im Style-Block).
  const floatingGap =
    !isDesktop.value && navPosition.mobile === 'bottom'
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-3')) || 0
      : 0;
  document.documentElement.style.setProperty('--navbar-offset', `${isTop.value ? height : 0}px`);
  document.documentElement.style.setProperty(
    '--navbar-bottom-offset',
    `${isTop.value ? 0 : height + floatingGap}px`
  );
}

// Aktive Hervorhebung gleitet per JS-gemessener transform/width-Animation zwischen den Nav-Punkten
// statt hart umzuschalten (gleiches Grundprinzip wie SegmentedToggle.vue's Pille) - anders als dort
// haben Nav-Links aber unterschiedliche Breiten und eine dynamische, nutzerkonfigurierbare Anzahl
// (navConfig.ts), ein reines CSS-Grid mit gleich breiten Spalten funktioniert hier also nicht. Statt
// dessen wird die tatsächliche Position/Breite des aktiven `.link`-Elements per offsetLeft/
// offsetWidth ausgelesen und einem absolut positionierten Geschwister-Element zugewiesen.
const linksEl = ref<HTMLElement | null>(null);
const highlightLeft = ref(0);
const highlightWidth = ref(0);
const highlightVisible = ref(false);

function updateHighlight() {
  const activeEl = linksEl.value?.querySelector<HTMLElement>('.link.router-link-active');
  if (!activeEl) {
    highlightVisible.value = false;
    return;
  }
  highlightLeft.value = activeEl.offsetLeft;
  highlightWidth.value = activeEl.offsetWidth;
  highlightVisible.value = true;
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    updateOffset();
    updateHighlight();
  });
  if (navEl.value) resizeObserver.observe(navEl.value);
  updateOffset();
  nextTick(updateHighlight);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(isTop, updateOffset);

// "Übersicht" (Dashboard) bleibt fix, nicht Teil der konfigurierbaren Liste (siehe navLinks.ts) -
// zentraler Einstiegspunkt der App, soll nicht ausblendbar/verschiebbar sein.
const DASHBOARD_LINK: NavLinkDef = {
  key: 'dashboard',
  to: '/',
  label: 'Übersicht',
  icon: SECTION_ICON_DEFS.dashboard,
};

// Sichtbare Einträge in der vom Nutzer konfigurierten Reihenfolge (siehe stores/navConfig.ts,
// SettingsView.vue) - ausgeblendete Einträge werden hier bereits rausgefiltert, nicht erst im
// Template, damit z. B. der "Touren neben Karte"-Sondereinschub unten unverändert funktioniert.
const visibleLinks = computed<NavLinkDef[]>(() =>
  navConfig.entries
    .filter((e) => e.visible)
    .map((e) => NAV_LINKS.find((l) => l.key === e.key))
    .filter((l): l is NavLinkDef => !!l)
);

// route.fullPath (nicht nur .path) reicht auch für den seltenen Fall, dass sich nur Query/Hash
// ändern und `router-link-active` dadurch nicht neu berechnet wird - dann bleibt updateHighlight()
// einfach ein No-Op, da sich die aktive Klasse nicht verschiebt. visibleLinks zusätzlich beobachten,
// da sich Breite/Position aller Links ändert, sobald Einträge in SettingsView.vue aus-/eingeblendet
// werden.
watch([() => route.fullPath, visibleLinks], () => nextTick(updateHighlight));

function hasUnseenAny(link: NavLinkDef): boolean {
  if (link.domain) return liveSync.hasUnseen(link.domain);
  if (link.domains) return link.domains.some((d) => liveSync.hasUnseen(d));
  return false;
}

// Scrollt ein angeklicktes Nav-Icon vollständig in den sichtbaren Bereich – wichtig auf
// mobilen Geräten, wo die Leiste horizontal scrollt und rechte Icons teils abgeschnitten sind.
function onLinkClick(event: MouseEvent) {
  (event.currentTarget as HTMLElement).scrollIntoView({
    behavior: 'smooth',
    inline: 'nearest',
    block: 'nearest',
  });
}
</script>

<template>
  <nav
    ref="navEl"
    class="navbar"
    :class="[`mobile-${navPosition.mobile}`, `desktop-${navPosition.desktop}`]"
  >
    <div class="links" ref="linksEl">
      <!-- Gleitende Hervorhebung hinter den Links (siehe updateHighlight() oben) - ein einzelnes
           Element statt einer Hintergrundfarbe je aktivem .link, damit sich beim Wechseln eine
           durchgehende Bewegung statt eines harten Umschaltens ergibt. -->
      <span
        class="nav-highlight"
        :class="{ visible: highlightVisible }"
        :style="{ transform: `translateX(${highlightLeft}px)`, width: `${highlightWidth}px` }"
        aria-hidden="true"
      ></span>
      <!-- Übersicht (Dashboard) ganz links, noch vor dem mobilen Kalender-Link: der zentrale
           Einstiegspunkt der App soll auf mobile immer der allererste (am wenigsten wegscrollte)
           Nav-Punkt sein. -->
      <router-link :to="DASHBOARD_LINK.to" class="link" @click="onLinkClick">
        <AppIcon
          class="icon"
          :icon="DASHBOARD_LINK.icon"
          group="navigation"
          :color="iconStyle.navColored ? NAV_LINK_COLORS.get('dashboard') : undefined"
        />
        <span class="label">{{ DASHBOARD_LINK.label }}</span>
      </router-link>
      <!-- Kalender ist auf Desktop weiterhin eine globale Schublade (App.vue, über die seitlich
           schwebende Lasche erreichbar). Dieselbe ausklapp-Schublade lässt sich auf Mobil aber kaum
           sinnvoll bedienen (u. a. überlagerte die Lasche dort teils wichtige Inhalte/Buttons) –
           dort deshalb stattdessen als ganz normaler, fest verlinkter Nav-Punkt auf eine eigene
           Seite (/calendar – dieselbe Komponente wie in der Schublade, siehe router/index.ts), nur
           <800px sichtbar (.mobile-page-link; ab Desktop bleibt es beim bestehenden Nav-Punkt hier,
           Kalender erreicht man dort weiterhin nur über die Lasche). Direkt nach Übersicht. Touren
           haben seit ihrer Verschmelzung in die Spots-Sicht ("Karte", /excursions) keinen eigenen
           Nav-Punkt mehr - Touren anlegen/Spots zuordnen geht bereits direkt dort. -->
      <router-link to="/calendar" class="link mobile-page-link" @click="onLinkClick">
        <span class="icon-wrap">
          <AppIcon
            class="icon"
            :icon="SECTION_ICON_DEFS.calendar"
            group="navigation"
            :color="iconStyle.navColored ? NAV_LINK_COLORS.get('calendar') : undefined"
          />
          <span
            v-if="liveSync.hasUnseen('schedule')"
            class="unseen-dot"
            aria-label="Neue Änderungen"
          />
        </span>
        <span class="label">Kalender</span>
      </router-link>
      <router-link
        v-for="link in visibleLinks"
        :key="link.to"
        :to="link.to"
        class="link"
        @click="onLinkClick"
      >
        <span class="icon-wrap">
          <AppIcon
            class="icon"
            :icon="link.icon"
            group="navigation"
            :color="iconStyle.navColored ? NAV_LINK_COLORS.get(link.key) : undefined"
          />
          <span v-if="hasUnseenAny(link)" class="unseen-dot" aria-label="Neue Änderungen" />
        </span>
        <span class="label">{{ link.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  /* AppHeader.vue setzt diese Variable per ResizeObserver auf seine tatsächliche, veränderliche
     Höhe (56px + Statuszeile, falls ein Offline-/PWA-Update-Hinweis gerade angezeigt wird) – ein
     fest verdrahtetes "56px" würde die NavBar sonst beim Scrollen unter dem dann höheren Header
     verschwinden lassen. */
  top: var(--app-header-height, 56px);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  padding: var(--space-2) var(--space-3);
  overflow-x: auto;
  z-index: 10;
  border-top: none;
  border-bottom: 1px solid var(--color-border);
  /* Deutlich sichtbarer Schatten (statt des vorher fehlenden), damit sich der fixe Kopfbereich klar
     vom scrollenden Inhalt darunter abhebt (AppHeader.vue verzichtet dafür jetzt bewusst auf einen
     eigenen Schatten). Reines Schwarz mit fester Opacity statt der --shadow-sm/md-Tokens (die sind
     für dezente Karten-Schatten kalibriert) – bleibt so in beiden Themes gleich gut sichtbar.
     Richtung folgt der jeweiligen Kante: hier "oben" (Default), nach unten in den Inhalt hinein. */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}

/* Position ist pro Gerätebreite konfigurierbar (Einstellungen) – Default für beide "oben".
   "Oben" nutzt sticky (die NavBar steht dafür im Markup VOR dem Hauptinhalt, siehe App.vue – nur
   an ihrer natürlichen Fluss-Position hält sticky sie beim Scrollen tatsächlich fest). "Unten"
   braucht dagegen position:fixed, unabhängig von der DOM-Reihenfolge an den Viewport-Rand gepinnt;
   .page hat dafür bereits durchgehend padding-bottom reserviert. */
/* Schwebende "Liquid Glass"-Pille statt randloser Vollbreite-Leiste (nur mobil, siehe
   @media(min-width:800px) unten für den unveränderten Desktop-Reset): eine randlos an die
   Bildschirmkante geklebte Leiste war dort zu niedrig/schmal, wodurch ein horizontales
   Wisch-Scrollen der Icons leicht versehentlich stattdessen die Zurück-/Vorwärts-Navigations-
   geste des mobilen Browsers auslöste (die an der äußersten Bildschirmkante abgefangen wird) -
   Rand-Abstand auf allen Seiten nimmt der Geste dort die Angriffsfläche. .page reserviert dafür
   zusätzlichen Randabstand (siehe style.css, --navbar-bottom-offset), sonst würde die schwebende
   Pille am unteren Seitenende Inhalt überlagern. */
.navbar.mobile-bottom {
  position: fixed;
  top: auto;
  left: var(--space-3);
  right: var(--space-3);
  bottom: var(--space-3);
  padding-top: 10px;
  padding-bottom: 10px;
  border: 1px solid var(--color-surface-glass-border);
  border-radius: 999px;
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  -webkit-backdrop-filter: var(--backdrop-blur-md);
  box-shadow:
    0 0 24px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.links {
  position: relative;
  display: flex;
  gap: var(--space-1);
  flex: 1;
}

/* Gleitende Hervorhebungs-Pille hinter den Links (siehe updateHighlight() im Script-Block) - ersetzt
   die vorher pro Link hart umgeschaltete Hintergrundfarbe durch ein einzelnes, per transform/width
   animiertes Element, das zwischen den Nav-Punkten hinüberrutscht (gleiches Grundprinzip wie
   SegmentedToggle.vue's .segmented-thumb). Volle Pille (border-radius:999px) statt Squircle - näher
   an Apples Tab-Bar-Sprache (z. B. Apple Podcasts), gleiche Konvention wie .navbar.mobile-bottom/
   .category-nav (siehe DESIGN.md). "Größere Bewegung" laut DESIGN.md's Animations-Abschnitt (0.25s
   ease) statt der 0.15s-Mikro-Interaktions-Stufe, da die Pille teils über mehrere Nav-Punkte hinweg
   wandert statt nur an Ort und Stelle zu reagieren. */
.nav-highlight {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--color-primary-tint);
  /* --color-primary-tint ist auf --color-surface (Navbar-Hintergrund) fast kontrastfrei (beides
     nahezu weiß in Light Mode, nahezu identisch dunkel in Dark Mode) - die Pille war dadurch fast
     unsichtbar, wodurch das eigentlich vorhandene Gleiten unbemerkt blieb (Issue #71: "Animation
     nicht erkennbar auf Desktop"). Eine dezente, halbtransparente Border zeichnet die Pille
     unabhängig vom Füllfarben-Kontrast nach, ohne selbst zum dominanten Element zu werden - das
     aktive Icon (siehe .link.router-link-active .icon unten) trägt den Hauptteil der Hervorhebung. */
  border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  border-radius: 999px;
  opacity: 0;
  transition:
    transform 0.25s ease,
    width 0.25s ease,
    opacity 0.15s ease;
  pointer-events: none;
}

.nav-highlight.visible {
  opacity: 1;
}

.link {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
  white-space: nowrap;
}

.link.router-link-active {
  color: var(--color-primary-dark);
}

/* Aktives Icon etwas leuchtender als die (dunklere) Textfarbe daneben - .icon bekommt AppIcon.vue's
   Default-color-Prop 'currentColor' (siehe dort), übernimmt diese Regel hier also automatisch für
   die Tabler-Variante. Wirkt bewusst NICHT bei aktivierter navColored-Einstellung (dort setzt
   AppIcon einen expliziten Farb-Prop pro Bereich, der als Inline-Style immer gewinnt) und auch
   nicht für die Emoji-Variante (Emoji ignorieren CSS color ohnehin). */
.link.router-link-active .icon {
  color: var(--color-primary);
}

.icon-wrap {
  position: relative;
  display: inline-flex;
}

.icon {
  font-size: 1.2rem;
}

/* Roter Punkt: eine andere Person hat seit dem letzten Besuch dieses Bereichs etwas geändert
   (Echtzeit-Sync, siehe stores/liveSync.ts). Verschwindet, sobald die Zielansicht gemountet wird
   (markSeen() dort) – ein Klick auf dieses Nav-Item reicht also, um ihn wieder loszuwerden. */
.unseen-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-surface);
  animation: badgePulse 2s infinite ease-in-out;
}

.logout {
  display: none;
}

@media (min-width: 800px) {
  /* Ab Desktop bleibt es bei den zwei ursprünglichen Nav-Punkten neben "Karte" – Kalender/Touren
     erreicht man dort weiterhin ausschließlich über die seitliche Lasche (Drawer.vue). */
  .mobile-page-link {
    display: none;
  }

  .navbar.mobile-bottom {
    /* Mobile Einstellung gilt hier nicht mehr – Desktop-Einstellung übernimmt. Setzt auch die
       schwebende "Liquid Glass"-Optik von oben zurück (bewusst nur ein Mobil-Phänomen, siehe
       dortiger Kommentar - auf Desktop gibt es weder die Wisch-Zurück-Geste noch den knappen
       Platz, der dort das Problem war). */
    position: sticky;
    top: var(--app-header-height, 56px);
    left: 0;
    right: 0;
    bottom: auto;
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
    border-top: none;
    border-bottom: 1px solid var(--color-border);
    border-left: none;
    border-right: none;
    border-radius: 0;
    background: var(--color-surface);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  }

  .navbar.desktop-bottom {
    position: fixed;
    top: auto;
    bottom: 0;
    border-top: 1px solid var(--color-border);
    border-bottom: none;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.18);
  }

  .link {
    flex-direction: row;
    font-size: 0.85rem;
  }

  .logout {
    display: inline-block;
  }
}
</style>
