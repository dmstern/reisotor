// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DraftStatusBar from './DraftStatusBar.vue';

describe('DraftStatusBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function renderStatus(props: InstanceType<typeof DraftStatusBar>['$props']) {
    const app = createApp({
      render: () => h(DraftStatusBar, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders nothing when status is idle', async () => {
    const html = await renderStatus({ status: 'idle' });
    expect(html).not.toContain('draft-status');
  });

  it('renders saved status without discard button by default', async () => {
    const html = await renderStatus({ status: 'saved' });
    expect(html).toContain('draft-status');
    expect(html).toContain('Entwurf gesichert');
    expect(html).not.toContain('draft-discard-btn');
  });

  it('renders restored status when restored=true', async () => {
    const html = await renderStatus({ status: 'saved', restored: true });
    expect(html).toContain('Entwurf wiederhergestellt');
  });

  it('renders dirty status while saving', async () => {
    const html = await renderStatus({ status: 'dirty' });
    expect(html).toContain('Entwurf wird gesichert');
  });

  it('renders discard button when canDiscard is true', async () => {
    const html = await renderStatus({ status: 'saved', canDiscard: true });
    expect(html).toContain('draft-discard-btn');
    expect(html).toContain('Entwurf verwerfen');
  });

  it('does not render discard button when canDiscard is false', async () => {
    const html = await renderStatus({ status: 'saved', canDiscard: false });
    expect(html).not.toContain('draft-discard-btn');
  });

  it('emits discard event when discard button is clicked', async () => {
    let discarded = false;
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(DraftStatusBar, {
          status: 'saved',
          canDiscard: true,
          onDiscard: () => {
            discarded = true;
          },
        }),
    });
    app.use(createPinia());
    app.mount(container);

    const btn = container.querySelector('.draft-discard-btn') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    btn?.click();
    expect(discarded).toBe(true);

    app.unmount();
    container.remove();
  });

  it('renders edit mode with "Ungespeicherte Änderungen" when status is saved', async () => {
    const html = await renderStatus({ status: 'saved', mode: 'edit' });
    expect(html).toContain('Ungespeicherte Änderungen');
    expect(html).not.toContain('Entwurf gesichert');
  });

  it('renders edit mode with "Ungespeicherte Änderungen…" when status is dirty', async () => {
    const html = await renderStatus({ status: 'dirty', mode: 'edit' });
    expect(html).toContain('Ungespeicherte Änderungen…');
  });

  it('renders edit mode restored message when restored is true', async () => {
    const html = await renderStatus({ status: 'saved', restored: true, mode: 'edit' });
    expect(html).toContain('Stand nach Unterbrechung wiederhergestellt');
  });

  it('renders discard button in edit mode with "Änderungen verwerfen"', async () => {
    const html = await renderStatus({ status: 'saved', canDiscard: true, mode: 'edit' });
    expect(html).toContain('draft-discard-btn');
    expect(html).toContain('Änderungen verwerfen');
    expect(html).not.toContain('Entwurf verwerfen');
  });
});
