<script setup lang="ts">
import { ref } from 'vue';
import { usePwaInstallStore } from '../stores/pwaInstall';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import PwaInstallDialog from './PwaInstallDialog.vue';

// Läuft die App schon im Standalone-Modus (auf dem Homescreen/im eigenen Fenster) oder wurde der
// Hinweis bereits weggeklickt (siehe stores/pwaInstall.ts, Persistenz per localStorage), bleibt er
// dauerhaft ausgeblendet - kein erneutes Anzeigen bei jedem Besuch.
const install = usePwaInstallStore();
const showDialog = ref(false);
</script>

<template>
  <span v-if="!install.isStandalone && !install.dismissed" class="pwa-pill install">
    <button type="button" class="pwa-pill-trigger" @click="showDialog = true">
      <AppIcon :icon="ACTION_ICONS.installApp" :size="14" group="actions" /> Als App installierbar
    </button>
    <button type="button" class="pwa-pill-dismiss-btn" aria-label="Hinweis schließen" @click="install.dismiss()">
      <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" />
    </button>
  </span>
  <PwaInstallDialog v-model="showDialog" />
</template>

<style scoped>
/* Gleiche Grundform wie OfflineIndicator.vue's .offline-pill/PwaUpdatePrompt.vue's .pwa-pill (Klasse
   .pwa-pill bewusst identisch benannt, damit AppHeader.vue's ":has(.offline-pill, .pwa-pill)"-Selektor
   die Statuszeile auch für diesen Hinweis reserviert, ohne dort etwas anpassen zu müssen). Eigene
   Farbe (--color-primary statt --color-success/-accent): weder "gute Nachricht" (Update/Offline-
   bereit) noch Warnung, sondern ein neutraler Hinweis/Vorschlag. */
.pwa-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

.pwa-pill-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.pwa-pill-dismiss-btn {
  background: rgba(255, 255, 255, 0.25);
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
  line-height: 1.4;
}

.pwa-pill-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
