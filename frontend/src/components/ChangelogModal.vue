<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import ChangelogContent from './ChangelogContent.vue';
import { usePwaUpdateStore } from '../stores/pwaUpdate';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useAuthStore } from '../stores/auth';

const pwaUpdate = usePwaUpdateStore();
const buildInfoStore = useBuildInfoStore();
const auth = useAuthStore();
const router = useRouter();

const isOpen = computed(() => Boolean(auth.user && pwaUpdate.showChangelogDialog));

const title = computed(() => `Was ist neu in v${pwaUpdate.currentVersion}? 🎉`);

watch(
  () => isOpen.value,
  (open) => {
    if (open && !buildInfoStore.buildInfo) {
      buildInfoStore.load();
    }
  },
  { immediate: true }
);

const loading = computed(() => isOpen.value && !buildInfoStore.buildInfo);

const groups = computed(() => {
  return buildInfoStore.buildInfo?.changelog?.groups ?? [];
});

const notes = computed(() => {
  const rawNotes = buildInfoStore.buildInfo?.changelog?.notes ?? [];
  return rawNotes.map((n) => (n.startsWith('- ') ? n.slice(2).trim() : n.trim())).filter(Boolean);
});

const hasNotes = computed(() => groups.value.length > 0 || notes.value.length > 0);

function onClose() {
  pwaUpdate.dismissChangelogDialog();
}

function goToSettings() {
  pwaUpdate.dismissChangelogDialog();
  router.push({ path: '/settings', query: { tab: 'notifications' } });
}
</script>

<template>
  <Modal :model-value="isOpen" :title="title" size="md" @update:model-value="onClose">
    <div class="changelog-modal">
      <div v-if="loading" class="loading-state">
        <LoadingSpinner size="md" />
        <p class="loading-text">Lade Versionshinweise…</p>
      </div>

      <div v-else-if="hasNotes" class="notes-container">
        <h3 class="changelog-intro">Das ist neu in dieser Version:</h3>
        <div class="changelog-scroll-area">
          <ChangelogContent :groups="groups" :notes="notes" />
        </div>
      </div>

      <div v-else class="empty-state">
        <p class="changelog-intro">
          Reisotor wurde erfolgreich auf Version v{{ pwaUpdate.currentVersion }} aktualisiert.
        </p>
      </div>

      <div class="changelog-actions">
        <Button variant="primary" class="action-btn" @click="onClose"> Alles klar </Button>
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
.changelog-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4) 0;
  gap: var(--space-2);
}

.loading-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
}

.notes-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.changelog-intro {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0;
}

.changelog-scroll-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 48vh;
  overflow-y: auto;
  padding-right: var(--space-1);
}

.empty-state {
  padding: var(--space-2) 0;
}

.changelog-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-top: var(--space-2);
}

.action-btn {
  min-width: 120px;
  justify-content: center;
}

.settings-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-1) 0 0;
  text-align: center;
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
