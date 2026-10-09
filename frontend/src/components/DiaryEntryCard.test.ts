// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DiaryEntryCard from './DiaryEntryCard.vue';
import type { DiaryEntry } from '../api/types';

describe('DiaryEntryCard', () => {
  const dummyEntry: DiaryEntry = {
    id: 101,
    trip_id: 1,
    author_id: 1,
    author_username: 'Daniel',
    author_avatar: '🦊',
    title: 'Sonnenuntergang am Meer',
    content: '<p>Wunderschöner Abend mit Blick auf die Wellen.</p>',
    content_format: 'html',
    images: [],
    excursion_ids: [],
    spot_ids: [],
    editor_ids: [],
    date: '2026-08-10',
    is_draft: 0,
    created_at: '2026-08-10T18:00:00Z',
    updated_at: null,
  };

  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);

    const app = createApp({
      render: () =>
        h(DiaryEntryCard, {
          entry: dummyEntry,
          authorName: 'Daniel',
          authorAvatar: '🦊',
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert Autor, Datum, Titel und Inhalt', async () => {
    const html = await render();
    expect(html).toContain('Daniel');
    expect(html).toContain('🦊');
    expect(html).toContain('Sonnenuntergang am Meer');
    expect(html).toContain('Wunderschöner Abend mit Blick auf die Wellen.');
  });

  it('rendert Wetter-Anzeige, wenn Wetterdaten übergeben werden', async () => {
    const html = await render({
      weather: {
        weatherCode: 0,
        tempMax: 24,
        tempMin: 16,
      },
    });
    expect(html).toContain('24° / 16°');
  });

  it('rendert Ausflugs-Chips, wenn verknüpfte Ausflüge vorhanden sind', async () => {
    const html = await render({
      excursions: [
        {
          id: 5,
          trip_id: 1,
          title: 'Bootstour',
          spot_ids: [],
        },
      ],
    });
    expect(html).toContain('Bootstour');
  });

  it('rendert Entwurfs-Badge, wenn is_draft gesetzt ist', async () => {
    const html = await render({
      entry: { ...dummyEntry, is_draft: 1 },
    });
    expect(html).toContain('Entwurf');
  });
});
