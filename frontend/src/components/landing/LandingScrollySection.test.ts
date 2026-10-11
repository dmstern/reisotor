// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { IconCalendarEvent } from '@tabler/icons-vue';
import LandingScrollySection from './LandingScrollySection.vue';
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
];

describe('LandingScrollySection', () => {
  async function renderComponent(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(LandingScrollySection, props as never),
    });
    return renderToString(app);
  }

  it('renders section header, badge, and scrolly layout', async () => {
    const html = await renderComponent({
      features: mockFeatures,
      activeIndex: 0,
      glowOpacities: [1],
    });

    expect(html).toContain('Reiseplanung neu gedacht');
    expect(html).toContain('ALLES AN EINEM ORT');
    expect(html).toContain('scrolly-badge');
    expect(html).toContain('scrolly-layout');
    expect(html).toContain('reisotor.app/dashboard');
  });
});
