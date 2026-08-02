import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegionInfo } from '../../src/utils/regionInfo.js';

// Regressionsnetz für die Fehlertoleranz von fetchRegionInfo() (siehe dortiger Kommentar,
// Promise.allSettled-Muster analog zum Wetter-Widget): ein Fehlschlag einer der drei externen APIs
// (REST Countries/open.er-api.com/travel-advisory.info) darf nicht die gesamte Anfrage scheitern
// lassen, sondern soll nur den betroffenen Teil der Antwort leer/null lassen.
describe('fetchRegionInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a partial result when the travel-advisory API fails, instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('restcountries.com')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ languages: { por: 'Portuguese' }, currencies: { EUR: { name: 'Euro' } } }]),
          });
        }
        if (url.includes('travel-advisory.info')) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.reject(new Error('unexpected URL in test: ' + url));
      }),
    );

    const info = await fetchRegionInfo('PT', null);
    expect(info.languages).toEqual(['Portuguese']);
    expect(info.currency).toEqual({ code: 'EUR', name: 'Euro' });
    expect(info.advisory).toBeNull();
  });

  it('returns an all-empty result when every external API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 })),
    );

    const info = await fetchRegionInfo('XX', 'EUR');
    expect(info).toEqual({ languages: [], currency: null, exchangeRate: null, advisory: null });
  });

  it('resolves an exchange rate when the home currency differs from the local one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('restcountries.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ languages: { eng: 'English' }, currencies: { USD: { name: 'US Dollar' } } }]),
          });
        }
        if (url.includes('open.er-api.com')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: 'success', rates: { EUR: 0.92 } }) });
        }
        if (url.includes('travel-advisory.info')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { XX: { advisory: { score: 2.1, message: 'Ok' } } } }) });
        }
        return Promise.reject(new Error('unexpected URL in test: ' + url));
      }),
    );

    const info = await fetchRegionInfo('US', 'EUR');
    expect(info.currency).toEqual({ code: 'USD', name: 'US Dollar' });
    expect(info.exchangeRate).toBe(0.92);
    expect(info.advisory).toEqual({ score: 2.1, message: 'Ok' });
  });
});
