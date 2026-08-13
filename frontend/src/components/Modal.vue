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
import { onUnmounted, watch } from 'vue';

const props = defineProps<{ modelValue: boolean; title?: string; hideHeader?: boolean; fullHeight?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}

// Sperrt den Scroll der Hauptseite im Hintergrund, solange mindestens ein Modal offen ist - Zähler
// statt Boolean, da mehrere Modals gleichzeitig gemountet sein können (z. B. DetailModal.vue
// innerhalb einer Ansicht, die selbst schon einen Formular-Dialog offen hat); nur beim Wechsel von 0
// auf 1 (bzw. zurück auf 0) tatsächlich sperren/entsperren, damit ein zweites offenes Modal die
// Sperre des ersten nicht vorzeitig aufhebt. Modulweiter Zustand statt Pinia-Store, da Modal.vue
// ohnehin nur einmal pro App-Instanz geladen wird - anders als stores/drawers.ts' ähnliches Muster
// bewusst nicht auf Desktop/Mobile beschränkt, ein zentrierter Overlay soll auf jeder Breite jedes
// Durchscrollen des Hintergrunds verhindern.
let openModalCount = 0;
function lockBodyScroll() {
  openModalCount++;
  if (openModalCount === 1) document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) document.body.style.overflow = '';
}

watch(() => props.modelValue, (open) => (open ? lockBodyScroll() : unlockBodyScroll()), { immediate: true });
onUnmounted(() => {
  if (props.modelValue) unlockBodyScroll();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="overlay" @click.self="close">
        <div class="modal" :class="{ 'full-height': fullHeight }">
          <div class="modal-head" v-if="!hideHeader">
            <h2 v-if="title">{{ title }}</h2>
            <button class="secondary close-btn" @click="close">✕</button>
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
  transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
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
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  padding: var(--space-4);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}

/* fullHeight-Variante (siehe Prop oben): align-self:stretch überschreibt gezielt nur für dieses
   Element das align-items:center der .overlay, wodurch die Höhe automatisch auf deren Content-Box
   wächst (Viewport abzüglich .overlay's eigenem Padding) – kein eigenes vh/dvh-Kalkül nötig. */
.modal.full-height {
  align-self: stretch;
  max-height: none;
  display: flex;
  flex-direction: column;
}

.modal.full-height .modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Slot-Inhalt gehört der aufrufenden View (Notizen/Tagebuch/Spot-/Touren-/Unterkunft-/Reise-
   Formulare), braucht daher :slotted() statt einer normalen scoped-Regel. Das Formular selbst füllt
   den verfügbaren Platz, sein zentrales Notiz-/Inhalts-Textfeld (nicht die übrigen, kurzen Felder)
   den Rest davon – jede dieser Views hat genau ein solches Feld pro Formular. */
.modal.full-height .modal-body :slotted(form) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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

.close-btn {
  padding: 4px 10px;
  flex-shrink: 0;
}
</style>
