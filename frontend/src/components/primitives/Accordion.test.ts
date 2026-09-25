/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Accordion from './Accordion.vue';

function createTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  slots?: Record<string, unknown>
) {
  const app = createApp({
    render: () => h(rootComponent, props, slots),
  });
  return app;
}

describe('Accordion primitive', () => {
  it('renders collapsed by default with inert attribute', async () => {
    const app = createTestApp(
      Accordion,
      {},
      {
        default: () => h('div', 'Accordion content'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('class="accordion"');
    expect(html).not.toContain('is-expanded');
    expect(html).toContain('inert');
    expect(html).toContain('class="accordion-inner"');
    expect(html).toContain('Accordion content');
  });

  it('renders expanded when expanded prop is true without inert attribute', async () => {
    const app = createTestApp(
      Accordion,
      { expanded: true },
      {
        default: () => h('div', 'Expanded content'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('accordion is-expanded');
    expect(html).not.toContain('inert');
    expect(html).toContain('Expanded content');
  });

  it('omits inert when inertWhenClosed is false on collapsed accordion', async () => {
    const app = createTestApp(
      Accordion,
      { expanded: false, inertWhenClosed: false },
      {
        default: () => h('div', 'Focusable content'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('class="accordion"');
    expect(html).not.toContain('is-expanded');
    expect(html).not.toContain('inert');
  });

  it('applies accordion-stagger class when stagger is true', async () => {
    const app = createTestApp(
      Accordion,
      { stagger: true },
      {
        default: () => h('div', 'Stagger item'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('accordion-stagger');
    expect(html).toContain('accordion-inner');
  });

  it('supports nesting an accordion inside an expanded accordion without leaking is-expanded state', async () => {
    const nestedApp = createApp({
      render: () =>
        h(
          Accordion,
          { expanded: true },
          {
            default: () => [
              h('p', 'Outer Content'),
              h(
                Accordion,
                { expanded: false },
                {
                  default: () => h('p', 'Nested Content'),
                }
              ),
            ],
          }
        ),
    });

    const html = await renderToString(nestedApp);
    // Outer is expanded
    expect(html).toContain('accordion is-expanded');
    // Nested is collapsed
    expect(html).toContain('class="accordion" inert');
    expect(html).toContain('Outer Content');
    expect(html).toContain('Nested Content');
  });
});
