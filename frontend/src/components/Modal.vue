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
import { onUnmounted, watch, useId, ref, nextTick } from 'vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  hideHeader?: boolean;
  fullHeight?: boolean;
  ariaLabel?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const titleId = useId();
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

let openModalCount = 0;
let modalZIndexCounter = 100;

const modalZIndex = ref(100);

function lockBodyScroll() {
  openModalCount++;
  modalZIndexCounter += 10;
  modalZIndex.value = modalZIndexCounter;
  if (openModalCount === 1) {
    document.body.style.overflow = 'hidden';
  }
  window.addEventListener('keydown', handleKeydown);
}
function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  window.removeEventListener('keydown', handleKeydown);
  if (openModalCount === 0) {
    document.body.style.overflow = '';
    modalZIndexCounter = 100;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;

  if (e.key === 'Escape') {
    if (modalZIndex.value === modalZIndexCounter) {
      close();
    }
    return;
  }

  if (e.key === 'Tab') {
    if (modalZIndex.value !== modalZIndexCounter) return;
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

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      lockBodyScroll();
      nextTick(() => {
        const focusables = getFocusableElements();
        if (focusables.length > 0) {
          focusables[0].focus();
        }
      });
    } else {
      unlockBodyScroll();
    }
  },
  { immediate: true }
);
onUnmounted(() => {
  if (props.modelValue) unlockBodyScroll();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div v-if="modelValue" class="overlay" :style="{ zIndex: modalZIndex }" @click.self="close">
        <div
          ref="modalRef"
          class="modal"
          :class="{ 'full-height': fullHeight }"
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
            <slot :close="close" />
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
</style>
