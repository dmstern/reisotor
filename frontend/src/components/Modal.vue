<script setup lang="ts">
// hideHeader: für DetailModal.vue, dessen Bild-Banner randlos bis ganz oben reichen soll – die
// normale .modal-head-Zeile (auch ohne title nur der Close-Button) würde dafür immer eine Lücke
// über dem Banner offen lassen, egal wie stark man das Banner selbst nach oben zieht. In dem Fall
// übernimmt der Aufrufer den Close-Button selbst (siehe DetailModal.vue).
// fullHeight: für Formulare mit einem zentralen Notiz-/Inhalts-Textfeld (Notizen, Tagebuch, Spot-/
// Touren-/Unterkunft-/Reise-Notizen), die sonst nur die feste `rows`-Zahl des Textfelds als Höhe
// bekämen – oft zu wenig Platz zum Tippen, v. a. mobil mit eingeblendeter Tastatur. Streckt den
// Dialog stattdessen auf die verfügbare Höhe; das Formular (und darin per :slotted() jedes
// textarea, siehe unten) wächst mit, alle anderen Felder behalten ihre natürliche Höhe.
import { onUnmounted, watch, useId, ref, nextTick, computed } from 'vue';
import IconButton from './primitives/IconButton.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useModalStore } from '../stores/modal';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    hideHeader?: boolean;
    fullHeight?: boolean;
    ariaLabel?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    confirmClose?: boolean;
    confirmCloseTitle?: string;
    confirmCloseMessage?: string;
    confirmCloseConfirmLabel?: string;
    confirmCloseCancelLabel?: string;
  }>(),
  {
    size: 'md',
    confirmClose: false,
    confirmCloseTitle: 'Ungespeicherte Änderungen verwerfen?',
    confirmCloseMessage:
      'Du hast ungespeicherte Änderungen vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?',
    confirmCloseConfirmLabel: 'Änderungen verwerfen',
    confirmCloseCancelLabel: 'Weiter bearbeiten',
  }
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'discard'): void;
}>();

const modalStore = useModalStore();
const modalId = useId();
const titleId = `${modalId}-title`;
const modalRef = ref<HTMLDivElement | null>(null);
const confirmModalRef = ref<HTMLDivElement | null>(null);
const showConfirmClose = ref(false);

function close() {
  if (props.confirmClose) {
    showConfirmClose.value = true;
    return;
  }
  emit('update:modelValue', false);
}

function cancelConfirmClose() {
  showConfirmClose.value = false;
}

function acceptConfirmClose() {
  showConfirmClose.value = false;
  emit('discard');
  emit('update:modelValue', false);
}

function getFocusableElements(container: HTMLElement | null = modalRef.value): HTMLElement[] {
  if (!container) return [];
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return elements.filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;

  if (e.key === 'Escape') {
    if (showConfirmClose.value) {
      cancelConfirmClose();
      return;
    }
    if (modalStore.isTop(modalId)) {
      close();
    }
    return;
  }

  if (e.key === 'Tab') {
    if (!modalStore.isTop(modalId)) return;
    const container = showConfirmClose.value ? confirmModalRef.value : modalRef.value;
    const focusables = getFocusableElements(container);
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
    } else {
      if (active === last || !modalRef.value?.contains(active)) {
        first.focus();
        e.preventDefault();
      }
    }
  }
}

let isRegistered = false;

const modalBodyRef = ref<HTMLDivElement | null>(null);
const topFadeRef = ref<HTMLDivElement | null>(null);
const bottomFadeRef = ref<HTMLDivElement | null>(null);

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

function getScrollElement(): HTMLElement | null {
  if (!modalRef.value) return null;
  return modalBodyRef.value || modalRef.value.querySelector<HTMLElement>('.modal-body');
}

function updateScrollState() {
  const modalEl = modalRef.value;
  if (!modalEl) return;
  const el = getScrollElement();
  if (!el) {
    modalEl.classList.remove('can-scroll-up', 'can-scroll-down', 'has-actions-row');
    topFadeRef.value?.classList.remove('is-visible');
    bottomFadeRef.value?.classList.remove('is-visible');
    return;
  }
  const canUp = el.scrollTop > 2;
  const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  const hasActions = Boolean(modalEl.querySelector('.actions-row'));

  modalEl.classList.toggle('can-scroll-up', canUp);
  modalEl.classList.toggle('can-scroll-down', canDown);
  modalEl.classList.toggle('has-actions-row', hasActions);

  topFadeRef.value?.classList.toggle('is-visible', canUp);
  bottomFadeRef.value?.classList.toggle('is-visible', canDown && !hasActions);
}

function onScroll(e: Event) {
  const target = e.target as HTMLElement | null;
  const scrollEl = getScrollElement();
  if (
    target === scrollEl ||
    target === modalBodyRef.value ||
    target === modalRef.value ||
    modalRef.value?.contains(target as Node)
  ) {
    updateScrollState();
  }
}

function setupScrollObservers() {
  cleanupScrollObservers();
  if (!modalRef.value) return;

  modalRef.value.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', updateScrollState, { passive: true });

  const scrollEl = getScrollElement();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    if (scrollEl) {
      resizeObserver.observe(scrollEl);
      for (const child of scrollEl.children) {
        resizeObserver.observe(child);
      }
    }
    if (modalBodyRef.value && modalBodyRef.value !== scrollEl) {
      resizeObserver.observe(modalBodyRef.value);
    }
    if (modalRef.value && modalRef.value !== scrollEl) {
      resizeObserver.observe(modalRef.value);
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    const observeTarget = scrollEl || modalBodyRef.value || modalRef.value;
    if (observeTarget) {
      mutationObserver = new MutationObserver(() => {
        updateScrollState();
        if (resizeObserver && scrollEl) {
          for (const child of scrollEl.children) {
            resizeObserver.observe(child);
          }
        }
      });
      mutationObserver.observe(observeTarget, { childList: true, subtree: true });
    }
  }

  updateScrollState();
}

function cleanupScrollObservers() {
  if (modalRef.value) {
    modalRef.value.removeEventListener('scroll', onScroll, { capture: true });
    modalRef.value.classList.remove('can-scroll-up', 'can-scroll-down', 'has-actions-row');
  }
  window.removeEventListener('resize', updateScrollState);
  resizeObserver?.disconnect();
  resizeObserver = null;
  mutationObserver?.disconnect();
  mutationObserver = null;
  topFadeRef.value?.classList.remove('is-visible');
  bottomFadeRef.value?.classList.remove('is-visible');
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (!isRegistered) {
        isRegistered = true;
        modalStore.register(modalId);
        window.addEventListener('keydown', handleKeydown);
        nextTick(() => {
          const focusables = getFocusableElements();
          if (focusables.length > 0) {
            focusables[0].focus();
          }
          setupScrollObservers();
          requestAnimationFrame(updateScrollState);
        });
      }
    } else {
      showConfirmClose.value = false;
      if (isRegistered) {
        isRegistered = false;
        window.removeEventListener('keydown', handleKeydown);
        modalStore.unregister(modalId);
        cleanupScrollObservers();
      }
    }
  },
  { immediate: true }
);

watch(showConfirmClose, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      const focusables = getFocusableElements(confirmModalRef.value);
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    });
  } else if (props.modelValue) {
    nextTick(() => {
      const focusables = getFocusableElements(modalRef.value);
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    });
  }
});

watch(
  () => props.fullHeight,
  () => {
    if (props.modelValue) {
      nextTick(() => {
        setupScrollObservers();
      });
    }
  }
);

onUnmounted(() => {
  if (isRegistered) {
    isRegistered = false;
    window.removeEventListener('keydown', handleKeydown);
    modalStore.unregister(modalId);
  }
  cleanupScrollObservers();
});

const currentZIndex = computed(() => modalStore.getZIndex(modalId));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div v-if="modelValue" class="overlay" :style="{ zIndex: currentZIndex }" @click.self="close">
        <div
          ref="modalRef"
          class="modal"
          :class="[{ 'full-height': fullHeight }, `size-${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="(title || $slots.title) && !hideHeader ? titleId : undefined"
          :aria-label="
            (!title && !$slots.title) || hideHeader ? ariaLabel || title || 'Dialog' : undefined
          "
        >
          <div class="modal-head" v-if="!hideHeader">
            <h2 v-if="title || $slots.title" :id="titleId">
              <slot name="title">{{ title }}</slot>
            </h2>
            <IconButton
              variant="ghost"
              class="close-btn"
              :icon="ACTION_ICONS.close"
              size="sm"
              title="Schließen"
              aria-label="Schließen"
              @click="close"
            />
          </div>
          <div class="modal-body-wrap">
            <div class="modal-body" ref="modalBodyRef">
              <slot :close="close" />
            </div>
            <div
              ref="topFadeRef"
              class="modal-scroll-fade modal-scroll-fade--top modal-scroll-shadow--top"
              aria-hidden="true"
            />
            <div
              ref="bottomFadeRef"
              class="modal-scroll-fade modal-scroll-fade--bottom modal-scroll-shadow--bottom"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="modal-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div
        v-if="modelValue && showConfirmClose"
        class="overlay confirm-close-overlay"
        :style="{ zIndex: currentZIndex + 5 }"
        @click.self="cancelConfirmClose"
      >
        <div
          ref="confirmModalRef"
          class="modal confirm-close-dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="`${modalId}-confirm-title`"
        >
          <div class="modal-head">
            <h2 :id="`${modalId}-confirm-title`">
              {{ confirmCloseTitle || 'Ungespeicherte Änderungen verwerfen?' }}
            </h2>
          </div>
          <div class="modal-body-wrap">
            <div class="modal-body confirm-close-body">
              <p class="confirm-close-message">
                {{
                  confirmCloseMessage ||
                  'Du hast ungespeicherte Änderungen vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?'
                }}
              </p>
              <ButtonGroup class="confirm-close-actions">
                <Button type="button" variant="secondary" @click="cancelConfirmClose">
                  {{ confirmCloseCancelLabel || 'Weiter bearbeiten' }}
                </Button>
                <Button type="button" variant="danger" @click="acceptConfirmClose">
                  {{ confirmCloseConfirmLabel || 'Änderungen verwerfen' }}
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </div>
      </div>
    </Transition>
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
  z-index: var(--z-modal, 1000);
  padding: var(--space-4);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.modal-fade-enter-active .modal,
.modal-fade-leave-active .modal {
  transition:
    transform 0.2s ease-in-out,
    opacity 0.2s ease-in-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal,
.modal-fade-leave-to .modal {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}

.modal {
  position: relative;
  background: var(--color-surface);
  --scroll-fade-bg: var(--color-surface);
  --tab-bar-fade-bg: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  padding: var(--space-4);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition:
    height 0.35s cubic-bezier(0.34, 1.2, 0.64, 1),
    max-height 0.35s ease;
}

@media (max-width: 600px) {
  .overlay {
    padding: 12px;
  }

  .modal {
    padding: var(--space-3);
  }
}

.modal.size-sm {
  max-width: 360px;
}

.modal.size-md {
  max-width: 480px;
}

.modal.size-lg {
  max-width: 720px;
}

.modal.size-xl {
  max-width: 900px;
}

/* Desktop-Breite für inhaltsreiche Formulare (Notizen/Tagebuch/Touren/Spots/Reise), die diese
   Variante nutzen (#88). */
@media (min-width: 800px) {
  .modal.full-height {
    max-width: 900px;
  }
}

.modal-body-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
  /* padding (NICHT nur padding-block) reserviert Platz für den Fokus-Rahmen (outline-offset 1px +
     outline-Breite 2px, siehe input:focus in style.css) von Feldern ganz am Rand des Formulars -
     sonst schneidet das eigene overflow-y:auto des Containers diesen Rahmen ab. */
  padding: var(--space-1);
}

/* Sanfte Fade-Out-Verläufe in die Hintergrundfarbe (--color-surface) am oberen und unteren Rand,
   wenn der Inhalt scrollbar ist. Angelehnt an DayStrip.vue und TabBar.vue. pointer-events: none
   sichert uneingeschränkte Klickbarkeit dahinter liegender Felder. */
.modal-scroll-fade,
.modal-scroll-shadow {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 25;
}

.modal-scroll-fade--top,
.modal-scroll-shadow--top {
  top: 0;
  background: linear-gradient(to bottom, var(--color-surface) 0%, transparent 100%);
}

.modal-scroll-fade--bottom,
.modal-scroll-shadow--bottom {
  bottom: 0;
  background: linear-gradient(to top, var(--color-surface) 0%, transparent 100%);
}

.modal-scroll-fade.is-visible,
.modal-scroll-shadow.is-visible {
  opacity: 1;
}

/* Slot-Inhalt gehört der aufrufenden View. Formulare füllen die verfügbare Höhe; zentrale
   Notiz-/Inhalts-Textfelder (z. B. RichTextEditor / textarea) wachsen mit. */
.modal-body :slotted(form) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.modal-body :slotted(textarea) {
  flex: 1;
  min-height: 120px;
}

/* Fixierte Aktions-Leiste ("Speichern", "Löschen" etc.) am unteren Rand scrollbarer Dialog-Formulare:
   Bleibt beim Scrollen am unteren Rand stehen, während der Inhalt dahinter scrollt. Bei sichtbarem
   Überlauf nach unten zeigt ein weiches Fade-Out (::before) oberhalb der Leiste an, dass darunter
   weiterer Inhalt erreichbar ist. */
.modal-body :slotted(form) .actions-row,
.modal-body :slotted(.actions-row) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  position: sticky;
  bottom: -4px;
  margin-left: -4px;
  margin-right: -4px;
  margin-bottom: -4px;
  margin-top: var(--space-3);
  padding: var(--space-3) 4px var(--space-1);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 10;
}

.modal-body :slotted(form) .actions-row::before,
.modal-body :slotted(.actions-row)::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 28px;
  background: linear-gradient(to top, var(--color-surface) 0%, transparent 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.modal.can-scroll-down .modal-body :slotted(form) .actions-row::before,
.modal.can-scroll-down .modal-body :slotted(.actions-row)::before {
  opacity: 1;
}

.modal-body :slotted(form) .actions-row .spacer,
.modal-body :slotted(.actions-row) .spacer {
  flex: 1;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.modal-head h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
  min-width: 0;
}

.close-btn {
  position: relative;
}

.close-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}

.modal.confirm-close-dialog {
  max-width: 480px;
}

.confirm-close-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.confirm-close-message {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.confirm-close-actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.confirm-close-actions :deep(.btn),
.confirm-close-actions :deep(button) {
  white-space: nowrap;
}

@media (max-width: 600px) {
  .modal.confirm-close-dialog {
    max-width: 100%;
  }

  .confirm-close-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .confirm-close-actions :deep(.btn),
  .confirm-close-actions :deep(button) {
    width: 100%;
    justify-content: center;
  }
}
</style>
