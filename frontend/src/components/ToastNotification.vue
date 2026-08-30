<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      <TransitionGroup name="toast-list">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
          role="status"
        >
          <div class="toast-content">
            <span class="toast-message">{{ toast.message }}</span>
          </div>
          <button
            type="button"
            class="toast-close"
            aria-label="Schließen"
            @click="removeToast(toast.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  right: var(--space-4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
  width: calc(100% - (2 * var(--space-4)));
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background-color: var(--color-surface, #ffffff);
  color: var(--color-text, #1e293b);
  border: var(--ui-border-width, 1px) solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg-squircle, 16px);
  corner-shape: squircle;
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06));
  font-size: var(--font-size-sm, 0.85rem);
  line-height: 1.4;
}

.toast-item.toast-info {
  border-left: 4px solid var(--color-primary, #2a7f74);
}

.toast-item.toast-success {
  border-left: 4px solid #10b981;
}

.toast-item.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-item.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-content {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #64748b);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm, 4px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.toast-close:hover {
  color: var(--color-text, #1e293b);
  background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
}

/* Animations */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.25s ease;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
</style>
