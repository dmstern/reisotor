// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { IconCalendarEvent, IconCoin } from '@tabler/icons-vue';
import LandingScrollyShowcase from './LandingScrollyShowcase.vue';
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

const mockFeatures: ScrollyFeature[] = [
  {
    id: 'dashboard',
    kicker: 'DASHBOARD',
    title: 'Dashboard',
    description: 'Desc 1',
    highlights: ['Point 1'],
    icon: markRaw(IconCalendarEvent),
    color: '#0070f3',
    iconBg: 'rgba(0, 112, 243, 0.1)',
    screenshotLight: '/screen-1-light.png',
    screenshotDark: '/screen-1-dark.png',
    screenshotMobileLight: '/screen-1-m-light.png',
    screenshotMobileDark: '/screen-1-m-dark.png',
    alt: 'Screen 1',
    routePill: 'Dashboard & Kalender',
  },
  {
    id: 'budget',
    kicker: 'BUDGET',
    title: 'Budget',
    description: 'Desc 2',
    highlights: ['Point 2'],
    icon: markRaw(IconCoin),
    color: '#10b981',
    iconBg: 'rgba(16, 185, 129, 0.1)',
    screenshotLight: '/screen-2-light.png',
    screenshotDark: '/screen-2-dark.png',
    screenshotMobileLight: '/screen-2-m-light.png',
    screenshotMobileDark: '/screen-2-m-dark.png',
    alt: 'Screen 2',
    routePill: 'Budget & Finanzen',
  },
];

describe('LandingScrollyShowcase', () => {
  async function renderComponent(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(LandingScrollyShowcase, props as never),
    });
    return renderToString(app);
  }

  it('renders browser mockup chrome with active route domain and tag', async () => {
    const html = await renderComponent({
      features: mockFeatures,
      activeIndex: 1,
      glowOpacities: [0, 1],
    });

    expect(html).toContain('reisotor.app/budget');
    expect(html).toContain('Budget &amp; Finanzen');
  });

  it('marks screenshot frames with is-active, is-prev, and is-next appropriately', async () => {
    const html = await renderComponent({
      features: mockFeatures,
      activeIndex: 0,
      glowOpacities: [1, 0],
    });

    expect(html).toContain('is-active');
    expect(html).toContain('is-next');
  });

  it('renders mobile device mockup with overlaid screenshot frames', async () => {
    const html = await renderComponent({
      features: mockFeatures,
      activeIndex: 1,
      glowOpacities: [0, 1],
    });

    expect(html).toContain('class="mobile-device-mockup"');
    expect(html).toContain('/screen-2-m-light.png');
  });
});
