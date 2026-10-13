<script setup lang="ts">
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import BudgetMeter from './BudgetMeter.vue';
import { useBudgetStore } from '../stores/budget';

const budgetStore = useBudgetStore();
</script>

<template>
  <Card class="overview-card">
    <div class="overview-header">
      <h2>Gesamt-Übersicht</h2>
      <Badge v-if="budgetStore.expenses.length">
        {{ budgetStore.expenses.length }}
        {{ budgetStore.expenses.length === 1 ? 'Ausgabe' : 'Ausgaben' }}
      </Badge>
    </div>
    <BudgetMeter
      label="Budget"
      :spent="budgetStore.totalSpent"
      :target="budgetStore.grandTotal"
      color="var(--color-primary-dark)"
    />
    <!-- BudgetMeter zeigt den Überzug-Fall (⚠️ X € über Budget) schon selbst an - hier nur den
         positiven Rest-Fall ergänzen, den BudgetMeter (auch anderswo für Packliste/Einkaufsliste/
         ToDo genutzt, siehe DashboardView.vue) bewusst nicht kennt. -->
    <p v-if="budgetStore.grandTotal > 0 && budgetStore.remaining >= 0" class="remaining-line">
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
  margin-bottom: var(--space-1);
}

.overview-header h2 {
  font-size: var(--font-size-md);
  color: var(--color-primary-dark);
  margin: 0;
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
