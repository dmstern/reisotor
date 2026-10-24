// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ReisotorRobot from './ReisotorRobot.vue';

describe('ReisotorRobot', () => {
  it('renders default idle state with blank variant and default size', async () => {
    const app = createApp({
      render: () => h(ReisotorRobot),
    });
    const html = await renderToString(app);

    expect(html).toContain('class="robot-stage variant-blank"');
    expect(html).toContain('width:200px');
    expect(html).toContain('class="robot idle"');
    expect(html).toContain('viewBox="0 0 500 500"');
  });

  it('renders background shapes for variants circle and full', async () => {
    const circleApp = createApp({
      render: () => h(ReisotorRobot, { variant: 'circle' }),
    });
    const circleHtml = await renderToString(circleApp);
    expect(circleHtml).toContain('class="bg-circle"');
    expect(circleHtml).toContain('variant-circle');

    const fullApp = createApp({
      render: () => h(ReisotorRobot, { variant: 'full' }),
    });
    const fullHtml = await renderToString(fullApp);
    expect(fullHtml).toContain('class="bg-full"');
    expect(fullHtml).toContain('variant-full');
  });

  it('renders sparkles in done phase', async () => {
    const doneApp = createApp({
      render: () => h(ReisotorRobot, { phase: 'done' }),
    });
    const html = await renderToString(doneApp);

    expect(html).toContain('class="sparkle sparkle-1"');
    expect(html).toContain('class="sparkle sparkle-2"');
    expect(html).toContain('class="sparkle sparkle-3"');
    expect(html).toContain('robot done');
  });

  it('renders sparkles and antenna signals in upgrade phase', async () => {
    const upgradeApp = createApp({
      render: () => h(ReisotorRobot, { phase: 'upgrade' }),
    });
    const html = await renderToString(upgradeApp);

    expect(html).toContain('class="sparkle sparkle-1"');
    expect(html).toContain('class="sparkle sparkle-4"');
    expect(html).toContain('class="sparkle sparkle-5"');
    expect(html).toContain('class="antenna-signals"');
    expect(html).toContain('robot upgrade');
  });

  it('handles coveringEyes and interactive props in SVG class list', async () => {
    const app = createApp({
      render: () => h(ReisotorRobot, { coveringEyes: true, interactive: true }),
    });
    const html = await renderToString(app);

    expect(html).toContain('covering-eyes');
    expect(html).toContain('is-interactive');
  });

  it('maps phase pack to packing class', async () => {
    const app = createApp({
      render: () => h(ReisotorRobot, { phase: 'pack' }),
    });
    const html = await renderToString(app);

    expect(html).toContain('robot packing');
  });

  it('emits packingDone on pack-backpack-anim animationend', () => {
    const onPackingDone = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () => h(ReisotorRobot, { onPackingDone }),
    });
    app.mount(container);

    const stage = container.querySelector('.robot-stage');
    expect(stage).not.toBeNull();

    // Trigger non-matching animationend
    const otherEvent = new Event('animationend', { bubbles: true });
    Object.defineProperty(otherEvent, 'animationName', { value: 'hover-bob' });
    stage?.dispatchEvent(otherEvent);
    expect(onPackingDone).not.toHaveBeenCalled();

    // Trigger pack-backpack-anim animationend
    const packEvent = new Event('animationend', { bubbles: true });
    Object.defineProperty(packEvent, 'animationName', { value: 'pack-backpack-anim' });
    stage?.dispatchEvent(packEvent);
    expect(onPackingDone).toHaveBeenCalledTimes(1);

    app.unmount();
    container.remove();
  });
});
