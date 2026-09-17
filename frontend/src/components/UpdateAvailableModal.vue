<script setup lang="ts">
import { useRouter } from 'vue-router';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { usePwaUpdateStore } from '../stores/pwaUpdate';

const pwaUpdate = usePwaUpdateStore();
const router = useRouter();

function onClose() {
  pwaUpdate.dismissUpdateDialog();
}

function updateNow() {
  pwaUpdate.reload();
}

function goToSettings() {
  pwaUpdate.dismissUpdateDialog();
  router.push({ path: '/settings', query: { tab: 'notifications' } });
}
</script>

<template>
  <Modal
    :model-value="pwaUpdate.showUpdateDialog"
    title="Neues Update verfügbar"
    size="sm"
    @update:model-value="onClose"
  >
    <div class="update-modal">
      <div class="update-icon-banner" aria-hidden="true">
        <div class="icon-circle">
          <AppIcon :icon="ACTION_ICONS.refresh" :size="28" group="actions" />
        </div>
      </div>

      <p class="update-desc">
        Eine neuere Version von Reisotor steht bereit. Aktualisiere jetzt, um die neuesten
        Funktionen und Verbesserungen zu laden.
      </p>

      <div class="update-actions">
        <Button
          variant="primary"
          :icon="ACTION_ICONS.refresh"
          class="action-btn"
          @click="updateNow"
        >
          Jetzt aktualisieren
        </Button>
        <Button variant="secondary" class="action-btn" @click="onClose"> Später </Button>
      </div>

      <p class="settings-hint">
        Hinweis: Du kannst diese Update-Popups in den
        <button type="button" class="settings-link" @click="goToSettings">Einstellungen</button>
        deaktivieren.
      </p>
    </div>
  </Modal>
</template>

<style scoped>
.update-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
}

.update-icon-banner {
  display: flex;
  justify-content: center;
  margin-top: var(--space-1);
}

.icon-circle {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary-tint);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.update-desc {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 380px;
}

.update-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
}

.action-btn {
  width: 100%;
  justify-content: center;
}

.settings-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-2) 0 0;
  line-height: 1.4;
}

.settings-link {
  color: var(--color-primary);
  text-decoration: underline;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  display: inline;
}

.settings-link:hover {
  filter: brightness(1.2);
}
</style>
