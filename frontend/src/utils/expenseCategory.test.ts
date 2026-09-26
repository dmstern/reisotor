import { describe, it, expect } from 'vitest';
import {
  expenseCategoryMeta,
  EXPENSE_CATEGORY_SUGGESTIONS,
  KNOWN_EXPENSE_CATEGORIES,
} from './expenseCategory';

describe('expenseCategory', () => {
  it('has a comprehensive list of suggestions', () => {
    expect(EXPENSE_CATEGORY_SUGGESTIONS.length).toBeGreaterThanOrEqual(25);
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Unterkunft');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Essen & Trinken');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Transport');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Aktivitäten & Spaß');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Supermarkt & Lebensmittel');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Tanken & Laden');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Maut & Vignetten');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Parken & Stellplatz');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Kurtaxe & Gebühren');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Trinkgelder');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('SIM-Karte & Internet');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Souvenirs');
    expect(EXPENSE_CATEGORY_SUGGESTIONS).toContain('Sonstiges');
  });

  it('provides valid IconDef and emoji for all known categories', () => {
    for (const cat of KNOWN_EXPENSE_CATEGORIES) {
      expect(cat.icon).toBeTruthy();
      expect(cat.tabler).toBeDefined();
      expect(cat.tabler.id).toBeTruthy();
      expect(cat.tabler.emoji).toBe(cat.icon);
      expect(cat.tabler.outline).toBeDefined();
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('resolves exact category names case-insensitively with trimming', () => {
    const meta = expenseCategoryMeta('  essen & trinken  ');
    expect(meta.icon).toBe('🍽️');
    expect(meta.tabler.id).toBe('tools-kitchen-2');
    expect(meta.color).toBe('#e34948');
  });

  it('resolves aliases to the correct parent category', () => {
    expect(expenseCategoryMeta('hotel').icon).toBe('🛏️');
    expect(expenseCategoryMeta('restaurant').icon).toBe('🍽️');
    expect(expenseCategoryMeta('zug').icon).toBe('🚆');
    expect(expenseCategoryMeta('flug').icon).toBe('✈️');
    expect(expenseCategoryMeta('tanken').icon).toBe('⛽');
    expect(expenseCategoryMeta('vignette').icon).toBe('🛣️');
    expect(expenseCategoryMeta('kurtaxe').icon).toBe('🏷️');
    expect(expenseCategoryMeta('trinkgeld').icon).toBe('🪙');
    expect(expenseCategoryMeta('esim').icon).toBe('📶');
  });

  it('returns fallback for unknown categories with deterministic color', () => {
    const meta1 = expenseCategoryMeta('Geocaching Ausrüstung');
    const meta2 = expenseCategoryMeta('Geocaching Ausrüstung');
    expect(meta1.tabler.id).toBe('category');
    expect(meta1.color).toBe(meta2.color);
  });

  it('handles null, undefined and empty string gracefully', () => {
    expect(expenseCategoryMeta(null).tabler.id).toBe('category');
    expect(expenseCategoryMeta(undefined).tabler.id).toBe('category');
    expect(expenseCategoryMeta('').tabler.id).toBe('category');
    expect(expenseCategoryMeta('   ').tabler.id).toBe('category');
  });
});
