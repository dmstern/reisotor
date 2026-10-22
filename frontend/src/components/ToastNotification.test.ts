// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ToastNotification from './ToastNotification.vue';
import { useToast } from '../composables/useToast';
import { useTripStore } from '../stores/trip';

describe('ToastNotification', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/trash', component: { template: '<div>Legacy Trash</div>' } },
        { path: '/trip/:tripId/trash', component: { template: '<div>Trip Trash</div>' } },
      ],
    });

    await router.push('/');
    await router.isReady();

    useToast().clearToasts();

    container = document.createElement('div');
    document.body.appendChild(container);

    app = createApp(ToastNotification);
    app.use(pinia);
    app.use(router);
    app.mount(container);
  });

  afterEach(() => {
    app.unmount();
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders standard toast message without router links when Papierkorb is not present', async () => {
    const { showToast } = useToast();
    showToast({ message: 'Änderungen gespeichert!', type: 'success' });
    await nextTick();

    const toastItem = document.querySelector('.toast-item');
    expect(toastItem).not.toBeNull();
    expect(toastItem?.textContent).toContain('Änderungen gespeichert!');
    const link = toastItem?.querySelector('a.toast-inline-link');
    expect(link).toBeNull();
  });

  it('renders Papierkorb as RouterLink to /trip/:tripId/trash when currentTripId is set', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 42;

    const { showToast } = useToast();
    showToast({
      message: 'Termin gelöscht. Er befindet sich nun im Papierkorb.',
      type: 'info',
    });
    await nextTick();

    const toastItem = document.querySelector('.toast-item');
    expect(toastItem).not.toBeNull();

    const link = toastItem?.querySelector('a.toast-inline-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent?.trim()).toBe('Papierkorb');
    expect(link.getAttribute('href')).toBe('/trip/42/trash');
  });

  it('renders Papierkorb as RouterLink to /trash when currentTripId is null', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = null;

    const { showToast } = useToast();
    showToast({
      message: 'Element gelöscht. Es befindet sich nun im Papierkorb.',
      type: 'info',
    });
    await nextTick();

    const toastItem = document.querySelector('.toast-item');
    const link = toastItem?.querySelector('a.toast-inline-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/trash');
  });

  it('removes toast when clicking the Papierkorb link', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 12;

    const { showToast, toasts } = useToast();
    showToast({
      message: 'Aufgabe gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
    });
    await nextTick();

    expect(toasts.value.length).toBe(1);

    const link = document.querySelector('a.toast-inline-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    link.click();
    await nextTick();

    expect(toasts.value.length).toBe(0);
  });

  it('removes toast when clicking the close button', async () => {
    const { showToast, toasts } = useToast();
    showToast({ message: 'Kurze Info', type: 'info' });
    await nextTick();

    expect(toasts.value.length).toBe(1);
    const closeBtn = document.querySelector('button.toast-close') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    expect(toasts.value.length).toBe(0);
  });

  it('supports action callback when provided', async () => {
    const onClick = vi.fn();
    const { showToast, toasts } = useToast();
    showToast({
      message: 'Etwas ist schiefgelaufen',
      type: 'error',
      action: {
        label: 'Erneut versuchen',
        onClick,
      },
    });
    await nextTick();

    const actionBtn = document.querySelector('button.toast-action-btn') as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.textContent?.trim()).toBe('Erneut versuchen');

    actionBtn.click();
    await nextTick();

    expect(onClick).toHaveBeenCalled();
    expect(toasts.value.length).toBe(0);
  });

  it('renders Wiederherstellen button when onRestore is provided and calls it on click', async () => {
    const onRestore = vi.fn();
    const { showToast, toasts } = useToast();
    showToast({
      message: 'Aufgabe gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
      onRestore,
    });
    await nextTick();

    const actionBtn = document.querySelector('button.toast-action-btn') as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.textContent?.trim()).toBe('Wiederherstellen');

    actionBtn.click();
    await nextTick();

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(toasts.value.length).toBe(0);
  });

  it('supports async onRestore callback and removes toast upon completion', async () => {
    let resolved = false;
    const onRestore = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      resolved = true;
    });
    const { showToast, toasts } = useToast();
    showToast({
      message: 'Ort gelöscht. Er befindet sich nun im Papierkorb.',
      type: 'info',
      onRestore,
    });
    await nextTick();

    const actionBtn = document.querySelector('button.toast-action-btn') as HTMLButtonElement;
    actionBtn.click();
    await nextTick();

    await new Promise((r) => setTimeout(r, 20));
    await nextTick();

    expect(resolved).toBe(true);
    expect(toasts.value.length).toBe(0);
  });
});
