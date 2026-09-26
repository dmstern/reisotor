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
  }>(),
  { size: 'md' }
);
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const modalStore = useModalStore();
const modalId = useId();
const titleId = `${modalId}-title`;
const modalRef = ref<HTMLDivElement | null>(null);

function close() {
  emit('update:modelValue', false);
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const elements = Array.from(modalRef.value.querySelectorAll<HTMLElement>(selector));
  return elements.filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;

  if (e.key === 'Escape') {
    if (modalStore.isTop(modalId)) {
      close();
    }
    return;
  }

  if (e.key === 'Tab') {
    if (!modalStore.isTop(modalId)) return;
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
    } else {
      if (active === last || !modalRef.value?.contains(active)) {
        first.focus();
        e.preventDefault();
      }
    }
  }
}

let isRegistered = false;

const canScrollUp = ref(false);
const canScrollDown = ref(false);
const hasActionsRow = ref(false);

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

function getScrollElement(): HTMLElement | null {
  if (!modalRef.value) return null;
  if (props.fullHeight) {
    const form = modalRef.value.querySelector<HTMLElement>('.modal-body > form');
    if (form) return form;
    const slottedChild = modalRef.value.querySelector<HTMLElement>('.modal-body > *');
    if (slottedChild && slottedChild.scrollHeight > slottedChild.clientHeight) {
      return slottedChild;
    }
  }
  return modalRef.value;
}

function updateScrollState() {
  const el = getScrollElement();
  if (!el) {
    canScrollUp.value = false;
    canScrollDown.value = false;
    hasActionsRow.value = false;
    return;
  }
  canScrollUp.value = el.scrollTop > 2;
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  hasActionsRow.value = Boolean(modalRef.value?.querySelector('.actions-row'));
}

function onScroll(e: Event) {
  const target = e.target as HTMLElement | null;
  const scrollEl = getScrollElement();
  if (target === scrollEl || target === modalRef.value) {
    if (!scrollEl) return;
    canScrollUp.value = scrollEl.scrollTop > 2;
    canScrollDown.value = scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 2;
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
    if (modalRef.value && modalRef.value !== scrollEl) {
      resizeObserver.observe(modalRef.value);
    }
  }

  if (typeof MutationObserver !== 'undefined' && scrollEl) {
    mutationObserver = new MutationObserver(() => {
      updateScrollState();
      if (resizeObserver && scrollEl) {
        for (const child of scrollEl.children) {
          resizeObserver.observe(child);
        }
      }
    });
    mutationObserver.observe(scrollEl, { childList: true, subtree: true });
  }

  updateScrollState();
}

function cleanupScrollObservers() {
  if (modalRef.value) {
    modalRef.value.removeEventListener('scroll', onScroll, { capture: true });
  }
  window.removeEventListener('resize', updateScrollState);
  resizeObserver?.disconnect();
  resizeObserver = null;
  mutationObserver?.disconnect();
  mutationObserver = null;
  canScrollUp.value = false;
  canScrollDown.value = false;
  hasActionsRow.value = false;
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
          :class="[
            {
              'full-height': fullHeight,
              'can-scroll-up': canScrollUp,
              'can-scroll-down': canScrollDown,
              'has-actions-row': hasActionsRow,
            },
            `size-${size}`,
          ]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title && !hideHeader ? titleId : undefined"
          :aria-label="!title || hideHeader ? ariaLabel || title || 'Dialog' : undefined"
        >
          <div class="modal-head" v-if="!hideHeader">
            <h2 v-if="title" :id="titleId">{{ title }}</h2>
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
          <div class="modal-body">
            <div
              class="modal-scroll-shadow modal-scroll-shadow--top"
              :class="{ 'is-visible': canScrollUp }"
              aria-hidden="true"
            />
            <slot :close="close" />
            <div
              class="modal-scroll-shadow modal-scroll-shadow--bottom"
              :class="{ 'is-visible': canScrollDown && !hasActionsRow }"
              aria-hidden="true"
            />
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
  z-index: 100;
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
  --modal-scroll-shadow-color: rgba(43, 42, 40, 0.14);
  background: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  padding: var(--space-4);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
  transition:
    height 0.35s cubic-bezier(0.34, 1.2, 0.64, 1),
    max-height 0.35s ease;
}

@media (prefers-color-scheme: dark) {
  .modal {
    --modal-scroll-shadow-color: rgba(0, 0, 0, 0.45);
  }
}

:global([data-theme='dark']) .modal {
  --modal-scroll-shadow-color: rgba(0, 0, 0, 0.45);
}

:global([data-theme='light']) .modal {
  --modal-scroll-shadow-color: rgba(43, 42, 40, 0.14);
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

/* fullHeight-Variante (siehe Prop oben): ursprünglich per align-self:stretch auf die volle
   Viewport-Höhe gestreckt, damit ein enthaltenes <textarea> per :slotted() mitwachsen konnte. Seit
   alle Anlegen-Formulare RichTextEditor.vue statt eines rohen <textarea> nutzen (das seine Höhe
   bereits selbst deckelt, siehe dort), hätte der Zwangs-Stretch nur noch ungenutzten Leerraum unter
   kurzen Formularen erzeugt (#88, konkret bei Notizen: Titel + Editor füllen die gestreckte Höhe
   nicht annähernd aus) – Höhe wächst jetzt stattdessen wie beim Basis-.modal mit dem Inhalt
   (max-height:90vh + overflow-y:auto), Desktop bekommt zusätzlich mehr Breite für die inhaltsreichen
   Formulare, die diese Variante nutzen (Notizen/Tagebuch/Touren/Spots/Reise). */
.modal.full-height {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (min-width: 800px) {
  .modal.full-height {
    /* #88: 640px verschenkte auf Desktop-Bildschirmen (FullHD+) spürbar Platz links/rechts, gerade
       für das große Freitextfeld (Tagebuch/Notizen) - deutlich breiter, aber immer noch mit Luft zum
       Bildschirmrand auf kleineren Laptop-Displays. */
    max-width: 900px;
  }
}

.modal.full-height .modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.modal-scroll-shadow {
  position: absolute;
  left: 0;
  right: 0;
  height: 14px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 15;
}

.modal-scroll-shadow--top {
  top: 0;
  background: linear-gradient(to bottom, var(--modal-scroll-shadow-color) 0%, transparent 100%);
}

.modal-scroll-shadow--bottom {
  bottom: 0;
  background: linear-gradient(to top, var(--modal-scroll-shadow-color) 0%, transparent 100%);
}

.modal-scroll-shadow.is-visible {
  opacity: 1;
}

/* Slot-Inhalt gehört der aufrufenden View (Notizen/Tagebuch/Spot-/Touren-/Unterkunft-/Reise-
   Formulare), braucht daher :slotted() statt einer normalen scoped-Regel. Das Formular selbst füllt
   den verfügbaren Platz, sein zentrales Notiz-/Inhalts-Textfeld (nicht die übrigen, kurzen Felder)
   den Rest davon – jede dieser Views hat genau ein solches Feld pro Formular. */
.modal.full-height .modal-body :slotted(form) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* padding (NICHT nur padding-block) reserviert Platz für den Fokus-Rahmen (outline-offset 1px +
     outline-Breite 2px, siehe input:focus in style.css) von Feldern ganz am Rand des Formulars -
     sonst schneidet das eigene overflow-y:auto des Formulars diesen Rahmen ab. Zwei Achsen statt nur
     block: overflow-y:auto setzt laut CSS-Spec (Overflow Module Level 3) implizit auch overflow-x
     auf auto, sobald eine Achse nicht "visible" ist - eine reine Block-Reservierung (frühere Fassung,
     #86) deckte deshalb nur oben/unten ab, links/rechts blieb der Rahmen z. B. bei zweispaltigen
     .row-Layouts (TravelSection.vue "Von"/"Nach") weiterhin abgeschnitten (#169). Gilt für jedes
     full-height-Formular gemeinsam (Notizen/Tagebuch/Touren/Spots/Unterkunft/Reise/...), da alle
     dieselbe :slotted(form)-Regel hier teilen - der Grund, warum dieser Fix zentral hier statt in
     jeder einzelnen View ansetzt. */
  padding: var(--space-1);
}

.modal.full-height .modal-body :slotted(textarea) {
  flex: 1;
  min-height: 120px;
}

/* Fixierte Aktions-Leiste ("Speichern", "Löschen" etc.) am unteren Rand scrollbarer Dialog-Formulare:
   Bleibt beim Scrollen am unteren Rand stehen, sodass Aktionen immer direkt erreichbar sind
   (z. B. wenn nur der Titel oben geändert wird), während der Formularinhalt dahinter scrollt. */
.modal.full-height .modal-body :slotted(form) .actions-row {
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
  transition: box-shadow 0.2s ease;
}

.modal.full-height .modal-body :slotted(form) .actions-row::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 14px;
  background: linear-gradient(to top, var(--modal-scroll-shadow-color) 0%, transparent 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.modal.full-height.can-scroll-down .modal-body :slotted(form) .actions-row {
  box-shadow: 0 -4px 12px var(--modal-scroll-shadow-color);
}

.modal.full-height.can-scroll-down .modal-body :slotted(form) .actions-row::before {
  opacity: 1;
}

.modal.full-height .modal-body :slotted(form) .actions-row .spacer {
  flex: 1;
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
</style>
