/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import DockTeleport from './DockTeleport.vue';

describe('DockTeleport primitive', () => {
  it('renders content in-place when active is false', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = createApp({
      render: () =>
        h(
          DockTeleport,
          { active: false, to: '#custom-dock' },
          { default: () => h('span', { class: 'slotted-content' }, 'dock item') }
        ),
    });
    app.mount(host);
    await nextTick();

    expect(host.querySelector('.slotted-content')?.textContent).toBe('dock item');

    app.unmount();
    host.remove();
  });

  it('teleports content to target container when active is true', async () => {
    const dock = document.createElement('div');
    dock.id = 'custom-dock';
    document.body.appendChild(dock);

    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = createApp({
      render: () =>
        h(
          DockTeleport,
          { active: true, to: '#custom-dock' },
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
