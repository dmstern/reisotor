import fs from 'node:fs';
import path from 'node:path';

export interface ScreenshotComparisonEntry {
  baseName: string;
  status: 'created' | 'updated' | 'unchanged';
  diffPixels: number;
  totalPixels: number;
  effectiveMaxDiff: number;
  hasMap: boolean;
  width: number;
  height: number;
  existingBuffer?: Buffer;
  newBuffer?: Buffer;
  diffBuffer?: Buffer;
}

const entries: ScreenshotComparisonEntry[] = [];

const REPORT_DIR = path.join(process.cwd(), '.tmp', 'screenshot-diffs');
const IMAGES_DIR = path.join(REPORT_DIR, 'images');

function findDocsScreenshot(baseName: string): string | null {
  const candidates = [
    path.join(process.cwd(), '..', 'docs', 'screenshots', baseName),
    path.join(process.cwd(), 'docs', 'screenshots', baseName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function recordScreenshotComparison(entry: ScreenshotComparisonEntry): void {
  entries.push(entry);

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Für alle Screenshots (auch identische) speichern wir das aktuelle Bild für den HTML-Report
  const currentBuffer = entry.newBuffer || entry.existingBuffer;
  const currentImagePath = path.join(IMAGES_DIR, entry.baseName);
  if (currentBuffer) {
    fs.writeFileSync(currentImagePath, currentBuffer);
  } else {
    const docsPath = findDocsScreenshot(entry.baseName);
    if (docsPath) {
      fs.copyFileSync(docsPath, currentImagePath);
    }
  }

  // Falls Unterschiede vorliegen oder das Bild aktualisiert wurde, speichern wir die Diff-Bilder
  if (entry.diffPixels > 0 || entry.status === 'updated' || entry.status === 'created') {
    if (entry.existingBuffer) {
      fs.writeFileSync(path.join(IMAGES_DIR, `${entry.baseName}.old.png`), entry.existingBuffer);
    }
    if (entry.newBuffer) {
      fs.writeFileSync(path.join(IMAGES_DIR, `${entry.baseName}.new.png`), entry.newBuffer);
    }
    if (entry.diffBuffer) {
      fs.writeFileSync(path.join(IMAGES_DIR, `${entry.baseName}.diff.png`), entry.diffBuffer);
    }
  }
}

export function generateScreenshotHtmlReport(): string | null {
  if (entries.length === 0) return null;

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const updatedEntries = entries.filter((e) => e.status === 'updated');
  const createdEntries = entries.filter((e) => e.status === 'created');
  const belowThresholdEntries = entries.filter((e) => e.status === 'unchanged' && e.diffPixels > 0);
  const identicalEntries = entries.filter((e) => e.status === 'unchanged' && e.diffPixels === 0);

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Reisotor Baseline Screenshot Diff Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #0f141c;
      --surface: #18202c;
      --surface-hover: #1f2a3a;
      --border: #2a374a;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #9d4edd;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --surface: #ffffff;
        --surface-hover: #f1f5f9;
        --border: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --primary: #8338ec;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.5;
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
    }
    h1 { margin: 0 0 0.5rem; font-size: 1.75rem; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 8px;
    }
    .stat-val { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
    .stat-label { font-size: 0.85rem; color: var(--text-muted); }
    .container { max-width: 1400px; margin: 0 auto; }
    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .filter-btn.active {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
    .cards { display: flex; flex-direction: column; gap: 2rem; }
    .diff-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      overflow: hidden;
    }
    .diff-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .diff-title {
      font-family: monospace;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
    }
    .badges { display: flex; gap: 0.5rem; align-items: center; }
    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-updated { background: rgba(16, 185, 129, 0.2); color: var(--success); border: 1px solid var(--success); }
    .badge-created { background: rgba(131, 56, 236, 0.2); color: var(--primary); border: 1px solid var(--primary); }
    .badge-ignored { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid var(--warning); }
    .badge-identical { background: var(--surface-hover); color: var(--text-muted); border: 1px solid var(--border); }
    .badge-map { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }
    .badge-ui { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #a855f7; }
    .diff-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .diff-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .preview-col {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .preview-col h4 {
      margin: 0;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .img-box {
      background: #000;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      max-height: 480px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .img-box a {
      display: block;
      width: 100%;
      line-height: 0;
    }
    .img-box img {
      width: 100%;
      height: auto;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Reisotor Baseline Screenshot Diff Report</h1>
    <div style="color: var(--text-muted); font-size: 0.9rem;">
      Erstellt am ${new Date().toLocaleString('de-DE')} • Insgesamt ${entries.length} Screenshots geprüft
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val" style="color: var(--success);">${updatedEntries.length}</div>
        <div class="stat-label">Aktualisiert (> Schwelle)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--warning);">${belowThresholdEntries.length}</div>
        <div class="stat-label">Ignoriert (unter Schwelle)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--text-muted);">${identicalEntries.length}</div>
        <div class="stat-label">Identisch (0 px Diff)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--primary);">${createdEntries.length}</div>
        <div class="stat-label">Neu angelegt</div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="filters">
      <button class="filter-btn active" onclick="filterCards('all')">Alle (${entries.length})</button>
      <button class="filter-btn" onclick="filterCards('updated')">Aktualisiert (${updatedEntries.length})</button>
      <button class="filter-btn" onclick="filterCards('ignored')">Unter Schwelle (${belowThresholdEntries.length})</button>
      <button class="filter-btn" onclick="filterCards('identical')">Identisch (${identicalEntries.length})</button>
      ${createdEntries.length > 0 ? `<button class="filter-btn" onclick="filterCards('created')">Neu angelegt (${createdEntries.length})</button>` : ''}
    </div>

    <div class="cards">
      ${entries
        .map((entry) => {
          const diffPct =
            entry.totalPixels > 0
              ? ((entry.diffPixels / entry.totalPixels) * 100).toFixed(3)
              : '0.000';
          const maxPct =
            entry.totalPixels > 0
              ? ((entry.effectiveMaxDiff / entry.totalPixels) * 100).toFixed(2)
              : '0.00';
          const statusClass =
            entry.status === 'updated'
              ? 'updated'
              : entry.status === 'created'
                ? 'created'
                : entry.diffPixels > 0
                  ? 'ignored'
                  : 'identical';

          const hasDiffFiles = entry.diffPixels > 0 || entry.status === 'updated';

          return `
      <div class="diff-card" data-status="${statusClass}">
        <div class="diff-header">
          <span class="diff-title">${entry.baseName}</span>
          <div class="badges">
            <span class="badge ${entry.hasMap ? 'badge-map' : 'badge-ui'}">
              ${entry.hasMap ? 'Karte (2.0%)' : 'UI (0.3% / 0.6%)'}
            </span>
            <span class="badge badge-${statusClass}">
              ${
                entry.status === 'updated'
                  ? 'Aktualisiert'
                  : entry.status === 'created'
                    ? 'Neu'
                    : entry.diffPixels > 0
                      ? 'Unter Schwelle'
                      : 'Identisch'
              }
            </span>
          </div>
        </div>

        <div class="diff-meta">
          <span><strong>Auflösung:</strong> ${entry.width} × ${entry.height} px</span>
          ${
            entry.status === 'created'
              ? `<span><strong>Status:</strong> Erstaufnahme (Baseline neu angelegt)</span>`
              : `<span><strong>Diff:</strong> ${entry.diffPixels.toLocaleString('de-DE')} px (${diffPct} %)</span>
          <span><strong>Toleranz:</strong> ${entry.effectiveMaxDiff.toLocaleString('de-DE')} px (${maxPct} %)</span>`
          }
        </div>

        ${
          entry.status === 'created'
            ? `
        <div class="preview-col" style="max-width: 640px;">
          <h4>Neu aufgenommene Baseline</h4>
          <div class="img-box">
            <a href="images/${entry.baseName}" target="_blank" title="In Originalgröße öffnen">
              <img src="images/${entry.baseName}" alt="Neu" loading="lazy">
            </a>
          </div>
        </div>
        `
            : hasDiffFiles
              ? `
        <div class="diff-preview-grid">
          <div class="preview-col">
            <h4>1. Vorher (Baseline)</h4>
            <div class="img-box">
              <a href="images/${entry.baseName}.old.png" target="_blank" title="In Originalgröße öffnen">
                <img src="images/${entry.baseName}.old.png" alt="Vorher" loading="lazy">
              </a>
            </div>
          </div>
          <div class="preview-col">
            <h4>2. Diff (Pixelmatch Rot)</h4>
            <div class="img-box">
              <a href="images/${entry.baseName}.diff.png" target="_blank" title="In Originalgröße öffnen">
                <img src="images/${entry.baseName}.diff.png" alt="Diff" loading="lazy">
              </a>
            </div>
          </div>
          <div class="preview-col">
            <h4>3. Neu (Aktuell)</h4>
            <div class="img-box">
              <a href="images/${entry.baseName}.new.png" target="_blank" title="In Originalgröße öffnen">
                <img src="images/${entry.baseName}.new.png" alt="Neu" loading="lazy">
              </a>
            </div>
          </div>
        </div>
        `
              : `
        <div class="preview-col" style="max-width: 640px;">
          <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; margin-bottom: 0.5rem;">
            Keine visuellen Abweichungen (0 Pixel Diff).
          </div>
          <h4>Aktueller Baseline-Screenshot</h4>
          <div class="img-box">
            <a href="images/${entry.baseName}" target="_blank" title="In Originalgröße öffnen">
              <img src="images/${entry.baseName}" alt="${entry.baseName}" loading="lazy">
            </a>
          </div>
        </div>
        `
        }
      </div>`;
        })
        .join('\n')}
    </div>
  </div>

  <script>
    function filterCards(type) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.diff-card').forEach(card => {
        if (type === 'all') {
          card.style.display = 'block';
        } else {
          card.style.display = card.getAttribute('data-status') === type ? 'block' : 'none';
        }
      });
    }
  </script>
</body>
</html>`;

  const reportPath = path.join(REPORT_DIR, 'index.html');
  fs.writeFileSync(reportPath, html);

  const fileUri = `file://${reportPath}`;
  console.log('\n================================================================================');
  console.log(`📸 Screenshot Diff Report generiert:`);
  console.log(`👉 ${fileUri}`);
  console.log(
    `📊 Statistik: ${updatedEntries.length} aktualisiert, ${belowThresholdEntries.length} ignoriert (unter Schwelle), ${identicalEntries.length} identisch.`
  );
  console.log('================================================================================\n');

  return fileUri;
}
