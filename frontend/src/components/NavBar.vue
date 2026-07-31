<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useDrawersStore } from '../stores/drawers';
import { SECTION_ICONS } from '../utils/sectionIcons';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();
const drawers = useDrawersStore();

// Schubladen (Drawer.vue) kleben ebenfalls "oben" fest und müssen wissen, wie viel Platz die
// NavBar dort tatsächlich einnimmt, um sie nicht zu überdecken – siehe --navbar-offset in
// style.css. Breite/Höhe der NavBar hängen vom Breakpoint (mobil/Desktop) und der jeweiligen
// Positions-Einstellung ab, daher live per matchMedia + ResizeObserver statt fest verdrahtet.
const navEl = ref<HTMLElement | null>(null);
const desktopQuery = window.matchMedia('(min-width: 800px)');
const isDesktop = ref(desktopQuery.matches);
const isTop = computed(() => (isDesktop.value ? navPosition.desktop === 'top' : navPosition.mobile === 'top'));
let resizeObserver: ResizeObserver | null = null;

function updateOffset() {
  const height = navEl.value ? navEl.value.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--navbar-offset', `${isTop.value ? height : 0}px`);
  document.documentElement.style.setProperty('--navbar-bottom-offset', `${isTop.value ? 0 : height}px`);
}

function onDesktopQueryChange(event: MediaQueryListEvent) {
  isDesktop.value = event.matches;
}

onMounted(() => {
  desktopQuery.addEventListener('change', onDesktopQueryChange);
  resizeObserver = new ResizeObserver(updateOffset);
  if (navEl.value) resizeObserver.observe(navEl.value);
  updateOffset();
});

onUnmounted(() => {
  desktopQuery.removeEventListener('change', onDesktopQueryChange);
  resizeObserver?.disconnect();
});

watch(isTop, updateOffset);

const links = [
  { to: '/', label: 'Übersicht', icon: SECTION_ICONS.dashboard },
  { to: '/packing', label: 'Packliste', icon: SECTION_ICONS.packing },
  { to: '/shopping', label: 'Einkauf', icon: SECTION_ICONS.shopping },
  { to: '/todo', label: 'ToDo', icon: SECTION_ICONS.todo },
  { to: '/excursions', label: 'Karte', icon: SECTION_ICONS.map },
  { to: '/travel', label: 'Reise', icon: SECTION_ICONS.travel },
  { to: '/accommodation', label: 'Unterkunft', icon: SECTION_ICONS.accommodation },
  { to: '/budget', label: 'Budget', icon: SECTION_ICONS.budget },
  { to: '/diary', label: 'Tagebuch', icon: SECTION_ICONS.diary },
  { to: '/notes', label: 'Notizen', icon: SECTION_ICONS.notes },
];

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
      <!-- Kalender/Touren sind keine Routen, sondern globale Schubladen (App.vue) – auf Desktop
           bleiben sie über die seitlich schwebende Lasche (Drawer.vue) erreichbar, die dort genug
           Abstand zum Inhalt hat. Auf Mobil überlagerte dieselbe Lasche aber teils wichtige Buttons
           (z. B. die Sheet-Auf/Ab-Pfeile in ExcursionsView.vue) – dort deshalb stattdessen als
           normale NavBar-Buttons (siehe .drawer-nav-link, nur <800px sichtbar; Drawer.vue blendet
           die Lasche im Gegenzug dort aus). Kalender bewusst ganz links (kein zugehöriger
           Routen-Link, an den er sich "anlehnen" könnte), Touren direkt neben ihrem inhaltlichen
           Pendant "Karte". router-link-active (statt einer eigenen Klasse) für identische Optik zum
           aktiven Routen-Link nebenan. -->
      <button
        type="button"
        class="link drawer-nav-link"
        :class="{ 'router-link-active': drawers.calendarOpen }"
        :aria-expanded="drawers.calendarOpen"
        :aria-label="(drawers.calendarOpen ? 'Schließen: ' : 'Öffnen: ') + 'Kalender'"
        @click="onLinkClick($event); drawers.toggleCalendar()"
      >
        <span class="icon">{{ SECTION_ICONS.calendar }}</span>
        <span class="label">Kalender</span>
      </button>
      <template v-for="link in links" :key="link.to">
        <router-link :to="link.to" class="link" @click="onLinkClick">
          <span class="icon">{{ link.icon }}</span>
          <span class="label">{{ link.label }}</span>
        </router-link>
        <button
          v-if="link.to === '/excursions'"
          type="button"
          class="link drawer-nav-link"
          :class="{ 'router-link-active': drawers.excursionsOpen }"
          :aria-expanded="drawers.excursionsOpen"
          :aria-label="(drawers.excursionsOpen ? 'Schließen: ' : 'Öffnen: ') + 'Touren'"
          @click="onLinkClick($event); drawers.toggleExcursions()"
        >
          <span class="icon">{{ SECTION_ICONS.excursions }}</span>
          <span class="label">Touren</span>
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 56px;
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
.navbar.mobile-bottom {
  position: fixed;
  top: auto;
  bottom: 0;
  border-top: 1px solid var(--color-border);
  border-bottom: none;
  /* Unten-fixiert: Schatten nach oben in den Inhalt hinein statt nach unten (dort wäre er ohnehin
     außerhalb des Viewports). */
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.18);
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
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
  white-space: nowrap;
}

.link.router-link-active {
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
}

.icon {
  font-size: 1.2rem;
}

/* Button-Reset, damit er optisch nicht von den .link-<router-link>s daneben abweicht. Nur <800px
   sichtbar (siehe @media unten) – ab Desktop übernimmt wieder die Drawer.vue-Lasche. */
.drawer-nav-link {
  border: none;
  background: none;
  font: inherit;
}

.logout {
  display: none;
}

@media (min-width: 800px) {
  .drawer-nav-link {
    display: none;
  }

  .navbar.mobile-bottom {
    /* Mobile Einstellung gilt hier nicht mehr – Desktop-Einstellung übernimmt. */
    position: sticky;
    top: 56px;
    bottom: auto;
    border-top: none;
    border-bottom: 1px solid var(--color-border);
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
