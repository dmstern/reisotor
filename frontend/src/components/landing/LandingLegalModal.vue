<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { LegalConfig } from '../../api/types';
import { ACTION_ICONS } from '../../utils/actionIcons';
import IconButton from '../primitives/IconButton.vue';
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
const closeBtnRef = ref<InstanceType<typeof IconButton> | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

function close() {
  emit('update:modelValue', false);
}

function handleTabChange(tab: 'privacy' | 'imprint') {
  emit('update:activeTab', tab);
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) {
    return [];
  }

  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(selector));
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) {
    return;
  }

  if (e.key === 'Escape') {
    close();
    return;
  }

  if (e.key !== 'Tab') {
    return;
  }

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

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document !== 'undefined') {
      if (open) {
        previouslyFocusedElement = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        nextTick(() => {
          (closeBtnRef.value?.$el as HTMLElement | undefined)?.focus();
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
                <IconButton
                  ref="closeBtnRef"
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  class="close-button"
                  aria-label="Schließen"
                  title="Schließen"
                  @click="close"
                />
              </template>
            </LegalContent>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.landing-legal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 1000);
  background: rgba(11, 11, 11, 0.55);
  backdrop-filter: var(--backdrop-blur-md);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--space-4) + env(safe-area-inset-top, 0px))
    calc(var(--space-4) + env(safe-area-inset-right, 0px))
    calc(var(--space-4) + env(safe-area-inset-bottom, 0px))
    calc(var(--space-4) + env(safe-area-inset-left, 0px));
  overflow-y: auto;
}

@include media-down('tablet-sm') {
  .landing-legal-overlay {
    padding-top: calc(var(--space-3) + env(safe-area-inset-top, 0px));
    padding-right: calc(var(--space-2) + env(safe-area-inset-right, 0px));
    padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
    padding-left: calc(var(--space-2) + env(safe-area-inset-left, 0px));
  }
}

.landing-legal-dialog {
  background-color: var(--color-surface);
  background-image: var(--gradient-surface-3d);
  background-origin: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  max-width: 860px;
  width: 100%;
  max-height: min(88vh, 100%);
  max-height: min(88dvh, 100%);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    border-radius: inherit;
    corner-shape: inherit;
    box-shadow: inset 0 1px 0 var(--shadow-control-highlight);
  }
}

.close-button {
  flex-shrink: 0;
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
