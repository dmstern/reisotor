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
});
