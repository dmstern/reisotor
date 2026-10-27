<script setup lang="ts">
import { computed } from 'vue';

// Gemeinsame Copyright-/GitHub-Link-Zeile für Login-Seite (vor dem Login, daher ohne
// backendseitige Build-Info) und den Über-Tab (nach dem Login, mit Build-Info vom Backend) -
// siehe Issue #172. repoUrl/hostingLocation kommen bei Bedarf von GET /build-info (nur
// eingeloggt erreichbar, protectedApi in backend/src/app.ts); ohne sie greifen die zur
// Build-Zeit eingebackenen Konstanten __REPO_URL__/__LANDING_URL__.
const props = defineProps<{
  repoUrl?: string;
  hostingLocation?: string;
  landingUrl?: string;
}>();

const copyrightYear = new Date().getFullYear();
const resolvedRepoUrl = computed(() => (props.repoUrl ?? __REPO_URL__).replace(/\/+$/, ''));
const licenseUrl = computed(() => `${resolvedRepoUrl.value}/blob/main/LICENSE`);
</script>

<template>
  <p class="hint app-footer-repo-link">
    <a :href="resolvedRepoUrl" target="_blank" rel="noopener">Reisotor auf GitHub</a>
    <template v-if="landingUrl">
      · <a :href="landingUrl" target="_blank" rel="noopener">Mehr über Reisotor</a>
    </template>
  </p>
  <p class="hint app-footer-legal-links">
    <router-link to="/privacy">Datenschutz</router-link>
    ·
    <router-link to="/imprint">Impressum</router-link>
  </p>
  <p class="hint app-footer-copyright">
    © {{ copyrightYear }}
    <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a> ·
    <a :href="licenseUrl" target="_blank" rel="noopener">EUPL-1.2</a> · Made with love, coffee and
    AI<template v-if="hostingLocation"> · gehostet in {{ hostingLocation }}</template>
  </p>
</template>

<style scoped>
.app-footer-repo-link,
.app-footer-legal-links,
.app-footer-copyright {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-sm, 0.85rem);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.app-footer-legal-links,
.app-footer-copyright {
  margin-top: var(--space-1);
}

.app-footer-repo-link a,
.app-footer-legal-links a,
.app-footer-copyright a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast, 0.15s ease);
}

.app-footer-repo-link a:hover,
.app-footer-legal-links a:hover,
.app-footer-copyright a:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}
</style>
