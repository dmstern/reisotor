<script setup lang="ts">
defineProps<{ modelValue: boolean; title?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @click.self="close">
      <div class="modal">
        <div class="modal-head">
          <h2 v-if="title">{{ title }}</h2>
          <button class="secondary close-btn" @click="close">✕</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 11, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-4);
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.modal-head h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.close-btn {
  padding: 4px 10px;
  flex-shrink: 0;
}
</style>
