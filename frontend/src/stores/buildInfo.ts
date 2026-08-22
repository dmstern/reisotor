import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client';
import type { BuildInfo } from '../api/types';

/** Backend-Build-Info (GET /build-info, nur eingeloggt erreichbar) einmalig laden und cachen –
 *  gebraucht u. a. von AppHeader.vue für den environment-Wert (Issue #219: Umgebung zur Laufzeit
 *  vom Backend statt per Domain-Vergleich erkennen). */
export const useBuildInfoStore = defineStore('buildInfo', () => {
  const buildInfo = ref<BuildInfo | null>(null);
  let loadPromise: Promise<void> | null = null;

  function load() {
    if (!loadPromise) {
      loadPromise = api.get<BuildInfo>('/build-info').then((info) => {
        buildInfo.value = info;
      });
    }
    return loadPromise;
  }

  return { buildInfo, load };
});
