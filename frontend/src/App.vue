<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useTripStore, type TripFormData } from './stores/trip';
import { useDrawersStore } from './stores/drawers';
import { useIsDesktop } from './composables/useIsDesktop';
import { SECTION_ICONS } from './utils/sectionIcons';
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

async function onCreateFirstTrip(data: TripFormData) {
  await tripStore.createTrip(data);
}
</script>

<template>
  <template v-if="!showNav">
    <router-view />
  </template>
  <template v-else-if="!tripStore.loaded">
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
        @update:open="(v) => (drawers.calendarOpen = v)"
        @update:width="(w) => (drawers.calendarWidth = w)"
      >
        <ScheduleView />
      </Drawer>
      <main class="app-main">
        <router-view :key="tripStore.currentTripId ?? undefined" />
      </main>
      <Drawer
        v-if="isDesktop"
        side="right"
        :open="drawers.excursionsOpen"
        :width="drawers.excursionsWidth"
        label="Touren"
        :icon="SECTION_ICONS.excursions"
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
