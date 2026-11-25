// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DropdownMenuItem from './DropdownMenuItem.vue';

describe('DropdownMenuItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
  });

  it('renders button mode with label, trailing slot, and click event', async () => {
    let clicked = false;
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(
          DropdownMenuItem,
          {
            label: 'Spot A',
            onClick: () => {
              clicked = true;
            },
          },
          {
            trailing: () => h('span', { class: 'test-trailing' }, '2×'),
          }
        ),
    });
    app.use(createPinia());
    app.mount(container);
    await nextTick();

    const button = container.querySelector('button.dropdown-item') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Spot A');
    expect(button?.querySelector('.test-trailing')?.textContent).toBe('2×');

    button?.click();
    await nextTick();
    expect(clicked).toBe(true);
    app.unmount();
  });

  it('renders multiselect mode with inputId, active state, subtitle, trailing slot, and emits update:checked', async () => {
    let latestChecked: boolean | null = null;
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(
          DropdownMenuItem,
          {
            multiselect: true,
            inputId: 'custom-track-1',
            label: 'GPS-Track 1',
            checked: true,
            active: true,
            'onUpdate:checked': (val: boolean) => {
              latestChecked = val;
            },
          },
          {
            subtitle: () => h('span', { class: 'test-subtitle' }, '12.06.2026 · 1h 20m'),
            trailing: () => h('span', { class: 'test-badge' }, 'Privat'),
          }
        ),
    });
    app.use(createPinia());
    app.mount(container);
    await nextTick();

    const label = container.querySelector(
      'label.dropdown-item--multiselect'
    ) as HTMLLabelElement | null;
    expect(label).not.toBeNull();
    expect(label?.getAttribute('for')).toBe('custom-track-1');
    expect(label?.classList.contains('is-active')).toBe(true);
    expect(label?.querySelector('.dropdown-item-label')?.textContent).toContain('GPS-Track 1');
    expect(label?.querySelector('.test-subtitle')?.textContent).toBe('12.06.2026 · 1h 20m');
    expect(label?.querySelector('.test-badge')?.textContent).toBe('Privat');

    const checkbox = container.querySelector('#custom-track-1') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);

    checkbox!.checked = false;
    checkbox!.dispatchEvent(new Event('change'));
    await nextTick();

    expect(latestChecked).toBe(false);
    app.unmount();
  });
});
