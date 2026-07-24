<script setup lang="ts">
defineProps<{ small?: boolean }>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    type="button"
    class="secondary delete-btn"
    :class="{ small }"
    title="Löschen"
    aria-label="Löschen"
    @click="$emit('click')"
  >
    🗑️
  </button>
</template>

<style scoped>
.delete-btn {
  padding: 6px 10px;
  font-size: 0.9rem;
  line-height: 1;
  flex-shrink: 0;
}

.delete-btn.small {
  padding: 4px 8px;
  font-size: 0.8rem;
}
</style>
