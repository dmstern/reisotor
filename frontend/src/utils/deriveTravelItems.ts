import type { Excursion, Spot, TravelItem } from '../api/types';

// #176: travel_items/routes/travel.ts entfallen - eine "Reise-Etappe" ist seitdem eine Excursion
// mit gesetzter role und genau zwei spot_ids (Von/Nach, siehe routes/ideas.ts's Validierung). Diese
// Funktion leitet daraus wieder dieselbe TravelItem-Sicht ab, die vorher direkt vom /travel-Endpunkt
// kam (siehe TravelItem-Kommentar in api/types.ts), damit die zahlreichen bestehenden Verbraucher
// (TripMap.vue, ExcursionCard.vue, calendarEntries.ts, dayStations.ts, excursionStations.ts,
// travelDerivedLocations.ts, BudgetView.vue, DashboardView.vue, ScheduleView.vue) unverändert
// weiterlaufen. idea.id wird 1:1 als TravelItem.id übernommen, from_place_id/to_place_id zeigen
// direkt auf die beiden Stationen (spot_ids[0]/[1]).
export function deriveTravelItems(excursions: Excursion[], spots: Spot[]): TravelItem[] {
  const spotById = new Map(spots.map((s) => [s.id, s]));
  return excursions
    .filter((e) => e.role != null)
    .map((e): TravelItem => {
      const fromId = e.spot_ids[0] ?? null;
      const toId = e.spot_ids.length > 1 ? (e.spot_ids[e.spot_ids.length - 1] ?? null) : null;
      const from = fromId != null ? spotById.get(fromId) : undefined;
      const to = toId != null ? spotById.get(toId) : undefined;
      return {
        id: e.id,
        trip_id: e.trip_id,
        title: e.title,
        type: e.transport_type,
        from_location: from?.title ?? null,
        to_location: to?.title ?? null,
        date: e.date,
        departure_time: e.departure_time,
        arrival_time: e.arrival_time,
        checkin_info: e.checkin_info,
        amount: e.amount,
        paid_by_user_id: e.paid_by_user_id,
        luggage: e.luggage,
        seat: e.seat,
        link: e.ticket_link,
        note: e.note,
        note_format: e.note_format,
        budget_expense_id: e.budget_expense_id,
        from_maps_link: from?.maps_link ?? null,
        from_lat: from?.lat ?? null,
        from_lng: from?.lng ?? null,
        to_maps_link: to?.maps_link ?? null,
        to_lat: to?.lat ?? null,
        to_lng: to?.lng ?? null,
        role: e.role,
        from_place_id: fromId,
        to_place_id: toId,
      };
    });
}
