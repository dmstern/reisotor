import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TripCategoryAffectedItems from './TripCategoryAffectedItems.vue';

describe('TripCategoryAffectedItems', () => {
  function render(props: InstanceType<typeof TripCategoryAffectedItems>['$props']) {
    const app = createApp({
      render: () => h(TripCategoryAffectedItems, props),
    });
    return renderToString(app);
  }

  it('renders spots count and link to excursions with category filter', async () => {
    const html = await render({
      items: [{ id: '1', title: 'Elafonisi Strand', subtitle: 'Strand im Südwesten' }],
      totalCount: 1,
      activeType: 'spot',
      categoryName: 'Strand',
      tripId: 42,
      isLoading: false,
    });

    expect(html).toContain('Betroffener Spot (1):');
    expect(html).toContain('affected-items-link');
    expect(html).toContain('In Spot-Übersicht anzeigen');
    expect(html).toContain('href="/trip/42/excursions?category=Strand"');
    expect(html).toContain('Elafonisi Strand');
    expect(html).toContain('Strand im Südwesten');
  });

  it('renders plural Ausgaben label and budget link for expense type', async () => {
    const html = await render({
      items: [
        { id: '10', title: 'Supermarkt', amount: 45.5 },
        { id: '11', title: 'Tanken', amount: 70 },
      ],
      totalCount: 2,
      activeType: 'expense',
      categoryName: 'Lebensmittel',
      tripId: 42,
    });

    expect(html).toContain('Betroffene Ausgaben (2):');
    expect(html).toContain('Supermarkt');
    expect(html).toContain('45,50 €');
    expect(html).toContain('Im Budget anzeigen');
    expect(html).toContain('href="/trip/42/budget"');
  });

  it('renders more items hint when totalCount exceeds items length', async () => {
    const html = await render({
      items: [{ id: '1', title: 'Spot 1' }],
      totalCount: 5,
      activeType: 'spot',
      categoryName: 'Kultur',
      tripId: 42,
    });

    expect(html).toContain('+ 4 weitere');
    expect(html).toContain('alle in der Übersicht ansehen');
  });

  it('renders loading state when isLoading is true', async () => {
    const html = await render({
      items: [],
      totalCount: 3,
      activeType: 'spot',
      categoryName: 'Kultur',
      tripId: 42,
      isLoading: true,
    });

    expect(html).toContain('Wird geladen...');
  });
});
