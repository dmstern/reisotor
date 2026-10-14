<script setup lang="ts">
import { computed } from 'vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import BudgetMeter from './BudgetMeter.vue';
import { useBudgetStore } from '../stores/budget';
import { ACTION_ICONS } from '../utils/actionIcons';

const budgetStore = useBudgetStore();

const expenseCount = computed(() => budgetStore.expenses.filter((e) => e.amount >= 0).length);
const incomeCount = computed(() => budgetStore.expenses.filter((e) => e.amount < 0).length);
</script>

<template>
  <Card class="overview-card">
    <div class="overview-header">
      <h2>Gesamt-Übersicht</h2>
      <div v-if="expenseCount > 0 || incomeCount > 0" class="overview-badges">
        <Badge v-if="expenseCount > 0">
          {{ expenseCount }} {{ expenseCount === 1 ? 'Ausgabe' : 'Ausgaben' }}
        </Badge>
        <Badge v-if="incomeCount > 0" variant="success">
          {{ incomeCount }} {{ incomeCount === 1 ? 'Einnahme' : 'Einnahmen' }}
        </Badge>
      </div>
    </div>
    <BudgetMeter
      label="Budget"
      :icon="ACTION_ICONS.moneybag"
      :spent="budgetStore.totalSpent"
      :target="budgetStore.grandTotal"
      :prominent="true"
    />
    <!-- BudgetMeter zeigt den Überzug-Fall (⚠️ X € über Budget) schon selbst an - hier nur den
         positiven Rest-Fall ergänzen, den BudgetMeter (auch anderswo für Packliste/Einkaufsliste/
         ToDo genutzt, siehe DashboardView.vue) bewusst nicht kennt. -->
    <p
      v-if="budgetStore.grandTotal > 0 && budgetStore.remaining >= 0"
      class="remaining-line"
      :class="{
        'is-low': budgetStore.remaining / budgetStore.grandTotal <= 0.2,
      }"
    >
      Noch übrig: <strong class="nobr">{{ budgetStore.remaining.toFixed(2) }}&nbsp;€</strong>
    </p>
  </Card>
</template>

<style scoped>
.overview-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: 0;
  animation: card-appear 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.overview-header h2 {
  font-size: var(--font-size-md);
  color: var(--color-primary-dark);
  margin: 0;
}

.overview-badges {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.overview-card :deep(.meter-head) {
  font-size: var(--font-size-md);
}

.overview-card :deep(.track) {
  height: 14px;
}

.remaining-line {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-success);
}

.remaining-line.is-low {
  color: var(--color-warning);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overview-card {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
</style>
