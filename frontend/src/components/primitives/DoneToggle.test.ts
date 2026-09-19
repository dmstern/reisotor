import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DoneToggle from './DoneToggle.vue';

describe('DoneToggle primitive', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(
    props: InstanceType<typeof DoneToggle>['$props'] = {},
    slotText = 'Gemacht'
  ) {
    const app = createApp({
      render: () => h(DoneToggle, props, () => slotText),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders a button element with default not-done state and slot content', async () => {
    const html = await mountComponent({}, 'Gemacht');
    expect(html).toContain('<button');
    expect(html).toContain('class="done-toggle"');
    expect(html).toContain('Gemacht');
    expect(html).toContain('status-text');
  });

  it('renders planned state with .planned class when planned=true and not done', async () => {
    const html = await mountComponent({ planned: true }, 'Geplant für Fr., 12. Mai');
    expect(html).toContain('done-toggle');
    expect(html).toContain('planned');
    expect(html).not.toContain('status-done');
    expect(html).toContain('Geplant für Fr., 12. Mai');
  });

  it('renders done state with .status-done, .active and aria-pressed="true"', async () => {
    const html = await mountComponent({ done: true, planned: true }, 'Besucht');
    expect(html).toContain('status-done');
    expect(html).toContain('active');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('planned ');
  });

  it('renders partiallyDone state with .status-done', async () => {
    const html = await mountComponent({ partiallyDone: true }, '1/3 x besucht');
    expect(html).toContain('status-done');
    expect(html).toContain('1/3 x besucht');
  });

  it('passes title and aria-label to the button element', async () => {
    const html = await mountComponent({
      ariaLabel: 'Als gemacht markieren',
      title: 'Klicken zum Markieren',
    });
    expect(html).toContain('aria-label="Als gemacht markieren"');
    expect(html).toContain('title="Klicken zum Markieren"');
  });
});
