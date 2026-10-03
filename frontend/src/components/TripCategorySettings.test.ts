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

  it('rendert den Bereichs-Umschalter für Spots und Ausgaben und den Button für neue Kategorien', async () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 1,
        trip_id: 10,
        type: 'spot',
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
    expect(html).toContain('Spots');
    expect(html).toContain('Ausgaben');
    expect(html).toContain('Neue Kategorie');
    expect(html).toContain('Tauchkurs');
    expect(html).toContain('3 Spots');
    expect(html).toContain('Urlaub');

    // Keine veralteten separaten Emoji-Eingabefelder vorhanden
    expect(html).not.toContain('emoji-input');
    expect(html).not.toContain('emoji-field');

    // Kein Inline-Edit-Formular in der Liste vorhanden
    expect(html).not.toContain('inline-edit-form');

    // Bearbeiten-Button ist vorhanden mit Titel "Kategorie bearbeiten" und Standard-Styling (btn--ghost, edit-btn small)
    expect(html).toContain('title="Kategorie bearbeiten"');
    expect(html).toContain('btn--ghost');
    expect(html).toContain('edit-btn small');

    // Standardkategorie-Aktion "Ausblenden" ist vorhanden und hat das hide-Icon (eye-off)
    expect(html).toContain('Ausblenden');
    expect(html).toContain('eye-off');
  });

  it('zeigt in der Zeile kein inline-Löschen-Icon mehr, sondern verlegt Löschen in den Dialog', async () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 1,
        trip_id: 10,
        type: 'spot',
        name: 'Tauchkurs',
        icon: 'swimming',
        emoji: '🤿',
        color: '#0ea5e9',
        is_hidden: 0,
        created_at: '',
        usage_count: 0,
      },
    ];

    const html = await render({ tripId: 10 });
    // In der Zeilenansicht darf es keinen direkten "Kategorie löschen"-Button mehr geben
    // (Löschen ist nun im Bearbeiten-Dialog verortet)
    const rowActionsMatches = html.match(/<div class="row-actions">([\s\S]*?)<\/div>/g) || [];
    for (const rowActions of rowActionsMatches) {
      expect(rowActions).not.toContain('title="Kategorie löschen"');
    }
  });

  it('rendert Standardkategorien mit ihren spezifischen Farben und Icons statt generischem Fallback', async () => {
    const html = await render({ tripId: 10 });

    // Spot-Standardkategorien sind initial sichtbar
    expect(html).toContain('Restaurant');
    expect(html).toContain('--category-color:#e34948');

    expect(html).toContain('Café');
    expect(html).toContain('--category-color:#c9891f');
  });

  it('bettet die Kategorienliste in einen Scroll-Fade-Wrapper mit oberen und unteren Verläufen ein', async () => {
    const html = await render({ tripId: 10 });
    expect(html).toContain('category-list-wrapper');
    expect(html).toContain('category-list');
    expect(html).toContain('scroll-fade--top');
    expect(html).toContain('scroll-fade--bottom');
  });

  it('rendert eine angepasste Standardkategorie ohne Duplikat und mit "Standard (angepasst)"-Badge', async () => {
    const store = useTripCategoriesStore();
    store.categories = [
      {
        id: 8,
        trip_id: 10,
        type: 'spot',
        name: 'Flughafennnnn',
        default_name: 'Flughafen',
        icon: 'plane',
        emoji: '✈️',
        color: '#4a3aa7',
        is_hidden: 0,
        created_at: '',
        usage_count: 2,
      },
    ];

    const html = await render({ tripId: 10 });
    // Angepasster Name ist vorhanden
    expect(html).toContain('Flughafennnnn');
    expect(html).toContain('Standard (angepasst)');
    expect(html).toContain('Zurücksetzen');
    expect(html).toContain('2 Spots');

    // Der alte Standardname "Flughafen" darf NICHT als eigenes separates Chip/Row existieren
    const flughafenMatches = html.match(/>Flughafen</g) || [];
    expect(flughafenMatches).toHaveLength(0);
  });
});
