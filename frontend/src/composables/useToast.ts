import { ref, readonly } from 'vue';
import { useUiSettingsStore } from '../stores/uiSettings';

export type ToastAction =
  | {
      label: string;
      to: string | object;
      onClick?: () => void | Promise<void>;
    }
  | {
      label: string;
      onClick: () => void | Promise<void>;
      to?: undefined;
    };

export interface ToastOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  action?: ToastAction;
  onRestore?: () => void | Promise<void>;
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
  action?: ToastAction;
}

const toasts = ref<ToastItem[]>([]);
let nextId = 1;

export function useToast() {
  function showToast(options: ToastOptions | string) {
    const uiSettingsStore = useUiSettingsStore();
    const defaultDuration = (uiSettingsStore.toastTimeout ?? 5) * 1000;

    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const type = opts.type ?? 'info';
    const rawDuration = opts.duration ?? defaultDuration;
    const duration =
      type === 'error' && rawDuration > 0 ? Math.max(rawDuration, 8000) : rawDuration;
    const action =
      opts.action ??
      (opts.onRestore
        ? {
            label: 'Wiederherstellen',
            onClick: opts.onRestore,
          }
        : undefined);
    const id = nextId++;
    const item: ToastItem = {
      id,
      message: opts.message,
      type,
      duration,
      action,
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
