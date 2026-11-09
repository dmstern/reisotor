import { describe, it, expect } from 'vitest';
import {
  spotCategoryMeta,
  SPOT_CATEGORY_SUGGESTIONS,
  KNOWN_CATEGORIES,
  isHomeCategory,
  isTransitCategory,
  isVacationCategory,
  spotTitlePlaceholder,
  DEFAULT_SPOT_TITLE_PLACEHOLDER,
} from './spotCategory';

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
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Bar');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Kneipe');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Club');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Agentur');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Unternehmen');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Kino');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Eiscafé');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Bibliothek & Buchhandlung');
    expect(SPOT_CATEGORY_SUGGESTIONS).toContain('Krankenhaus & Klinik');
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
    expect(spotCategoryMeta('club').icon).toBe('🪩');
    expect(spotCategoryMeta('kneipe').icon).toBe('🍺');
    expect(spotCategoryMeta('bar').icon).toBe('🍸');
    expect(spotCategoryMeta('agentur').icon).toBe('💻');
    expect(spotCategoryMeta('kino').icon).toBe('🎬');
    expect(spotCategoryMeta('eisdiele').icon).toBe('🍨');
    expect(spotCategoryMeta('krankenhaus').icon).toBe('🏥');
    expect(spotCategoryMeta('bibliothek').icon).toBe('📚');
  });

  it('falls back to map-pin for unknown categories', () => {
    const meta = spotCategoryMeta('Geheimer Fotospot');
    expect(meta.tabler.id).toBe('map-pin');
    expect(meta.icon).toBe('📍');
  });

  it('correctly classifies home categories', () => {
    expect(isHomeCategory('Zuhause')).toBe(true);
    expect(isHomeCategory('zuhause')).toBe(true);
    expect(isHomeCategory('Heimat')).toBe(true);
    expect(isHomeCategory('Wohnung')).toBe(true);
    expect(isHomeCategory('Home')).toBe(true);
    expect(isHomeCategory('daheim')).toBe(true);
    expect(isHomeCategory('Unterkunft')).toBe(false);
    expect(isHomeCategory('Flughafen')).toBe(false);
    expect(isHomeCategory('')).toBe(false);
    expect(isHomeCategory(undefined)).toBe(false);
  });

  it('correctly classifies transit categories', () => {
    expect(isTransitCategory('Flughafen')).toBe(true);
    expect(isTransitCategory('Airport')).toBe(true);
    expect(isTransitCategory('Bahnhof')).toBe(true);
    expect(isTransitCategory('Zug')).toBe(true);
    expect(isTransitCategory('Hafen')).toBe(true);
    expect(isTransitCategory('Fähre')).toBe(true);
    expect(isTransitCategory('Busbahnhof')).toBe(true);
    expect(isTransitCategory('Raststätte')).toBe(true);
    expect(isTransitCategory('Zuhause')).toBe(false);
    expect(isTransitCategory('Unterkunft')).toBe(false);
    expect(isTransitCategory('Restaurant')).toBe(false);
  });

  it('correctly classifies vacation categories', () => {
    expect(isVacationCategory('Unterkunft')).toBe(true);
    expect(isVacationCategory('Hotel')).toBe(true);
    expect(isVacationCategory('Restaurant')).toBe(true);
    expect(isVacationCategory('Strand')).toBe(true);
    expect(isVacationCategory('Museum')).toBe(true);
    expect(isVacationCategory('Zuhause')).toBe(false);
    expect(isVacationCategory('Flughafen')).toBe(false);
    expect(isVacationCategory('Bahnhof')).toBe(false);
  });

  it('provides matching title placeholders for various spot categories and synonyms', () => {
    // User requested examples
    expect(spotTitlePlaceholder('Kneipe')).toBe('Name der Kneipe...');
    expect(spotTitlePlaceholder('Restaurant')).toBe('Name des Restaurants...');
    expect(spotTitlePlaceholder('Strand')).toBe('Name des Strands...');
    expect(spotTitlePlaceholder('Unterkunft')).toBe('Name der Unterkunft...');

    // Synonyms & specific cases
    expect(spotTitlePlaceholder('Pub')).toBe('Name des Pubs...');
    expect(spotTitlePlaceholder('Biergarten')).toBe('Name des Biergartens...');
    expect(spotTitlePlaceholder('Hotel')).toBe('Name des Hotels...');
    expect(spotTitlePlaceholder('Ferienwohnung')).toBe('Name der Ferienwohnung...');
    expect(spotTitlePlaceholder('Café')).toBe('Name des Cafés...');
    expect(spotTitlePlaceholder('Bar')).toBe('Name der Bar...');
    expect(spotTitlePlaceholder('Club')).toBe('Name des Clubs...');
    expect(spotTitlePlaceholder('Museum')).toBe('Name des Museums...');
    expect(spotTitlePlaceholder('Schloss')).toBe('Name des Schlosses...');
    expect(spotTitlePlaceholder('Wanderweg')).toBe('Name des Wanderwegs...');
    expect(spotTitlePlaceholder('Aussichtspunkt')).toBe('Name des Aussichtspunkts...');
    expect(spotTitlePlaceholder('Flughafen')).toBe('Name des Flughafens...');
    expect(spotTitlePlaceholder('Bahnhof')).toBe('Name des Bahnhofs...');
    expect(spotTitlePlaceholder('Zuhause')).toBe('Name des Heimatorts...');
    expect(spotTitlePlaceholder('Supermarkt')).toBe('Name des Supermarkts...');
    expect(spotTitlePlaceholder('Bäckerei')).toBe('Name der Bäckerei...');
    expect(spotTitlePlaceholder('Apotheke')).toBe('Name der Apotheke...');
    expect(spotTitlePlaceholder('Tankstelle')).toBe('Name der Tankstelle...');
    expect(spotTitlePlaceholder('Campingplatz')).toBe('Name des Campingplatzes...');
    expect(spotTitlePlaceholder('Kino')).toBe('Name des Kinos...');
    expect(spotTitlePlaceholder('Eiscafé')).toBe('Name des Eiscafés...');

    // Fallbacks
    expect(spotTitlePlaceholder('')).toBe(DEFAULT_SPOT_TITLE_PLACEHOLDER);
    expect(spotTitlePlaceholder(null)).toBe(DEFAULT_SPOT_TITLE_PLACEHOLDER);
    expect(spotTitlePlaceholder(undefined)).toBe(DEFAULT_SPOT_TITLE_PLACEHOLDER);
    expect(spotTitlePlaceholder('Unbekannte Spezialkategorie')).toBe(
      DEFAULT_SPOT_TITLE_PLACEHOLDER
    );
  });
});
