import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TripCategoryRow, { type DisplayCategory } from './TripCategoryRow.vue';

describe('TripCategoryRow', () => {
  function render(category: DisplayCategory, activeType: 'expense' | 'spot') {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render: () =>
        h(TripCategoryRow, {
          category,
          activeType,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert eine Custom-Kategorie mit Urlaub-Badge und Ausgaben-Zähler', async () => {
    const cat: DisplayCategory = {
      id: 42,
      name: 'Tauchen',
      isCustom: true,
      isHidden: false,
      icon: 'swimming',
      emoji: '🤿',
      color: '#0ea5e9',
      usageCount: 5,
    };

    const html = await render(cat, 'expense');
    expect(html).toContain('Tauchen');
    expect(html).toContain('Urlaub');
    expect(html).toContain('5 Ausgaben');
    expect(html).toContain('title="Kategorie bearbeiten"');
    // Kein Ausblenden-Button bei Urlaub/Custom
    expect(html).not.toContain('Ausblenden');
  });

  it('rendert eine Standardkategorie mit Standard-Badge und Ausblenden-Button', async () => {
    const cat: DisplayCategory = {
      name: 'Essen & Trinken',
      isCustom: false,
      isHidden: false,
      usageCount: 0,
    };

    const html = await render(cat, 'expense');
    expect(html).toContain('Essen &amp; Trinken');
    expect(html).toContain('Standard');
    expect(html).toContain('Ausblenden');
  });

  it('rendert eine ausgeblendete Kategorie mit Einblenden-Button und is-hidden-Klasse', async () => {
    const cat: DisplayCategory = {
      name: 'Unterkunft',
      isCustom: false,
      isHidden: true,
      usageCount: 0,
    };

    const html = await render(cat, 'spot');
    expect(html).toContain('Unterkunft');
    expect(html).toContain('is-hidden');
    expect(html).toContain('Einblenden');
  });

  it('formatiert Zähler bei n=1 im Singular ("1 Spot" bzw. "1 Ausgabe")', async () => {
    const spotCat: DisplayCategory = {
      name: 'Restaurant',
      isCustom: false,
      isHidden: false,
      usageCount: 1,
    };
    const spotHtml = await render(spotCat, 'spot');
    expect(spotHtml).toContain('1 Spot');
    expect(spotHtml).not.toContain('1 Spots');

    const expenseCat: DisplayCategory = {
      name: 'Restaurant',
      isCustom: false,
      isHidden: false,
      usageCount: 1,
    };
    const expenseHtml = await render(expenseCat, 'expense');
    expect(expenseHtml).toContain('1 Ausgabe');
    expect(expenseHtml).not.toContain('1 Ausgaben');
  });

  it('formatiert Zähler bei n!=1 im Plural ("2 Spots" bzw. "2 Ausgaben")', async () => {
    const spotCat: DisplayCategory = {
      name: 'Sehenswürdigkeit',
      isCustom: false,
      isHidden: false,
      usageCount: 2,
    };
    const spotHtml = await render(spotCat, 'spot');
    expect(spotHtml).toContain('2 Spots');

    const expenseCat: DisplayCategory = {
      name: 'Transport',
      isCustom: false,
      isHidden: false,
      usageCount: 2,
    };
    const expenseHtml = await render(expenseCat, 'expense');
    expect(expenseHtml).toContain('2 Ausgaben');
  });
});
