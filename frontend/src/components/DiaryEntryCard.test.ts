// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DiaryEntryCard from './DiaryEntryCard.vue';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import type { DiaryEntry, Spot, Excursion } from '../api/types';

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

  it('rendert Bilder-PolaroidStack sicher bei null-Werten oder fehlenden Bildern (#603)', async () => {
    const htmlWithNull = await render({
      entry: {
        ...dummyEntry,
        images: [null, undefined] as unknown as DiaryEntry['images'],
      },
    });
    expect(htmlWithNull).not.toContain('diary-polaroid-wrap');

    const htmlWithMixed = await render({
      entry: {
        ...dummyEntry,
        images: [
          null,
          { url: 'https://example.com/foto.jpg', original_name: 'foto.jpg' },
        ] as unknown as DiaryEntry['images'],
      },
    });
    expect(htmlWithMixed).toContain('diary-polaroid-wrap');
    expect(htmlWithMixed).toContain('foto.jpg');
  });

  it('rendert Warn-Badge an Ausflugs-Chip, wenn Tour-Datum vom Tagebuch-Datum abweicht', async () => {
    const html = await render({
      excursions: [
        {
          id: 5,
          trip_id: 1,
          title: 'Bootstour',
          date: '2026-08-15',
          spot_ids: [],
        },
      ],
    });
    expect(html).toContain('Bootstour');
    expect(html).toContain('is-warning');
    expect(html).toContain('chip-mismatch-badge');
    expect(html).toContain('15.08');
  });

  it('zeigt neutralen Tooltip ohne Warn-Badge an Spot-Chip, wenn Spot-Termin vom Tagebuch-Datum abweicht', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const spotsStore = useSpotsStore();
    const spotWithDate = {
      id: 42,
      trip_id: 1,
      title: 'Aussichtspunkt',
      category: 'viewpoint',
      dates: [{ id: 200, trip_id: 1, spot_id: 42, date: '2026-08-20', done: 0, created_at: '' }],
    } as unknown as Spot;
    spotsStore.spots = [spotWithDate];

    const app = createApp({
      render: () =>
        h(DiaryEntryCard, {
          entry: dummyEntry, // date: 2026-08-10
          authorName: 'Daniel',
          authorAvatar: '🦊',
          spots: [spotWithDate],
        }),
    });
    app.use(pinia);
    const html = await renderToString(app);

    expect(html).toContain('Aussichtspunkt');
    expect(html).toContain('title="Aussichtspunkt (geplant am 20.08.2026)"');
    expect(html).not.toContain('is-warning');
    expect(html).not.toContain('chip-mismatch-badge');
  });

  it('ruft openMapForExcursion beim Klick auf einen Tour-Chip auf', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const drawersStore = useDrawersStore();
    const openSpy = vi.spyOn(drawersStore, 'openMapForExcursion');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(DiaryEntryCard, {
          entry: dummyEntry,
          authorName: 'Daniel',
          authorAvatar: '🦊',
          excursions: [
            {
              id: 7,
              trip_id: 1,
              title: 'Bootstour',
              spot_ids: [],
            } as unknown as Excursion,
          ],
        }),
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const button = container.querySelector('.diary-linked-excursion') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button?.click();
    expect(openSpy).toHaveBeenCalledWith(7);

    app.unmount();
    container.remove();
  });

  it('ruft openMapAt mit spot-ID beim Klick auf einen Spot-Chip auf', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const drawersStore = useDrawersStore();
    const openSpy = vi.spyOn(drawersStore, 'openMapAt');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(DiaryEntryCard, {
          entry: dummyEntry,
          authorName: 'Daniel',
          authorAvatar: '🦊',
          spots: [
            {
              id: 99,
              trip_id: 1,
              title: 'Aussichtsturm',
              category: 'viewpoint',
            } as unknown as Spot,
          ],
        }),
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const button = container.querySelector('.diary-linked-spot') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button?.click();
    expect(openSpy).toHaveBeenCalledWith('spot-99');

    app.unmount();
    container.remove();
  });
});
