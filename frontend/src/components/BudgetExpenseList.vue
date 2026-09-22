<script setup lang="ts">
import type { BudgetExpense } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useToast } from '../composables/useToast';

defineProps<{
  highlightedIds: Set<number>;
  autoSourceFor: (id: number) => { label: string; path: string } | null;
}>();
const emit = defineEmits<{ (e: 'edit', expense: BudgetExpense): void }>();

const store = useBudgetStore();
const { showToast } = useToast();

async function removeExpense(id: number) {
  await store.removeExpense(id);
  showToast({ message: 'Ausgabe gelöscht. Sie befindet sich nun im Papierkorb.', type: 'info' });
}
</script>

<template>
  <TransitionGroup tag="ul" name="list" class="list">
    <li
      v-for="e in store.expenses"
      :key="e.id"
      class="row"
      :class="{ 'new-highlight': highlightedIds.has(e.id) }"
    >
      <div class="row-main">
        <span class="row-title"
          >{{ e.title }}<span v-if="e.note" class="note"> · {{ e.note }}</span></span
        >
        <span class="row-meta">
          <Badge v-if="e.date">{{ e.date }}</Badge>
          <Badge v-if="e.category">{{ e.category }}</Badge>
          <Badge v-if="store.users.length > 1"
            >{{ store.userAvatar(e.paid_by_user_id) }}
            {{ store.userName(e.paid_by_user_id) }}</Badge
          >
        </span>
      </div>
      <strong class="row-amount">{{ e.amount.toFixed(2) }}&nbsp;€</strong>
      <!-- Sparkle-Badge für LiveSync-Updates von anderen Nutzern -->
      <span
        v-if="highlightedIds.has(e.id)"
        class="row-sparkle-indicator"
        title="Neu von Mitreisenden hinzugefügt oder geändert"
        aria-label="Neu aktualisiert"
      >
        <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
      </span>
      <div class="row-actions">
        <template v-if="autoSourceFor(e.id)">
          <Button variant="card-action" :to="autoSourceFor(e.id)!.path">
            {{ autoSourceFor(e.id)!.label }}
          </Button>
        </template>
        <template v-else>
          <EditButton small @click="emit('edit', e)" />
          <DeleteButton small @click="removeExpense(e.id)" />
        </template>
      </div>
    </li>
    <li v-if="!store.expenses.length" key="empty" class="empty">
      Noch keine Ausgaben eingetragen.
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
