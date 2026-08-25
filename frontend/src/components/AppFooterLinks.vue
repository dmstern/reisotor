<script setup lang="ts">
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
const resolvedRepoUrl = props.repoUrl ?? __REPO_URL__;
</script>

<template>
  <p class="hint app-footer-repo-link">
    <a :href="resolvedRepoUrl" target="_blank" rel="noopener">Reisotor auf GitHub</a>
    <template v-if="landingUrl">
      · <a :href="landingUrl" target="_blank" rel="noopener">Mehr über Reisotor</a>
    </template>
  </p>
  <p class="hint app-footer-copyright">
    © {{ copyrightYear }}
    <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a> ·
    gebaut mit Claude Code<template v-if="hostingLocation">
      · gehostet in {{ hostingLocation }}</template
    >
  </p>
</template>

<style scoped>
.app-footer-repo-link,
.app-footer-copyright {
  margin: 0;
  text-align: center;
}
</style>
