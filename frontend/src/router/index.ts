import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/schedule', name: 'schedule', component: () => import('../views/ScheduleView.vue') },
    { path: '/packing', name: 'packing', component: () => import('../views/PackingListView.vue') },
    { path: '/excursions', name: 'excursions', component: () => import('../views/ExcursionsView.vue') },
    { path: '/travel', name: 'travel', component: () => import('../views/TravelView.vue') },
    {
      path: '/accommodation',
      name: 'accommodation',
      component: () => import('../views/AccommodationView.vue'),
    },
    { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
    { path: '/shopping', name: 'shopping', component: () => import('../views/ShoppingListView.vue') },
    { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
    { path: '/diary', name: 'diary', component: () => import('../views/DiaryView.vue') },
    { path: '/map', name: 'map', component: () => import('../views/MapView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
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

  return true;
});

export default router;
