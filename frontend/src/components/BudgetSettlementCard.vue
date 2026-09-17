<script setup lang="ts">
import Button from './primitives/Button.vue';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import { useBudgetStore } from '../stores/budget';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineEmits<{ (e: 'use-suggestion', suggestion: SettlementSuggestion): void }>();

const store = useBudgetStore();
</script>

<template>
  <Card class="settlement-card">
    <h2>Wer schuldet wem?</h2>

    <div v-if="!store.settlementSuggestions.length" class="settled-banner">
      <span class="settled-icon-wrap" aria-hidden="true">
        <AppIcon :icon="ACTION_ICONS.done" :size="16" group="actions" />
      </span>
      <span class="settled-text">Ausgeglichen – niemand schuldet aktuell etwas.</span>
    </div>

    <ul v-else class="suggestion-list">
      <li v-for="(s, i) in store.settlementSuggestions" :key="i" class="suggestion-row">
        <span class="suggestion-text">
          {{ store.userAvatar(s.from.id) }} <strong>{{ s.from.username }}</strong> schuldet
          {{ store.userAvatar(s.to.id) }} <strong>{{ s.to.username }}</strong> noch
          <strong class="debt-amount">{{ s.amount.toFixed(2) }} €</strong>
        </span>
        <Button
          variant="secondary"
          size="sm"
          class="settle-btn"
          @click="$emit('use-suggestion', s)"
        >
          Als Überweisung eintragen
        </Button>
      </li>
    </ul>

    <ul class="balance-list">
      <li v-for="b in store.balances" :key="b.user.id" class="balance-row">
        <span class="balance-user">{{ b.user.avatar }} {{ b.user.username }}</span>
        <Badge :variant="b.net >= 0 ? 'success' : 'danger'">
          {{ b.net >= 0 ? 'bekommt' : 'schuldet' }} {{ Math.abs(b.net).toFixed(2) }} €
        </Badge>
      </li>
    </ul>
    <p class="hint">
      Berechnung: Nur Ausgaben aus geteilten Budgets werden zu gleichen Teilen unter allen
      Nutzer:innen aufgeteilt (private Budgets zählen nicht mit); Überweisungen gleichen das direkt
      aus.
    </p>
  </Card>
</template>

<style scoped>
.settled-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-2) 0;
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-success);
  font-weight: 600;
  font-size: 0.9rem;
}

.settled-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-success) 20%, transparent);
  flex-shrink: 0;
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
  padding: var(--space-2) var(--space-3);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.suggestion-row:hover {
  transform: translateY(-1.5px);
  box-shadow: var(--shadow-sm);
  border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
}

.suggestion-text {
  font-size: 0.9rem;
  min-width: 0;
}

.debt-amount {
  color: var(--color-accent);
  font-weight: 700;
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
  gap: 6px;
}

.balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9rem;
  padding: 4px var(--space-2);
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.balance-row:hover {
  background: var(--color-hover);
}

.balance-user {
  font-weight: 500;
}

.hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-2) 0 0;
}
</style>
