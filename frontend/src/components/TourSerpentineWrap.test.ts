// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TourSerpentineWrap from './TourSerpentineWrap.vue';
import type { Excursion, Spot } from '../api/types';

describe('TourSerpentineWrap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const dummyExcursion: Excursion = {
    id: 10,
    trip_id: 1,
    title: 'Küsten-Rundgang',
    spot_ids: [1, 2],
    created_by: 1,
  } as unknown as Excursion;

  const dummySpot1: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Strandpromenade',
    category: 'Strand',
    created_by: 1,
    is_home: 0,
  } as unknown as Spot;

  const dummySpot2: Spot = {
    id: 2,
    trip_id: 1,
    title: 'Fischereihafen',
    category: 'Restaurant',
    created_by: 1,
    is_home: 0,
  } as unknown as Spot;

  function render(props: any) {
    const app = createApp({
      render: () => h(TourSerpentineWrap, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders serpentine row and spot cells', async () => {
    const html = await render({
      excursion: dummyExcursion,
      items: [{ spot: dummySpot1 }, { spot: dummySpot2 }],
      cols: 2,
      rows: [
        {
          rowIndex: 0,
          isRtl: false,
          cells: [
            { key: 'spot-1', type: 'spot', spot: dummySpot1, globalIndex: 0 },
            {
              key: 'leg-1-2',
              type: 'leg-horizontal',
              fromSpot: dummySpot1,
              toSpot: dummySpot2,
              leg: null,
              isRtl: false,
            },
            { key: 'spot-2', type: 'spot', spot: dummySpot2, globalIndex: 1 },
          ],
          rowBreak: null,
        },
      ],
      expandedSpotId: null,
      highlightedIds: new Set(),
      dayFocusHighlightedIds: new Set(),
      spotScheduledDates: new Map(),
      users: [],
      allTourTitles: ['Küsten-Rundgang'],
      spotCommentItemsFor: () => [],
      getTourLayover: () => null,
    });

    expect(html).toContain('tour-station-wrap');
    expect(html).toContain('tour-serpentine-wrap');
    expect(html).toContain('Strandpromenade');
    expect(html).toContain('Fischereihafen');
    expect(html).toContain('tour-leg-connector');
  });
});
