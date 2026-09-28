// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */
import { describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import InfoPopover from './InfoPopover.vue';

describe('InfoPopover', () => {
  it('renders info button with title and aria-label via SSR', async () => {
    const pinia = createPinia();
    const app = createApp({
      render: () =>
        h(
          InfoPopover,
          {
            title: 'Erklärung zum Bereich',
            ariaLabel: 'Hilfe zum Bereich',
          },
          () => h('p', 'Hilfetext')
        ),
    });
    app.use(pinia);

    const html = await renderToString(app);
    expect(html).toContain('class="info-popover-btn"');
    expect(html).toContain('title="Erklärung zum Bereich"');
    expect(html).toContain('aria-label="Hilfe zum Bereich"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('toggles open state and renders popover content in DOM', async () => {
    const pinia = createPinia();
    const popoverRef = ref<InstanceType<typeof InfoPopover> | null>(null);
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(
          InfoPopover,
          {
            ref: popoverRef,
            title: 'Hilfe',
          },
          () => h('p', { class: 'test-content' }, 'Hilfetext für Spots')
        ),
    });
    app.use(pinia);
    app.mount(container);

    const btn = container.querySelector('.info-popover-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    // Klick zum Öffnen
    btn.click();
    await nextTick();

    expect(popoverRef.value?.open).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    const content = document.body.querySelector('.test-content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('Hilfetext für Spots');

    // Schließen
    popoverRef.value?.close();
    await nextTick();

    expect(popoverRef.value?.open).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    app.unmount();
    container.remove();
  });
});
