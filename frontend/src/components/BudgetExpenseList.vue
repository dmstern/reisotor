<script setup lang="ts">
import type { BudgetExpense } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import UndoDeleteRow from './UndoDeleteRow.vue';

defineProps<{
  highlightedIds: Set<number>;
  autoSourceFor: (id: number) => { label: string; path: string } | null;
}>();
const emit = defineEmits<{ (e: 'edit', expense: BudgetExpense): void }>();

const store = useBudgetStore();
</script>

<template>
  <TransitionGroup tag="ul" name="list" class="list">
    <template v-for="e in store.expenses" :key="e.id">
      <li v-if="store.expenseUndo.isPending(e.id)" class="row">
        <UndoDeleteRow :label="e.title" @undo="store.restoreExpense(e.id)" />
      </li>
      <li v-else class="row" :class="{ 'new-highlight': highlightedIds.has(e.id) }">
        <div class="row-main">
          <span class="row-title"
            >{{ e.title }}<span v-if="e.note" class="note"> · {{ e.note }}</span></span
          >
          <span class="row-meta">
            <span v-if="e.date" class="tag">{{ e.date }}</span>
            <span v-if="e.category" class="tag">{{ e.category }}</span>
            <span v-if="store.users.length > 1" class="tag"
              >{{ store.userAvatar(e.paid_by_user_id) }}
              {{ store.userName(e.paid_by_user_id) }}</span
            >
          </span>
        </div>
        <strong class="row-amount">{{ e.amount.toFixed(2) }} €</strong>
        <div class="row-actions">
          <template v-if="autoSourceFor(e.id)">
            <router-link :to="autoSourceFor(e.id)!.path" class="card-action-btn">
              {{ autoSourceFor(e.id)!.label }}
            </router-link>
          </template>
          <template v-else>
            <EditButton small @click="emit('edit', e)" />
            <DeleteButton small @click="store.removeExpense(e.id)" />
          </template>
        </div>
      </li>
    </template>
    <li v-if="!store.expenses.length" key="empty" class="empty">
      Noch keine Bezahlungen eingetragen.
    </li>
  </TransitionGroup>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

/* .row selbst hat (anders als .card) keinen border-radius - die globale .new-highlight-Regel
   (style.css, --new-highlight-radius) würde hier sonst mit ihrem für Karten gedachten Radius
   overrulen bzw. eckig wirken. Kleinerer, zur schmalen Listen-Zeile passender Wert. */
.row.new-highlight {
  --new-highlight-radius: var(--radius-sm-squircle);
}

.row:last-child {
  border-bottom: none;
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 140px;
}

.row-title {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.tag {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  background: var(--color-hover);
  border-radius: 999px;
  padding: 2px 8px;
}

.note {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.row-amount {
  flex-shrink: 0;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.empty {
  padding: var(--space-2) 0;
  text-align: center;
}
</style>
