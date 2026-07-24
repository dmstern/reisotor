<script setup lang="ts">
import type { BudgetItem } from '../api/types';

defineProps<{ items: BudgetItem[] }>();
const emit = defineEmits<{
  (e: 'toggle-paid', item: BudgetItem): void;
  (e: 'remove', id: number): void;
}>();
</script>

<template>
  <table class="budget-table">
    <thead>
      <tr>
        <th>Titel</th>
        <th>Kategorie</th>
        <th>Betrag</th>
        <th>Bezahlt von</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id">
        <td>{{ item.title }}</td>
        <td>{{ item.category || '–' }}</td>
        <td>{{ item.amount.toFixed(2) }} €</td>
        <td>{{ item.paid_by || '–' }}</td>
        <td>
          <button class="secondary status" @click="emit('toggle-paid', item)">
            {{ item.is_paid ? 'Bezahlt ✓' : 'Offen' }}
          </button>
        </td>
        <td>
          <button class="secondary" @click="emit('remove', item.id)">✕</button>
        </td>
      </tr>
      <tr v-if="!items.length">
        <td colspan="6" class="empty">Noch keine Kostenpositionen.</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.budget-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

th {
  color: var(--color-text-muted);
  font-weight: 600;
}

.status {
  font-size: 0.8rem;
  padding: 4px 10px;
}

.empty {
  color: var(--color-text-muted);
  text-align: center;
}
</style>
