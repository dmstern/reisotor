<script setup lang="ts">
// Persistenter Hinweis im backend-losen Demo-Build (Issue #172): macht klar, dass hier nichts
// wirklich gespeichert wird, und bietet einen Weg zurück zur Marketing-Landingpage.
import { resetDemoStore } from '../demo/demoClient';

// __LANDING_URL__ (vite.config.ts's define) lässt sich nicht direkt im Template referenzieren -
// vue-tsc's Template-Typprüfung löst Ambient-Globals aus einer .d.ts nicht auf, siehe env.d.ts.
const landingUrl = __LANDING_URL__;

function reset() {
  resetDemoStore();
  window.location.reload();
}
</script>

<template>
  <div class="demo-banner">
    <span>🎭 Demo-Modus — nichts wird dauerhaft gespeichert</span>
    <div class="demo-banner-actions">
      <button type="button" class="secondary" @click="reset">Demo zurücksetzen</button>
      <a :href="landingUrl" class="demo-banner-link">Zurück zur Übersicht</a>
    </div>
  </div>
</template>

<style scoped>
.demo-banner {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  font-size: 0.85rem;
  text-align: center;
  border-bottom: 1px solid var(--color-primary);
}

.demo-banner-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.demo-banner-actions button {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
}

.demo-banner-link {
  font-weight: 600;
  color: var(--color-primary-dark);
}
</style>
