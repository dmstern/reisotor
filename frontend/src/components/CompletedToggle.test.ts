import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CompletedToggle from './CompletedToggle.vue';

describe('CompletedToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: { modelValue: boolean }) {
    const app = createApp({
      render: () => h(CompletedToggle, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders "Erledigte" label and both toggle options', async () => {
    const html = await mountComponent({ modelValue: false });
    expect(html).toContain('Erledigte');
    expect(html).toContain('anzeigen');
    expect(html).toContain('ausblenden');
    expect(html).toContain('completed-toggle');
  });

  it('marks "anzeigen" as active when modelValue is false', async () => {
    const html = await mountComponent({ modelValue: false });
    // Find the button for anzeigen
    expect(html).toMatch(
      /<button[^>]*class="[^"]*active[^"]*"[^>]*>[\s\S]*?anzeigen[\s\S]*?<\/button>/
    );
  });

  it('marks "ausblenden" as active when modelValue is true', async () => {
    const html = await mountComponent({ modelValue: true });
    // Find the button for ausblenden
    expect(html).toMatch(
      /<button[^>]*class="[^"]*active[^"]*"[^>]*>[\s\S]*?ausblenden[\s\S]*?<\/button>/
    );
  });
});
