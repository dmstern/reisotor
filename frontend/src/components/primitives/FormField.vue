<template>
  <label class="r-pr-field">
    <span class="label"><slot name="label" /></span>
    <div class="control"><slot /></div>
    <p class="hint"><slot name="hint" /></p>
  </label>
</template>

<script setup lang="ts">
// Minimal FormField primitive — preserves markup and exposes slots for label/control/hint
</script>

<style scoped>
.r-pr-field { display: block; margin-bottom: var(--space-3); color: var(--color-text-muted); }
.r-pr-field .label { display: block; margin-bottom: 6px; font-weight: 600; color: var(--color-text); }
.r-pr-field .control { }
.r-pr-field .hint { margin-top: 6px; font-size: 0.9rem; color: var(--color-text-muted); }
</style>
