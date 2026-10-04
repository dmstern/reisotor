import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ScheduleToolbar from './ScheduleToolbar.vue';

describe('ScheduleToolbar', () => {
  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render: () =>
        h(ScheduleToolbar, {
          granularity: 'month',
          canGoPrev: true,
          canGoNext: true,
          prevPageLabel: 'Vorheriger Monat',
          nextPageLabel: 'Nächster Monat',
          visibleRangeLabel: 'Oktober 2026',
          isTodayActive: false,
          isTripActive: false,
          hasTripStartDate: true,
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert Datumsbereich und Standard-Aktionen', async () => {
    const html = await render();
    expect(html).toContain('Oktober 2026');
    expect(html).toContain('Heute');
    expect(html).toContain('Urlaub');
    expect(html).toContain('Neu');
  });

  it('blendet Urlaub-Button aus, wenn kein Reisebeginn vorhanden ist', async () => {
    const html = await render({ hasTripStartDate: false });
    expect(html).toContain('Heute');
    expect(html).not.toContain('Urlaub');
  });

  it('rendert den Pending-Schedule-Banner im Planen-Modus', async () => {
    const html = await render({
      pendingSchedule: { kind: 'spot', id: 10, mode: 'plan' },
      pendingScheduleLabel: 'Eiffelturm',
    });
    expect(html).toContain('Tippe einen Tag an, um „Eiffelturm“ einzuplanen');
    expect(html).toContain('Abbrechen');
  });

  it('rendert den Pending-Schedule-Banner im Bestätigen-Modus', async () => {
    const html = await render({
      pendingSchedule: { kind: 'excursion', id: 5, mode: 'confirm-done' },
      pendingScheduleLabel: 'Bootstour',
    });
    expect(html).toContain('Wähle den Tag, an dem „Bootstour“ gemacht wurde');
  });
});
