<script setup lang="ts">
import { useBudgetStore } from '../stores/budget';
import DeleteButton from './DeleteButton.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useToast } from '../composables/useToast';

defineProps<{ highlightedIds: Set<number> }>();

const store = useBudgetStore();
const { showToast } = useToast();

async function removeTransfer(id: number) {
  await store.removeTransfer(id);
  showToast({
    message: 'Überweisung gelöscht. Sie befindet sich nun im Papierkorb.',
    type: 'info',
  });
}
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
        <DeleteButton small @click="removeTransfer(t.id)" />
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

.row.new-highlight {
  --new-highlight-radius: var(--radius-sm-squircle);
  position: relative;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
}

.row.new-highlight::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
  box-shadow:
    inset 0 0 0 2px var(--color-success),
    0 4px 16px -2px color-mix(in srgb, var(--color-success) 32%, transparent),
    0 2px 6px -1px color-mix(in srgb, var(--color-success) 20%, transparent);
  animation: rowNewHighlightPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Glanz-Animation für LiveSync-Updates, die sanft und dezent von links nach rechts drüberwischt */
.row.new-highlight::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    110deg,
    transparent 38%,
    color-mix(in srgb, var(--color-success) 10%, rgba(255, 255, 255, 0.08)) 48%,
    color-mix(in srgb, var(--color-success) 18%, rgba(255, 255, 255, 0.16)) 50%,
    color-mix(in srgb, var(--color-success) 10%, rgba(255, 255, 255, 0.08)) 52%,
    transparent 62%
  );
  background-size: 260% 100%;
  background-repeat: no-repeat;
  animation: rowGlanceSweep 4.5s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

@keyframes rowGlanceSweep {
  0% {
    background-position: 130% 0;
  }
  28% {
    background-position: -30% 0;
  }
  100% {
    background-position: -30% 0;
  }
}

/* Sparkle-Badge für LiveSync-Updates in Überweisungszeilen */
.row-sparkle-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
  border: 1px solid var(--color-success);
  color: var(--color-success);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-success) 30%, transparent);
  flex-shrink: 0;
  margin-left: var(--space-1);
  margin-right: var(--space-1);
  align-self: center;
  pointer-events: none;
  z-index: 3;
  animation: sparkleTwinkle 3.4s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

@keyframes sparkleTwinkle {
  0% {
    transform: scale(1) rotate(0deg);
  }
  15% {
    transform: scale(1.18) rotate(14deg);
  }
  30% {
    transform: scale(1) rotate(0deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes rowNewHighlightPulse {
  0% {
    box-shadow:
      inset 0 0 0 0px var(--color-success),
      0 0 0 0 transparent;
  }
  50% {
    box-shadow:
      inset 0 0 0 3.5px var(--color-success),
      0 0 20px 3px color-mix(in srgb, var(--color-success) 45%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px var(--color-success),
      0 4px 16px -2px color-mix(in srgb, var(--color-success) 32%, transparent),
      0 2px 6px -1px color-mix(in srgb, var(--color-success) 20%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .row.new-highlight::after,
  .row.new-highlight::before,
  .row-sparkle-indicator {
    animation: none;
  }
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
