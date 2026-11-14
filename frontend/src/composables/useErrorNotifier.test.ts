// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError, rawRequest } from '../api/client';
import {
  useErrorNotifier,
  formatDiagnosticMarkdown,
  createCapturedError,
} from './useErrorNotifier';
import { useToast } from './useToast';
import { useBuildInfoStore } from '../stores/buildInfo';

describe('useErrorNotifier', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const { clearToasts } = useToast();
    clearToasts();
    const { clearErrors } = useErrorNotifier();
    clearErrors();
  });

  it('normalizes an ApiError with method and path and triggers an error toast with action', () => {
    const { notifyError, recentErrors, isErrorModalOpen, activeError } = useErrorNotifier();
    const { toasts } = useToast();

    const err = new ApiError(500, 'Datenbank-Fehler', {
      method: 'PUT',
      path: '/diary/42',
    });

    const captured = notifyError(err, 'Tagebucheintrag konnte nicht gespeichert werden');

    expect(captured).not.toBeNull();
    expect(captured?.kind).toBe('api');
    expect(captured?.status).toBe(500);
    expect(captured?.method).toBe('PUT');
    expect(captured?.path).toBe('/diary/42');
    expect(captured?.summary).toBe(
      'Tagebucheintrag konnte nicht gespeichert werden: Datenbank-Fehler (HTTP 500)'
    );
    expect(recentErrors.value).toHaveLength(1);

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].type).toBe('error');
    expect(toasts.value[0].duration).toBeGreaterThanOrEqual(8000);
    expect(toasts.value[0].action?.label).toBe('Details anzeigen');

    // Triggering toast action opens the ErrorDetailModal
    if (toasts.value[0].action && 'onClick' in toasts.value[0].action) {
      toasts.value[0].action.onClick?.();
    }

    expect(isErrorModalOpen.value).toBe(true);
    expect(activeError.value?.id).toBe(captured?.id);
  });

  it('ignores AbortError, HTTP 401, and HTTP 0 (offline cache miss)', () => {
    const { notifyError, recentErrors } = useErrorNotifier();
    const { toasts } = useToast();

    const abortErr = new DOMException('The user aborted a request.', 'AbortError');
    const authErr = new ApiError(401, 'Unauthorized', { method: 'GET', path: '/todos' });
    const offlineCacheMiss = new ApiError(0, 'Offline', { method: 'GET', path: '/todos' });

    expect(notifyError(abortErr)).toBeNull();
    expect(notifyError(authErr)).toBeNull();
    expect(notifyError(offlineCacheMiss)).toBeNull();

    expect(recentErrors.value).toHaveLength(0);
    expect(toasts.value).toHaveLength(0);
  });

  it('marks an error as handled so a subsequent rethrow does not trigger a duplicate toast', () => {
    const { notifyError } = useErrorNotifier();
    const { toasts } = useToast();

    const err = new TypeError('Cannot read properties of null');
    const first = notifyError(err, 'Speichern fehlgeschlagen');
    const second = notifyError(err);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(toasts.value).toHaveLength(1);
  });

  it('deduplicates identical errors within 2000ms flood window', () => {
    vi.useFakeTimers();

    try {
      const { notifyError, recentErrors } = useErrorNotifier();
      const { toasts } = useToast();

      const err1 = new ApiError(502, 'Bad Gateway', { method: 'GET', path: '/spots' });
      const err2 = new ApiError(502, 'Bad Gateway', { method: 'GET', path: '/spots' });

      expect(notifyError(err1)).not.toBeNull();
      expect(notifyError(err2)).toBeNull();
      expect(toasts.value).toHaveLength(1);
      expect(recentErrors.value).toHaveLength(1);

      vi.advanceTimersByTime(2500);
      const err3 = new ApiError(502, 'Bad Gateway', { method: 'GET', path: '/spots' });
      expect(notifyError(err3)).not.toBeNull();
      expect(recentErrors.value).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('formats diagnostic markdown with metadata and stacktrace', () => {
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.12.0',
      ref: 'abcdef123456',
      builtAt: '2026-10-18T12:00:00Z',
      changelog: null,
      repoUrl: '',
      hostingLocation: '',
      environment: 'production',
    };

    const { notifyOutboxRejected } = useErrorNotifier();
    const err = new ApiError(400, 'Ungültiges Datum', { method: 'POST', path: '/schedule' });
    const captured = notifyOutboxRejected(
      {
        id: 'outbox-1',
        method: 'POST',
        path: '/schedule',
        body: { title: 'Test' },
        createdAt: '2026-10-18T12:00:00Z',
      },
      err
    );

    expect(captured).not.toBeNull();
    expect(captured?.kind).toBe('sync');
    expect(captured?.summary).toContain('Offline-Änderung vom Server abgelehnt');

    const md = formatDiagnosticMarkdown(captured!);
    expect(md).toContain('### Fehlerdiagnose');
    expect(md).toContain('Offline-Sync-Konflikt (HTTP 400)');
    expect(md).toContain('`POST /schedule`');
    expect(md).toContain('v1.12.0 (abcdef1)');
  });

  it('notifies on outbox failure with 500 error', () => {
    const { notifyOutboxFailed } = useErrorNotifier();
    const err = new ApiError(500, 'Internal Server Error', { method: 'POST', path: '/budget' });
    const captured = notifyOutboxFailed(
      {
        id: 'outbox-2',
        method: 'POST',
        path: '/budget',
        body: { amount: 50 },
        createdAt: '2026-10-18T12:00:00Z',
      },
      err
    );

    expect(captured).not.toBeNull();
    expect(captured?.kind).toBe('sync');
    expect(captured?.summary).toContain('Synchronisierung fehlgeschlagen');
    expect(captured?.status).toBe(500);
  });

  it('includes ApiError data details in diagnostic stack output', () => {
    const err = new ApiError(404, 'Keine Route', {
      method: 'POST',
      path: '/trips/1/routes/directions',
      data: { details: 'OpenRouteService HTTP 404: code 2010' },
    });

    const captured = createCapturedError(err, 'Routenberechnung');

    expect(captured.stack).toContain('Response Details:');
    expect(captured.stack).toContain('OpenRouteService HTTP 404: code 2010');
  });

  it('enriches string-based openErrorModal calls with recent rawRequest ApiError metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Upstream quota exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(
        rawRequest('/trips/1/routes/directions', { method: 'POST', body: '{}' })
      ).rejects.toThrow('Upstream quota exceeded');

      const { openErrorModal, activeError, isErrorModalOpen } = useErrorNotifier();
      openErrorModal('Routenberechnung fehlgeschlagen', { context: 'Routenberechnung' });

      expect(isErrorModalOpen.value).toBe(true);
      expect(activeError.value?.kind).toBe('api');
      expect(activeError.value?.status).toBe(429);
      expect(activeError.value?.method).toBe('POST');
      expect(activeError.value?.path).toBe('/trips/1/routes/directions');
      expect(activeError.value?.summary).toContain(
        'Routenberechnung: Routenberechnung fehlgeschlagen'
      );
      expect(activeError.value?.summary).toContain('(HTTP 429)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens FeedbackDialog state directly via openErrorFeedback', () => {
    const { openErrorFeedback, isFeedbackModalOpen, isErrorModalOpen, activeError } =
      useErrorNotifier();

    openErrorFeedback(new Error('Verbindung unterbrochen'), 'Wetterdaten laden');

    expect(isErrorModalOpen.value).toBe(false);
    expect(isFeedbackModalOpen.value).toBe(true);
    expect(activeError.value?.summary).toContain('Wetterdaten laden');
  });
});
