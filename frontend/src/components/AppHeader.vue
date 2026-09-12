<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useConnectivityStore } from '../stores/connectivity';
import { useNavPositionStore } from '../stores/navPosition';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useIsDesktop } from '../composables/useIsDesktop';
import TripSwitcher from './TripSwitcher.vue';
import NavBar from './NavBar.vue';
import PresenceAvatars from './PresenceAvatars.vue';
import NotificationInbox from './NotificationInbox.vue';
import TrackRecordingIndicator from './TrackRecordingIndicator.vue';
import LoadingIndicator from './LoadingIndicator.vue';
import DemoModeBanner from './DemoModeBanner.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { DEMO_MODE } from '../demo/isDemoMode';

import { useHeaderNavFits } from '../composables/useHeaderNavFits';

const auth = useAuthStore();
const tripStore = useTripStore();
const connectivity = useConnectivityStore();
const navPosition = useNavPositionStore();
const isDesktop = useIsDesktop();
const headerNavFits = useHeaderNavFits();
const route = useRoute();

const showTripNav = computed(() => tripStore.currentTripId != null && route.name !== 'trips');
const showDockedNav = computed(
  () => isDesktop.value && headerNavFits.value && navPosition.desktop === 'top' && showTripNav.value
);

// Der Header ist standardmäßig 56px hoch (bzw. höher im Demo-Modus durch den DemoModeBanner) –
// NavBar.vue klebt direkt darunter per position:sticky mit einem fest verdrahteten "top"-Wert
// und muss deshalb die tatsächliche Höhe kennen (analog zu NavBar.vue's eigenem
// --navbar-offset-Muster).
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

const profileTitle = computed(() => {
  if (!connectivity.isOnline) return 'Offline – Einstellungen';
  if (connectivity.pendingCount > 0) {
    return `${connectivity.pendingCount} ausstehende Synchronisation(en) – Einstellungen`;
  }
  return 'Einstellungen';
});
</script>

<template>
  <header ref="headerEl" class="app-header">
    <DemoModeBanner v-if="DEMO_MODE" />
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

      <div class="header-center">
        <div class="floating-island" :class="{ 'has-nav': showDockedNav }">
          <TripSwitcher class="switcher" :docked="showDockedNav" />
          <Transition name="nav-dock">
            <div v-if="showDockedNav" class="docked-nav">
              <div class="dock-divider" aria-hidden="true"></div>
              <NavBar embedded />
            </div>
          </Transition>
        </div>
      </div>

      <div class="header-actions">
        <TrackRecordingIndicator />
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
          :title="profileTitle"
        >
          <div class="avatar-wrapper">
            <span class="avatar">{{ auth.user?.avatar || '👤' }}</span>
            <div v-if="!connectivity.isOnline" class="offline-badge" title="Offline">
              <AppIcon :icon="ACTION_ICONS.offline" :size="12" group="actions" />
            </div>
            <div
              v-else-if="connectivity.pendingCount > 0"
              class="pending-badge"
              :title="`${connectivity.pendingCount} ausstehende Synchronisation(en)`"
            >
              <AppIcon
                :icon="ACTION_ICONS.syncPending"
                :size="11"
                group="actions"
                :class="{ 'is-spinning': connectivity.syncing }"
              />
            </div>
          </div>
        </router-link>
      </div>
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
  background: transparent;
  border-bottom: none;
  box-shadow: none;
  box-sizing: border-box;
  pointer-events: none;
}

.header-row {
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  box-sizing: border-box;
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  width: fit-content;
  flex-shrink: 0;
  pointer-events: auto;
  border-radius: 999px;
  transition: opacity 0.15s ease;
}

.brand:hover {
  opacity: 0.85;
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

.header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

/* Die schwebende "Liquid Glass"-Insel im Header. Vereint den TripSwitcher und bei ausgewählter Reise
   auf Desktop die Haupt-Navigation zu einem organisch verschmolzenen Pill-Container. */
.floating-island {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  -webkit-backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  padding: var(--space-1);
  pointer-events: auto;
  max-width: 100%;
  min-width: 0;
  position: relative;
}

.floating-island.has-nav {
  margin-top: var(--space-4);
}

.switcher {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 1;
}

.floating-island.has-nav .switcher {
  flex-shrink: 0;
}

.dock-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-strong);
  margin: 0 4px;
  opacity: 0.5;
  flex-shrink: 0;
}

.docked-nav {
  display: inline-flex;
  align-items: center;
  max-width: 900px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  opacity: 1;
  transform: scale(1);
  transform-origin: left center;
}

.docked-nav::-webkit-scrollbar {
  display: none;
}

.nav-dock-enter-active,
.nav-dock-leave-active {
  transition:
    max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  white-space: nowrap;
}

.nav-dock-enter-from,
.nav-dock-leave-to {
  max-width: 0 !important;
  opacity: 0 !important;
  transform: scale(0.96) !important;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  pointer-events: auto;
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

@media (max-width: 1200px) {
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

.pending-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: var(--color-accent);
  color: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--color-surface);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.pending-badge:hover {
  transform: scale(1.15);
}

.pending-badge .is-spinning {
  animation: spin 1s linear infinite;
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
