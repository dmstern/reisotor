<script setup lang="ts">
defineProps<{
  repoUrl: string;
}>();
</script>

<template>
  <section class="self-hosting">
    <h2>Wie kommt man an Reisotor?</h2>
    <p>
      Reisotor ist Open Source und aktuell nur per Self-Hosting verfügbar. Die
      <a :href="`${repoUrl}#readme`" target="_blank" rel="noopener">README</a> beschreibt lokale
      Entwicklung und Deployment auf einem eigenen Server.
    </p>
  </section>
</template>

<style scoped>
.self-hosting {
  text-align: center;
  width: calc(100% - 2 * var(--space-4));
  max-width: 800px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: var(--space-5);
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  border-radius: var(--radius-xl-squircle);
  corner-shape: squircle;
  border: 1px dashed var(--color-border-strong);
}

@container landing (max-width: 480px) {
  .self-hosting {
    width: calc(100% - 2 * var(--space-3));
    padding: var(--space-4);
  }
}

.self-hosting h2 {
  margin-top: 0;
  margin-bottom: var(--space-2);
}

.self-hosting p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.self-hosting a {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
