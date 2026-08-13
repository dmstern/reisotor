<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useNavConfigStore } from '../stores/navConfig';
import { useLiveSyncStore } from '../stores/liveSync';
import { useIsDesktop } from '../composables/useIsDesktop';
import { SECTION_ICONS } from '../utils/sectionIcons';
import { NAV_LINKS, type NavLinkDef } from '../utils/navLinks';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();
const navConfig = useNavConfigStore();
const liveSync = useLiveSyncStore();
const isDesktop = useIsDesktop();

// Schubladen (Drawer.vue) kleben ebenfalls "oben" fest und müssen wissen, wie viel Platz die
// NavBar dort tatsächlich einnimmt, um sie nicht zu überdecken – siehe --navbar-offset in
// style.css. Höhe hängt vom Breakpoint (mobil/Desktop) und der jeweiligen Positions-Einstellung
// ab, daher live per ResizeObserver statt fest verdrahtet.
const navEl = ref<HTMLElement | null>(null);
const isTop = computed(() => (isDesktop.value ? navPosition.desktop === 'top' : navPosition.mobile === 'top'));
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
  document.documentElement.style.setProperty('--navbar-bottom-offset', `${isTop.value ? 0 : height + floatingGap}px`);
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateOffset);
  if (navEl.value) resizeObserver.observe(navEl.value);
  updateOffset();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(isTop, updateOffset);

// "Übersicht" (Dashboard) bleibt fix, nicht Teil der konfigurierbaren Liste (siehe navLinks.ts) -
// zentraler Einstiegspunkt der App, soll nicht ausblendbar/verschiebbar sein.
const DASHBOARD_LINK: NavLinkDef = { key: 'dashboard', to: '/', label: 'Übersicht', icon: SECTION_ICONS.dashboard };

// Sichtbare Einträge in der vom Nutzer konfigurierten Reihenfolge (siehe stores/navConfig.ts,
// ProfileView.vue) - ausgeblendete Einträge werden hier bereits rausgefiltert, nicht erst im
// Template, damit z. B. der "Touren neben Karte"-Sondereinschub unten unverändert funktioniert.
const visibleLinks = computed<NavLinkDef[]>(() =>
  navConfig.entries
    .filter((e) => e.visible)
    .map((e) => NAV_LINKS.find((l) => l.key === e.key))
    .filter((l): l is NavLinkDef => !!l),
);

function hasUnseenAny(link: NavLinkDef): boolean {
  if (link.domain) return liveSync.hasUnseen(link.domain);
  if (link.domains) return link.domains.some((d) => liveSync.hasUnseen(d));
  return false;
}

async function onLogout() {
  await auth.logout();
  router.push('/login');
}

// Scrollt ein angeklicktes Nav-Icon vollständig in den sichtbaren Bereich – wichtig auf
// mobilen Geräten, wo die Leiste horizontal scrollt und rechte Icons teils abgeschnitten sind.
function onLinkClick(event: MouseEvent) {
  (event.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}
</script>

<template>
  <nav ref="navEl" class="navbar" :class="[`mobile-${navPosition.mobile}`, `desktop-${navPosition.desktop}`]">
    <div class="links">
      <!-- Übersicht (Dashboard) ganz links, noch vor dem mobilen Kalender-Link: der zentrale
           Einstiegspunkt der App soll auf mobile immer der allererste (am wenigsten wegscrollte)
           Nav-Punkt sein. -->
      <router-link :to="DASHBOARD_LINK.to" class="link" @click="onLinkClick">
        <span class="icon">{{ DASHBOARD_LINK.icon }}</span>
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
          <span class="icon">{{ SECTION_ICONS.calendar }}</span>
          <span v-if="liveSync.hasUnseen('schedule')" class="unseen-dot" aria-label="Neue Änderungen" />
        </span>
        <span class="label">Kalender</span>
      </router-link>
      <router-link v-for="link in visibleLinks" :key="link.to" :to="link.to" class="link" @click="onLinkClick">
        <span class="icon-wrap">
          <span class="icon">{{ link.icon }}</span>
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

/* Position ist pro Gerätebreite konfigurierbar (Profil-Einstellungen) – Default für beide "oben".
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
  border: 1px solid var(--color-border);
  border-radius: 999px;
  /* color-mix() statt einer zweiten, fest kodierten rgba()-Farbe: bleibt automatisch im jeweils
     aktiven Theme (hell/dunkel) stimmig, da --color-surface selbst schon themeabhängig ist. */
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.links {
  display: flex;
  gap: var(--space-1);
  flex: 1;
}

.link {
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

/* Volle Pille statt der geerbten Squircle-Ecken von .link - näher an Apples Tab-Bar-Sprache (z. B.
   Apple Podcasts), gleiche "Pille"-Konvention wie .navbar.mobile-bottom/.category-nav (siehe
   DESIGN.md: vollständig runde Elemente nutzen border-radius:999px statt eines Squircle-Tokens). */
.link.router-link-active {
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  border-radius: 999px;
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
