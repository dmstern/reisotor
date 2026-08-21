<script setup lang="ts">
import { useBudgetStore } from '../stores/budget';
import DeleteButton from './DeleteButton.vue';
import UndoDeleteRow from './UndoDeleteRow.vue';

defineProps<{ highlightedIds: Set<number> }>();

const store = useBudgetStore();
</script>

<template>
  <TransitionGroup tag="ul" name="list" class="list">
    <template v-for="t in store.transfers" :key="t.id">
      <li v-if="store.transferUndo.isPending(t.id)" class="row">
        <UndoDeleteRow :label="`${t.amount.toFixed(2)} €`" @undo="store.restoreTransfer(t.id)" />
      </li>
      <li v-else class="row" :class="{ 'new-highlight': highlightedIds.has(t.id) }">
        <div class="row-main">
          <span class="row-title">
            {{ store.userAvatar(t.from_user_id) }} {{ store.userName(t.from_user_id) }}
            →
            {{ store.userAvatar(t.to_user_id) }} {{ store.userName(t.to_user_id) }}
          </span>
          <span v-if="t.date || t.note" class="row-meta">
            <span v-if="t.date" class="tag">{{ t.date }}</span>
            <span v-if="t.note" class="note">{{ t.note }}</span>
          </span>
        </div>
        <strong class="row-amount">{{ t.amount.toFixed(2) }} €</strong>
        <div class="row-actions">
          <DeleteButton small @click="store.removeTransfer(t.id)" />
        </div>
      </li>
    </template>
    <li v-if="!store.transfers.length" key="empty" class="empty">Noch keine Überweisungen eingetragen.</li>
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
