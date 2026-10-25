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
      trackRecordingError?: string | null;
    } = {},
    emitListeners: {
      onDismissTrackError?: () => void;
    } = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TripMapStatusPills, {
          trackRecordingError: props.trackRecordingError,
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
});
