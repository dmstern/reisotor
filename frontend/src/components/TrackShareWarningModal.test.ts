// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackShareWarningModal from './TrackShareWarningModal.vue';

describe('TrackShareWarningModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mountModal(props: {
    modelValue: boolean;
    trackTitle?: string | null;
    tourTitle?: string | null;
    onConfirm?: () => void;
    onUpdate?: (v: boolean) => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const modelVal = ref(props.modelValue);

    const app = createApp({
      render: () =>
        h(TrackShareWarningModal, {
          modelValue: modelVal.value,
          trackTitle: props.trackTitle,
          tourTitle: props.tourTitle,
          'onUpdate:modelValue': (val: boolean) => {
            modelVal.value = val;
            props.onUpdate?.(val);
          },
          onConfirm: () => {
            props.onConfirm?.();
          },
        }),
    });

    app.mount(container);
    return { container, modelVal, app };
  }

  it('renders modal with warning text and titles when open', async () => {
    mountModal({
      modelValue: true,
      trackTitle: 'Morgenwanderung',
      tourTitle: 'Fjord-Erkundung',
    });
    await nextTick();

    expect(document.body.textContent).toContain('Morgenwanderung');
    expect(document.body.textContent).toContain('Fjord-Erkundung');
    expect(document.body.textContent).toContain('für alle Mitreisenden sichtbar');
  });

  it('emits confirm and closes on clicking confirm button', async () => {
    let confirmed = false;
    let closedVal = true;

    mountModal({
      modelValue: true,
      onConfirm: () => {
        confirmed = true;
      },
      onUpdate: (v) => {
        closedVal = v;
      },
    });
    await nextTick();

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.includes('Verknüpfen & Teilen'));
    expect(confirmBtn).toBeDefined();

    confirmBtn!.click();
    await nextTick();

    expect(confirmed).toBe(true);
    expect(closedVal).toBe(false);
  });

  it('emits update:modelValue(false) on clicking cancel button', async () => {
    let confirmed = false;
    let closedVal = true;

    mountModal({
      modelValue: true,
      onConfirm: () => {
        confirmed = true;
      },
      onUpdate: (v) => {
        closedVal = v;
      },
    });
    await nextTick();

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const cancelBtn = buttons.find((b) => b.textContent?.includes('Abbrechen'));
    expect(cancelBtn).toBeDefined();

    cancelBtn!.click();
    await nextTick();

    expect(confirmed).toBe(false);
    expect(closedVal).toBe(false);
  });
});
