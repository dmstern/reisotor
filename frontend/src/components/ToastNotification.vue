<script setup lang="ts">
import { computed } from 'vue';
import { getActivePinia } from 'pinia';
import { useToast, type ToastItem } from '../composables/useToast';
import { useTripStore } from '../stores/trip';

const { toasts, removeToast } = useToast();

const trashRoute = computed(() => {
  if (getActivePinia()) {
    try {
      const tripStore = useTripStore();
      if (tripStore.currentTripId != null) {
        return `/trip/${tripStore.currentTripId}/trash`;
      }
    } catch {
      // Fallback
    }
  }
  return '/trash';
});

interface MessageSegment {
  text: string;
  isTrashLink: boolean;
}

function parseMessageSegments(message: string): MessageSegment[] {
  if (!message.includes('Papierkorb')) {
    return [{ text: message, isTrashLink: false }];
  }
  const parts = message.split(/(Papierkorb)/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isTrashLink: part === 'Papierkorb',
    }));
}

async function handleActionClick(toast: ToastItem) {
  try {
    await toast.action?.onClick?.();
  } catch {
    useToast().showToast({
      message: 'Wiederherstellen fehlgeschlagen. Bitte erneut versuchen.',
      type: 'error',
    });
  } finally {
    removeToast(toast.id);
  }
}
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
          :role="toast.type === 'error' ? 'alert' : 'status'"
        >
          <div class="toast-content">
            <span class="toast-message">
              <template v-for="(seg, idx) in parseMessageSegments(toast.message)" :key="idx">
                <RouterLink
                  v-if="seg.isTrashLink"
                  :to="trashRoute"
                  class="toast-inline-link"
                  @click="removeToast(toast.id)"
                >
                  {{ seg.text }}
                </RouterLink>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
            <RouterLink
              v-if="toast.action && toast.action.to"
              :to="toast.action.to"
              class="toast-action"
              @click="handleActionClick(toast)"
            >
              {{ toast.action.label }}
            </RouterLink>
            <button
              v-else-if="toast.action"
              type="button"
              class="toast-action toast-action-btn"
              @click="handleActionClick(toast)"
            >
              {{ toast.action.label }}
            </button>
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
  box-shadow: var(
    --shadow-md,
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06)
  );
  font-size: var(--font-size-sm, 0.85rem);
  line-height: 1.4;
}

.toast-item.toast-info {
  border-left: 4px solid var(--color-primary, #9141ac);
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
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.toast-inline-link {
  font-weight: 600;
  color: var(--color-primary, #9141ac);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.toast-inline-link:hover {
  text-decoration: none;
}

.toast-inline-link:focus-visible {
  outline: 2px solid var(--color-primary, #9141ac);
  outline-offset: 2px;
  border-radius: var(--radius-xs, 2px);
}

.toast-action {
  font-weight: 600;
  color: var(--color-primary, #9141ac);
  text-decoration: underline;
  text-underline-offset: 2px;
  align-self: flex-start;
  margin-top: 2px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.toast-action-btn {
  background: transparent;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  text-align: left;
}

.toast-action:hover {
  text-decoration: none;
  opacity: 0.85;
}

.toast-action:focus-visible {
  outline: 2px solid var(--color-primary, #9141ac);
  outline-offset: 2px;
  border-radius: var(--radius-xs, 2px);
}

.toast-item.toast-error .toast-action {
  color: #ef4444;
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
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
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
