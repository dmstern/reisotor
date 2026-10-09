<script setup lang="ts">
defineProps<{
  demoUrl: string;
  storybookUrl: string;
  repoUrl: string;
}>();

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="landing-footer">
    <div class="hint-links">
      <a :href="demoUrl">Live Demo</a>
      <span class="dot">·</span>
      <a :href="storybookUrl" target="_blank" rel="noopener">Storybook</a>
      <span class="dot">·</span>
      <a :href="repoUrl" target="_blank" rel="noopener">GitHub</a>
    </div>
    <p class="hint">
      © {{ currentYear }}
      <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a>
      · agentic-coded
    </p>
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
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.hint-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
}

.hint-links a:hover {
  color: var(--color-primary);
}

.dot {
  color: var(--color-border-strong);
}

.hint {
  font-size: 0.95rem;
  margin: 0;
  color: var(--color-text-muted);
}

.hint a {
  color: var(--color-text);
  text-decoration: underline;
}
</style>
