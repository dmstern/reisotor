import { describe, expect, it } from 'vitest';
import { tablerMarkerSvg } from './tablerMarkerSvg';

describe('tablerMarkerSvg', () => {
  it('returns an empty string for an id that was never curated', () => {
    expect(tablerMarkerSvg('not-a-real-icon', 'outline', 32)).toBe('');
  });

  it('normalizes both width and height to the requested pixel size', () => {
    const svg = tablerMarkerSvg('home', 'outline', 40);
    expect(svg).toContain('width="40"');
    expect(svg).toContain('height="40"');
    expect(svg).not.toContain('width="24"');
    expect(svg).not.toContain('height="24"');
  });

  it('returns the filled markup for a curated id that has a filled variant', () => {
    const svg = tablerMarkerSvg('home', 'filled', 32);
    expect(svg).toContain('icons-tabler-filled');
  });

  it('falls back to outline markup when the filled variant is requested but none is curated - not every icon has one', () => {
    const svg = tablerMarkerSvg('coffee', 'filled', 32);
    expect(svg).toContain('icons-tabler-outline');
  });
});
