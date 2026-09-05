import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useIconStyleStore } from '../stores/iconStyle';
// Statisch (nicht dynamisch wie die übrigen Routen) importiert: App.vue bindet dieselbe Komponente
// bereits statisch für die Desktop-Kalender-Schublade ein – ein zusätzlicher dynamischer Import
// hier würde sie nur unnötig erneut anfordern (Vite kann sie ohnehin nicht in einen separaten Chunk
// auslagern, da sie schon Teil des Hauptbundles ist).
import { useTripStore } from '../stores/trip';
import { useToast } from '../composables/useToast';
import ScheduleView from '../views/ScheduleView.vue';

// Viele Sichten (z. B. SettingsView.vue) rendern ihr Template erst hinter einem v-if="!loading" nach
// einem asynchronen API-Aufruf – ein Sprungziel wie #weather-provider-settings existiert direkt nach
// dem Routenwechsel deshalb oft noch gar nicht im DOM. Ein fester setTimeout wäre abhängig von der
// (auf dem Pi ggf. langsameren) API-Antwortzeit unzuverlässig; stattdessen wird auf das Element
// gewartet (Poll pro Frame), bis es erscheint oder ein Timeout greift.
function waitForElement(selector: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    function check() {
      if (document.querySelector(selector)) {
        resolve(true);
      } else if (performance.now() - start > timeoutMs) {
        resolve(false);
      } else {
        requestAnimationFrame(check);
      }
    }
    check();
  });
}

const router = createRouter({
  // import.meta.env.BASE_URL statt keinem Argument: entspricht immer dem tatsächlich konfigurierten
  // Vite-`base` (vite.config.ts) - für den normalen App-Build weiterhin '/', für den Demo-Build
  // unter GitHub Pages (VITE_BASE=/reisotor/demo/, Issue #172) aber genau dieser Unterpfad. Ohne das
  // würde createWebHistory() intern auf '/' zurückfallen (kein <base>-Tag im HTML), Vue Router
  // versucht dann den KOMPLETTEN Pfad inkl. "/reisotor/demo/"-Präfix gegen die Routen (die alle bei
  // '/' beginnen) zu matchen - schlägt fehl, <router-view> bleibt dauerhaft leer.
  // In isolierten Unit-Testumgebungen (Node.js) wird createMemoryHistory verwendet.
  history:
    typeof window !== 'undefined'
      ? createWebHistory(import.meta.env.BASE_URL)
      : createMemoryHistory(import.meta.env.BASE_URL),
  // Nur für echte Hash-Sprünge (z. B. der "Anbieter wechseln"-Link im Wetter-Widget,
  // DashboardView.vue -> /settings#weather-provider-settings) – kein genereller Scroll-Reset auf
  // Position 0 bei jeder Navigation, um das bisherige Verhalten (Scroll-Position bleibt bei
  // normaler Navigation unangetastet) nicht zu verändern.
  async scrollBehavior(to) {
    if (!to.hash) return;
    const found = await waitForElement(to.hash);
    if (found) return { el: to.hash, behavior: 'smooth' };
  },
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    {
      path: '/security-check',
      name: 'security-check',
      component: () => import('../views/SecurityCheckView.vue'),
    },

    // Deeplinks zu bestimmten Urlauben (#368): /trip/:tripId/...
    {
      path: '/trip/:tripId',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/trip/:tripId/listen',
      name: 'listen',
      component: () => import('../views/ListenView.vue'),
    },
    {
      path: '/trip/:tripId/packing',
      redirect: (to) => ({
        path: `/trip/${to.params.tripId}/listen`,
        query: { ...to.query, tab: 'packing' },
      }),
    },
    {
      path: '/trip/:tripId/shopping',
      redirect: (to) => ({
        path: `/trip/${to.params.tripId}/listen`,
        query: { ...to.query, tab: 'shopping' },
      }),
    },
    {
      path: '/trip/:tripId/todo',
      redirect: (to) => ({
        path: `/trip/${to.params.tripId}/listen`,
        query: { ...to.query, tab: 'todo' },
      }),
    },
    {
      path: '/trip/:tripId/excursions',
      name: 'excursions',
      component: () => import('../views/ExcursionsView.vue'),
    },
    {
      path: '/trip/:tripId/calendar',
      name: 'calendar',
      component: ScheduleView,
      props: { standalone: true },
    },
    {
      path: '/trip/:tripId/travel',
      redirect: (to) => ({
        path: `/trip/${to.params.tripId}/excursions`,
        query: { ...to.query, group: 'tours' },
      }),
    },
    {
      path: '/trip/:tripId/budget',
      name: 'budget',
      component: () => import('../views/BudgetView.vue'),
    },
    {
      path: '/trip/:tripId/notes',
      name: 'notes',
      component: () => import('../views/NotesView.vue'),
    },
    {
      path: '/trip/:tripId/diary',
      name: 'diary',
      component: () => import('../views/DiaryView.vue'),
    },
    {
      path: '/trip/:tripId/trash',
      name: 'trash',
      component: () => import('../views/TrashView.vue'),
    },

    // Legacy-Routen ohne :tripId: Platzhalter-Pfade, werden im beforeEach Guard auf
    // /trip/:currentTripId/... weitergeleitet
    { path: '/', name: 'legacy-dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/listen', name: 'legacy-listen', component: () => import('../views/ListenView.vue') },
    { path: '/packing', redirect: '/listen?tab=packing' },
    { path: '/shopping', redirect: '/listen?tab=shopping' },
    { path: '/todo', redirect: '/listen?tab=todo' },
    {
      path: '/excursions',
      name: 'legacy-excursions',
      component: () => import('../views/ExcursionsView.vue'),
    },
    {
      path: '/calendar',
      name: 'legacy-calendar',
      component: ScheduleView,
      props: { standalone: true },
    },
    { path: '/travel', redirect: '/excursions?group=tours' },
    { path: '/budget', name: 'legacy-budget', component: () => import('../views/BudgetView.vue') },
    { path: '/notes', name: 'legacy-notes', component: () => import('../views/NotesView.vue') },
    { path: '/diary', name: 'legacy-diary', component: () => import('../views/DiaryView.vue') },
    { path: '/trash', name: 'legacy-trash', component: () => import('../views/TrashView.vue') },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.checked) {
    await auth.checkSession();
  }

  // Einmalig nach bestätigter Session laden (load() ist intern gegen Mehrfachaufrufe abgesichert)
  // - Icons rendern app-weit (AppIcon.vue), nicht erst nach einem Besuch der Einstellungs-Ansicht wie bei
  // den Push-Präferenzen.
  if (auth.user) {
    useIconStyleStore().load();
  }

  if (to.name !== 'login' && !auth.user) {
    return { name: 'login' };
  }

  if (to.name === 'login' && auth.user) {
    const tripStore = useTripStore();
    await tripStore.ensureLoaded();
    if (tripStore.currentTripId != null) {
      return { path: `/trip/${tripStore.currentTripId}` };
    }
    return { name: 'trips' };
  }

  // Für alle nicht-Login Routen bei eingeloggtem Nutzer: sicherstellen, dass Trips geladen sind
  if (auth.user && to.name !== 'trips' && to.name !== 'settings' && to.name !== 'security-check') {
    const tripStore = useTripStore();
    await tripStore.ensureLoaded();

    // 1. Wenn eine :tripId in den Parametern übergeben wurde
    if (to.params.tripId) {
      const paramTripId = Number(to.params.tripId);
      if (!Number.isFinite(paramTripId) || !tripStore.hasTrip(paramTripId)) {
        useToast().showToast({
          message: 'Kein Zugriff auf diesen Urlaub oder nicht gefunden',
          type: 'error',
        });
        return { name: 'trips' };
      }

      if (tripStore.currentTripId !== paramTripId) {
        tripStore.selectTrip(paramTripId);
      }
    } else {
      // 2. Legacy-Routen ohne :tripId (z. B. /, /listen, /excursions, ...)
      const subpath = to.path === '/' ? '' : to.path;
      if (tripStore.currentTripId != null) {
        return {
          path: `/trip/${tripStore.currentTripId}${subpath}`,
          query: to.query,
          hash: to.hash,
        };
      } else {
        return { name: 'trips' };
      }
    }
  }

  // Auf Desktop ist der Kalender bereits als globale Schublade gemountet (App.vue) – ein direkter
  // Aufruf dieser Mobil-Seiten-Route (z. B. per eingetippter URL, kein Nav-Link dorthin auf
  // Desktop) würde dieselbe Komponente sonst ein zweites Mal unabhängig mounten (doppelte
  // API-Aufrufe, zwei auseinanderlaufende lokale Zustände).
  if (to.name === 'calendar' && window.matchMedia('(min-width: 800px)').matches) {
    const tripId = to.params.tripId ? String(to.params.tripId) : '';
    return tripId ? { path: `/trip/${tripId}` } : { name: 'trips' };
  }

  return true;
});

export default router;
