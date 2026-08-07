<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { useLiveSyncStore, type LiveDomain } from '../stores/liveSync';
import { useIsDesktop } from '../composables/useIsDesktop';
import { useTourSettingsStore } from '../stores/tourSettings';
import { SECTION_ICONS } from '../utils/sectionIcons';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();
const liveSync = useLiveSyncStore();
const isDesktop = useIsDesktop();
const tourSettings = useTourSettingsStore();

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

const links: { to: string; label: string; icon: string; domain?: LiveDomain }[] = [
  { to: '/', label: 'Übersicht', icon: SECTION_ICONS.dashboard },
  { to: '/packing', label: 'Packliste', icon: SECTION_ICONS.packing, domain: 'packing' },
  { to: '/shopping', label: 'Einkauf', icon: SECTION_ICONS.shopping, domain: 'shopping' },
  { to: '/todo', label: 'ToDo', icon: SECTION_ICONS.todo, domain: 'todos' },
  { to: '/excursions', label: 'Karte', icon: SECTION_ICONS.map, domain: 'spots' },
  { to: '/travel', label: 'Reise', icon: SECTION_ICONS.travel, domain: 'travel' },
  { to: '/budget', label: 'Budget', icon: SECTION_ICONS.budget, domain: 'budget' },
  { to: '/diary', label: 'Tagebuch', icon: SECTION_ICONS.diary, domain: 'diary' },
  { to: '/notes', label: 'Notizen', icon: SECTION_ICONS.notes, domain: 'notes' },
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
      <!-- Übersicht (Dashboard) ganz links, noch vor dem mobilen Kalender-Link: der zentrale
           Einstiegspunkt der App soll auf mobile immer der allererste (am wenigsten wegscrollte)
           Nav-Punkt sein. -->
      <router-link :to="links[0].to" class="link" @click="onLinkClick">
        <span class="icon">{{ links[0].icon }}</span>
        <span class="label">{{ links[0].label }}</span>
      </router-link>
      <!-- Kalender/Touren sind auf Desktop weiterhin globale Schubladen (App.vue, über die seitlich
           schwebende Lasche erreichbar). Dieselben ausklapp-Schubladen lassen sich auf Mobil aber
           kaum sinnvoll bedienen (u. a. überlagerte die Lasche dort teils wichtige Inhalte/Buttons)
           – dort deshalb stattdessen als ganz normale, fest verlinkte Nav-Punkte auf eigene Seiten
           (/calendar, /tours – dieselben Komponenten wie in den Schubladen, siehe router/index.ts),
           nur <800px sichtbar (.mobile-page-link; ab Desktop bleibt es bei den beiden bestehenden
           Nav-Punkten hier, Kalender/Touren erreicht man dort weiterhin nur über die Lasche).
           Kalender direkt nach Übersicht, Touren direkt neben ihrem inhaltlichen Pendant "Karte". -->
      <router-link to="/calendar" class="link mobile-page-link" @click="onLinkClick">
        <span class="icon-wrap">
          <span class="icon">{{ SECTION_ICONS.calendar }}</span>
          <span v-if="liveSync.hasUnseen('schedule')" class="unseen-dot" aria-label="Neue Änderungen" />
        </span>
        <span class="label">Kalender</span>
      </router-link>
      <template v-for="link in links.slice(1)" :key="link.to">
        <router-link :to="link.to" class="link" @click="onLinkClick">
          <span class="icon-wrap">
            <span class="icon">{{ link.icon }}</span>
            <span v-if="link.domain && liveSync.hasUnseen(link.domain)" class="unseen-dot" aria-label="Neue Änderungen" />
          </span>
          <span class="label">{{ link.label }}</span>
        </router-link>
        <!-- Im einfachen Touren-Modus (Standard) ausgeblendet: Touren anlegen/Spots zuordnen geht
             dort bereits direkt in der Karte (TourAssignPicker.vue), ein zusätzlicher Nav-Punkt
             daneben wäre nur redundante Navigation (siehe App.vue's Drawer hideTab-Kommentar für
             das Desktop-Pendant). Die Route /tours selbst bleibt unverändert erreichbar - Bearbeiten-
             und Querverweis-Aktionen (drawers.openExcursions()) navigieren dorthin weiterhin, auch im
             einfachen Modus. -->
        <router-link
          v-if="link.to === '/excursions' && tourSettings.advancedEditing"
          to="/tours"
          class="link mobile-page-link"
          @click="onLinkClick"
        >
          <span class="icon-wrap">
            <span class="icon">{{ SECTION_ICONS.excursions }}</span>
            <span v-if="liveSync.hasUnseen('ideas')" class="unseen-dot" aria-label="Neue Änderungen" />
          </span>
          <span class="label">Touren</span>
        </router-link>
      </template>
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
    /* Mobile Einstellung gilt hier nicht mehr – Desktop-Einstellung übernimmt. */
    position: sticky;
    top: var(--app-header-height, 56px);
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
