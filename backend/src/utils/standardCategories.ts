export const STANDARD_SPOT_CATEGORIES: string[] = [
  'Restaurant',
  'Café',
  'Ausflugsziel',
  'Shop',
  'Museum',
  'Aktivität',
  'Sehenswürdigkeit',
  'Strand',
  'Natur',
  'Aussichtspunkt',
  'Wanderweg',
  'Nachtleben',
  'Supermarkt',
  'Bäckerei',
  'Apotheke',
  'Tankstelle',
  'Flughafen',
  'Bahnhof',
  'Busbahnhof',
  'Hafen',
  'Raststätte',
  'Zuhause',
  'Unterkunft',
  'Park & Garten',
  'Zoo & Tierpark',
  'Spielplatz',
  'Kirche & Tempel',
  'Theater & Bühne',
  'Sport & Fitness',
  'Wellness & Therme',
  'Campingplatz',
  'Parkplatz',
  'Geldautomat & Bank',
];

export const STANDARD_EXPENSE_CATEGORIES: string[] = [
  'Unterkunft',
  'Essen & Trinken',
  'Supermarkt & Lebensmittel',
  'Transport',
  'Flug & Anreise',
  'Mietwagen & Roller',
  'Tanken & Laden',
  'Maut & Vignetten',
  'Parken & Stellplatz',
  'Aktivitäten & Spaß',
  'Kultur & Sehenswürdigkeiten',
  'Tickets & Events',
  'Natur & Nationalparks',
  'Strand & Wasser',
  'Nachtleben & Bars',
  'Shopping & Mode',
  'Souvenirs',
  'Wellness & Entspannung',
  'Gesundheit & Apotheke',
  'Kurtaxe & Gebühren',
  'Trinkgelder',
  'SIM-Karte & Internet',
  'Versicherungen & Schutz',
  'Ausrüstung & Outdoor',
  'Wäsche & Reinigung',
  'Sonstiges',
];

export const STANDARD_PACKING_CATEGORIES: string[] = [
  'Kleidung',
  'Elektronik',
  'Dokumente',
  'Kosmetik & Gesundheit',
  'Sonstiges',
];

export const STANDARD_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  spot: STANDARD_SPOT_CATEGORIES,
  expense: STANDARD_EXPENSE_CATEGORIES,
  packing: STANDARD_PACKING_CATEGORIES,
};

export function findStandardCategory(type: string, name: string): string | undefined {
  const standards = STANDARD_CATEGORIES_BY_TYPE[type] || [];
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) return undefined;
  return standards.find((s) => s.toLowerCase() === trimmed);
}
