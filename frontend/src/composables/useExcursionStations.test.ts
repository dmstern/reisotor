// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useExcursionStations } from './useExcursionStations';
import { useTracksStore } from '../stores/tracks';
import type { Excursion, LocationTrack, Spot, TravelItem } from '../api/types';

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 1,
    trip_id: 10,
    title: 'Tagesausflug',
    spot_ids: [101, 102],
    done: 0,
    ...partial,
  } as unknown as Excursion;
}

function createMockSpot(partial: Partial<Spot>): Spot {
  return {
    id: 101,
    trip_id: 10,
    title: 'Spot A',
    lat: 48.2,
    lng: 16.3,
    ...partial,
  } as Spot;
}

describe('useExcursionStations', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('löst Stationen sauber auf und erkennt kartierte Koordinaten', () => {
    const excursion = ref(createMockExcursion({ spot_ids: [101, 102] }));
    const stations = ref([
      createMockSpot({ id: 101, title: 'Spot A', lat: 48.2, lng: 16.3 }),
      createMockSpot({ id: 102, title: 'Spot B', lat: null, lng: null }),
    ]);
    const travelItems = ref<TravelItem[]>([]);

    const { resolvedStations, hasMappedStations, stationsSummaryText } = useExcursionStations({
      excursion,
      stations,
      travelItems,
    });

    expect(resolvedStations.value).toHaveLength(2);
    expect(resolvedStations.value[0].title).toBe('Spot A');
    expect(hasMappedStations.value).toBe(true);
    expect(stationsSummaryText.value).toBe('Spot A → Spot B');
  });

  it('formatiert Routen-Label und Zwischenstopps bei gesetzter Rolle (Travel Leg)', () => {
    const excursion = ref(
      createMockExcursion({
        role: 'onward',
        spot_ids: [101, 102, 103],
      })
    );
    const stations = ref([
      createMockSpot({ id: 101, title: 'Wien' }),
      createMockSpot({ id: 102, title: 'Linz' }),
      createMockSpot({ id: 103, title: 'Salzburg' }),
    ]);
    const travelItems = ref<TravelItem[]>([]);

    const { routeLabel, stationsSummaryText } = useExcursionStations({
      excursion,
      stations,
      travelItems,
    });

    expect(routeLabel.value).toBe('Wien → Salzburg · 1 Zwischenstopp');
    expect(stationsSummaryText.value).toBe('Wien → Salzburg · 1 Zwischenstopp');
  });

  it('ermittelt Abfahrts- und Ankunftszeiten sowie Reisedauer aus Legs oder Excursion', () => {
    const excursion = ref(
      createMockExcursion({
        departure_time: '08:00',
        arrival_time: '12:00',
        legs: [
          {
            position: 0,
            from_spot_id: 1,
            to_spot_id: 2,
            departure_time: '08:15',
            arrival_time: '09:30',
            transport_type: 'train',
          },
          {
            position: 1,
            from_spot_id: 2,
            to_spot_id: 3,
            departure_time: '10:00',
            arrival_time: '11:45',
            transport_type: 'bus',
          },
        ],
      })
    );
    const stations = ref<Spot[]>([]);
    const travelItems = ref<TravelItem[]>([]);

    const { effectiveDepartureTime, effectiveArrivalTime, travelDuration } = useExcursionStations({
      excursion,
      stations,
      travelItems,
    });

    expect(effectiveDepartureTime.value).toBe('08:15');
    expect(effectiveArrivalTime.value).toBe('11:45');
    expect(travelDuration.value).toBe('3\u00A0Std. 30\u00A0Min.');
  });

  it('filtert verknüpfte Tracks nach excursion.id', () => {
    const tracksStore = useTracksStore();
    tracksStore.tracks = [
      { id: 1, excursion_id: 1, title: 'Wanderung' } as LocationTrack,
      { id: 2, excursion_id: 99, title: 'Andere Tour' } as LocationTrack,
    ];

    const excursion = ref(createMockExcursion({ id: 1 }));
    const stations = ref<Spot[]>([]);
    const travelItems = ref<TravelItem[]>([]);

    const { linkedTracks } = useExcursionStations({
      excursion,
      stations,
      travelItems,
    });

    expect(linkedTracks.value).toHaveLength(1);
    expect(linkedTracks.value[0].title).toBe('Wanderung');
  });
});
