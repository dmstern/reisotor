import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useModalStore = defineStore('modal', () => {
  const activeStack = ref<string[]>([]);
  let zIndexCounter = 100;
  const zIndices = ref<Record<string, number>>({});

  function register(id: string): number {
    zIndexCounter += 10;
    zIndices.value[id] = zIndexCounter;
    activeStack.value.push(id);
    updateBodyScroll();
    return zIndexCounter;
  }

  function unregister(id: string) {
    delete zIndices.value[id];
    const idx = activeStack.value.indexOf(id);
    if (idx !== -1) {
      activeStack.value.splice(idx, 1);
    }
    if (activeStack.value.length === 0) {
      zIndexCounter = 100;
    }
    updateBodyScroll();
  }

  function updateBodyScroll() {
    if (typeof document === 'undefined') return;
    if (activeStack.value.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  function isTop(id: string): boolean {
    return activeStack.value.length > 0 && activeStack.value[activeStack.value.length - 1] === id;
  }

  function getZIndex(id: string): number {
    return zIndices.value[id] ?? 100;
  }

  return {
    activeStack,
    zIndices,
    register,
    unregister,
    isTop,
    getZIndex,
  };
});
