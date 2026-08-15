<script setup lang="ts">
import { useConnectivityStore } from '../stores/connectivity';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Zeigt an, dass die App gerade offline arbeitet (Änderungen werden nur lokal in der Outbox
// gesammelt, siehe api/offline.ts) bzw. gerade dabei ist, diese nach einer Wiederverbindung
// nachzusenden (stores/connectivity.ts).
const connectivity = useConnectivityStore();
</script>

<template>
  <button
    v-if="!connectivity.isOnline"
    type="button"
    class="offline-pill offline-pill-btn"
    :disabled="connectivity.checking"
    title="Änderungen werden nur lokal gespeichert – antippen, um sofort erneut zu versuchen"
    @click="connectivity.checkNow()"
  >
    <AppIcon :icon="connectivity.checking ? ACTION_ICONS.refresh : ACTION_ICONS.offline" :size="14" group="actions" />
    {{ connectivity.checking ? 'Prüfe…' : 'Offline' }}
  </button>
  <span v-else-if="connectivity.syncing" class="offline-pill syncing" title="Änderungen werden synchronisiert">
    <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Synchronisiert…
  </span>
  <span
    v-else-if="connectivity.pendingCount > 0"
    class="offline-pill"
    :title="`${connectivity.pendingCount} Änderung(en) warten auf Synchronisierung`"
  >
    <AppIcon :icon="ACTION_ICONS.pending" :size="14" group="actions" /> {{ connectivity.pendingCount }}
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
  /* Orange statt Rot: "offline"/"wartet noch auf Sync" ist ein Hinweis, kein Fehler — die App
     funktioniert in diesem Zustand bewusst weiter (siehe api/offline.ts). Rot bleibt echten
     Fehlern vorbehalten. */
  background: var(--color-accent);
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Die Offline-Pille ist die einzige der drei Varianten, die als <button> statt <span> gerendert wird
   (siehe Template) - Browser-Standardstile fürs <button>-Element zurücksetzen, damit sie optisch
   nicht von den beiden span-Varianten abweicht, aber trotzdem klickbar/fokussierbar bleibt. */
.offline-pill-btn {
  border: none;
  font: inherit;
  cursor: pointer;
}

.offline-pill-btn:disabled {
  cursor: default;
  opacity: 0.85;
}

/* Aktiv laufender Sync statt eines wartenden Zustands: eigene Farbe, damit "gerade am
   Synchronisieren" optisch von "offline"/"wartet noch" unterscheidbar bleibt, obwohl beide
   dieselbe .offline-pill-Basis nutzen. --color-primary statt --color-accent-secondary (dessen
   heller Dark-Mode-Ton #8b98f0 mit weißer Schrift zu wenig Kontrast hätte) — dieselbe
   Farbe/Kombination, die PwaUpdatePrompt.vue vorher schon für seine Pill genutzt hat. */
.offline-pill.syncing {
  background: var(--color-primary);
}
</style>
