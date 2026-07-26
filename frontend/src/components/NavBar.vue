<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNavPositionStore } from '../stores/navPosition';
import { SECTION_ICONS } from '../utils/sectionIcons';

const auth = useAuthStore();
const router = useRouter();
const navPosition = useNavPositionStore();

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
  { to: '/excursions', label: 'Ausflüge', icon: SECTION_ICONS.excursions },
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
      <router-link v-for="link in links" :key="link.to" :to="link.to" class="link" @click="onLinkClick">
        <span class="icon">{{ link.icon }}</span>
        <span class="label">{{ link.label }}</span>
      </router-link>
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
  .navbar.mobile-bottom {
    /* Mobile Einstellung gilt hier nicht mehr – Desktop-Einstellung übernimmt. */
    position: sticky;
    top: 56px;
    bottom: auto;
    border-top: none;
    border-bottom: 1px solid var(--color-border);
  }

  .navbar.desktop-bottom {
    position: fixed;
    top: auto;
    bottom: 0;
    border-top: 1px solid var(--color-border);
    border-bottom: none;
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
