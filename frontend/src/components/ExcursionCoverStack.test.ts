// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionCoverStack from './ExcursionCoverStack.vue';
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';

describe('ExcursionCoverStack', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockExcursion: Excursion = {
    id: 1,
    trip_id: 1,
    title: 'Wanderung',
    created_by: 1,
  } as unknown as Excursion;

  const mockStations: ExcursionStation[] = [
    { key: 'spot:10', kind: 'spot', id: 10, title: 'Start' } as ExcursionStation,
    { key: 'spot:11', kind: 'spot', id: 11, title: 'Ziel' } as ExcursionStation,
  ];

  function mountComponent(props: { excursion: Excursion; resolvedStations: ExcursionStation[] }) {
    const app = createApp({
      render: () => h(ExcursionCoverStack, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders polaroid stack when resolved stations are present', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      resolvedStations: mockStations,
    });
    expect(html).toContain('tour-visual-col');
    expect(html).toContain('tour-polaroid-stack');
  });

  it('renders category placeholder icon when no stations are present', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      resolvedStations: [],
    });
    expect(html).toContain('tour-visual-col');
    expect(html).toContain('tour-placeholder');
  });
});
