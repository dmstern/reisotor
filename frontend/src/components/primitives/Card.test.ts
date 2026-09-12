/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Card from './Card.vue';

describe('Card primitive', () => {
  it('renders default card with class card', async () => {
    const app = createApp({
      render: () => h(Card, null, () => 'Card Content'),
    });
    const html = await renderToString(app);
    expect(html).toContain('class="card"');
    expect(html).toContain('Card Content');
  });

  it('renders polaroid variant with class card--polaroid', async () => {
    const app = createApp({
      render: () => h(Card, { variant: 'polaroid' }, () => 'Polaroid Content'),
    });
    const html = await renderToString(app);
    expect(html).toContain('card--polaroid');
    expect(html).toContain('Polaroid Content');
  });

  it('renders interactive card with card--interactive, role=button, and tabindex=0', async () => {
    const app = createApp({
      render: () => h(Card, { interactive: true }, () => 'Interactive Card'),
    });
    const html = await renderToString(app);
    expect(html).toContain('card--interactive');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it('renders expandable card with card--expandable and aria-expanded', async () => {
    const app = createApp({
      render: () => h(Card, { expandable: true, expanded: true }, () => 'Expanded Card'),
    });
    const html = await renderToString(app);
    expect(html).toContain('card--expandable');
    expect(html).toContain('card--expanded');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-expanded="true"');
  });
});
