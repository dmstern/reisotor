// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ErrorDetailModal from './ErrorDetailModal.vue';
import { useErrorNotifier } from '../composables/useErrorNotifier';
import { useToast } from '../composables/useToast';
import { ApiError } from '../api/client';

describe('ErrorDetailModal', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    useToast().clearToasts();
    useErrorNotifier().clearErrors();
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(ErrorDetailModal),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders error summary, metadata, and stacktrace when opened', async () => {
    const { notifyError, openErrorModal } = useErrorNotifier();
    const err = new ApiError(500, 'Speicherfehler auf dem Server', {
      method: 'PUT',
      path: '/diary/99',
    });
    const captured = notifyError(err, 'Tagebucheintrag speichern fehlgeschlagen');
    openErrorModal(captured!);

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).toContain('Fehlerdetails');
    expect(document.body.innerHTML).toContain(
      'Tagebucheintrag speichern fehlgeschlagen: Speicherfehler auf dem Server (HTTP 500)'
    );
    expect(document.body.innerHTML).toContain('API-Fehler (HTTP 500)');
    expect(document.body.innerHTML).toContain('PUT /diary/99');
    expect(document.body.innerHTML).toContain('Diagnose kopieren');
    expect(document.body.innerHTML).toContain('Als Bug melden');

    cleanUp();
  });

  it('copies diagnostic markdown to clipboard when clicking copy button', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { notifyError, openErrorModal } = useErrorNotifier();
    const captured = notifyError(new TypeError('Unexpected null value'));
    openErrorModal(captured!);

    const { cleanUp } = mountComponent();
    await nextTick();

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const copyBtn = buttons.find((b) => b.textContent?.includes('Diagnose kopieren'));
    expect(copyBtn).toBeTruthy();

    copyBtn!.click();
    await nextTick();

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toContain('### Fehlerdiagnose');
    expect(writeTextMock.mock.calls[0][0]).toContain('TypeError: Unexpected null value');

    cleanUp();
  });

  it('opens pre-filled FeedbackDialog when clicking Als Bug melden', async () => {
    const { notifyError, openErrorModal, isErrorModalOpen } = useErrorNotifier();
    const err = new ApiError(422, 'Ungültige Eingabe', { method: 'POST', path: '/todos' });
    const captured = notifyError(err, 'Aufgabe anlegen fehlgeschlagen');
    openErrorModal(captured!);

    const { cleanUp } = mountComponent();
    await nextTick();

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const reportBtn = buttons.find((b) => b.textContent?.includes('Als Bug melden'));
    expect(reportBtn).toBeTruthy();

    reportBtn!.click();
    await nextTick();
    await nextTick();

    expect(isErrorModalOpen.value).toBe(false);
    expect(document.body.innerHTML).toContain('Feedback geben');

    const titleInput = document.body.querySelector('input[type="text"]') as HTMLInputElement | null;
    const descTextarea = document.body.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(titleInput?.value).toContain('Aufgabe anlegen fehlgeschlagen');
    expect(descTextarea?.value).toContain('<details>');
    expect(descTextarea?.value).toContain('POST /todos');

    cleanUp();
  });
});
