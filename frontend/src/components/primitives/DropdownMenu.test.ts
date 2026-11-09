// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DropdownMenu from './DropdownMenu.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

describe('DropdownMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setActivePinia(createPinia());
  });

  function mountDropdownMenu(props: any = {}, slots: any = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(DropdownMenu, props, slots),
    });
    app.use(createPinia());
    const vm = app.mount(container);
    return {
      container,
      app,
      vm,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders trigger button with label and chevron icon', () => {
    const { container, cleanUp } = mountDropdownMenu({
      label: 'Filter wählen',
      icon: ACTION_ICONS.filter,
    });

    const button = container.querySelector('button.dropdown__button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Filter wählen');
    expect(container.querySelector('.dropdown__caret')).not.toBeNull();

    cleanUp();
  });

  it('emits toggle event when trigger button is clicked', async () => {
    let toggled = false;
    const { container, cleanUp } = mountDropdownMenu({
      label: 'Optionen',
      onToggle: () => {
        toggled = true;
      },
    });

    const button = container.querySelector<HTMLButtonElement>('button.dropdown__button')!;
    button.click();
    await nextTick();

    expect(toggled).toBe(true);

    cleanUp();
  });

  it('teleports menu content to document.body on top level when open (issue #722)', async () => {
    const { container, cleanUp } = mountDropdownMenu(
      {
        label: 'Aktionen',
        open: true,
      },
      {
        default: () => h('div', { class: 'custom-menu-content' }, 'Menüinhalt'),
      }
    );

    const menuInContainer = container.querySelector('.custom-menu-content');
    const menuInBody = document.body.querySelector('.custom-menu-content');
    const portal = document.body.querySelector('.dropdown__portal');

    expect(menuInContainer).toBeNull();
    expect(menuInBody).not.toBeNull();
    expect(portal).not.toBeNull();
    expect(portal?.classList.contains('is-teleported')).toBe(true);

    cleanUp();
  });

  it('renders menu in place when teleport is explicitly disabled', async () => {
    const { container, cleanUp } = mountDropdownMenu(
      {
        label: 'Aktionen',
        open: true,
        teleport: false,
      },
      {
        default: () => h('div', { class: 'custom-menu-content' }, 'Menüinhalt'),
      }
    );

    const menuInContainer = container.querySelector('.custom-menu-content');
    expect(menuInContainer).not.toBeNull();

    cleanUp();
  });
});
