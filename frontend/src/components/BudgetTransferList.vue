<script setup lang="ts">
import type { BudgetTransfer } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import EditButton from './EditButton.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ highlightedIds: Set<number> }>();
const emit = defineEmits<{ (e: 'edit', transfer: BudgetTransfer): void }>();

const store = useBudgetStore();
</script>

<template>
  <TransitionGroup tag="ul" name="list" class="list">
    <li
      v-for="t in store.transfers"
      :key="t.id"
      class="row"
      :class="{ 'new-highlight': highlightedIds.has(t.id) }"
    >
      <div class="row-main">
        <span class="row-title">
          {{ store.userAvatar(t.from_user_id) }} {{ store.userName(t.from_user_id) }}
          →
          {{ store.userAvatar(t.to_user_id) }} {{ store.userName(t.to_user_id) }}
        </span>
        <span v-if="t.date || t.note" class="row-meta">
          <Badge v-if="t.date">{{ t.date }}</Badge>
          <span v-if="t.note" class="note">{{ t.note }}</span>
        </span>
      </div>
      <strong class="row-amount">{{ t.amount.toFixed(2) }}&nbsp;€</strong>
      <!-- Sparkle-Badge für LiveSync-Updates von anderen Nutzern -->
      <span
        v-if="highlightedIds.has(t.id)"
        class="row-sparkle-indicator"
        title="Neu von Mitreisenden hinzugefügt oder geändert"
        aria-label="Neu aktualisiert"
      >
        <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
      </span>
      <div class="row-actions">
        <EditButton
          small
          :icon="ACTION_ICONS.cashEdit"
          aria-label="Überweisung bearbeiten"
          @click="emit('edit', t)"
        />
      </div>
    </li>
    <li v-if="!store.transfers.length" key="empty" class="empty">
      Noch keine Überweisungen eingetragen.
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
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.note {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.row-amount {
  flex-shrink: 0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.empty {
  padding: var(--space-2) 0;
  text-align: center;
}
</style>
