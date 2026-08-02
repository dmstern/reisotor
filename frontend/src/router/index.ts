import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
// Statisch (nicht dynamisch wie die übrigen Routen) importiert: App.vue bindet dieselben zwei
// Komponenten bereits statisch für die Desktop-Schubladen ein – ein zusätzlicher dynamischer Import
// hier würde sie nur unnötig erneut anfordern (Vite kann sie ohnehin nicht in einen separaten Chunk
// auslagern, da sie schon Teil des Hauptbundles sind).
import ScheduleView from '../views/ScheduleView.vue';
import ExcursionsDrawer from '../views/ExcursionsDrawer.vue';

// Viele Sichten (z. B. ProfileView.vue) rendern ihr Template erst hinter einem v-if="!loading" nach
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
  history: createWebHistory(),
  // Nur für echte Hash-Sprünge (z. B. der "Anbieter wechseln"-Link im Wetter-Widget,
  // DashboardView.vue -> /profile#weather-provider-settings) – kein genereller Scroll-Reset auf
  // Position 0 bei jeder Navigation, um das bisherige Verhalten (Scroll-Position bleibt bei
  // normaler Navigation unangetastet) nicht zu verändern.
  async scrollBehavior(to) {
    if (!to.hash) return;
    const found = await waitForElement(to.hash);
    if (found) return { el: to.hash, behavior: 'smooth' };
  },
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/packing', name: 'packing', component: () => import('../views/PackingListView.vue') },
    { path: '/excursions', name: 'excursions', component: () => import('../views/ExcursionsView.vue') },
    // Kalender/Touren sind auf Desktop weiterhin globale Schubladen (App.vue, über die seitliche
    // Lasche erreichbar) – dieselben Komponenten dienen hier zusätzlich als eigenständige Mobil-
    // Seiten (NavBar.vue verlinkt nur dorthin, auf Desktop bleiben diese beiden Nav-Punkte
    // ausgeblendet). Kein separates Wrapper-/Duplikat-Component nötig: ScheduleView.vue/
    // ExcursionsDrawer.vue sind bereits eigenständige, in sich responsive (Container-Queries)
    // Komponenten ohne Abhängigkeit von der umgebenden Drawer-Chrome.
    { path: '/calendar', name: 'calendar', component: ScheduleView, props: { standalone: true } },
    { path: '/tours', name: 'tours', component: ExcursionsDrawer, props: { standalone: true } },
    { path: '/travel', name: 'travel', component: () => import('../views/TravelView.vue') },
    {
      path: '/accommodation',
      name: 'accommodation',
      component: () => import('../views/AccommodationView.vue'),
    },
    { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
    { path: '/shopping', name: 'shopping', component: () => import('../views/ShoppingListView.vue') },
    { path: '/todo', name: 'todo', component: () => import('../views/TodoView.vue') },
    { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
    { path: '/diary', name: 'diary', component: () => import('../views/DiaryView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    {
      path: '/security-check',
      name: 'security-check',
      component: () => import('../views/SecurityCheckView.vue'),
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.checked) {
    await auth.checkSession();
  }

  if (to.name !== 'login' && !auth.user) {
    return { name: 'login' };
  }

  if (to.name === 'login' && auth.user) {
    return { name: 'dashboard' };
  }

  // Auf Desktop sind Kalender/Touren bereits als globale Schublade gemountet (App.vue) – ein
  // direkter Aufruf dieser Mobil-Seiten-Routen (z. B. per eingetippter URL, kein Nav-Link dorthin
  // auf Desktop) würde dieselbe Komponente sonst ein zweites Mal unabhängig mounten (doppelte
  // API-Aufrufe, zwei auseinanderlaufende lokale Zustände).
  if ((to.name === 'calendar' || to.name === 'tours') && window.matchMedia('(min-width: 800px)').matches) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
