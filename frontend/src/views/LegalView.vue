<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type { LegalConfig } from '../api/types';
import { DEFAULT_LEGAL_CONFIG } from '../api/types';
import { useAuthStore } from '../stores/auth';
import LegalContent from '../components/legal/LegalContent.vue';
import ThemeModeSelect from '../components/ThemeModeSelect.vue';
import Button from '../components/primitives/Button.vue';
import { IconArrowLeft } from '@tabler/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const config = ref<LegalConfig>(DEFAULT_LEGAL_CONFIG);
const loading = ref(true);

const initialTab = computed<'privacy' | 'imprint'>(() => {
  if (
    route.name === 'imprint' ||
    route.path.includes('imprint') ||
    route.path.includes('impressum')
  ) {
    return 'imprint';
  }
  return 'privacy';
});

const activeTab = ref<'privacy' | 'imprint'>(initialTab.value);

watch(
  () => route.path,
  () => {
    activeTab.value = initialTab.value;
  }
);

onMounted(async () => {
  try {
    const data = await api.get<LegalConfig>('/legal');
    config.value = data;
  } catch {
    config.value = DEFAULT_LEGAL_CONFIG;
  } finally {
    loading.value = false;
  }
});

function onTabChange(tab: 'privacy' | 'imprint') {
  activeTab.value = tab;
  router.replace({ name: tab });
}

function goBack() {
  if (typeof window !== 'undefined' && window.history.state?.back) {
    router.back();
  } else if (auth.user) {
    router.push('/');
  } else {
    router.push('/login');
  }
}
</script>

<template>
  <div class="legal-page">
    <header class="legal-page-header">
      <Button variant="secondary" class="back-btn" @click="goBack">
        <IconArrowLeft :size="18" aria-hidden="true" />
        {{ auth.user ? 'Zurück zur App' : 'Zurück zur Anmeldung' }}
      </Button>

      <ThemeModeSelect variant="icon" class="theme-toggle" />
    </header>

    <main class="legal-page-main">
      <div class="legal-card">
        <LegalContent
          :config="config"
          :active-tab="activeTab"
          :is-landing-page="false"
          :loading="loading"
          @update:active-tab="onTabChange"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(170deg, var(--color-primary-tint), var(--color-bg) 420px);
  padding: calc(var(--space-4) + env(safe-area-inset-top, 0px))
    calc(var(--space-3) + env(safe-area-inset-right, 0px))
    calc(var(--space-6) + env(safe-area-inset-bottom, 0px))
    calc(var(--space-3) + env(safe-area-inset-left, 0px));
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  box-sizing: border-box;
}

@media (min-width: 800px) {
  .legal-page {
    padding-top: calc(var(--space-5) + env(safe-area-inset-top, 0px));
    padding-right: calc(var(--space-4) + env(safe-area-inset-right, 0px));
    padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
    padding-left: calc(var(--space-4) + env(safe-area-inset-left, 0px));
  }
}

.legal-page-header {
  max-width: 860px;
  width: 100%;
  margin: 0 auto var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  background: var(--color-surface);
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
  max-width: calc(100% - 48px);
}

.theme-toggle.icon {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.legal-page-main {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  min-width: 0;
}

.legal-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}
</style>
