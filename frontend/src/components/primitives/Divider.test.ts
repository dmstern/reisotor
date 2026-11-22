// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Divider, { type DividerSpacing } from './Divider.vue';

describe('Divider primitive', () => {
  function mountDivider(props: { spacing?: DividerSpacing } = {}) {
    const app = createApp({
      render: () => h(Divider, props),
    });
    return renderToString(app);
  }

  it('renders an <hr> element with default spacing class', async () => {
    const html = await mountDivider();
    expect(html).toContain('<hr');
    expect(html).toContain('divider');
    expect(html).toContain('divider--spacing-none');
  });

  it('applies the requested spacing modifier class', async () => {
    const html = await mountDivider({ spacing: 'md' });
    expect(html).toContain('divider--spacing-md');
  });
});
