// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ChangelogContent from './ChangelogContent.vue';

describe('ChangelogContent', () => {
  let container: HTMLDivElement;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mount(props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(ChangelogContent, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders highlights directly and collapses other groups into a single details element', async () => {
    const { cleanUp } = mount({
      groups: [
        {
          title: 'Highlights',
          notes: ['🌟 **Top Feature**: Großes Redesign'],
        },
        {
          title: 'Reisen und Urlaube',
          notes: ['📅 **Termine**: Urlaube ohne festes Datum'],
        },
        {
          title: 'Karte und Navigation',
          notes: ['🗺️ **Schnellmenü**: Neues Kartenmenü'],
        },
      ],
    });
    await nextTick();

    // Highlights should be visible at top level
    const highlightGroup = container.querySelector('.changelog-group--highlights');
    expect(highlightGroup).not.toBeNull();
    expect(highlightGroup?.textContent).toContain('Highlights');
    expect(highlightGroup?.textContent).toContain('Top Feature');

    // Collapsible primitive for all remaining groups
    const collapsible = container.querySelector('.changelog-collapsible');
    expect(collapsible).not.toBeNull();
    expect(collapsible?.textContent).toContain('Alle weiteren Neuerungen');
    expect(collapsible?.textContent).not.toContain('Änderungen in');

    // Groups inside collapsible
    const otherGroups = collapsible?.querySelectorAll('.changelog-group');
    expect(otherGroups).toHaveLength(2);
    expect(collapsible?.textContent).toContain('Reisen und Urlaube');
    expect(collapsible?.textContent).toContain('Karte und Navigation');

    cleanUp();
  });

  it('renders all groups normally if there are no highlights', async () => {
    const { cleanUp } = mount({
      groups: [
        {
          title: 'Reisen und Urlaube',
          notes: ['📅 **Termine**: Urlaube ohne festes Datum'],
        },
        {
          title: 'Karte und Navigation',
          notes: ['🗺️ **Schnellmenü**: Neues Kartenmenü'],
        },
      ],
    });
    await nextTick();

    expect(container.querySelector('.changelog-group--highlights')).toBeNull();
    expect(container.querySelector('.changelog-collapsible')).toBeNull();
    expect(container.querySelectorAll('.changelog-group')).toHaveLength(2);

    cleanUp();
  });

  it('renders flat notes list when no groups are provided', async () => {
    const { cleanUp } = mount({
      notes: ['🚀 **Start**: Version 1.0'],
    });
    await nextTick();

    expect(container.querySelector('.changelog-group')).toBeNull();
    expect(container.textContent).toContain('Start');
    expect(container.textContent).toContain('Version 1.0');

    cleanUp();
  });
});
