import { describe, it, expect } from 'vitest';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS, KNOWN_CATEGORIES } from './spotCategory';

describe('spotCategory', () => {
  it('has expanded spot category suggestions', () => {
    expect(SPOT_CATEGORY_SUGGESTIONS.length).toBeGreaterThanOrEqual(30);
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Park & Garten');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Zoo & Tierpark');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Kirche & Tempel');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Theater & Bühne');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Sport & Fitness');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Wellness & Therme');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Campingplatz');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Parkplatz');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Geldautomat & Bank');
  });

  it('provides valid IconDef and emoji for all known spot categories', () => {
    for (const cat of KNOWN_CATEGORIES) {
      expect(cat.icon).toBeTruthy();
      expect(cat.tabler).toBeDefined();
      expect(cat.tabler.id).toBeTruthy();
      expect(cat.tabler.emoji).toBe(cat.icon);
      expect(cat.tabler.outline).toBeDefined();
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('resolves aliases correctly', () => {
    expect(spotCategoryMeta('hotel').icon).toBe('🛏️');
    expect(spotCategoryMeta('zoo').icon).toBe('🦁');
    expect(spotCategoryMeta('kirche').icon).toBe('⛪');
    expect(spotCategoryMeta('camping').icon).toBe('⛺');
    expect(spotCategoryMeta('atm').icon).toBe('🏧');
    expect(spotCategoryMeta('parkplatz').icon).toBe('🅿️');
  });

  it('falls back to map-pin for unknown categories', () => {
    const meta = spotCategoryMeta('Geheimer Fotospot');
    expect(meta.tabler.id).toBe('map-pin');
    expect(meta.icon).toBe('📍');
  });
});
