import { api } from '../api/client';
import { useHomeCurrencyStore } from '../stores/homeCurrency';

export interface RegionInfo {
  countryName: string | null;
  languages: string[];
  currency: { code: string; name: string } | null;
  /** Wechselkurs 1 Urlaubswährung -> Heimatwährung, null falls identisch/nicht ermittelbar/"kein
   *  Vergleich gewünscht" (siehe stores/homeCurrency.ts's 'none'-Option). */
  exchangeRate: number | null;
  advisory: { score: number; message: string } | null;
}

/** Dünner Client-Wrapper um GET /trips/:id/region-info – reicht die lokal (nicht am Account)
 *  gespeicherte Heimatwährung als Query-Param durch, damit das Backend den Wechselkurs auflösen
 *  kann (siehe stores/homeCurrency.ts). */
export function fetchRegionInfo(tripId: number): Promise<RegionInfo> {
  const homeCurrency = useHomeCurrencyStore();
  const params = new URLSearchParams();
  if (homeCurrency.currency !== 'none') params.set('home_currency', homeCurrency.currency);
  const qs = params.toString();
  return api.get<RegionInfo>(`/trips/${tripId}/region-info${qs ? `?${qs}` : ''}`);
}
