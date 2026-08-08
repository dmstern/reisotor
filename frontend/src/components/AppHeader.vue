<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useConnectivityStore } from '../stores/connectivity';
import TripSwitcher from './TripSwitcher.vue';
import PresenceAvatars from './PresenceAvatars.vue';
import OfflineIndicator from './OfflineIndicator.vue';
import PwaUpdatePrompt from './PwaUpdatePrompt.vue';
import LoadingIndicator from './LoadingIndicator.vue';
import ThemeModeSelect from './ThemeModeSelect.vue';

const auth = useAuthStore();
// Nur instanziieren, damit die Online/Offline-Listener + der periodische Health-Check (siehe dort)
// unabhängig davon laufen, ob gerade eine bestimmte Unteransicht gemountet ist.
useConnectivityStore();

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

// Frontend wird identisch für Staging (dev.reise.ruebenherz.de) und Produktion
// (reise.ruebenherz.de) gebaut (siehe .github/workflows/build-deploy.yml) – der Unterschied lässt
// sich also nur zur Laufzeit über den Hostnamen erkennen, nicht über einen Build-Flag/env-Wert.
// Alles außer der echten Produktions-Domain (Staging, localhost, IPs) gilt als Nicht-Prod.
const isNonProd = window.location.hostname !== 'reise.ruebenherz.de';
</script>

<template>
  <header ref="headerEl" class="app-header" :class="{ 'non-prod': isNonProd }">
    <!-- Eigene Zeile ÜBER der Icon-Zeile statt zwischen TripSwitcher und den Icons rechts
         eingereiht: der TripSwitcher-Button wächst mit dem Urlaubsnamen und schrumpft nicht
         zuverlässig (siehe .switcher-btn in TripSwitcher.vue), wodurch ein hier eingereihter Pill
         auf schmalen Viewports vom TripSwitcher überlagert statt danebengestellt wurde. -->
    <div class="status-row">
      <OfflineIndicator />
      <PwaUpdatePrompt />
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
        <span v-if="isNonProd" class="env-badge" title="Dev-/Staging-Umgebung, nicht die echte Produktion">DEV</span>
      </router-link>
      <TripSwitcher class="switcher" />
      <PresenceAvatars />
      <ThemeModeSelect variant="icon" class="theme-toggle" />
      <router-link to="/profile" class="profile-link" title="Profil">
        <span class="avatar">{{ auth.user?.avatar || '👤' }}</span>
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
  /* Bewusst kein Schlagschatten mehr: die NavBar direkt darunter bekommt jetzt den deutlich
     sichtbaren Schatten, der den fixen Header-Bereich vom scrollenden Inhalt abhebt (siehe
     NavBar.vue) – zwei Schatten kurz hintereinander wirkten redundant/unruhig. Die Trennlinie
     (border-bottom) reicht hier weiterhin als dezente Abgrenzung. */
  box-sizing: border-box;
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

.status-row:has(.offline-pill, .pwa-pill) {
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

/* Einziger optischer Marker für "nicht Produktion" (Staging/lokal) – dezent (nur die
   Header-Trennlinie, kein flächiger Farbwechsel), damit die grundsätzliche UI nicht gestört wird,
   aber auf einen Blick von der echten Produktion unterscheidbar bleibt. */
.app-header.non-prod {
  border-bottom: 2px solid var(--color-accent);
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

/* Auf mobile zieht "alle Mitreisenden statt nur online" (PresenceAvatars.vue) potenziell mehr
   Avatare in den Header als vorher - der Theme-Toggle wandert dafür in die Profil-Einstellungen
   (ProfileView.vue), auf Desktop bleibt er exklusiv hier im Header (derselbe 800px-Umbruch wie
   .wordmark oben/NavBar.vue). */
@media (max-width: 799px) {
  .theme-toggle {
    display: none;
  }
}

.profile-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-tint);
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s ease;
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
