<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useTripStore } from './stores/trip';
import { useBudgetStore } from './stores/budget';
import { useDrawersStore } from './stores/drawers';
import { useLiveSyncStore } from './stores/liveSync';
import { useLocationSharingStore } from './stores/locationSharing';
import { useTrackRecordingStore } from './stores/trackRecording';
import { useIsDesktop } from './composables/useIsDesktop';
import { SECTION_ICON_DEFS } from './utils/sectionIcons';
import { prefetchTripDataForOffline } from './utils/offlinePrefetch';
import { useBuildInfoStore } from './stores/buildInfo';
import { getAppTitle } from './utils/envTitle';
import AppHeader from './components/AppHeader.vue';
import NavBar from './components/NavBar.vue';
import Drawer from './components/Drawer.vue';
import ScheduleView from './views/ScheduleView.vue';
import SplashScreen from './components/SplashScreen.vue';
import MustChangePasswordModal from './components/MustChangePasswordModal.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tripStore = useTripStore();
const budgetStore = useBudgetStore();
const drawers = useDrawersStore();
const isDesktop = useIsDesktop();

const buildInfoStore = useBuildInfoStore();
buildInfoStore.load();

watch(
  () => buildInfoStore.buildInfo?.environment,
  (env) => {
    document.title = getAppTitle(env);
  },
  { immediate: true }
);

// SSE-Verbindung + Präsenz sollen laufen, sobald ein Urlaub geladen ist, unabhängig davon, welche
// Unteransicht gerade aktiv ist – Pinia-Stores werden erst beim ersten useXStore()-Aufruf erzeugt,
// siehe liveSync.ts's watch(currentTripId, ..., { immediate: true }). Wird hier außerdem für die
// Nav-Punkte der beiden Schubladen-Laschen (Kalender/Touren) unten gebraucht.
const liveSync = useLiveSyncStore();
// Standort-Freigabe soll unabhängig von der Kartenansicht laufen (siehe stores/locationSharing.ts)
// - hier instanziiert, damit ihr watch(currentTripId) unabhängig davon greift, welche Unteransicht
// gerade aktiv ist, exakt wie liveSync oben.
useLocationSharingStore();
// Standort-Aufzeichnung (stores/trackRecording.ts) läuft ebenso app-weit unabhängig von der
// aktuellen View - hier instanziiert, damit resume() nach einem Reload/App-Neustart mit noch
// laufender Aufzeichnung greift, exakt wie locationSharing oben.
useTrackRecordingStore();
const showNav = computed(() => route.name !== 'login');
// NavBar/Kalender-Schublade gehören zu den Domänen-Ansichten INNERHALB eines AUSGEWÄHLTEN Urlaubs
// (Dashboard, Listen, Karte, ...) - auf der Urlaubsverwaltung (/trips, siehe TripsView.vue) sowie
// solange (noch) kein Urlaub ausgewählt ist (z. B. erster Login auf einem neuen Gerät mit mehreren
// Urlauben, siehe loadTrips() in stores/trip.ts) ergeben sie keinen Sinn.
const showTripNav = computed(() => tripStore.currentTripId != null && route.name !== 'trips');

// Reagiert auf die IDENTITÄT des Nutzers statt (wie vorher) nur auf tripStore.loaded - sonst würde
// tripStore.loadTrips() nur beim allerersten Login der SPA-Session laufen: meldet sich Nutzer A ab
// und Nutzer B im selben Tab an (kein Hard-Reload, siehe LoginView.vue), bliebe tripStore.loaded
// weiterhin true und B sähe A's Trips/currentTripId, bis die Seite neu geladen wird.
watch(
  () => auth.user?.id ?? null,
  (userId, prevUserId) => {
    if (userId !== prevUserId) {
      tripStore.reset();
      budgetStore.reset();
    }
    if (userId) tripStore.loadTrips();
  },
  { immediate: true }
);

// Sobald Trips geladen sind, aber KEIN Urlaub ausgewählt ist, zur Übersichtsseite (TripsView.vue)
// leiten statt (wie vorher) direkt hier im Template ein Anlegen-Formular ohne Header zu zeigen.
// Deckt zwei Fälle einheitlich ab: keine Urlaube vorhanden, ODER ≥2 Urlaube ohne gespeicherte
// Präferenz auf diesem Gerät (siehe loadTrips() in stores/trip.ts - dort wird bewusst nicht
// geraten). /settings bleibt ausgenommen, damit Logout während der Weiterleitung erreichbar bleibt.
watch(
  () => [tripStore.loaded, tripStore.currentTripId, route.name] as const,
  ([loaded, currentTripId, name]) => {
    if (loaded && currentTripId == null && name !== 'trips' && name !== 'settings') {
      router.push({ name: 'trips' });
    }
  },
  { immediate: true }
);

// Serverseitige Session weg (z. B. Prozess-Neustart, siehe api/client.ts) - client.ts feuert
// dieses Event statt selbst hart auf /login umzuleiten (window.location.href), damit parallel
// laufende Requests/Watcher nicht während eines Dokument-Teardowns weiterlaufen und dabei auf eine
// bereits abgebaute Pinia-/Router-Instanz zugreifen (Ursache der in #77 beobachteten Abstürze).
function onSessionExpired() {
  auth.user = null;
  router.push('/login');
}
onMounted(() => window.addEventListener('reisotor:session-expired', onSessionExpired));
onUnmounted(() => window.removeEventListener('reisotor:session-expired', onSessionExpired));

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
  { immediate: true }
);

// Beim allerersten App-Start soll die Rucksack-Animation (SplashScreen.vue/ReisotorRobot.vue's
// "packing"-Phase) einmal komplett durchlaufen, bevor die eigentliche UI erscheint - danach (z. B.
// bei einem Urlaubswechsel, der liveSync.ready unten erneut kurz auf false setzt) reicht der
// schlichte Lade-Spinner ohne die ~2s-Choreografie erneut zu erzwingen.
const firstLoadDone = ref(
  typeof window !== 'undefined' &&
    (navigator.webdriver || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
);
</script>

<template>
  <MustChangePasswordModal v-if="auth.user?.must_change_password" />
  <template v-if="!showNav">
    <router-view />
  </template>
  <template v-else-if="!tripStore.loaded || !firstLoadDone">
    <SplashScreen :play-intro="!firstLoadDone" @ready="firstLoadDone = true" />
  </template>
  <template v-else>
    <AppHeader />
    <!-- NavBar muss VOR dem Hauptinhalt im DOM stehen: position:sticky "oben" hält ein Element nur
         an seiner natürlichen Fluss-Position fest (direkt unterm Header), es "springt" damit beim
         Scrollen nicht von einer späteren DOM-Position aus nach oben. Ohne Urlaub (trips.length===0,
         Nutzer wird per Watcher oben nach /trips geleitet) bzw. auf der Urlaubsverwaltung selbst
         ergibt eine Domänen-Navigation keinen Sinn - Header (für Logout/Einstellungen) bleibt trotzdem
         immer sichtbar, siehe #75. -->
    <NavBar v-if="showTripNav" />
    <div class="app-shell">
      <!-- Kalender nur auf Desktop als Schublade gemountet – auf Mobil ersetzt dieselbe Komponente
           stattdessen als eigenständige Seite (/calendar, siehe router/index.ts) den Hauptinhalt.
           v-if (nicht nur CSS) verhindert, dass ScheduleView auf Mobil zusätzlich zur Routen-Seite
           ein zweites Mal (unsichtbar) gemountet würde und dabei unnötig ein zweites Mal seine Daten
           läuft. Touren haben seit ihrer Verschmelzung in die Spots-Sicht (ExcursionsView.vue,
           Route /excursions) keine eigene Schublade mehr. -->
      <Drawer
        v-if="isDesktop && showTripNav"
        side="left"
        :open="drawers.calendarOpen"
        :width="drawers.calendarWidth"
        label="Kalender"
        :icon="SECTION_ICON_DEFS.calendar"
        :has-unseen="liveSync.hasUnseen('schedule')"
        @update:open="(v) => (drawers.calendarOpen = v)"
        @update:width="(w) => (drawers.calendarWidth = w)"
      >
        <ScheduleView />
      </Drawer>
      <main class="app-main">
        <router-view :key="tripStore.currentTripId ?? undefined" />
      </main>
    </div>
  </template>
</template>

<style scoped>
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
