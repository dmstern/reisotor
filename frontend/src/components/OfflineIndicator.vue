<script setup lang="ts">
import { useConnectivityStore } from '../stores/connectivity';

// Zeigt an, dass die App gerade offline arbeitet (Änderungen werden nur lokal in der Outbox
// gesammelt, siehe api/offline.ts) bzw. gerade dabei ist, diese nach einer Wiederverbindung
// nachzusenden (stores/connectivity.ts).
const connectivity = useConnectivityStore();
</script>

<template>
  <span v-if="!connectivity.isOnline" class="offline-pill" title="Änderungen werden nur lokal gespeichert">
    📴 Offline
  </span>
  <span v-else-if="connectivity.syncing" class="offline-pill syncing" title="Änderungen werden synchronisiert">
    🔄 Synchronisiert…
  </span>
  <span
    v-else-if="connectivity.pendingCount > 0"
    class="offline-pill"
    :title="`${connectivity.pendingCount} Änderung(en) warten auf Synchronisierung`"
  >
    ⏳ {{ connectivity.pendingCount }}
  </span>
</template>

<style scoped>
.offline-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-danger);
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

.offline-pill.syncing {
  background: var(--color-accent);
}
</style>
