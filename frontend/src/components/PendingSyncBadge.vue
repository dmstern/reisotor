<script setup lang="ts">
// Markiert ein einzelnes Objekt als offline angelegt/bearbeitet und noch nicht mit dem Server
// synchronisiert. Bei Klick wird sofort ein Synchronisationsversuch angestoßen.
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useConnectivityStore } from '../stores/connectivity';

let connectivity: ReturnType<typeof useConnectivityStore> | null = null;
try {
  connectivity = useConnectivityStore();
} catch {
  // Graceful fallback outside active Pinia context (z. B. Storybook)
}

const isSyncing = computed(() => connectivity?.syncing ?? false);

function onClick(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  connectivity?.syncNow();
}
</script>

<template>
  <button
    type="button"
    class="pending-sync-badge"
    :class="{ 'is-syncing': isSyncing }"
    :disabled="isSyncing"
    title="Offline gespeichert – klicken, um Synchronisation jetzt anzustoßen"
    @click="onClick"
  >
    <AppIcon
      :icon="isSyncing ? ACTION_ICONS.syncPending : ACTION_ICONS.offline"
      :size="12"
      group="actions"
      :class="{ 'is-spinning': isSyncing }"
    />
    <span>{{ isSyncing ? 'synchronisiere…' : 'nur lokal gespeichert' }}</span>
  </button>
</template>

<style scoped>
.pending-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  color: #fff;
  background: var(--color-accent);
  border: 1px solid transparent;
  flex-shrink: 0;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.pending-sync-badge:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-0.5px);
}

.pending-sync-badge:active:not(:disabled) {
  transform: translateY(0);
}

.pending-sync-badge:disabled {
  cursor: default;
  opacity: 0.85;
}

.pending-sync-badge .is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
