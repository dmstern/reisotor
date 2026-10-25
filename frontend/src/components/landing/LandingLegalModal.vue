<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { LegalConfig } from '../../api/types';
import LegalContent from '../legal/LegalContent.vue';

const props = defineProps<{
  modelValue: boolean;
  activeTab: 'privacy' | 'imprint';
  config: LegalConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:activeTab', tab: 'privacy' | 'imprint'): void;
}>();

const modalRef = ref<HTMLElement | null>(null);

function close() {
  emit('update:modelValue', false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    close();
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document !== 'undefined') {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="legal-modal-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div
        v-if="modelValue"
        class="landing-legal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Rechtliche Informationen"
        @click.self="close"
      >
        <div ref="modalRef" class="landing-legal-dialog">
          <header class="landing-legal-header">
            <button
              type="button"
              class="close-button"
              aria-label="Schließen"
              title="Schließen"
              @click="close"
            >
              ✕
            </button>
          </header>

          <div class="landing-legal-body">
            <LegalContent
              :config="config"
              :active-tab="activeTab"
              :is-landing-page="true"
              @update:active-tab="(tab) => emit('update:activeTab', tab)"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.landing-legal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  overflow-y: auto;
}

.landing-legal-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg-squircle, 16px);
  box-shadow: var(--shadow-lg);
  max-width: 860px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.landing-legal-header {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-3) var(--space-4) 0;
}

.close-button {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 9999px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.close-button:hover {
  background: var(--color-border);
  transform: scale(1.05);
}

.landing-legal-body {
  padding: 0 var(--space-5) var(--space-6);
  overflow-y: auto;
}

.legal-modal-fade-enter-active,
.legal-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.legal-modal-fade-enter-from,
.legal-modal-fade-leave-to {
  opacity: 0;
}

.legal-modal-fade-enter-active .landing-legal-dialog,
.legal-modal-fade-leave-active .landing-legal-dialog {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.legal-modal-fade-enter-from .landing-legal-dialog,
.legal-modal-fade-leave-to .landing-legal-dialog {
  transform: scale(0.96) translateY(10px);
}
</style>
