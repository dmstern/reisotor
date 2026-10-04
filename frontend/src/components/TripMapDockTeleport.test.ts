/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import TripMapDockTeleport from './TripMapDockTeleport.vue';

describe('TripMapDockTeleport', () => {
  it('renders content in-place when active is false', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = createApp({
      render: () =>
        h(
          TripMapDockTeleport,
          { active: false },
          { default: () => h('span', { class: 'slotted-content' }, 'dock item') }
        ),
    });
    app.mount(host);
    await nextTick();

    expect(host.querySelector('.slotted-content')?.textContent).toBe('dock item');

    app.unmount();
    host.remove();
  });

  it('teleports content to target when active is true', async () => {
    const dock = document.createElement('div');
    dock.id = 'map-focus-dock';
    document.body.appendChild(dock);

    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = createApp({
      render: () =>
        h(
          TripMapDockTeleport,
          { active: true, to: '#map-focus-dock' },
          { default: () => h('span', { class: 'slotted-content' }, 'teleported item') }
        ),
    });
    app.mount(host);
    await nextTick();

    expect(host.querySelector('.slotted-content')).toBeNull();
    expect(dock.querySelector('.slotted-content')?.textContent).toBe('teleported item');

    app.unmount();
    host.remove();
    dock.remove();
  });
});
