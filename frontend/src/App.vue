<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useTripStore, type TripFormData } from './stores/trip';
import { useDrawersStore } from './stores/drawers';
import { SECTION_ICONS } from './utils/sectionIcons';
import AppHeader from './components/AppHeader.vue';
import NavBar from './components/NavBar.vue';
import TripForm from './components/TripForm.vue';
import Drawer from './components/Drawer.vue';
import ScheduleView from './views/ScheduleView.vue';
import MapView from './views/MapView.vue';

const route = useRoute();
const auth = useAuthStore();
const tripStore = useTripStore();
const drawers = useDrawersStore();
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
      <Drawer
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
        side="right"
        :open="drawers.mapOpen"
        :width="drawers.mapWidth"
        label="Karte"
        :icon="SECTION_ICONS.map"
        @update:open="(v) => (drawers.mapOpen = v)"
        @update:width="(w) => (drawers.mapWidth = w)"
      >
        <MapView />
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
}

@media (min-width: 800px) {
  .app-shell {
    display: flex;
    /* flex-start statt stretch: sonst wird .drawer (und darin der zentrierte Tab) über
       align-items:stretch auf die volle Höhe des .app-main-Inhalts gezogen – bei langen Seiten
       landet der Tab dann irgendwo weit unten statt im sichtbaren Bereich, und die Schublade
       kann eine unten fixierte NavBar überlagern. */
    align-items: flex-start;
  }

  .app-main {
    flex: 1;
  }
}
</style>
