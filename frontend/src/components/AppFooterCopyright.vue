<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  repoUrl?: string;
  hostingLocation?: string;
}>();

const currentYear = new Date().getFullYear();
const resolvedRepoUrl = computed(() => {
  const url = props.repoUrl || (typeof __REPO_URL__ !== 'undefined' ? __REPO_URL__ : '');
  return url.replace(/\/+$/, '');
});
const licenseUrl = computed(() => `${resolvedRepoUrl.value}/blob/main/LICENSE`);
</script>

<template>
  <p class="hint app-footer-copyright">
    <span class="copyright-group">
      © {{ currentYear }}
      <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a>
      <span class="sep" aria-hidden="true">·</span>
      <a :href="licenseUrl" target="_blank" rel="noopener">EUPL-1.2</a>
    </span>
    <span class="sep sep-break" aria-hidden="true">·</span>
    <span class="copyright-group">Made with love, coffee and AI</span>
    <template v-if="hostingLocation">
      <span class="sep sep-break" aria-hidden="true">·</span>
      <span class="copyright-group">gehostet in {{ hostingLocation }}</span>
    </template>
  </p>
</template>

<style scoped>
.app-footer-copyright {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-sm, 0.85rem);
  color: var(--color-text-muted);
  line-height: 1.5;
  container-type: inline-size;
}

.copyright-group {
  display: inline-block;
  white-space: nowrap;
}

.sep {
  display: inline-block;
  margin: 0 0.35em;
  color: inherit;
}

.app-footer-copyright a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast, 0.15s ease);
}

.app-footer-copyright a:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

@container (max-width: 640px) {
  .copyright-group {
    display: block;
  }

  .sep-break {
    display: none;
  }
}

@media (max-width: 640px) {
  .copyright-group {
    display: block;
  }

  .sep-break {
    display: none;
  }
}
</style>
