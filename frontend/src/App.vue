<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useTripStore, type TripFormData } from './stores/trip';
import { useDrawersStore } from './stores/drawers';
import { useLiveSyncStore } from './stores/liveSync';
import { useLocationSharingStore } from './stores/locationSharing';
import { useTourSettingsStore } from './stores/tourSettings';
import { useIsDesktop } from './composables/useIsDesktop';
import { SECTION_ICONS } from './utils/sectionIcons';
import { prefetchTripDataForOffline } from './utils/offlinePrefetch';
import AppHeader from './components/AppHeader.vue';
import NavBar from './components/NavBar.vue';
import TripForm from './components/TripForm.vue';
import Drawer from './components/Drawer.vue';
import ScheduleView from './views/ScheduleView.vue';
import ExcursionsDrawer from './views/ExcursionsDrawer.vue';

const route = useRoute();
const auth = useAuthStore();
const tripStore = useTripStore();
const drawers = useDrawersStore();
const isDesktop = useIsDesktop();
// SSE-Verbindung + Präsenz sollen laufen, sobald ein Urlaub geladen ist, unabhängig davon, welche
// Unteransicht gerade aktiv ist – Pinia-Stores werden erst beim ersten useXStore()-Aufruf erzeugt,
// siehe liveSync.ts's watch(currentTripId, ..., { immediate: true }). Wird hier außerdem für die
// Nav-Punkte der beiden Schubladen-Laschen (Kalender/Touren) unten gebraucht.
const liveSync = useLiveSyncStore();
// Standort-Freigabe soll unabhängig von der Kartenansicht laufen (siehe stores/locationSharing.ts)
// - hier instanziiert, damit ihr watch(currentTripId) unabhängig davon greift, welche Unteransicht
// gerade aktiv ist, exakt wie liveSync oben.
useLocationSharingStore();
const tourSettings = useTourSettingsStore();
const showNav = computed(() => route.name !== 'login');

watch(
  () => auth.user,
  (user) => {
    if (user && !tripStore.loaded) {
      tripStore.loadTrips();
    }
  },
  { immediate: true },
);

// Wärmt den Offline-Daten-Cache (api/offline.ts) für den aktuellen Urlaub im Hintergrund vor -
// sonst bleiben Views, die DashboardView.vue selbst nicht lädt (Touren, Reise-Orte, Budget-
// Kategorien/Überweisungen, Likes/Kommentare), erst nach einem einmaligen Online-Besuch offline
// nutzbar, obwohl die "App ist jetzt offline verfügbar"-Meldung (PwaUpdatePrompt.vue) das
// Gegenteil suggeriert. Läuft bei jedem Urlaubswechsel erneut (eigener Cache-Key pro trip_id).
watch(
  () => tripStore.currentTripId,
  (tripId) => {
    if (tripId && navigator.onLine) prefetchTripDataForOffline(tripId);
  },
  { immediate: true },
);

async function onCreateFirstTrip(data: TripFormData) {
  await tripStore.createTrip(data);
}
</script>

<template>
  <template v-if="!showNav">
    <router-view />
  </template>
  <template v-else-if="!tripStore.loaded || !liveSync.ready">
    <!-- liveSync.ready: verhindert, dass eine Domänen-Ansicht mountet und markSeen() aufruft, BEVOR
         das Nachhol-Protokoll (backfill, siehe liveSync.ts) für den aktuellen Urlaub fertig ist –
         sonst ein Wettlauf, der die "neu"-Hervorhebung nach einem Reload/Deep-Link verlieren kann. -->
    <div class="onboarding"></div>
  </template>
  <template v-else-if="tripStore.trips.length === 0">
    <div class="onboarding">
      <div class="card onboarding-card">
        <h1>Willkommen bei Reisotor!</h1>
        <p>Lege deinen ersten Urlaub an, um loszulegen.</p>
        <TripForm submit-label="Urlaub anlegen" @submit="onCreateFirstTrip" />
      </div>
    </div>
  </template>
  <template v-else>
    <AppHeader />
    <!-- NavBar muss VOR dem Hauptinhalt im DOM stehen: position:sticky "oben" hält ein Element nur
         an seiner natürlichen Fluss-Position fest (direkt unterm Header), es "springt" damit beim
         Scrollen nicht von einer späteren DOM-Position aus nach oben. -->
    <NavBar />
    <div class="app-shell">
      <!-- Kalender/Touren nur auf Desktop als Schublade gemountet – auf Mobil ersetzen dieselben
           Komponenten stattdessen als eigenständige Seiten (/calendar, /tours, siehe router/index.ts)
           den Hauptinhalt. v-if (nicht nur CSS) verhindert, dass ScheduleView/ExcursionsDrawer auf
           Mobil zusätzlich zur Routen-Seite ein zweites Mal (unsichtbar) gemountet würde und dabei
           unnötig ein zweites Mal seine Daten läuft. -->
      <Drawer
        v-if="isDesktop"
        side="left"
        :open="drawers.calendarOpen"
        :width="drawers.calendarWidth"
        label="Kalender"
        :icon="SECTION_ICONS.calendar"
        :has-unseen="liveSync.hasUnseen('schedule')"
        @update:open="(v) => (drawers.calendarOpen = v)"
        @update:width="(w) => (drawers.calendarWidth = w)"
      >
        <ScheduleView />
      </Drawer>
      <main class="app-main">
        <router-view :key="tripStore.currentTripId ?? undefined" />
      </main>
      <!-- Lasche im einfachen Touren-Modus (Standard) ausgeblendet: Touren anlegen/Spots zuordnen
           geht dort bereits direkt in der Karte-Hauptsicht (TourAssignPicker.vue in
           ExcursionsView.vue), eine zusätzliche, ständig sichtbare "Touren"-Lasche daneben wäre nur
           redundante Navigation. Die Schublade selbst bleibt trotzdem gemountet/funktionsfähig
           (siehe Drawer.vue's hideTab-Prop) - "Bearbeiten" eines Ausflugs (TripMap.vue's
           editOpenExcursion()) und Querverweise (z. B. aus dem Tagebuch) öffnen sie weiterhin
           programmatisch, auch im einfachen Modus. -->
      <Drawer
        v-if="isDesktop"
        side="right"
        :open="drawers.excursionsOpen"
        :width="drawers.excursionsWidth"
        label="Touren"
        :icon="SECTION_ICONS.excursions"
        :has-unseen="liveSync.hasUnseen('ideas')"
        :hide-tab="!tourSettings.advancedEditing"
        @update:open="(v) => (drawers.excursionsOpen = v)"
        @update:width="(w) => (drawers.excursionsWidth = w)"
      >
        <ExcursionsDrawer />
      </Drawer>
    </div>
  </template>
</template>

<style scoped>
.onboarding {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
}

.onboarding-card {
  max-width: 420px;
  width: 100%;
}

.onboarding-card h1 {
  margin-bottom: var(--space-2);
}

.onboarding-card p {
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.app-main {
  min-width: 0;
  /* container-type global hier statt in einzelnen Views: .app-main ist die einzige Stelle, an der
     die WIRKLICH verfügbare Breite ankommt (Viewport minus offene Schubladen, siehe .app-shell
     unten) – einzelne Seiten (z. B. ExcursionsView.vue) können sich per @container darauf
     verlassen, ohne selbst noch einen eigenen Container aufspannen zu müssen. Benannt (statt
     anonym), da einzelne Seiten (ExcursionsView.vue) inzwischen selbst verschachtelte
     Container aufspannen (z. B. .spots-col für Kompakt-Zeilen-Abfragen) – unbenannte
     @container-Abfragen für Enkel-Elemente eines solchen inneren Containers würden sonst
     versehentlich GEGEN DIESEN statt gegen .app-main ausgewertet. */
  container: app-main / inline-size;
}

@media (min-width: 800px) {
  .app-shell {
    display: flex;
    /* stretch (nicht flex-start!): .drawer muss die volle Höhe von .app-main erreichen, sonst hat
       das sticky .drawer-panel (Drawer.vue) bei langen Seiten nur ein kurzes "Trag"-Element zum
       Dranhaften zur Verfügung und scrollt nach einem Viewport schon mit weg, statt stehen zu
       bleiben. Das sichtbare/blickdichte Panel selbst bleibt trotzdem über sein eigenes
       max-height (Drawer.vue) auf Viewport-Höhe gedeckelt – dadurch kann es weiterhin nie eine
       unten fixierte NavBar überlagern, unabhängig davon, wie hoch .drawer insgesamt ist. */
    align-items: stretch;
  }

  .app-main {
    flex: 1;
  }
}
</style>

<!-- e2e-update-test -->
