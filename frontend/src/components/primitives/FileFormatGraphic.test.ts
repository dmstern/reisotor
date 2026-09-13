import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import FileFormatGraphic from './FileFormatGraphic.vue';

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  return app;
}

describe('FileFormatGraphic primitive', () => {
  it('renders PDF file graphic with PDF label and rose-red gradient', async () => {
    const app = createTestApp(FileFormatGraphic, { extension: 'pdf' });
    const html = await renderToString(app);
    expect(html).toContain('file-format-graphic');
    expect(html).toContain('PDF');
    expect(html).toContain('#f43f5e'); // Rose-red gradient start
  });

  it('renders Word graphic for docx file', async () => {
    const app = createTestApp(FileFormatGraphic, { filename: 'Reiseplan.docx' });
    const html = await renderToString(app);
    expect(html).toContain('DOCX');
    expect(html).toContain('#3b82f6'); // Royal blue
  });

  it('renders Excel graphic for xlsx file', async () => {
    const app = createTestApp(FileFormatGraphic, { extension: 'xlsx' });
    const html = await renderToString(app);
    expect(html).toContain('XLSX');
    expect(html).toContain('#10b981'); // Emerald green
  });

  it('renders Zip graphic for archive', async () => {
    const app = createTestApp(FileFormatGraphic, { extension: 'zip' });
    const html = await renderToString(app);
    expect(html).toContain('ZIP');
    expect(html).toContain('#f59e0b'); // Golden amber
  });

  it('resolves format from mime-type when extension is absent', async () => {
    const app = createTestApp(FileFormatGraphic, { mimeType: 'application/pdf' });
    const html = await renderToString(app);
    expect(html).toContain('PDF');
  });

  it('renders custom size correctly', async () => {
    const app = createTestApp(FileFormatGraphic, { extension: 'pdf', size: 36 });
    const html = await renderToString(app);
    expect(html).toContain('width:36px');
    expect(html).toContain('height:42px');
  });
});
