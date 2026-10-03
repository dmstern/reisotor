import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ScrollFadeOverlay from './ScrollFadeOverlay.vue';

describe('ScrollFadeOverlay', () => {
  function renderOverlay(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(ScrollFadeOverlay, props),
    });
    return renderToString(app);
  }

  it('rendert standardmäßig beide Fade-Elemente ohne is-visible Klasse', async () => {
    const html = await renderOverlay();
    expect(html).toContain('scroll-fade--top');
    expect(html).toContain('scroll-fade--bottom');
    expect(html).not.toContain('is-visible');
  });

  it('setzt is-visible auf dem oberen Element, wenn canScrollUp true ist', async () => {
    const html = await renderOverlay({ canScrollUp: true, canScrollDown: false });
    expect(html).toContain('scroll-fade--top');
    expect(html).toContain('is-visible');
    expect(html).toMatch(/<div[^>]*class="[^"]*scroll-fade--top[^"]*"[^>]*>/);
    expect(html).toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--top[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--top[^"]*is-visible[^"]*"[^>]*>/
    );
    expect(html).not.toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--bottom[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--bottom[^"]*is-visible[^"]*"[^>]*>/
    );
  });

  it('setzt is-visible auf dem unteren Element, wenn canScrollDown true ist', async () => {
    const html = await renderOverlay({ canScrollUp: false, canScrollDown: true });
    expect(html).not.toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--top[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--top[^"]*is-visible[^"]*"[^>]*>/
    );
    expect(html).toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--bottom[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--bottom[^"]*is-visible[^"]*"[^>]*>/
    );
  });

  it('setzt is-visible auf beiden Elementen, wenn beide true sind', async () => {
    const html = await renderOverlay({ canScrollUp: true, canScrollDown: true });
    expect(html).toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--top[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--top[^"]*is-visible[^"]*"[^>]*>/
    );
    expect(html).toMatch(
      /<div[^>]*class="[^"]*is-visible[^"]*scroll-fade--bottom[^"]*"[^>]*>|<div[^>]*class="[^"]*scroll-fade--bottom[^"]*is-visible[^"]*"[^>]*>/
    );
  });
});
