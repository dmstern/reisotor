import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TripCategoryFormFields, { type CategoryFormData } from './TripCategoryFormFields.vue';

describe('TripCategoryFormFields', () => {
  function render(formData: CategoryFormData, activeType: 'expense' | 'spot') {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render: () =>
        h(TripCategoryFormFields, {
          modelValue: formData,
          activeType,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert Vorschau-Chip, Namens-Eingabe, Icon-Button und Farbpalette', async () => {
    const data: CategoryFormData = {
      name: 'Wellness',
      icon: 'spa',
      emoji: '🧖',
      color: '#1baf7a',
    };

    const html = await render(data, 'expense');
    expect(html).toContain('Vorschau:');
    expect(html).toContain('Wellness');
    expect(html).toContain('Name');
    expect(html).toContain('Icon auswählen');
    expect(html).toContain('Farbe');
    expect(html).toContain('color-swatch-picker');
  });
});
