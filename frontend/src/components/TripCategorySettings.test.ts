import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TripCategorySettings from './TripCategorySettings.vue';
import { useTripCategoriesStore } from '../stores/tripCategories';

describe('TripCategorySettings', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function render(props: { tripId: number }) {
    const app = createApp({
      render: () => h(TripCategorySettings, props),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert den Bereichs-Umschalter für Ausgaben und Spots und den Button für neue Kategorien', async () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 1,
        trip_id: 10,
        type: 'expense',
        name: 'Tauchkurs',
        icon: 'swimming',
        emoji: '🤿',
        color: '#0ea5e9',
        is_hidden: 0,
        created_at: '',
        usage_count: 3,
      },
    ];

    const html = await render({ tripId: 10 });
    expect(html).toContain('Ausgaben');
    expect(html).toContain('Spots');
    expect(html).toContain('Neue Kategorie');
    expect(html).toContain('Tauchkurs');
    expect(html).toContain('3 Ausgaben');
    expect(html).toContain('Urlaub');
  });
});
