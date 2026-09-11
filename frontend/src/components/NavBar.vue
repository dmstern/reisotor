<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavConfigStore } from '../stores/navConfig';
import { useLiveSyncStore } from '../stores/liveSync';
import { useIsDesktop } from '../composables/useIsDesktop';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { NAV_LINKS, type NavLinkDef } from '../utils/navLinks';
import { NAV_LINK_COLORS } from '../utils/widgetColors';
import { useIconStyleStore } from '../stores/iconStyle';
import { useTripStore } from '../stores/trip';
import AppIcon from './AppIcon.vue';
import UnseenDot from './primitives/UnseenDot.vue';

const props = withDefaults(
  defineProps<{
    embedded?: boolean;
  }>(),
  {
    embedded: false,
  }
);

const _auth = useAuthStore();
const _router = useRouter();
const route = useRoute();
const navConfig = useNavConfigStore();
const liveSync = useLiveSyncStore();
const tripStore = useTripStore();
const isDesktop = useIsDesktop();
const iconStyle = useIconStyleStore();

// Schubladen (Drawer.vue) kleben ebenfalls "oben" fest und müssen wissen, wie viel Platz die
// NavBar dort tatsächlich einnimmt, um sie nicht zu überdecken – siehe --navbar-offset in
// style.css. Höhe hängt vom Breakpoint (mobil/Desktop) und der jeweiligen Positions-Einstellung
// ab, daher live per ResizeObserver statt fest verdrahtet.
const navEl = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function updateOffset() {
  if (props.embedded) {
    document.documentElement.style.setProperty('--navbar-offset', '0px');
    document.documentElement.style.setProperty('--navbar-bottom-offset', '0px');
    return;
  }
  const height = navEl.value ? navEl.value.getBoundingClientRect().height : 0;
  // Die schwebende Pille hat zusätzlich zu ihrer eigenen Höhe noch einen Rand-Abstand zum
  // Viewport-Rand (var(--space-3)) - der muss mit in den reservierten Content-Abstand einfließen,
  // sonst würde scrollbarer Inhalt optisch bis unter die Pille statt sauber darüber enden.
  const floatingGap =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-3')) || 12;
  document.documentElement.style.setProperty('--navbar-offset', '0px');
  document.documentElement.style.setProperty(
    '--navbar-bottom-offset',
    `${height > 0 ? height + floatingGap : 0}px`
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

const isTravelActive = computed(() => {
  if (!route.path.includes('/excursions')) return false;
  const tourRole = route.query.tourRole;
  if (!tourRole) return false;
  const roles = (Array.isArray(tourRole) ? tourRole.join(',') : String(tourRole)).split(',');
  return roles.includes('arrival') || roles.includes('departure') || roles.includes('onward');
});

function isLinkActive(link: NavLinkDef): boolean {
  if (link.key === 'travel') {
    return isTravelActive.value;
  }
  if (link.key === 'excursions') {
    const travelVisible = visibleLinks.value.some((l) => l.key === 'travel');
    if (travelVisible && isTravelActive.value) return false;
    return route.path.includes('/excursions');
  }
  const targetPath = tripStore.currentTripId
    ? `/trip/${tripStore.currentTripId}${link.to}`
    : link.to;
  return route.path.startsWith(targetPath);
}

function getLinkTarget(link: NavLinkDef) {
  if (link.key === 'travel') {
    const basePath = tripStore.currentTripId
      ? `/trip/${tripStore.currentTripId}/excursions`
      : '/excursions';
    return {
      path: basePath,
      query: { group: 'tours', tourRole: 'arrival,departure,onward' },
    };
  }
  return tripStore.currentTripId ? `/trip/${tripStore.currentTripId}${link.to}` : link.to;
}

function updateHighlight() {
  const activeEl = linksEl.value?.querySelector<HTMLElement>(
    '.link.active, .link.router-link-active:not(.custom-inactive)'
  );
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
  document.documentElement.style.setProperty('--navbar-offset', '0px');
  document.documentElement.style.setProperty('--navbar-bottom-offset', '0px');
});

watch(() => props.embedded, updateOffset);

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
  <nav ref="navEl" class="navbar" :class="props.embedded ? 'embedded' : 'floating-bottom'">
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
      <router-link
        :to="tripStore.currentTripId ? `/trip/${tripStore.currentTripId}` : '/'"
        class="link"
        @click="onLinkClick"
      >
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
      <router-link
        :to="tripStore.currentTripId ? `/trip/${tripStore.currentTripId}/calendar` : '/calendar'"
        class="link mobile-page-link"
        @click="onLinkClick"
      >
        <span class="icon-wrap">
          <AppIcon
            class="icon"
            :icon="SECTION_ICON_DEFS.calendar"
            group="navigation"
            :color="iconStyle.navColored ? NAV_LINK_COLORS.get('calendar') : undefined"
          />
          <UnseenDot v-if="liveSync.hasUnseen('schedule')" />
        </span>
        <span class="label">Kalender</span>
      </router-link>
      <router-link
        v-for="link in visibleLinks"
        :key="link.key"
        :to="getLinkTarget(link)"
        class="link"
        :class="{ active: isLinkActive(link), 'custom-inactive': !isLinkActive(link) }"
        @click="onLinkClick"
      >
        <span class="icon-wrap">
          <AppIcon
            class="icon"
            :icon="link.icon"
            group="navigation"
            :color="iconStyle.navColored ? NAV_LINK_COLORS.get(link.key) : undefined"
          />
          <UnseenDot v-if="hasUnseenAny(link)" />
        </span>
        <span class="label">{{ link.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.navbar.embedded {
  position: static;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  z-index: 1;
}

.navbar.embedded .links {
  align-items: center;
}

.navbar.embedded .link {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  gap: 1px;
  border-radius: 999px;
  corner-shape: round;
  min-width: 44px;
}

.navbar.embedded .label {
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0.01em;
}

.navbar.floating-bottom {
  position: fixed;
  top: auto;
  bottom: var(--space-3);
  left: 0;
  right: 0;
  margin-inline: auto;
  width: fit-content;
  max-width: calc(100vw - 24px);
  padding: 6px var(--space-2);
  border: 1px solid var(--color-surface-glass-border);
  border-radius: 999px;
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  -webkit-backdrop-filter: var(--backdrop-blur-md);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  z-index: 10;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.navbar.floating-bottom::-webkit-scrollbar {
  display: none;
}

.links {
  position: relative;
  display: flex;
  gap: var(--space-1);
  flex: 1;
  align-items: center;
}

/* Gleitende Hervorhebungs-Pille hinter den Links (siehe updateHighlight() im Script-Block) - ersetzt
   die vorher pro Link hart umgeschaltete Hintergrundfarbe durch ein einzelnes, per transform/width
   animiertes Element, das zwischen den Nav-Punkten hinüberrutscht (gleiches Grundprinzip wie
   SegmentedToggle.vue's .segmented-thumb). Volle Pille (border-radius:999px) statt Squircle - näher
   an Apples Tab-Bar-Sprache (z. B. Apple Podcasts), gleiche Konvention wie .navbar.floating-bottom/
   .category-nav (siehe DESIGN.md). "Größere Bewegung" laut DESIGN.md's Animations-Abschnitt (0.25s
   ease) statt der 0.15s-Mikro-Interaktions-Stufe, da die Pille teils über mehrere Nav-Punkte hinweg
   wandert statt nur an Ort und Stelle zu reagieren. */
.nav-highlight {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--color-primary-tint);
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
  justify-content: center;
  gap: 2px;
  padding: 4px 10px;
  border-radius: 999px;
  corner-shape: round;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
  white-space: nowrap;
  min-width: 44px;
}

.link.active,
.link.router-link-active:not(.custom-inactive) {
  color: var(--color-primary-dark);
}

/* Aktives Icon etwas leuchtender als die (dunklere) Textfarbe daneben - .icon bekommt AppIcon.vue's
   Default-color-Prop 'currentColor' (siehe dort), übernimmt diese Regel hier also automatisch für
   die Tabler-Variante. Wirkt bewusst NICHT bei aktivierter navColored-Einstellung (dort setzt
   AppIcon einen expliziten Farb-Prop pro Bereich, der als Inline-Style immer gewinnt) und auch
   nicht für die Emoji-Variante (Emoji ignorieren CSS color ohnehin). */
.link.active .icon,
.link.router-link-active:not(.custom-inactive) .icon {
  color: var(--color-primary);
}

.icon-wrap {
  position: relative;
  display: inline-flex;
}

.icon {
  font-size: 1.2rem;
}

@media (min-width: 800px) {
  /* Ab Desktop bleibt es bei den zwei ursprünglichen Nav-Punkten neben "Karte" – Kalender/Touren
     erreicht man dort weiterhin ausschließlich über die seitliche Lasche (Drawer.vue). */
  .mobile-page-link {
    display: none;
  }
}
</style>
