import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLOR_PALETTE,
  CATEGORY_ICON_PALETTE,
  findCategoryIcon,
  getCategoryIconDef,
  resolveCategoryMeta,
} from './categoryIcons';

describe('categoryIcons', () => {
  it('enthält eine Palette mit Icons und Farben', () => {
    expect(CATEGORY_ICON_PALETTE.length).toBeGreaterThanOrEqual(30);
    expect(CATEGORY_COLOR_PALETTE.length).toBeGreaterThanOrEqual(10);
  });

  it('findet Icons anhand der ID und liefert Tabler-IconDef', () => {
    const bed = findCategoryIcon('bed');
    expect(bed).toBeDefined();
    expect(bed?.label).toContain('Unterkunft');
    expect(bed?.defaultEmoji).toBe('🛏️');

    const def = getCategoryIconDef('bed', '🏨');
    expect(def.id).toBe('bed');
    expect(def.emoji).toBe('🏨');
  });

  it('löst benutzerdefinierte Kategorie-Metadaten vorrangig auf', () => {
    const meta = resolveCategoryMeta('Mein Bootsverleih', 'spot', {
      icon: 'swimming',
      emoji: '🚤',
      color: '#0ea5e9',
    });
    expect(meta.label).toBe('Mein Bootsverleih');
    expect(meta.icon).toBe('🚤');
    expect(meta.color).toBe('#0ea5e9');
    expect(meta.tabler.id).toBe('swimming');
  });

  it('fällt bei fehlenden Custom-Werten auf Standard-Kategorien zurück', () => {
    const meta = resolveCategoryMeta('Unterkunft', 'expense');
    expect(meta.color).toBe('#1baf7a');
    expect(meta.tabler.id).toBe('bed');
  });
});
