<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useConnectivityStore } from '../stores/connectivity';
import { useNavPositionStore } from '../stores/navPosition';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useIsDesktop } from '../composables/useIsDesktop';
import TripSwitcher from './TripSwitcher.vue';
import PresenceAvatars from './PresenceAvatars.vue';
import NotificationInbox from './NotificationInbox.vue';
import TrackRecordingIndicator from './TrackRecordingIndicator.vue';
import PwaUpdatePrompt from './PwaUpdatePrompt.vue';
import PwaInstallHint from './PwaInstallHint.vue';
import LoadingIndicator from './LoadingIndicator.vue';
import DemoModeBanner from './DemoModeBanner.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { DEMO_MODE } from '../demo/isDemoMode';

const auth = useAuthStore();
const connectivity = useConnectivityStore();

// Steht die NavBar (per Einstellung, siehe stores/navPosition.ts) gerade NICHT direkt unter
// dem Header (sondern unten am Viewport-Rand), fehlt der Header sonst komplett ohne den kräftigeren
// Schatten, der ihn vom scrollenden Inhalt abhebt (siehe .app-header-Kommentar unten) – die NavBar
// selbst bekommt in dem Fall ja ihren eigenen, nach oben gerichteten Schatten. Gleiche
// Desktop/Mobil-Weiche wie NavBar.vue's isTop.
const navPosition = useNavPositionStore();
const isDesktop = useIsDesktop();
const navBarIsBottom = computed(() =>
  isDesktop.value ? navPosition.desktop === 'bottom' : navPosition.mobile === 'bottom'
);

// Der Header ist nur noch 56px hoch, solange die Statuszeile (Offline-/PWA-Update-Hinweis) leer
// ist – NavBar.vue klebt direkt darunter per position:sticky mit einem fest verdrahteten "top"-Wert
// und muss deshalb die tatsächliche, veränderliche Höhe kennen (analog zu NavBar.vue's eigenem
// --navbar-offset-Muster), sonst würde sie beim Scrollen unter dem dann höheren Header verschwinden.
const headerEl = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function updateHeaderHeight() {
  const height = headerEl.value ? headerEl.value.getBoundingClientRect().height : 56;
  document.documentElement.style.setProperty('--app-header-height', `${height}px`);
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateHeaderHeight);
  if (headerEl.value) resizeObserver.observe(headerEl.value);
  updateHeaderHeight();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Frontend wird identisch für Staging und Produktion gebaut (siehe
// .github/workflows/ci.yml) – der Unterschied kommt deshalb zur Laufzeit vom Backend
// (APP_ENV-Env-Var pro Instanz, GET /build-info) statt aus einem Domain-Vergleich, siehe Issue #219.
const buildInfoStore = useBuildInfoStore();
buildInfoStore.load();
const isNonProd = computed(
  () => buildInfoStore.buildInfo != null && buildInfoStore.buildInfo.environment !== 'production'
);
</script>

<template>
  <header ref="headerEl" class="app-header" :class="{ 'nav-bottom': navBarIsBottom }">
    <DemoModeBanner v-if="DEMO_MODE" />
    <!-- Eigene Zeile ÜBER der Icon-Zeile statt zwischen TripSwitcher und den Icons rechts
         eingereiht: der TripSwitcher-Button wächst mit dem Urlaubsnamen und schrumpft nicht
         zuverlässig (siehe .switcher-btn in TripSwitcher.vue), wodurch ein hier eingereihter Pill
         auf schmalen Viewports vom TripSwitcher überlagert statt danebengestellt wurde. -->
    <div class="status-row">
      <TrackRecordingIndicator />
      <PwaUpdatePrompt />
      <PwaInstallHint />
    </div>
    <!-- Bewusst AUSSERHALB von .status-row: LoadingIndicator.vue rendert seit dem Wechsel auf einen
         freischwebenden Toast (position:fixed, blitzt bei JEDEM Request kurz auf/ab) nicht mehr am
         Layout beteiligt - eine Verschachtelung in der Statuszeile würde nur suggerieren, dass er
         (wie Offline-/PWA-Update-Hinweis) Teil von deren dauerhaftem Layout wäre. -->
    <LoadingIndicator />
    <div class="header-row">
      <router-link to="/" class="brand">
        <img src="/reisotor_logo.svg" alt="Reisotor Logo" class="logo" />
        <span class="wordmark">Reisotor</span>
        <span
          v-if="isNonProd"
          class="env-badge"
          title="Dev-/Staging-Umgebung, nicht die echte Produktion"
          >DEV</span
        >
      </router-link>
      <TripSwitcher class="switcher" />
      <PresenceAvatars />
      <NotificationInbox />
      <router-link
        to="/settings"
        class="profile-link"
        :class="{
          'is-online': connectivity.isOnline && !connectivity.syncing && !connectivity.checking,
          'is-offline': !connectivity.isOnline,
          'is-retrying': connectivity.syncing || connectivity.checking,
        }"
        title="Einstellungen"
      >
        <div class="avatar-wrapper">
          <span class="avatar">{{ auth.user?.avatar || '👤' }}</span>
          <div v-if="!connectivity.isOnline" class="offline-badge">
            <AppIcon :icon="ACTION_ICONS.offline" :size="12" group="actions" />
          </div>
        </div>
      </router-link>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  /* Höher als alle Drawer-Ebenen (Drawer.vue: Backdrop/Panel/Lasche/Buttons 11-16), da der Header
     selbst eine eigene Stacking-Context bildet – ein hoher z-index innerhalb (z. B. das
     TripSwitcher-Dropdown, z-index:21) wird sonst nur INNERHALB dieser Context verglichen und
     verliert gegen eine Schublade mit höherem Context-z-index, obwohl der Dropdown-Inhalt optisch
     weit darüber liegen soll. Bleibt unterhalb von Modal.vue (z-index:100). */
  z-index: 25;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  /* Bewusst kein eigener Schlagschatten, solange die NavBar direkt darunter klebt: die bekommt dann
     den deutlich sichtbaren Schatten, der den fixen Kopfbereich vom scrollenden Inhalt abhebt (siehe
     NavBar.vue) – zwei Schatten kurz hintereinander wirkten redundant/unruhig. Die Trennlinie
     (border-bottom) reicht hier weiterhin als dezente Abgrenzung. Steht die NavBar per
     Einstellung dagegen unten (.nav-bottom unten), übernimmt der Header selbst genau
     denselben Schatten – sonst fehlt er komplett, weil dann nichts mehr direkt darunter klebt. */
  box-sizing: border-box;
}

/* Gleicher Schattenwert wie NavBar.vue's Default-.navbar-Schatten (reines Schwarz mit fester
   Opacity statt --shadow-sm/md-Tokens, bleibt so in beiden Themes gleich gut sichtbar). */
.app-header.nav-bottom {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}

/* Statuszeile (Offline-/PWA-Update-Hinweis) bekommt eine eigene volle Zeile über der Icon-Zeile
   statt zwischen TripSwitcher und den Icons rechts eingereiht zu werden – der TripSwitcher-Button
   wächst mit dem Urlaubsnamen und schrumpft nicht zuverlässig (siehe .switcher-btn in
   TripSwitcher.vue), ein hier eingereihter Pill wurde dadurch auf schmalen Viewports vom
   TripSwitcher überlagert statt danebengestellt. :has() statt eines eigenen "zeig überhaupt
   etwas?"-Flags: Offline-/PWA-Zustand kommt aus zwei unabhängigen Stores, die Zeile soll aber ohne
   zusätzliche Kopplung einfach nur dann Platz beanspruchen, wenn eine der beiden Kind-Komponenten
   tatsächlich einen Pill rendert. */
.status-row {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
}

.status-row:has(.pwa-pill) {
  padding: 6px var(--space-4) 0;
}

.header-row {
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  width: fit-content;
  flex-shrink: 0;
}

.env-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: var(--color-accent);
  padding: 2px 7px;
  border-radius: 999px;
  line-height: 1.4;
}

.switcher {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.logo {
  width: 32px;
  height: 32px;
}

.wordmark {
  font-weight: 700;
  color: var(--color-primary-dark);
  font-size: 1.1rem;
}

/* Unter 800px (derselbe Mobil/Desktop-Umbruch wie NavBar.vue/App.vue) reicht der Platz zwischen
   Logo, TripSwitcher und den Buttons rechts nicht mehr für den Schriftzug – er würde sich mit dem
   TripSwitcher überlagern. Logo (und ein evtl. DEV-Badge) bleiben als kompakte Marke stehen. */
@media (max-width: 799px) {
  .wordmark {
    display: none;
  }
}

.profile-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary-tint);
  text-decoration: none;
  flex-shrink: 0;
  transition:
    background 0.15s ease,
    filter 0.2s ease;
  position: relative;
  box-sizing: border-box;
  z-index: 1;
}

.profile-link.is-online {
  border: 2px solid color-mix(in srgb, var(--color-success) 50%, transparent);
}

.profile-link.is-offline {
  filter: grayscale(1) opacity(0.8);
  border: 2px solid transparent;
}

.profile-link.is-retrying {
  border: 2px solid transparent;
}

.profile-link.is-retrying::before {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  bottom: -2px;
  left: -2px;
  z-index: -1;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-success) 0deg,
    var(--color-success) 90deg,
    transparent 180deg
  );
  animation: spin 1s linear infinite;
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #fff calc(100% - 2px));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0);
  opacity: 0.5;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.avatar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: inherit;
}

.offline-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: var(--color-surface);
  color: var(--color-text-light);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--color-surface);
}

.profile-link:hover,
.profile-link.router-link-active {
  background: var(--color-primary);
}

.avatar {
  font-size: 1.2rem;
  line-height: 1;
}
</style>
