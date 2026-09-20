import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Card from './Card.vue';

describe('Card primitive', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function renderCard(props: Record<string, unknown> | null, content = 'Card Content') {
    const app = createApp({
      render: () => h(Card, props, () => content),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders default card with class card', async () => {
    const html = await renderCard(null, 'Card Content');
    expect(html).toContain('class="card"');
    expect(html).toContain('Card Content');
  });

  it('renders polaroid variant with class card--polaroid', async () => {
    const html = await renderCard({ variant: 'polaroid' }, 'Polaroid Content');
    expect(html).toContain('card--polaroid');
    expect(html).toContain('Polaroid Content');
  });

  it('renders interactive card with card--interactive, role=button, and tabindex=0', async () => {
    const html = await renderCard({ interactive: true }, 'Interactive Card');
    expect(html).toContain('card--interactive');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it('renders expandable card with card--expandable and aria-expanded', async () => {
    const html = await renderCard({ expandable: true, expanded: true }, 'Expanded Card');
    expect(html).toContain('card--expandable');
    expect(html).toContain('card--expanded');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders mapFocused card with is-map-focused class', async () => {
    const html = await renderCard({ mapFocused: true }, 'Focused Card');
    expect(html).toContain('is-map-focused');
    expect(html).toContain('Focused Card');
  });

  it('renders highlight card with new-highlight class and card-sparkle-badge', async () => {
    const html = await renderCard({ highlight: true }, 'Highlighted Card');
    expect(html).toContain('new-highlight');
    expect(html).toContain('card-sparkle-badge');
    expect(html).toContain('Highlighted Card');
  });

  it('renders card-sparkle-badge when new-highlight class is passed directly', async () => {
    const html = await renderCard({ class: 'custom-card new-highlight' }, 'Highlighted Card');
    expect(html).toContain('new-highlight');
    expect(html).toContain('card-sparkle-badge');
  });
});
