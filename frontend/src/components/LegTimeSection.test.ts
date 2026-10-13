// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegTimeSection from './LegTimeSection.vue';

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('LegTimeSection', () => {
  it('renders departure and arrival time inputs with dynamic departure label', async () => {
    const { cleanUp } = mountTestApp(LegTimeSection, {
      departureTime: '10:00',
      arrivalTime: '11:30',
      departureLabel: 'Abfahrt',
      isTimeLinked: true,
      canToggleLink: true,
      timeLinkTitle: 'Zeiten koppeln',
    });
    await nextTick();

    const depInput = document.querySelector('.departure-time-wrapper input') as HTMLInputElement;
    const arrInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;

    expect(depInput).not.toBeNull();
    expect(depInput.value).toBe('10:00');
    expect(arrInput).not.toBeNull();
    expect(arrInput.value).toBe('11:30');

    cleanUp();
  });

  it('emits toggleTimeLink when connector button is clicked', async () => {
    let toggled = false;
    const { cleanUp } = mountTestApp(LegTimeSection, {
      departureTime: '10:00',
      arrivalTime: '11:00',
      departureLabel: 'Abfahrt',
      isTimeLinked: true,
      canToggleLink: true,
      timeLinkTitle: 'Zeiten entkoppeln',
      onToggleTimeLink: () => {
        toggled = true;
      },
    });
    await nextTick();

    const linkBtn = document.querySelector('[data-testid="time-link-toggle"]') as HTMLButtonElement;
    expect(linkBtn).not.toBeNull();
    linkBtn.click();
    await nextTick();

    expect(toggled).toBe(true);

    cleanUp();
  });

  it('renders discrete duration chip when timeDurationInfo is provided', async () => {
    const { cleanUp } = mountTestApp(LegTimeSection, {
      departureTime: '10:00',
      arrivalTime: '11:00',
      departureLabel: 'Abfahrt',
      isTimeLinked: true,
      canToggleLink: true,
      timeLinkTitle: 'Zeiten entkoppeln',
      timeDurationInfo: { label: 'Reisedauer', duration: '1 Std.' },
    });
    await nextTick();

    const chip = document.querySelector('[data-testid="time-duration-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain('Reisedauer:');
    expect(chip?.textContent).toContain('1 Std.');

    cleanUp();
  });

  it('renders mismatch alert with sync button when times diverge from duration', async () => {
    let syncClicked = false;
    const { cleanUp } = mountTestApp(LegTimeSection, {
      departureTime: '10:00',
      arrivalTime: '11:00',
      departureLabel: 'Abfahrt',
      isTimeLinked: false,
      canToggleLink: true,
      timeLinkTitle: 'Zeiten koppeln',
      activeDurationSeconds: 1800, // 30 Min
      timeDurationStatus: {
        type: 'mismatch',
        text: 'Abweichung',
        canToggleLink: true,
        elapsedMinutes: 60,
        diffMinutes: 30,
      },
      onSyncTimes: () => {
        syncClicked = true;
      },
    });
    await nextTick();

    const alert = document.querySelector('[data-testid="time-sync-bar"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Zeitfenster:');
    expect(alert?.textContent).toContain('+30 Min. Puffer');

    const adaptBtn = alert?.querySelector('button');
    expect(adaptBtn?.textContent).toContain('Anpassen');
    adaptBtn?.click();
    await nextTick();

    expect(syncClicked).toBe(true);

    cleanUp();
  });

  it('renders suggestion alert with apply button when only one time field is filled', async () => {
    let appliedField = '';
    let appliedTarget = '';
    const { cleanUp } = mountTestApp(LegTimeSection, {
      departureTime: '10:00',
      arrivalTime: '',
      departureLabel: 'Abfahrt',
      isTimeLinked: false,
      canToggleLink: true,
      timeLinkTitle: 'Zeiten koppeln',
      activeDurationSeconds: 1800,
      timeDurationStatus: {
        type: 'suggest',
        field: 'arrival',
        target: '10:30',
        text: 'Ankunftszeit auf 10:30 setzen (30 Min. Fahrzeit)?',
      },
      onApplySuggestedTime: (field: string, target: string) => {
        appliedField = field;
        appliedTarget = target;
      },
    });
    await nextTick();

    const applyBtn = document.querySelector('[data-testid="time-apply-btn"]') as HTMLButtonElement;
    expect(applyBtn).not.toBeNull();
    expect(applyBtn.textContent).toContain('Übernehmen');
    applyBtn.click();
    await nextTick();

    expect(appliedField).toBe('arrival');
    expect(appliedTarget).toBe('10:30');

    cleanUp();
  });
});
