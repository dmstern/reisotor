import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetRegionInfoCache, fetchRegionInfo } from '../../src/utils/regionInfo.js';

// Regressionsnetz für die Fehlertoleranz von fetchRegionInfo() (siehe dortiger Kommentar):
// ein Fehlschlag einer der externen APIs (REST Countries / open.er-api.com / Auswärtiges Amt) darf nicht die
// gesamte Anfrage scheitern lassen, sondern soll nur den betroffenen Teil der Antwort leer/null lassen.
describe('fetchRegionInfo', () => {
  beforeEach(() => {
    _resetRegionInfoCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetRegionInfoCache();
  });

  it('returns a partial result when REST Countries succeeds without exchange rate or advisory', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('restcountries.com')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { languages: { por: 'Portuguese' }, currencies: { EUR: { name: 'Euro' } } },
              ]),
          });
        }
        return Promise.reject(new Error('unexpected URL in test: ' + url));
      })
    );

    const info = await fetchRegionInfo('PT', null);
    expect(info.languages).toEqual(['Portuguese']);
    expect(info.currency).toEqual({ code: 'EUR', name: 'Euro' });
    expect(info.advisory).toBeNull();
  });

  it('returns an all-empty result when every external API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
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
            json: () =>
              Promise.resolve([
                { languages: { eng: 'English' }, currencies: { USD: { name: 'US Dollar' } } },
              ]),
          });
        }
        if (url.includes('open.er-api.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: 'success', rates: { EUR: 0.92 } }),
          });
        }
        return Promise.reject(new Error('unexpected URL in test: ' + url));
      })
    );

    const info = await fetchRegionInfo('US', 'EUR');
    expect(info.currency).toEqual({ code: 'USD', name: 'US Dollar' });
    expect(info.exchangeRate).toBe(0.92);
    expect(info.advisory).toBeNull();
  });

  it('maps Auswaertiges Amt warnings correctly to advisory score and message', async () => {
    const mockAAData = {
      response: {
        '100': {
          countryCode: 'UA',
          countryName: 'Ukraine',
          warning: true,
          partialWarning: false,
        },
        '101': {
          countryCode: 'JP',
          countryName: 'Japan',
          warning: false,
          partialWarning: true,
        },
        '102': {
          countryCode: 'XX',
          countryName: 'Spezialland',
          warning: false,
          partialWarning: false,
          situationWarning: true,
        },
        '103': {
          countryCode: 'DE',
          countryName: 'Deutschland',
          warning: false,
          partialWarning: false,
        },
      },
    };

    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('auswaertiges-amt.de')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAAData),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const ua = await fetchRegionInfo('UA', null);
    expect(ua.advisory).toEqual({ score: 5.0, message: 'Reisewarnung' });

    const jp = await fetchRegionInfo('JP', null);
    expect(jp.advisory).toEqual({ score: 3.0, message: 'Teilreisewarnung' });

    const xx = await fetchRegionInfo('XX', null);
    expect(xx.advisory).toEqual({ score: 2.5, message: 'Lagebedingter Sicherheitshinweis' });

    const de = await fetchRegionInfo('DE', null);
    expect(de.advisory).toEqual({ score: 1.0, message: 'Keine Reisewarnung' });

    // Auswärtiges Amt sollte nur einmal aufgerufen worden sein (In-Memory Cache)
    const aaCallCount = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).includes('auswaertiges-amt.de')
    ).length;
    expect(aaCallCount).toBe(1);
  });

  it('returns advisory null when country is not present in Auswaertiges Amt response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('auswaertiges-amt.de')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ response: {} }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      })
    );

    const info = await fetchRegionInfo('ZZ', null);
    expect(info.advisory).toBeNull();
  });
});
