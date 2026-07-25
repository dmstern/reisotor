<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useTripStore, type TripFormData } from './stores/trip';
import AppHeader from './components/AppHeader.vue';
import NavBar from './components/NavBar.vue';
import TripForm from './components/TripForm.vue';

const route = useRoute();
const auth = useAuthStore();
const tripStore = useTripStore();
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
    <NavBar />
    <router-view :key="tripStore.currentTripId ?? undefined" />
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
</style>
