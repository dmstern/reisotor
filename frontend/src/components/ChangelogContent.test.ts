// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import ChangelogContent from './ChangelogContent.vue';

describe('ChangelogContent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function mount(props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(ChangelogContent, props),
    });
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

    // Big collapsible for all remaining groups
    const collapsible = container.querySelector('details.changelog-all-details-collapsible');
    expect(collapsible).not.toBeNull();
    expect(collapsible?.textContent).toContain('Alle weiteren Neuerungen');
    expect(collapsible?.textContent).toContain('2 Änderungen in 2 Bereichen');

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
    expect(container.querySelector('details.changelog-all-details-collapsible')).toBeNull();
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
