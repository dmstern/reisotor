import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTourSerpentine } from './useTourSerpentine';
import type { Excursion, ExcursionLeg, Spot } from '../api/types';

describe('useTourSerpentine', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function createMockSpot(partial: Partial<Spot>): Spot {
    return partial as unknown as Spot;
  }

  function createMockExcursion(partial: Partial<Excursion>): Excursion {
    return partial as unknown as Excursion;
  }

  const mockSpot1 = createMockSpot({
    id: 1,
    trip_id: 1,
    title: 'Startbahnhof',
    category: 'Bahnhof',
  });

  const mockSpot2 = createMockSpot({
    id: 2,
    trip_id: 1,
    title: 'Zwischenstopp',
    category: 'Aussichtspunkt',
  });

  const mockSpot3 = createMockSpot({
    id: 3,
    trip_id: 1,
    title: 'Zielort',
    category: 'Hotel',
  });

  it('ermittelt Spaltenanzahl basierend auf Containerbreite', () => {
    const { getTourCols, tourWrapWidths } = useTourSerpentine();

    expect(getTourCols(10)).toBe(1);

    tourWrapWidths.set(10, 600);
    expect(getTourCols(10)).toBe(2);

    tourWrapWidths.set(10, 900);
    expect(getTourCols(10)).toBe(3);

    tourWrapWidths.set(10, 1300);
    expect(getTourCols(10)).toBe(4);
  });

  it('liefert Legs, Dauer und Tooltip korrekt zurück', () => {
    const { getTourLeg, getLegDuration, getLegDurationParts, getLegTooltip } = useTourSerpentine();

    const leg1: ExcursionLeg = {
      from_spot_id: 1,
      to_spot_id: 2,
      position: 0,
      transport_type: 'Zug',
      departure_time: '10:00',
      arrival_time: '11:30',
      amount: 24.5,
    };

    const excursion = createMockExcursion({
      id: 10,
      trip_id: 1,
      title: 'Tagestour',
      spot_ids: [1, 2, 3],
      legs: [leg1],
    });

    const foundLeg = getTourLeg(excursion, 1, 2);
    expect(foundLeg).toBeDefined();
    expect(foundLeg?.transport_type).toBe('Zug');

    expect(getTourLeg(excursion, 2, 3)).toBeUndefined();

    // 90 Minuten Dauer
    expect(getLegDuration(leg1)).toBe('1\u00A0Std. 30\u00A0Min.');
    expect(getLegDurationParts(leg1)).toEqual(['1\u00A0Std.', '30\u00A0Min.']);

    const tooltip = getLegTooltip(leg1, mockSpot1, mockSpot2);
    expect(tooltip).toContain('Zug');
    expect(tooltip).toContain('10:00–11:30');
    expect(tooltip).toContain('24,50\u00A0€');
    expect(tooltip).toContain('Von: Startbahnhof → Nach: Zwischenstopp');
  });

  it('berechnet Umstiegs-/Layover-Zeiten zwischen Legs', () => {
    const { getTourLayover } = useTourSerpentine();

    const legIn: ExcursionLeg = {
      from_spot_id: 1,
      to_spot_id: 2,
      position: 0,
      departure_time: '08:00',
      arrival_time: '09:15',
    };

    const legOut: ExcursionLeg = {
      from_spot_id: 2,
      to_spot_id: 3,
      position: 1,
      departure_time: '09:45',
      arrival_time: '11:00',
    };

    const excursion = createMockExcursion({
      id: 10,
      trip_id: 1,
      title: 'Zugfahrt',
      spot_ids: [1, 2, 3],
      legs: [legIn, legOut],
    });

    const items = [{ spot: mockSpot1 }, { spot: mockSpot2 }, { spot: mockSpot3 }];

    // Ankunft 09:15, Abfahrt 09:45 -> 30 Minuten Umstieg an Station Index 1 (mockSpot2)
    expect(getTourLayover(excursion, items, 1)).toBe(30);

    // Erste und letzte Station haben keinen Layover
    expect(getTourLayover(excursion, items, 0)).toBeNull();
    expect(getTourLayover(excursion, items, 2)).toBeNull();
  });

  it('öffnet das Leg-Modal mit bestehendem oder neuem Leg', () => {
    const { showCardLegModal, editingCardLeg, openCardLegModal } = useTourSerpentine();

    const excursion = createMockExcursion({
      id: 10,
      trip_id: 1,
      title: 'Tour',
      spot_ids: [1, 2],
      legs: [],
    });

    expect(showCardLegModal.value).toBe(false);
    expect(editingCardLeg.value).toBeNull();

    openCardLegModal(excursion, mockSpot1, mockSpot2);

    expect(showCardLegModal.value).toBe(true);
    expect(editingCardLeg.value?.fromSpot.id).toBe(1);
    expect(editingCardLeg.value?.toSpot.id).toBe(2);
    expect(editingCardLeg.value?.leg.from_spot_id).toBe(1);
  });
});
