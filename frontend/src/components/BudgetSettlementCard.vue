<script setup lang="ts">
import type { SettlementSuggestion } from '../utils/budgetBalances';
import { useBudgetStore } from '../stores/budget';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineEmits<{ (e: 'use-suggestion', suggestion: SettlementSuggestion): void }>();

const store = useBudgetStore();
</script>

<template>
  <Card>
    <h2>Wer schuldet wem?</h2>

    <p v-if="!store.settlementSuggestions.length" class="settled">
      <AppIcon :icon="ACTION_ICONS.done" :size="15" group="actions" /> Ausgeglichen – niemand schuldet aktuell etwas.
    </p>

    <ul v-else class="suggestion-list">
      <li v-for="(s, i) in store.settlementSuggestions" :key="i" class="suggestion-row">
        <span class="suggestion-text">
          {{ store.userAvatar(s.from.id) }} <strong>{{ s.from.username }}</strong>
          schuldet {{ store.userAvatar(s.to.id) }} <strong>{{ s.to.username }}</strong> noch
          <strong class="debt-amount">{{ s.amount.toFixed(2) }} €</strong>
        </span>
        <button class="secondary settle-btn" @click="$emit('use-suggestion', s)">Als Überweisung eintragen</button>
      </li>
    </ul>

    <ul class="balance-list">
      <li v-for="b in store.balances" :key="b.user.id">
        <span>{{ b.user.avatar }} {{ b.user.username }}</span>
        <span :class="b.net >= 0 ? 'positive' : 'negative'">
          {{ b.net >= 0 ? 'bekommt' : 'schuldet' }} {{ Math.abs(b.net).toFixed(2) }} €
        </span>
      </li>
    </ul>
    <p class="hint">
      Berechnung: Nur Ausgaben aus geteilten Budgets werden zu gleichen Teilen unter allen Nutzer:innen
      aufgeteilt (private Budgets zählen nicht mit); Überweisungen gleichen das direkt aus.
    </p>
  </Card>
</template>

<style scoped>
h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.settled {
  color: var(--color-success);
  font-weight: 600;
}

.suggestion-list {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.suggestion-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-hover);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.suggestion-text {
  font-size: 0.9rem;
  min-width: 0;
}

.debt-amount {
  color: var(--color-accent);
}

.settle-btn {
  flex-shrink: 0;
  font-size: 0.82rem;
}

.balance-list {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  padding: 4px 0;
}

.positive {
  color: var(--color-success);
  font-weight: 600;
}

.negative {
  color: var(--color-danger);
  font-weight: 600;
}

.hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-2) 0 0;
}
</style>
