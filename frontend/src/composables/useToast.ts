import { ref, readonly } from 'vue';
import { useUiSettingsStore } from '../stores/uiSettings';

export interface ToastOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

const toasts = ref<ToastItem[]>([]);
let nextId = 1;

export function useToast() {
  function showToast(options: ToastOptions | string) {
    const uiSettingsStore = useUiSettingsStore();
    const defaultDuration = (uiSettingsStore.toastTimeout ?? 5) * 1000;

    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const id = nextId++;
    const item: ToastItem = {
      id,
      message: opts.message,
      type: opts.type ?? 'info',
      duration: opts.duration ?? defaultDuration,
    };

    toasts.value.push(item);

    if (item.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, item.duration);
    }
    return id;
  }

  function removeToast(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  function clearToasts() {
    toasts.value = [];
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    clearToasts,
  };
}
