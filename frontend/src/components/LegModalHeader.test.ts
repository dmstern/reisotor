// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegModalHeader from './LegModalHeader.vue';
import type { Spot } from '../api/types';

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

describe('LegModalHeader', () => {
  it('renders start and destination spot titles with category icons and arrow', async () => {
    const fromSpot = { id: 1, title: 'Berlin Hbf', category: 'Bahnhof' } as Spot;
    const toSpot = { id: 2, title: 'München Hbf', category: 'Bahnhof' } as Spot;

    const { cleanUp } = mountTestApp(LegModalHeader, {
      fromSpot,
      toSpot,
    });
    await nextTick();

    const titleEl = document.querySelector('.leg-modal-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toContain('Teilstrecke:');
    expect(titleEl?.textContent).toContain('Berlin Hbf');
    expect(titleEl?.textContent).toContain('München Hbf');
    expect(titleEl?.textContent).toContain('→');

    const icons = titleEl?.querySelectorAll('.app-icon');
    expect(icons?.length).toBe(2);

    cleanUp();
  });

  it('renders default fallback labels when spots are null or undefined', async () => {
    const { cleanUp } = mountTestApp(LegModalHeader, {
      fromSpot: null,
      toSpot: null,
    });
    await nextTick();

    const titleEl = document.querySelector('.leg-modal-title');
    expect(titleEl?.textContent).toContain('Start');
    expect(titleEl?.textContent).toContain('Ziel');
    expect(titleEl?.querySelectorAll('.app-icon').length).toBe(0);

    cleanUp();
  });
});
