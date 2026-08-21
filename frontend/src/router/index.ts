import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useIconStyleStore } from '../stores/iconStyle';
// Statisch (nicht dynamisch wie die übrigen Routen) importiert: App.vue bindet dieselbe Komponente
// bereits statisch für die Desktop-Kalender-Schublade ein – ein zusätzlicher dynamischer Import
// hier würde sie nur unnötig erneut anfordern (Vite kann sie ohnehin nicht in einen separaten Chunk
// auslagern, da sie schon Teil des Hauptbundles ist).
import ScheduleView from '../views/ScheduleView.vue';

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
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue') },
    // Packliste/Einkauf/ToDo sind zu einer Tab-Ansicht zusammengefasst (siehe ListenView.vue) - die
    // alten Routen bleiben als Redirects erhalten, damit Lesezeichen/Push-Payloads/Querverweise auf
    // sie nicht ins Leere laufen.
    { path: '/listen', name: 'listen', component: () => import('../views/ListenView.vue') },
    { path: '/packing', redirect: '/listen?tab=packing' },
    { path: '/shopping', redirect: '/listen?tab=shopping' },
    { path: '/todo', redirect: '/listen?tab=todo' },
    { path: '/excursions', name: 'excursions', component: () => import('../views/ExcursionsView.vue') },
    // Kalender ist auf Desktop weiterhin eine globale Schublade (App.vue, über die seitliche Lasche
    // erreichbar) – dieselbe Komponente dient hier zusätzlich als eigenständige Mobil-Seite
    // (NavBar.vue verlinkt nur dorthin, auf Desktop bleibt dieser Nav-Punkt ausgeblendet). Kein
    // separates Wrapper-/Duplikat-Component nötig: ScheduleView.vue ist bereits eine eigenständige,
    // in sich responsive (Container-Queries) Komponente ohne Abhängigkeit von der umgebenden
    // Drawer-Chrome. Touren haben seit ihrer Verschmelzung in die Spots-Sicht (/excursions) keine
    // eigene Route mehr.
    { path: '/calendar', name: 'calendar', component: ScheduleView, props: { standalone: true } },
    // Reise (früher eigene Route+View) lebt seit #176 als Touren mit gesetzter role in
    // ExcursionsView.vue's "Touren"-Gruppierung (#196: die zwischenzeitliche eigene
    // "Reise"-Gruppierung aus #175 entfiel wieder, da redundant) - Redirect statt Entfernen, damit
    // alte Lesezeichen/Push-Benachrichtigungs-Links weiterhin funktionieren. ExcursionsView.vue's
    // onMounted() bildet ?group=travel weiterhin auf die Touren-Gruppierung ab.
    { path: '/travel', redirect: '/excursions?group=tours' },
    { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
    { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
    { path: '/diary', name: 'diary', component: () => import('../views/DiaryView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: '/trash', name: 'trash', component: () => import('../views/TrashView.vue') },
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

  // Einmalig nach bestätigter Session laden (load() ist intern gegen Mehrfachaufrufe abgesichert)
  // - Icons rendern app-weit (AppIcon.vue), nicht erst nach einem Besuch der Profil-Ansicht wie bei
  // den Push-Präferenzen.
  if (auth.user) {
    useIconStyleStore().load();
  }

  if (to.name !== 'login' && !auth.user) {
    return { name: 'login' };
  }

  if (to.name === 'login' && auth.user) {
    return { name: 'dashboard' };
  }

  // Auf Desktop ist der Kalender bereits als globale Schublade gemountet (App.vue) – ein direkter
  // Aufruf dieser Mobil-Seiten-Route (z. B. per eingetippter URL, kein Nav-Link dorthin auf
  // Desktop) würde dieselbe Komponente sonst ein zweites Mal unabhängig mounten (doppelte
  // API-Aufrufe, zwei auseinanderlaufende lokale Zustände).
  if (to.name === 'calendar' && window.matchMedia('(min-width: 800px)').matches) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
