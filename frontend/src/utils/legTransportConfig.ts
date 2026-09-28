import { IconBrandCitymapper, IconSTurnRight } from '@tabler/icons-vue';
import type { IconDef } from './icon';
import type { FormFieldIconKey } from './formFieldIcons';
import { ACTION_ICONS } from './actionIcons';
import { travelTypeIconDef } from './travelTypeIcon';

export type TransportCategory = 'zu Fuß' | 'Auto' | 'Fahrrad' | 'ÖPNV';

export const TRANSPORT_MODE_OPTIONS: {
  value: TransportCategory;
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'zu Fuß',
    label: 'Zu Fuß',
    icon: travelTypeIconDef('zu Fuß'),
  },
  {
    value: 'Auto',
    label: 'Auto',
    icon: travelTypeIconDef('Auto'),
  },
  {
    value: 'Fahrrad',
    label: 'Fahrrad',
    icon: travelTypeIconDef('Fahrrad'),
  },
  {
    value: 'ÖPNV',
    label: 'ÖPNV',
    icon: travelTypeIconDef('ÖPNV'),
  },
];

export const DEFAULT_TRANSIT_OPTIONS = [
  'Zug',
  'Bus',
  'Straßenbahn',
  'U-Bahn',
  'Fähre',
  'Flug',
  'Sonstiges',
];

export const ROUTE_MODE_OPTIONS: {
  value: 'exact' | 'direct';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'exact',
    label: 'Exakte Route',
    icon: { id: 's-turn-right', emoji: '🗺️', outline: IconSTurnRight },
  },
  {
    value: 'direct',
    label: 'Luftlinie',
    icon: { id: 'brand-citymapper', emoji: '〰️', outline: IconBrandCitymapper },
  },
];

export const ROUTE_PREFERENCE_OPTIONS: {
  value: 'fastest' | 'shortest';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'fastest',
    label: 'Schnellste Route',
    icon: ACTION_ICONS.duration,
  },
  {
    value: 'shortest',
    label: 'Kürzeste Strecke',
    icon: ACTION_ICONS.distance,
  },
];

export function getCategoryFromType(type?: string | null): TransportCategory {
  if (!type) return 'zu Fuß';
  const lower = type.trim().toLowerCase();
  if (lower === 'zu fuß' || lower === 'zu fuss' || lower === 'fuss' || lower === 'fuß') {
    return 'zu Fuß';
  }
  if (lower === 'auto' || lower === 'car') {
    return 'Auto';
  }
  if (lower === 'fahrrad' || lower === 'rad' || lower === 'bike') {
    return 'Fahrrad';
  }
  return 'ÖPNV';
}

export function getDepartureLabel(type?: string | null): string {
  if (!type) return 'Abfahrt';
  const lower = type.trim().toLowerCase();
  if (
    lower === 'zu fuß' ||
    lower === 'zu fuss' ||
    lower === 'fuss' ||
    lower === 'fuß' ||
    lower === 'wandern' ||
    lower === 'walk'
  ) {
    return 'Losgehen';
  }
  if (lower === 'flug' || lower === 'flugzeug' || lower === 'flight' || lower === 'plane') {
    return 'Abflug';
  }
  if (
    lower === 'fähre' ||
    lower === 'faehre' ||
    lower === 'schiff' ||
    lower === 'boot' ||
    lower === 'ferry' ||
    lower === 'boat'
  ) {
    return 'Ablegen';
  }
  return 'Abfahrt';
}

export interface ExtendedFieldsConfig {
  showsSeat: boolean;
  labels: {
    checkin: string;
    seat: string;
    luggage: string;
    ticketLink: string;
    amount: string;
    note: string;
  };
  placeholders: {
    checkin: string;
    seat: string;
    luggage: string;
    ticketLink: string;
    amount: string;
    note: string;
  };
  icons: {
    checkin: FormFieldIconKey;
    seat: FormFieldIconKey;
    luggage: FormFieldIconKey;
    ticketLink: FormFieldIconKey;
    amount: FormFieldIconKey;
    note: FormFieldIconKey;
  };
}

export function getExtendedFieldsConfig(transportType?: string | null): ExtendedFieldsConfig {
  const type = (transportType || '').trim().toLowerCase();

  // 1. Zu Fuß / Wandern
  if (
    type === 'zu fuß' ||
    type === 'zu fuss' ||
    type === 'fuss' ||
    type === 'fuß' ||
    type === 'wandern' ||
    type === 'walk' ||
    type === 'spaziergang'
  ) {
    return {
      showsSeat: false,
      labels: {
        checkin: 'Treffpunkt / Startpunkt',
        seat: 'Sitzplatz / Rastplatz',
        luggage: 'Ausrüstung & Rucksack',
        ticketLink: 'Touren-Link / Wanderkarte',
        amount: 'Eintritt & Kosten (€)',
        note: 'Notiz zur Strecke',
      },
      placeholders: {
        checkin: 'z. B. Vor dem Haupteingang, Brunnen am Marktplatz',
        seat: 'z. B. Bank am Aussichtspunkt',
        luggage: 'z. B. Wanderschuhe, Regenjacke, 20L-Tagesrucksack',
        ticketLink: 'z. B. Komoot-Tour, AllTrails, Park-Webseite',
        amount: 'z. B. Nationalpark-Gebühr, Führung',
        note: 'z. B. Schöne Fotospots, steiler Anstieg, Einkehrmöglichkeit',
      },
      icons: {
        checkin: 'location',
        seat: 'note',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 2. Fahrrad
  if (
    type === 'fahrrad' ||
    type === 'rad' ||
    type === 'bike' ||
    type === 'e-bike' ||
    type === 'mountainbike'
  ) {
    return {
      showsSeat: false,
      labels: {
        checkin: 'Treffpunkt / Fahrradverleih',
        seat: 'Fahrrad / Rad-Nummer',
        luggage: 'Fahrrad-Typ & Ausrüstung',
        ticketLink: 'Routen-Link / Leihrad-App',
        amount: 'Leihgebühr & Kosten (€)',
        note: 'Notiz zur Radstrecke',
      },
      placeholders: {
        checkin: 'z. B. Radstation Gleis 1, Nextbike-Station Hafen',
        seat: 'z. B. Rad #42',
        luggage: 'z. B. E-Bike mit Packtaschen, Helm, Schloss',
        ticketLink: 'z. B. Komoot-Route, Nextbike-Buchung, Mietvertrag',
        amount: 'z. B. 15.00 für Leihrad oder Akku-Aufladung',
        note: 'z. B. Steile Steigung, Schotterweg, Schloss-Code',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 3. Auto / Taxi / Mietwagen / Carsharing
  if (
    type === 'auto' ||
    type === 'car' ||
    type === 'taxi' ||
    type === 'uber' ||
    type === 'mietwagen' ||
    type === 'carsharing'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Treffpunkt / Abholort',
        seat: 'Fahrzeug / Fahrer:in',
        luggage: 'Kofferraum & Gepäck',
        ticketLink: 'Mietwagen-Link / Buchung',
        amount: 'Kosten (Maut, Sprit, Miete) (€)',
        note: 'Notiz zur Fahrt',
      },
      placeholders: {
        checkin: 'z. B. Mietwagen-Station Terminal 1, Hotelauffahrt',
        seat: 'z. B. Sixt Buchung XYZ, VW Golf, Fahrer:in Alice',
        luggage: 'z. B. 2 große Koffer im Kofferraum, Kindersitz',
        ticketLink: 'z. B. Buchungsbestätigung Mietwagen, Uber-Link',
        amount: 'z. B. 45.00 für Maut, Parkhaus oder Benzin',
        note: 'z. B. Parkhaus P2 reserviert, Umweltplakette beachten',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 4. Flug
  if (type === 'flug' || type === 'flugzeug' || type === 'flight' || type === 'plane') {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Terminal, Gate & Check-in',
        seat: 'Sitzplatz & Flugnummer',
        luggage: 'Aufgabe- & Handgepäck',
        ticketLink: 'Online-Check-in / Flug-Link',
        amount: 'Flugkosten (€)',
        note: 'Notiz zum Flug',
      },
      placeholders: {
        checkin: 'z. B. Terminal 2, Gate B14, 2 Std. vorher da sein',
        seat: 'z. B. LH 1234, Sitz 14A (Fenster)',
        luggage: 'z. B. 1x Koffer 23kg, Handgepäck-Trolley',
        ticketLink: 'z. B. Airline-Buchung, Bordkarte, Flugverfolgung',
        amount: 'z. B. 149.00',
        note: 'z. B. Buchungscode (PNR): ABCD12, Reisepass mitnehmen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 5. Fähre / Schiff
  if (
    type === 'fähre' ||
    type === 'faehre' ||
    type === 'schiff' ||
    type === 'boot' ||
    type === 'ferry' ||
    type === 'boat'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Pier, Anleger & Boarding',
        seat: 'Kabine / Deck / Sitzplatz',
        luggage: 'Fahrzeugmitnahme & Gepäck',
        ticketLink: 'Fähr-Ticket / Buchungslink',
        amount: 'Fahrtkosten / Überfahrt (€)',
        note: 'Notiz zur Überfahrt',
      },
      placeholders: {
        checkin: 'z. B. Pier 3, Terminal Ost, 30 Min. vor Ablegen',
        seat: 'z. B. Sonnendeck, Kabine 402, Pullmansitz 12',
        luggage: 'z. B. Auto auf Autodeck, 2 Reisetaschen',
        ticketLink: 'z. B. Buchungsbestätigung Fährlinie, E-Ticket',
        amount: 'z. B. 45.00',
        note: 'z. B. Buchungsnummer, Voucher am Schalter umtauschen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 6. Bus
  if (type === 'bus' || type === 'fernbus' || type === 'reisebus') {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Haltestelle & Bussteig',
        seat: 'Sitzplatz',
        luggage: 'Freigepäck & Handgepäck',
        ticketLink: 'Bus-Ticket / Buchungslink',
        amount: 'Ticketkosten (€)',
        note: 'Notiz zur Busfahrt',
      },
      placeholders: {
        checkin: 'z. B. ZOB Steig 4, 15 Min. vor Abfahrt',
        seat: 'z. B. Reihe 5, Platz 18 (Fenster)',
        luggage: 'z. B. 1x Koffer im Laderaum, Handgepäck',
        ticketLink: 'z. B. FlixBus-Ticket, ÖPNV-Ticket',
        amount: 'z. B. 19.99',
        note: 'z. B. QR-Code in App bereithalten',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 7. Zug / Bahn / Straßenbahn / U-Bahn / Standard-ÖPNV
  if (
    type === 'zug' ||
    type === 'bahn' ||
    type === 'straßenbahn' ||
    type === 'strassenbahn' ||
    type === 'tram' ||
    type === 'u-bahn' ||
    type === 'ubahn' ||
    type === 'metro' ||
    type === 'öpnv'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Gleis & Einstieg',
        seat: 'Wagen & Sitzplatz',
        luggage: 'Gepäck & Fahrradmitnahme',
        ticketLink: 'Ticket-Link / Online-Ticket',
        amount: 'Ticketkosten (€)',
        note: 'Notiz zur Teilstrecke',
      },
      placeholders: {
        checkin: 'z. B. Gleis 7 A-C, 10 Min. vorher am Bahnsteig',
        seat: 'z. B. Wagen 23, Platz 64 (Ruhebereich, Fenster)',
        luggage: 'z. B. Koffer im Gepäckregal, Fahrradstellplatz #3',
        ticketLink: 'z. B. Bahn.de-Buchung, ÖPNV-Ticket-App',
        amount: 'z. B. 49.90',
        note: 'z. B. Umstieg in Mannheim (nur 6 Min.!), Wagenreihung prüfen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // Fallback (z. B. Sonstiges)
  return {
    showsSeat: true,
    labels: {
      checkin: 'Vorher da sein / Treffpunkt',
      seat: 'Sitzplatz',
      luggage: 'Gepäck',
      ticketLink: 'Buchungslink / Ticket-URL',
      amount: 'Ticketkosten (€)',
      note: 'Notiz zur Teilstrecke',
    },
    placeholders: {
      checkin: 'z. B. Treffpunkt oder Haltestelle',
      seat: 'z. B. Platznummer oder Bereich',
      luggage: 'z. B. Taschen, Koffer',
      ticketLink: 'https://...',
      amount: 'z. B. 25.00',
      note: 'Wichtige Hinweise zur Teilstrecke',
    },
    icons: {
      checkin: 'location',
      seat: 'category',
      luggage: 'note',
      ticketLink: 'link',
      amount: 'amount',
      note: 'note',
    },
  };
}
