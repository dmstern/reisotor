<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useIsDesktop } from '../composables/useIsDesktop';
import { SECTION_ICONS } from '../utils/sectionIcons';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();
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
  document.documentElement.style.setProperty('--navbar-offset', `${isTop.value ? height : 0}px`);
  document.documentElement.style.setProperty('--navbar-bottom-offset', `${isTop.value ? 0 : height}px`);
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
      <!-- Kalender/Touren sind auf Desktop weiterhin globale Schubladen (App.vue, über die seitlich
           schwebende Lasche erreichbar). Dieselben ausklapp-Schubladen lassen sich auf Mobil aber
           kaum sinnvoll bedienen (u. a. überlagerte die Lasche dort teils wichtige Inhalte/Buttons)
           – dort deshalb stattdessen als ganz normale, fest verlinkte Nav-Punkte auf eigene Seiten
           (/calendar, /tours – dieselben Komponenten wie in den Schubladen, siehe router/index.ts),
           nur <800px sichtbar (.mobile-page-link; ab Desktop bleibt es bei den beiden bestehenden
           Nav-Punkten hier, Kalender/Touren erreicht man dort weiterhin nur über die Lasche).
           Kalender bewusst ganz links, Touren direkt neben ihrem inhaltlichen Pendant "Karte". -->
      <router-link to="/calendar" class="link mobile-page-link" @click="onLinkClick">
        <span class="icon">{{ SECTION_ICONS.calendar }}</span>
        <span class="label">Kalender</span>
      </router-link>
      <template v-for="link in links" :key="link.to">
        <router-link :to="link.to" class="link" @click="onLinkClick">
          <span class="icon">{{ link.icon }}</span>
          <span class="label">{{ link.label }}</span>
        </router-link>
        <router-link
          v-if="link.to === '/excursions'"
          to="/tours"
          class="link mobile-page-link"
          @click="onLinkClick"
        >
          <span class="icon">{{ SECTION_ICONS.excursions }}</span>
          <span class="label">Touren</span>
        </router-link>
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
