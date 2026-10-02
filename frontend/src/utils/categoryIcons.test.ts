import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLOR_PALETTE,
  CATEGORY_ICON_PALETTE,
  findCategoryIcon,
  findCategoryIconByEmoji,
  getCategoryIconDef,
  resolveCategoryMeta,
} from './categoryIcons';

describe('categoryIcons', () => {
  it('enthält eine Palette mit mindestens 100 Icons und reichhaltigen Farben', () => {
    expect(CATEGORY_ICON_PALETTE.length).toBeGreaterThanOrEqual(100);
    expect(CATEGORY_COLOR_PALETTE.length).toBeGreaterThanOrEqual(10);

    // Alle Icons müssen vollständige Metadaten besitzen
    for (const opt of CATEGORY_ICON_PALETTE) {
      expect(opt.id).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.defaultEmoji).toBeTruthy();
      expect(opt.tabler).toBeDefined();
      expect(opt.tabler.outline).toBeDefined();
    }
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

  it('findet Icons per Fallback-Emoji wenn Icon-ID fehlt', () => {
    const byEmoji = findCategoryIconByEmoji('🍕');
    expect(byEmoji).toBeDefined();
    expect(byEmoji?.id).toBe('pizza');

    const fallback = findCategoryIcon(undefined, '🍕');
    expect(fallback).toBeDefined();
    expect(fallback?.id).toBe('pizza');
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

  it('löst alle Standard-Icons aus spotCategory und expenseCategory korrekt auf und verhindert generische Fallbacks', () => {
    // Wellness & Therme muss das Massage-Icon haben, nicht das generische Category-Icon
    const wellnessMeta = resolveCategoryMeta('Wellness & Therme', 'spot');
    expect(wellnessMeta.tabler.id).toBe('massage');
    expect(wellnessMeta.icon).toBe('💆');
    expect(wellnessMeta.color).toBe('#14b8a6');

    // Ausflugsziel muss target haben
    const targetMeta = resolveCategoryMeta('Ausflugsziel', 'spot');
    expect(targetMeta.tabler.id).toBe('target');
    expect(targetMeta.icon).toBe('🎯');

    // Spielplatz muss mood-kid haben
    const spielplatzMeta = resolveCategoryMeta('Spielplatz', 'spot');
    expect(spielplatzMeta.tabler.id).toBe('mood-kid');
    expect(spielplatzMeta.icon).toBe('🛝');

    // Geldautomat & Bank muss cash haben
    const atmMeta = resolveCategoryMeta('Geldautomat & Bank', 'spot');
    expect(atmMeta.tabler.id).toBe('cash');
    expect(atmMeta.icon).toBe('🏧');

    // Zoo & Tierpark muss paw haben
    const zooMeta = resolveCategoryMeta('Zoo & Tierpark', 'spot');
    expect(zooMeta.tabler.id).toBe('paw');
    expect(zooMeta.icon).toBe('🦁');
  });

  it('behält das Standard-Icon bei, wenn nur eine benutzerdefinierte Farbe angegeben wird', () => {
    const customizedColorOnly = resolveCategoryMeta('Wellness & Therme', 'spot', {
      color: '#8b5cf6',
      icon: null,
      emoji: null,
    });
    expect(customizedColorOnly.color).toBe('#8b5cf6');
    expect(customizedColorOnly.tabler.id).toBe('massage');
    expect(customizedColorOnly.icon).toBe('💆');
  });

  it('findet Icons anhand alternativer Emojis aus Keywords (z. B. 🥾 für Wandern, 🌄 für Aussichtspunkt)', () => {
    const walkOpt = findCategoryIcon(undefined, '🥾');
    expect(walkOpt).toBeDefined();
    expect(walkOpt?.id).toBe('walk');

    const mountainOpt = findCategoryIcon(undefined, '🌄');
    expect(mountainOpt).toBeDefined();
    expect(mountainOpt?.id).toBe('mountain');
  });
});
