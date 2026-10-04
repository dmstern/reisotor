import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import CalendarExportDropdown from './CalendarExportDropdown.vue';
import type { CalendarEntry } from '../api/types';

import { createPinia, setActivePinia } from 'pinia';

describe('CalendarExportDropdown', () => {
  const dummyEntry: CalendarEntry = {
    key: 'schedule:1',
    date: '2026-10-15',
    title: 'Sightseeing Tour',
    category: 'excursion',
    kind: 'schedule',
    time: '10:00',
    endTime: '12:00',
    location: 'Alexanderplatz',
  } as CalendarEntry;

  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render: () =>
        h(CalendarExportDropdown, {
          entry: dummyEntry,
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert den Kalender-Export-Button mit Standard-Label', async () => {
    const html = await render();
    expect(html).toContain('In Kalender');
    expect(html).toContain('title="Zum eigenen Kalender hinzufügen"');
  });

  it('unterstützt benutzerdefiniertes Label und Card-Action-Variante', async () => {
    const html = await render({
      variant: 'card-action',
      label: 'In meinen Kalender',
      showLabel: true,
    });
    expect(html).toContain('In meinen Kalender');
    expect(html).toContain('always-show-label');
  });
});
