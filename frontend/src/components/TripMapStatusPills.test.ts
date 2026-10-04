// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripMapStatusPills from './TripMapStatusPills.vue';

describe('TripMapStatusPills', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(
    props: {
      tileDownloadState: 'idle' | 'downloading' | 'done';
      trackRecordingError?: string | null;
      tileDownloadProgress?: { done: number; total: number };
      tileDownloadResult?: { downloaded: number; failed: number } | null;
    },
    emitListeners: {
      onDismissTrackError?: () => void;
      onDismissDownloadResult?: () => void;
    } = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TripMapStatusPills, {
          tileDownloadState: props.tileDownloadState,
          trackRecordingError: props.trackRecordingError,
          tileDownloadProgress: props.tileDownloadProgress,
          tileDownloadResult: props.tileDownloadResult,
          ...emitListeners,
        }),
    });
    app.mount(container);
    return {
      container,
      unmount: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders track recording error pill and emits dismiss-track-error on close click', async () => {
    const onDismiss = vi.fn();
    const { container, unmount } = mountComponent(
      {
        trackRecordingError: 'GPS-Fehler beim Starten',
        tileDownloadState: 'idle',
      },
      {
        onDismissTrackError: onDismiss,
      }
    );
    await nextTick();

    const pill = container.querySelector('.tile-download-pill');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('GPS-Fehler beim Starten');

    const closeBtn = pill?.querySelector<HTMLButtonElement>('button');
    closeBtn?.click();
    await nextTick();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('renders downloading progress status when downloading tiles', async () => {
    const { container, unmount } = mountComponent({
      trackRecordingError: null,
      tileDownloadState: 'downloading',
      tileDownloadProgress: { done: 12, total: 40 },
    });
    await nextTick();

    const pill = container.querySelector('.tile-download-pill');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('Lädt Kartenkacheln… 12/40');
    unmount();
  });

  it('renders done result pill and emits dismiss-download-result', async () => {
    const onDismiss = vi.fn();
    const { container, unmount } = mountComponent(
      {
        trackRecordingError: null,
        tileDownloadState: 'done',
        tileDownloadResult: { downloaded: 45, failed: 2 },
      },
      {
        onDismissDownloadResult: onDismiss,
      }
    );
    await nextTick();

    const pill = container.querySelector('.tile-download-pill');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('45 Kacheln offline gespeichert, 2 fehlgeschlagen');

    const closeBtn = pill?.querySelector<HTMLButtonElement>('button');
    closeBtn?.click();
    await nextTick();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
  });
});
