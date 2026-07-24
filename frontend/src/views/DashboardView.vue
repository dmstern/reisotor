<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { BudgetItem, PackingItem, ScheduleItem, Trip } from '../api/types';

const trip = ref<Trip | null>(null);
const schedule = ref<ScheduleItem[]>([]);
const packing = ref<PackingItem[]>([]);
const budget = ref<BudgetItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [tripRes, scheduleRes, packingRes, budgetRes] = await Promise.all([
    api.get<Trip>('/trip'),
    api.get<ScheduleItem[]>('/schedule'),
    api.get<PackingItem[]>('/packing'),
    api.get<BudgetItem[]>('/budget'),
  ]);
  trip.value = tripRes;
  schedule.value = scheduleRes;
  packing.value = packingRes;
  budget.value = budgetRes;
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

const packingProgress = computed(() => {
  const total = packing.value.length;
  const checked = packing.value.filter((p) => p.checked).length;
  return { total, checked };
});

const budgetSummary = computed(() => {
  const total = budget.value.reduce((sum, b) => sum + b.amount, 0);
  const paid = budget.value.filter((b) => b.is_paid).reduce((sum, b) => sum + b.amount, 0);
  return { total, paid, rest: total - paid };
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
        <h3>Nächster Programmpunkt</h3>
        <p v-if="nextItem">{{ formatDate(nextItem.date) }}<span v-if="nextItem.time"> · {{ nextItem.time }}</span> — {{ nextItem.title }}</p>
        <p v-else>Noch nichts geplant</p>
      </router-link>

      <router-link to="/packing" class="card tile">
        <h3>Packliste</h3>
        <p>{{ packingProgress.checked }}/{{ packingProgress.total }} gepackt</p>
      </router-link>

      <router-link to="/budget" class="card tile">
        <h3>Budget</h3>
        <p>{{ budgetSummary.paid.toFixed(2) }} € bezahlt von {{ budgetSummary.total.toFixed(2) }} €</p>
        <p>Rest: {{ budgetSummary.rest.toFixed(2) }} €</p>
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
}

.tile {
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.tile h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
}
</style>
