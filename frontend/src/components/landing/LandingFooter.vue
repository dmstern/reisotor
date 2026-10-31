<script setup lang="ts">
import AppFooterCopyright from '../AppFooterCopyright.vue';

defineProps<{
  demoUrl: string;
  storybookUrl: string;
  repoUrl: string;
}>();

const emit = defineEmits<{
  (e: 'openLegal', tab: 'privacy' | 'imprint'): void;
}>();
</script>

<template>
  <footer class="landing-footer">
    <div class="hint-links">
      <a :href="demoUrl">Live Demo</a>
      <span class="dot">·</span>
      <a :href="storybookUrl" target="_blank" rel="noopener">Storybook</a>
      <span class="dot">·</span>
      <a :href="repoUrl" target="_blank" rel="noopener">GitHub</a>
      <span class="dot">·</span>
      <a href="#privacy" @click.prevent="emit('openLegal', 'privacy')">Datenschutz</a>
      <span class="dot">·</span>
      <a href="#imprint" @click.prevent="emit('openLegal', 'imprint')">Impressum</a>
    </div>
    <AppFooterCopyright :repo-url="repoUrl" />
  </footer>
</template>

<style scoped>
.landing-footer {
  text-align: center;
  padding: var(--space-5) 0 var(--space-4) 0;
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

.hint-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2) var(--space-3);
  margin-bottom: var(--space-3);
  padding: 0 var(--space-3);
}

@media (max-width: 600px) {
  .hint-links {
    gap: var(--space-1) var(--space-2);
    margin-bottom: var(--space-2);
  }
}

.hint-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  min-height: var(--input-default-height, 44px);
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-1);
}

.hint-links a:hover {
  color: var(--color-primary);
}

.dot {
  color: var(--color-border-strong);
}
</style>
