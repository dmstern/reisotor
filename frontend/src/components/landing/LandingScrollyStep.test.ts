// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { IconCalendarEvent } from '@tabler/icons-vue';
import LandingScrollyStep from './LandingScrollyStep.vue';
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

const mockFeature: ScrollyFeature = {
  id: 'dashboard',
  kicker: 'ZENTRALE REISEÜBERSICHT',
  title: 'Dashboard & Kalender',
  description: 'Zentrale Übersicht für den gesamten Urlaub.',
  highlights: ['Live-Synchronisation', 'Wettervorhersage'],
  icon: markRaw(IconCalendarEvent),
  color: 'var(--color-primary)',
  iconBg: 'rgba(0, 0, 0, 0.1)',
  screenshotLight: '/landing/screen-light.png',
  screenshotDark: '/landing/screen-dark.png',
  screenshotMobileLight: '/landing/screen-mobile-light.png',
  screenshotMobileDark: '/landing/screen-mobile-dark.png',
  alt: 'Dashboard Screenshot',
  routePill: 'Dashboard & Kalender',
};

describe('LandingScrollyStep', () => {
  async function renderComponent(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(LandingScrollyStep, props as never),
    });
    return renderToString(app);
  }

  it('renders kicker, title, description, and highlights', async () => {
    const html = await renderComponent({
      feature: mockFeature,
      index: 0,
      isActive: false,
    });

    expect(html).toContain('ZENTRALE REISEÜBERSICHT');
    expect(html).toContain('Dashboard &amp; Kalender');
    expect(html).toContain('Zentrale Übersicht für den gesamten Urlaub.');
    expect(html).toContain('Live-Synchronisation');
    expect(html).toContain('Wettervorhersage');
  });

  it('toggles is-active class on root container based on isActive prop and sets data-index', async () => {
    const htmlInactive = await renderComponent({
      feature: mockFeature,
      index: 2,
      isActive: false,
    });
    expect(htmlInactive).toContain('data-index="2"');
    expect(htmlInactive).toMatch(/class="scrolly-step"/);
    expect(htmlInactive).not.toMatch(/class="[^"]*scrolly-step[^"]*is-active/);

    const htmlActive = await renderComponent({
      feature: mockFeature,
      index: 2,
      isActive: true,
    });
    expect(htmlActive).toContain('data-index="2"');
    expect(htmlActive).toMatch(/class="[^"]*scrolly-step[^"]*is-active/);
  });

  it('progressively marks highlights with is-revealed and is-current', async () => {
    const htmlH0 = await renderComponent({
      feature: mockFeature,
      index: 0,
      isActive: true,
      activeHighlightIndex: 0,
    });
    // First highlight is revealed and current
    expect(htmlH0).toContain('is-revealed');
    expect(htmlH0).toContain('is-current');

    // Second highlight should not be revealed yet when activeHighlightIndex is 0
    expect(htmlH0).toMatch(/<li class="step-highlight-item" role="button"/);

    const htmlH1 = await renderComponent({
      feature: mockFeature,
      index: 0,
      isActive: true,
      activeHighlightIndex: 1,
    });
    // Both highlights revealed when activeHighlightIndex is 1
    expect(htmlH1).not.toMatch(/<li class="step-highlight-item" role="button"/);
  });

  it('renders the inline mobile screenshot preview', async () => {
    const html = await renderComponent({
      feature: mockFeature,
      index: 0,
      isActive: true,
    });

    expect(html).toContain('class="mobile-screenshot-preview"');
    expect(html).toContain('/landing/screen-mobile-light.png');
    expect(html).toContain('alt="Dashboard Screenshot"');
  });
});
