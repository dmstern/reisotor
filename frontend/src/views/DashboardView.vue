<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type {
  BudgetExpense,
  BudgetTarget,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  User,
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';

const auth = useAuthStore();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);
const schedule = ref<ScheduleItem[]>([]);
const packing = ref<PackingItem[]>([]);
const expenses = ref<BudgetExpense[]>([]);
const targets = ref<BudgetTarget[]>([]);
const shopping = ref<ShoppingItem[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [scheduleRes, packingRes, expensesRes, targetsRes, shoppingRes, usersRes] = await Promise.all([
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
    api.get<BudgetExpense[]>(`/budget?trip_id=${tripId}`),
    api.get<BudgetTarget[]>(`/budget/targets?trip_id=${tripId}`),
    api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
    api.get<User[]>('/users'),
  ]);
  schedule.value = scheduleRes;
  packing.value = packingRes;
  expenses.value = expensesRes;
  targets.value = targetsRes;
  shopping.value = shoppingRes;
  users.value = usersRes;
  loading.value = false;
});

const daysUntilStart = computed(() => {
  if (!trip.value?.start_date) return null;
  const start = new Date(trip.value.start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
});

const nextItem = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10);
  return schedule.value
    .filter((s) => s.date >= todayStr)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))[0];
});

function progressOf(listItems: PackingItem[]) {
  const total = listItems.length;
  const checked = listItems.filter((p) => p.checked).length;
  return { total, checked };
}

const packingLists = computed(() => {
  const shared = {
    key: 'shared',
    title: 'Gemeinsam',
    ...progressOf(packing.value.filter((p) => p.owner_id == null)),
  };
  const perUser = users.value.map((u) => ({
    key: `user-${u.id}`,
    title: u.id === auth.user?.id ? `Meine Liste ${u.avatar}` : `${u.username} ${u.avatar}`,
    ...progressOf(packing.value.filter((p) => p.owner_id === u.id)),
  }));
  return [...perUser, shared];
});

const budgetSummary = computed(() => {
  const target = targets.value.find((t) => t.owner_id === null)?.amount ?? 0;
  const spent = expenses.value.reduce((sum, e) => sum + e.amount, 0);
  return { target, spent, rest: target - spent };
});

const shoppingProgress = computed(() => {
  const total = shopping.value.length;
  const checked = shopping.value.filter((s) => s.checked).length;
  return { total, checked };
});

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
  <div class="page" v-if="!loading">
    <header class="hero card">
      <h1>{{ trip?.name || 'Eure Reise' }}</h1>
      <p v-if="trip?.destination">📍 {{ trip.destination }}</p>
      <p v-if="trip">{{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}</p>
      <p v-if="daysUntilStart !== null && daysUntilStart >= 0" class="countdown">
        Noch {{ daysUntilStart }} {{ daysUntilStart === 1 ? 'Tag' : 'Tage' }} bis zur Abreise 🎒
      </p>
      <p v-else-if="daysUntilStart !== null" class="countdown">Gute Reise! ✈️</p>
    </header>

    <div class="grid cards">
      <router-link to="/schedule" class="card tile">
        <span class="tile-icon">📅</span>
        <h3>Nächster Programmpunkt</h3>
        <p v-if="nextItem">{{ formatDate(nextItem.date) }}<span v-if="nextItem.time"> · {{ nextItem.time }}</span> — {{ nextItem.title }}</p>
        <p v-else>Noch nichts geplant</p>
      </router-link>

      <router-link to="/packing" class="card tile" v-for="list in packingLists" :key="list.key">
        <span class="tile-icon">🧳</span>
        <h3>Packliste: {{ list.title }}</h3>
        <p>{{ list.checked }}/{{ list.total }} gepackt</p>
      </router-link>

      <router-link to="/budget" class="card tile">
        <span class="tile-icon">💶</span>
        <h3>Budget</h3>
        <p>{{ budgetSummary.spent.toFixed(2) }} € ausgegeben von {{ budgetSummary.target.toFixed(2) }} €</p>
        <p>Rest: {{ budgetSummary.rest.toFixed(2) }} €</p>
      </router-link>

      <router-link to="/shopping" class="card tile">
        <span class="tile-icon">🛒</span>
        <h3>Einkaufsliste</h3>
        <p>{{ shoppingProgress.checked }}/{{ shoppingProgress.total }} gekauft</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.hero {
  margin-bottom: var(--space-4);
  background: linear-gradient(135deg, #eaf3f1, var(--color-surface));
}

.hero h1 {
  color: var(--color-primary-dark);
}

.countdown {
  color: var(--color-accent);
  font-weight: 600;
}

.cards {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding-top: 22px;
}

.tile {
  position: relative;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.tile-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.tile h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
  margin-top: var(--space-2);
  text-align: center;
}

.tile p {
  text-align: center;
}
</style>
