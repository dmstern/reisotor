<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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
const closeBtnRef = ref<HTMLButtonElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

function close() {
  emit('update:modelValue', false);
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(selector));
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;
  if (e.key === 'Escape') {
    close();
    return;
  }
  if (e.key === 'Tab') {
    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !modalRef.value?.contains(active)) {
        last.focus();
        e.preventDefault();
      }
    } else if (active === last || !modalRef.value?.contains(active)) {
      first.focus();
      e.preventDefault();
    }
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document !== 'undefined') {
      if (open) {
        previouslyFocusedElement = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        nextTick(() => {
          closeBtnRef.value?.focus();
        });
      } else {
        document.body.style.overflow = '';
        previouslyFocusedElement?.focus?.();
        previouslyFocusedElement = null;
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
      <div v-if="modelValue" class="landing-legal-overlay" @click.self="close">
        <div
          ref="modalRef"
          class="landing-legal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Rechtliche Informationen"
          tabindex="-1"
        >
          <header class="landing-legal-header">
            <button
              ref="closeBtnRef"
              type="button"
              class="close-button"
              aria-label="Schließen"
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
  border-radius: var(--radius-pill, 9999px);
  min-inline-size: 44px;
  min-block-size: 44px;
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
