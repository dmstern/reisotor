import { describe, it, expect } from 'vitest';

describe('CSS vendor prefix hygiene', () => {
  const modules = import.meta.glob(['./**/*.vue', './**/*.css'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  it('does not manually specify -webkit-backdrop-filter or -webkit-mask (handled by LightningCSS autoprefixer)', () => {
    // LightningCSS (via rolldown-vite) automatically adds -webkit- prefixes for targeted Safari versions.
    // Specifying them manually is redundant and risks ordering bugs where standard properties get stripped.
    const violations: { file: string; match: string }[] = [];
    const prefixRegex = /-(?:webkit)-(?:backdrop-filter|mask)\s*:/g;

    for (const [file, content] of Object.entries(modules)) {
      const matches = content.match(prefixRegex);
      if (matches) {
        for (const match of matches) {
          violations.push({ file, match: match.trim() });
        }
      }
    }

    expect(
      violations,
      'Do not write manual -webkit-backdrop-filter or -webkit-mask prefixes. Write standard backdrop-filter / mask instead; LightningCSS autoprefixes them automatically for production!'
    ).toEqual([]);
  });

  it('does not define standard properties before -webkit- prefixes if any vendor prefixes are used', () => {
    const violations: { file: string; match: string }[] = [];
    const criticalProperties = ['backdrop-filter', 'mask'];

    for (const [file, content] of Object.entries(modules)) {
      for (const prop of criticalProperties) {
        const regex = new RegExp(`(?<!-)${prop}\\s*:[^;]+;\\s*-webkit-${prop}\\s*:[^;]+;`, 'g');
        const matches = content.match(regex);
        if (matches) {
          for (const match of matches) {
            violations.push({ file, match: match.trim() });
          }
        }
      }
    }

    expect(
      violations,
      'Found standard CSS property preceding its -webkit- prefix. LightningCSS drops the standard property when -webkit- follows it!'
    ).toEqual([]);
  });
});
