// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { IconCalendarEvent, IconPigMoney } from '@tabler/icons-vue';
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
    icon: markRaw(IconPigMoney),
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

  it('updates route pill and active screenshot frame when activeHighlightIndex changes', async () => {
    const featureWithHighlight: ScrollyFeature = {
      ...mockFeatures[0],
      highlights: [
        {
          text: 'Base feature',
          screenshotLight: '/base-light.png',
          screenshotDark: '/base-dark.png',
          screenshotMobileLight: '/base-m-light.png',
          screenshotMobileDark: '/base-m-dark.png',
          routePill: 'Base Pill',
        },
        {
          text: 'Granular feature',
          screenshotLight: '/granular-light.png',
          screenshotDark: '/granular-dark.png',
          screenshotMobileLight: '/granular-m-light.png',
          screenshotMobileDark: '/granular-m-dark.png',
          routePill: 'Granular Pill',
        },
      ],
    };

    const htmlH0 = await renderComponent({
      features: [featureWithHighlight],
      activeStepIndex: 0,
      activeHighlightIndex: 0,
      glowOpacities: [1],
    });
    expect(htmlH0).toContain('Base Pill');
    expect(htmlH0).toContain('/base-light.png');

    const htmlH1 = await renderComponent({
      features: [featureWithHighlight],
      activeStepIndex: 0,
      activeHighlightIndex: 1,
      glowOpacities: [1],
    });
    expect(htmlH1).toContain('Granular Pill');
    expect(htmlH1).toContain('/granular-light.png');
  });

  it('does not swap or duplicate frames when consecutive highlights share the same screenshot', async () => {
    const featureWithShared: ScrollyFeature = {
      ...mockFeatures[0],
      highlights: [
        {
          text: 'Calendar point',
          screenshotLight: '/calendar.png',
          screenshotDark: '/calendar-dark.png',
          screenshotMobileLight: '/calendar-m.png',
          screenshotMobileDark: '/calendar-m-dark.png',
          routePill: 'Kalender',
        },
        {
          text: 'Dashboard point 1',
          screenshotLight: '/dashboard.png',
          screenshotDark: '/dashboard-dark.png',
          screenshotMobileLight: '/dashboard-m.png',
          screenshotMobileDark: '/dashboard-m-dark.png',
          routePill: 'Dashboard',
        },
        'Dashboard point 2 without custom screenshot',
        'Dashboard point 3 without custom screenshot',
      ],
    };

    const html = await renderComponent({
      features: [featureWithShared],
      activeStepIndex: 0,
      activeHighlightIndex: 1,
      glowOpacities: [1],
    });

    // Exactly 1 frame rendered for /dashboard.png, not 3!
    const matches = html.match(/src="\/dashboard\.png"/g);
    expect(matches).toHaveLength(1);
  });
});
