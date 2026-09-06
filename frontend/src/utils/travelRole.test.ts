import { describe, it, expect } from 'vitest';
import {
  TRAVEL_ROLE_META,
  TRAVEL_ROLE_OPTIONS,
  TOUR_ROLE_META,
  TOUR_ROLE_OPTIONS,
  getTourRoleIconDef,
} from './travelRole';
import { SECTION_ICON_DEFS } from './sectionIcons';

describe('travelRole', () => {
  it('defines correct icons and labels for all travel roles', () => {
    expect(TRAVEL_ROLE_META.arrival.icon).toBe('🛫');
    expect(TRAVEL_ROLE_META.arrival.label).toBe('Anreise');

    expect(TRAVEL_ROLE_META.departure.icon).toBe('🛬');
    expect(TRAVEL_ROLE_META.departure.label).toBe('Abreise');

    expect(TRAVEL_ROLE_META.onward.icon).toBe('🚆');
    expect(TRAVEL_ROLE_META.onward.label).toBe('Weiterreise');
    expect(TRAVEL_ROLE_META.onward.tabler.id).toBe('train');
  });

  it('includes arrival, departure, onward in TRAVEL_ROLE_OPTIONS', () => {
    expect(TRAVEL_ROLE_OPTIONS).toEqual(['arrival', 'departure', 'onward']);
  });

  it('defines TOUR_ROLE_OPTIONS including excursion', () => {
    expect(TOUR_ROLE_OPTIONS).toEqual(['arrival', 'departure', 'onward', 'excursion']);
    expect(TOUR_ROLE_META.excursion.icon).toBe('🎒');
    expect(TOUR_ROLE_META.excursion.label).toBe('Ausflug');
  });

  it('getTourRoleIconDef returns the correct icon for each role', () => {
    expect(getTourRoleIconDef('arrival')).toBe(TRAVEL_ROLE_META.arrival.tabler);
    expect(getTourRoleIconDef('departure')).toBe(TRAVEL_ROLE_META.departure.tabler);
    expect(getTourRoleIconDef('onward')).toBe(TRAVEL_ROLE_META.onward.tabler);
    expect(getTourRoleIconDef(null)).toBe(SECTION_ICON_DEFS.excursions);
    expect(getTourRoleIconDef(undefined)).toBe(SECTION_ICON_DEFS.excursions);
  });
});
