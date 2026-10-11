/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import LandingCtaBand from './LandingCtaBand.vue';
import LandingSelfHosting from './LandingSelfHosting.vue';
import LandingFooter from './LandingFooter.vue';

describe('Landing auxiliary sections', () => {
  describe('LandingCtaBand', () => {
    it('renders heading, description, and demo CTA link', async () => {
      const app = createApp({
        render: () => h(LandingCtaBand, { demoUrl: 'https://demo.reisotor.app' }),
      });
      const html = await renderToString(app);

      expect(html).toContain('Neugierig geworden?');
      expect(html).toContain('https://demo.reisotor.app');
      expect(html).toContain('Jetzt Demo starten');
    });
  });

  describe('LandingSelfHosting', () => {
    it('renders heading and link to GitHub README', async () => {
      const app = createApp({
        render: () => h(LandingSelfHosting, { repoUrl: 'https://github.com/dmstern/reisotor' }),
      });
      const html = await renderToString(app);

      expect(html).toContain('Wie kommt man an Reisotor?');
      expect(html).toContain('href="https://github.com/dmstern/reisotor#readme"');
    });
  });

  describe('LandingFooter', () => {
    it('renders all navigation links and current year in copyright', async () => {
      const app = createApp({
        render: () =>
          h(LandingFooter, {
            demoUrl: '/demo',
            storybookUrl: '/storybook',
            repoUrl: 'https://github.com/dmstern/reisotor',
          }),
      });
      const html = await renderToString(app);

      expect(html).toContain('href="/demo"');
      expect(html).toContain('href="/storybook"');
      expect(html).toContain('href="https://github.com/dmstern/reisotor"');

      const year = new Date().getFullYear().toString();
      expect(html).toContain(year);
    });
  });
});
