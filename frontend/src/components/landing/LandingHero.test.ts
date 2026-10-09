// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import LandingHero from './LandingHero.vue';

describe('LandingHero', () => {
  async function renderComponent(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(LandingHero, props as never),
    });
    return renderToString(app);
  }

  it('renders title, tagline, and action links correctly', async () => {
    const html = await renderComponent({
      demoUrl: 'https://demo.reisotor.app',
      repoUrl: 'https://github.com/dmstern/reisotor',
    });

    expect(html).toContain('Reisotor');
    expect(html).toContain('Euren Urlaub gemeinsam planen');
    expect(html).toContain('https://demo.reisotor.app');
    expect(html).toContain('Demo ausprobieren');
    expect(html).toContain('https://github.com/dmstern/reisotor');
    expect(html).toContain('GitHub');
  });

  it('renders the robot container', async () => {
    const html = await renderComponent({
      demoUrl: '/demo',
      repoUrl: 'https://github.com/dmstern/reisotor',
    });

    expect(html).toContain('class="hero-robot"');
  });
});
