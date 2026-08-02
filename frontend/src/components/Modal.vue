<script setup lang="ts">
// hideHeader: für DetailModal.vue, dessen Bild-Banner randlos bis ganz oben reichen soll – die
// normale .modal-head-Zeile (auch ohne title nur der Close-Button) würde dafür immer eine Lücke
// über dem Banner offen lassen, egal wie stark man das Banner selbst nach oben zieht. In dem Fall
// übernimmt der Aufrufer den Close-Button selbst (siehe DetailModal.vue).
defineProps<{ modelValue: boolean; title?: string; hideHeader?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="overlay" @click.self="close">
        <div class="modal">
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
