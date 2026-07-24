<script setup lang="ts">
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="brand">
      <img src="/reisotor_logo.svg" alt="Reisotor Logo" class="logo" />
      <span class="wordmark">Reisotor</span>
    </router-link>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 11;
  height: 56px;
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0 var(--space-4);
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  width: fit-content;
}

.logo {
  width: 32px;
  height: 32px;
}

.wordmark {
  font-weight: 700;
  color: var(--color-primary-dark);
  font-size: 1.1rem;
}
</style>
