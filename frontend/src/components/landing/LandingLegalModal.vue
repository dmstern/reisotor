<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { IconX } from '@tabler/icons-vue';
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
const bodyRef = ref<HTMLElement | null>(null);
const closeBtnRef = ref<HTMLButtonElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

function close() {
  emit('update:modelValue', false);
}

function handleTabChange(tab: 'privacy' | 'imprint') {
  emit('update:activeTab', tab);
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' });
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
          <div ref="bodyRef" class="landing-legal-body">
            <LegalContent
              :config="config"
              :active-tab="activeTab"
              :is-landing-page="true"
              @update:active-tab="handleTabChange"
            >
              <template #tabs-end>
                <button
                  ref="closeBtnRef"
                  type="button"
                  class="close-button"
                  aria-label="Schließen"
                  title="Schließen"
                  @click="close"
                >
                  <IconX :size="18" aria-hidden="true" />
                </button>
              </template>
            </LegalContent>
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
  z-index: var(--z-modal, 1000);
  background: rgba(11, 11, 11, 0.55);
  backdrop-filter: var(--backdrop-blur-md);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  overflow-y: auto;
}

@media (max-width: 600px) {
  .landing-legal-overlay {
    padding: var(--space-2);
  }
}

.landing-legal-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  max-width: 860px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.close-button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  width: 38px;
  height: 38px;
  min-inline-size: 38px;
  min-block-size: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  position: relative;
  transition:
    background-color var(--transition-fast, 0.15s ease),
    color var(--transition-fast, 0.15s ease),
    border-color var(--transition-fast, 0.15s ease),
    box-shadow var(--transition-fast, 0.15s ease);
}

.close-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}

.close-button:hover {
  background: var(--color-hover);
  color: var(--color-text);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}

.landing-legal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.legal-modal-fade-enter-active,
.legal-modal-fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.legal-modal-fade-enter-from,
.legal-modal-fade-leave-to {
  opacity: 0;
}

.legal-modal-fade-enter-active .landing-legal-dialog,
.legal-modal-fade-leave-active .landing-legal-dialog {
  transition:
    transform 0.2s ease-in-out,
    opacity 0.2s ease-in-out;
}

.legal-modal-fade-enter-from .landing-legal-dialog,
.legal-modal-fade-leave-to .landing-legal-dialog {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
