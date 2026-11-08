import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isBookingLinkUrl,
  cleanAccommodationTitle,
  cleanBookingUrl,
  parseDateParam,
  parsePrice,
  extractJsonLdBlocks,
  extractBookingMetadataFromHtml,
  fetchAccommodationPreview,
} from '../../src/utils/bookingLink.js';

describe('bookingLink', () => {
  describe('isBookingLinkUrl', () => {
    it('detects booking.com URLs', () => {
      expect(isBookingLinkUrl('https://www.booking.com/hotel/at/hotel-sacher-wien.html')).toBe(
        true
      );
      expect(isBookingLinkUrl('http://booking.com/hotel/de/berlin.de.html')).toBe(true);
      expect(isBookingLinkUrl('booking.com/hotel/it/rome.html')).toBe(true);
    });

    it('detects airbnb URLs', () => {
      expect(isBookingLinkUrl('https://www.airbnb.com/rooms/12345678')).toBe(true);
      expect(isBookingLinkUrl('https://airbnb.de/rooms/87654321')).toBe(true);
      expect(isBookingLinkUrl('https://abnb.me/xyz123')).toBe(true);
    });

    it('detects trivago URLs', () => {
      expect(isBookingLinkUrl('https://www.trivago.de/de/srl/hotel-adlon-berlin')).toBe(true);
      expect(isBookingLinkUrl('https://trivago.com/en-US/srl/hotel-xyz')).toBe(true);
    });

    it('detects other booking portals', () => {
      expect(
        isBookingLinkUrl('https://www.expedia.de/Berlin-Hotels-Adlon.h123.Hotel-Information')
      ).toBe(true);
      expect(isBookingLinkUrl('https://www.hotels.com/ho12345/')).toBe(true);
      expect(isBookingLinkUrl('https://www.fewo-direkt.de/ferienwohnung-ferienhaus/p12345')).toBe(
        true
      );
      expect(isBookingLinkUrl('https://www.vrbo.com/12345')).toBe(true);
      expect(isBookingLinkUrl('https://www.agoda.com/hotel-sacher/hotel/vienna-at.html')).toBe(
        true
      );
      expect(
        isBookingLinkUrl('https://www.hostelworld.com/pwa/hosteldetails.php/Wombats/Vienna/123')
      ).toBe(true);
    });

    it('detects generic URLs with accommodation paths', () => {
      expect(isBookingLinkUrl('https://www.hotel-beispiel.de/hotel/zimmer/')).toBe(true);
      expect(isBookingLinkUrl('https://my-domain.com/accommodations/suite-1')).toBe(true);
      expect(isBookingLinkUrl('https://alpenurlaub.at/ferienwohnung/bergblick')).toBe(true);
    });

    it('returns false for maps links and general websites', () => {
      expect(isBookingLinkUrl('https://maps.google.com/?q=48.2,16.3')).toBe(false);
      expect(isBookingLinkUrl('https://www.openstreetmap.org/#map=16/48.2/16.3')).toBe(false);
      expect(isBookingLinkUrl('https://example.com/some/path')).toBe(false);
      expect(isBookingLinkUrl('https://github.com/dmstern/reisotor')).toBe(false);
      expect(isBookingLinkUrl('')).toBe(false);
      expect(isBookingLinkUrl(null)).toBe(false);
      expect(isBookingLinkUrl(undefined)).toBe(false);
    });
  });

  describe('cleanAccommodationTitle', () => {
    it('removes Booking.com marketing fluff', () => {
      expect(
        cleanAccommodationTitle('Hotel Sacher Wien, Wien – Aktualisierte Preise für 2026')
      ).toBe('Hotel Sacher Wien, Wien');
      expect(cleanAccommodationTitle('Hotel Sacher - Aktualisierte Preise für 2026')).toBe(
        'Hotel Sacher'
      );
      expect(cleanAccommodationTitle('Hotel Sacher — Aktualisierte Preise für 2026')).toBe(
        'Hotel Sacher'
      );
      expect(cleanAccommodationTitle('Grand Hotel | Booking.com')).toBe('Grand Hotel');
      expect(cleanAccommodationTitle('Boutique Hotel (Preise & Verfügbarkeit) - Booking.com')).toBe(
        'Boutique Hotel'
      );
    });

    it('removes Airbnb marketing fluff', () => {
      expect(
        cleanAccommodationTitle(
          'Loft in Lisbon · ★4,9 · 2 Schlafzimmer - Wohnungen zur Miete in Lisbon - Airbnb'
        )
      ).toBe('Loft in Lisbon');
      expect(cleanAccommodationTitle('Cozy Cottage - Airbnb')).toBe('Cozy Cottage');
    });

    it('removes Trivago fluff', () => {
      expect(cleanAccommodationTitle('Hotel Adlon Kempinski, Berlin | trivago.de')).toBe(
        'Hotel Adlon Kempinski, Berlin'
      );
    });

    it('decodes HTML entities', () => {
      expect(cleanAccommodationTitle('Bed &amp; Breakfast &quot;Alpenblick&#39;s&quot;')).toBe(
        'Bed & Breakfast "Alpenblick\'s"'
      );
    });

    it('transliterates Booking.com slug umlauts (issue #607)', () => {
      expect(cleanAccommodationTitle('ferienpark ma1-4ritz')).toBe('ferienpark müritz');
      expect(cleanAccommodationTitle('hotel ba-1-4ren')).toBe('hotel bären');
      expect(cleanAccommodationTitle('gasthof scho1-4nblick')).toBe('gasthof schönblick');
    });
  });

  describe('cleanBookingUrl', () => {
    it('removes marketing and tracking parameters while preserving booking details', () => {
      const dirtyBookingUrl =
        'https://www.booking.com/hotel/de/ferienpark.html?aid=304142&label=mkt123&sid=832bdf&checkin=2026-12-11&checkout=2026-12-14&group_adults=2&utm_source=google&srepoch=1794149';
      const cleaned = cleanBookingUrl(dirtyBookingUrl);
      const url = new URL(cleaned);

      expect(url.searchParams.get('checkin')).toBe('2026-12-11');
      expect(url.searchParams.get('checkout')).toBe('2026-12-14');
      expect(url.searchParams.get('group_adults')).toBe('2');
      expect(url.searchParams.has('aid')).toBe(false);
      expect(url.searchParams.has('label')).toBe(false);
      expect(url.searchParams.has('sid')).toBe(false);
      expect(url.searchParams.has('utm_source')).toBe(false);
      expect(url.searchParams.has('srepoch')).toBe(false);
    });

    it('cleans Airbnb tracking parameters', () => {
      const dirtyAirbnb =
        'https://www.airbnb.de/rooms/12345?check_in=2026-12-11&check_out=2026-12-13&source_impression_id=p3_xyz&previous_page_section_name=1000';
      const cleaned = cleanBookingUrl(dirtyAirbnb);
      const url = new URL(cleaned);

      expect(url.searchParams.get('check_in')).toBe('2026-12-11');
      expect(url.searchParams.get('check_out')).toBe('2026-12-13');
      expect(url.searchParams.has('source_impression_id')).toBe(false);
      expect(url.searchParams.has('previous_page_section_name')).toBe(false);
    });

    it('handles schemeless URLs and preserves path', () => {
      const cleaned = cleanBookingUrl('booking.com/hotel/at/sacher.html?utm_medium=cpc');
      expect(cleaned).toBe('https://booking.com/hotel/at/sacher.html');
    });
  });

  describe('parseDateParam', () => {
    it('parses ISO format', () => {
      expect(parseDateParam('2026-08-15')).toBe('2026-08-15');
    });

    it('parses compact YYYYMMDD format', () => {
      expect(parseDateParam('20260815')).toBe('2026-08-15');
    });

    it('returns null for invalid inputs', () => {
      expect(parseDateParam('15.08.2026')).toBeNull();
      expect(parseDateParam('abc')).toBeNull();
      expect(parseDateParam(null)).toBeNull();
    });
  });

  describe('parsePrice', () => {
    it('handles numeric input', () => {
      expect(parsePrice(149)).toBe(149);
      expect(parsePrice(149.5)).toBe(149.5);
    });

    it('handles currency strings and European number formats', () => {
      expect(parsePrice('€ 149,00')).toBe(149);
      expect(parsePrice('1.250,50 €')).toBe(1250.5);
      expect(parsePrice('$120.99')).toBe(120.99);
      expect(parsePrice('$1,250.50')).toBe(1250.5);
      expect(parsePrice('1,500.00')).toBe(1500);
      expect(parsePrice('180')).toBe(180);
    });

    it('returns null for invalid values', () => {
      expect(parsePrice(0)).toBeNull();
      expect(parsePrice(-10)).toBeNull();
      expect(parsePrice('kostenlos')).toBeNull();
      expect(parsePrice(null)).toBeNull();
    });
  });

  describe('extractJsonLdBlocks', () => {
    it('extracts single and multiple JSON-LD objects including graph', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Hotel",
                "name": "Hotel Sacher"
              }
            </script>
            <script type="application/ld+json">
              {
                "@graph": [
                  { "@type": "BreadcrumbList" },
                  { "@type": "LodgingBusiness", "name": "Sacher Annex" }
                ]
              }
            </script>
          </head>
        </html>
      `;
      const blocks = extractJsonLdBlocks(html);
      expect(blocks.length).toBe(4); // Hotel, graph root, BreadcrumbList, Sacher Annex
      expect(blocks.some((b) => b.name === 'Hotel Sacher')).toBe(true);
      expect(blocks.some((b) => b.name === 'Sacher Annex')).toBe(true);
    });
  });

  describe('extractBookingMetadataFromHtml', () => {
    it('extracts full accommodation details from Schema.org Hotel JSON-LD', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "https://schema.org/Hotel",
                "name": "Hotel Sacher Wien – Aktualisierte Preise für 2026",
                "image": "//images.example.com/sacher.jpg",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Philharmoniker Str. 4",
                  "postalCode": "1010",
                  "addressLocality": "Wien",
                  "addressCountry": "Österreich"
                },
                "geo": {
                  "@type": "GeoCoordinates",
                  "latitude": 48.2038,
                  "longitude": 16.3695
                },
                "offers": {
                  "@type": "Offer",
                  "price": 320.00,
                  "priceCurrency": "EUR"
                },
                "checkinTime": "15:00:00",
                "checkoutTime": "12:00:00",
                "telephone": "+43 1 514560"
              }
            </script>
          </head>
        </html>
      `;

      const meta = extractBookingMetadataFromHtml(
        html,
        'https://www.booking.com/hotel/at/hotel-sacher-wien.html'
      );

      expect(meta.name).toBe('Hotel Sacher Wien');
      expect(meta.category).toBe('Unterkunft');
      expect(meta.imageUrl).toBe('https://images.example.com/sacher.jpg');
      expect(meta.address).toBe('Philharmoniker Str. 4, 1010 Wien, Österreich');
      expect(meta.city).toBe('Wien');
      expect(meta.lat).toBe(48.2038);
      expect(meta.lng).toBe(16.3695);
      expect(meta.amount).toBe(320);
      expect(meta.currency).toBe('EUR');
      expect(meta.checkin).toBe('15:00');
      expect(meta.checkout).toBe('12:00');
      expect(meta.contact).toBe('+43 1 514560');
    });

    it('extracts metadata from OpenGraph and HTML meta tags when JSON-LD is missing', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Cozy Seaside Villa | trivago.de" />
            <meta property="og:image" content="https://images.example.com/villa.jpg" />
            <meta property="place:location:latitude" content="38.7169" />
            <meta property="place:location:longitude" content="-9.1399" />
            <meta property="business:contact_data:street_address" content="Rua Augusta 10" />
            <meta property="business:contact_data:locality" content="Lissabon" />
            <meta property="product:price:amount" content="185.50" />
            <meta property="product:price:currency" content="EUR" />
          </head>
        </html>
      `;

      const meta = extractBookingMetadataFromHtml(html, 'https://www.trivago.de/hotel-xyz');

      expect(meta.name).toBe('Cozy Seaside Villa');
      expect(meta.category).toBe('Unterkunft');
      expect(meta.imageUrl).toBe('https://images.example.com/villa.jpg');
      expect(meta.address).toBe('Rua Augusta 10, Lissabon');
      expect(meta.city).toBe('Lissabon');
      expect(meta.lat).toBe(38.7169);
      expect(meta.lng).toBe(-9.1399);
      expect(meta.amount).toBe(185.5);
      expect(meta.currency).toBe('EUR');
    });

    it('falls back to extracting name from URL path if no title in HTML', () => {
      const html = '<html><head></head><body>No title</body></html>';
      const meta = extractBookingMetadataFromHtml(
        html,
        'https://www.booking.com/hotel/at/grand-hotel-wien.html'
      );
      expect(meta.name).toBe('grand hotel wien');
    });

    it('extracts coordinates from Booking.com data-atlas-latlng and map triggers (issue #607)', () => {
      const html = `
        <html>
          <head>
            <title>Ferienpark Müritz</title>
          </head>
          <body>
            <a data-atlas-latlng="53.357957,12.728514" title="Ferienpark Müritz - Lage prüfen" id="map_trigger_header_pin" href="#map_opened">
              Karte anzeigen
            </a>
            <p>Check-in in der Unterkunft ist ab 16:00, und der Check-out ist bis 10:00.</p>
          </body>
        </html>
      `;
      const meta = extractBookingMetadataFromHtml(
        html,
        'https://www.booking.com/hotel/de/ferienpark-ma1-4ritz.de.html'
      );
      expect(meta.name).toBe('Ferienpark Müritz');
      expect(meta.lat).toBe(53.357957);
      expect(meta.lng).toBe(12.728514);
      expect(meta.checkin).toBe('16:00');
      expect(meta.checkout).toBe('10:00');
    });

    it('avoids duplicating street address parts when streetAddress is already complete', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "http://schema.org",
                "@type": "Hotel",
                "name": "Ferienpark Müritz",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Am Hafendorf, 17248 Rechlin, Deutschland",
                  "addressLocality": "Am Hafendorf",
                  "postalCode": "17248",
                  "addressCountry": "Deutschland"
                }
              }
            </script>
          </head>
        </html>
      `;
      const meta = extractBookingMetadataFromHtml(
        html,
        'https://www.booking.com/hotel/de/ferienpark-ma1-4ritz.de.html'
      );
      expect(meta.address).toBe('Am Hafendorf, 17248 Rechlin, Deutschland');
      expect(meta.city).toBe('Rechlin');
    });

    it('extracts address from standalone Schema.org PostalAddress JSON-LD (Trivago structure)', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Parkhotel St. Leonhard | trivago" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "PostalAddress",
                "streetAddress": "Obere-St.-Leonhard-Straße 71",
                "postalCode": "88662",
                "addressLocality": "Ueberlingen",
                "addressCountry": "Germany"
              }
            </script>
          </head>
        </html>
      `;
      const meta = extractBookingMetadataFromHtml(
        html,
        'https://www.trivago.de/en-US/acd/hotels-ueberlingen-germany'
      );
      expect(meta.name).toBe('Parkhotel St. Leonhard');
      expect(meta.address).toBe('Obere-St.-Leonhard-Straße 71, 88662 Ueberlingen, Germany');
      expect(meta.city).toBe('Ueberlingen');
    });
  });

  describe('fetchAccommodationPreview', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches URL, extracts metadata and dates from URL query params', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Alpenchalet Bergblick" />
            <meta property="og:image" content="https://images.example.com/chalet.jpg" />
            <meta property="place:location:latitude" content="47.2692" />
            <meta property="place:location:longitude" content="11.4041" />
            <meta property="og:street-address" content="Dorfstraße 1" />
            <meta property="og:locality" content="Innsbruck" />
            <meta property="og:price:amount" content="240" />
          </head>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        url: 'https://www.booking.com/hotel/at/alpenchalet.html?checkIn=2026-07-01&checkOut=2026-07-08',
        text: async () => mockHtml,
      } as unknown as Response);

      const preview = await fetchAccommodationPreview(
        'https://www.booking.com/hotel/at/alpenchalet.html?checkIn=2026-07-01&checkOut=2026-07-08'
      );

      expect(preview).not.toBeNull();
      expect(preview?.name).toBe('Alpenchalet Bergblick');
      expect(preview?.category).toBe('Unterkunft');
      expect(preview?.imageUrl).toBe('https://images.example.com/chalet.jpg');
      expect(preview?.lat).toBe(47.2692);
      expect(preview?.lng).toBe(11.4041);
      expect(preview?.startDate).toBe('2026-07-01');
      expect(preview?.endDate).toBe('2026-07-08');
      expect(preview?.amount).toBe(240);
    });

    it('falls back to geocoding when coordinates are missing in HTML', async () => {
      const mockHtmlWithoutCoords = `
        <html>
          <head>
            <meta property="og:title" content="Pension Sonnenhof" />
            <meta property="og:street-address" content="Hauptstraße 15" />
            <meta property="og:locality" content="Salzburg" />
          </head>
        </html>
      `;

      global.fetch = vi.fn((url: string) => {
        if (String(url).includes('booking.com')) {
          return Promise.resolve({
            status: 200,
            url: 'https://www.booking.com/hotel/at/sonnenhof.html',
            text: async () => mockHtmlWithoutCoords,
          });
        }

        if (
          String(url).includes('nominatim') ||
          String(url).includes('photon') ||
          String(url).includes('places')
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [13.055, 47.8095],
                  },
                  properties: {
                    name: 'Pension Sonnenhof',
                    street: 'Hauptstraße',
                    housenumber: '15',
                    city: 'Salzburg',
                    country: 'Österreich',
                  },
                },
              ],
            }),
          });
        }

        return Promise.resolve({ ok: true, text: async () => '' });
      }) as unknown as typeof fetch;

      const preview = await fetchAccommodationPreview(
        'https://www.booking.com/hotel/at/sonnenhof.html'
      );

      expect(preview).not.toBeNull();
      expect(preview?.name).toBe('Pension Sonnenhof');
      expect(preview?.lat).toBe(47.8095);
      expect(preview?.lng).toBe(13.055);
    });

    it('rejects unsafe URLs (SSRF protection)', async () => {
      const preview = await fetchAccommodationPreview('http://localhost:3000/booking');
      expect(preview).toBeNull();

      const preview2 = await fetchAccommodationPreview('http://127.0.0.1/hotel');
      expect(preview2).toBeNull();
    });

    it('extracts price from Booking sr_pri_blocks query parameter (issue #607)', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Ferienpark Müritz" />
            <a data-atlas-latlng="53.357957,12.728514" id="map_trigger_header_pin">Karte</a>
          </head>
        </html>
      `;
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => mockHtml,
      } as unknown as Response);

      const preview = await fetchAccommodationPreview(
        'https://www.booking.com/hotel/de/ferienpark.html?checkin=2026-12-11&checkout=2026-12-14&sr_pri_blocks=57600623_372486079_2_0_0__23409'
      );

      expect(preview).not.toBeNull();
      expect(preview?.name).toBe('Ferienpark Müritz');
      expect(preview?.startDate).toBe('2026-12-11');
      expect(preview?.endDate).toBe('2026-12-14');
      expect(preview?.amount).toBe(234.09);
      expect(preview?.currency).toBe('EUR');
      expect(preview?.lat).toBe(53.357957);
      expect(preview?.lng).toBe(12.728514);
    });

    it('extracts dates from Trivago dr- parameter format', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Parkhotel St. Leonhard" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "PostalAddress",
                "streetAddress": "Obere-St.-Leonhard-Straße 71",
                "postalCode": "88662",
                "addressLocality": "Ueberlingen",
                "addressCountry": "Germany"
              }
            </script>
          </head>
        </html>
      `;
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => mockHtml,
      } as unknown as Response);

      const preview = await fetchAccommodationPreview(
        'https://www.trivago.de/en-US/acd/hotels-ueberlingen-germany?search=100-118997;dr-20270401-20270404;drs-46;rc-1-2'
      );

      expect(preview).not.toBeNull();
      expect(preview?.name).toBe('Parkhotel St. Leonhard');
      expect(preview?.startDate).toBe('2027-04-01');
      expect(preview?.endDate).toBe('2027-04-04');
    });

    it('retries with fallback user agent when AWS WAF bot challenge is returned', async () => {
      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        const ua = (init?.headers as Record<string, string>)?.['User-Agent'];

        if (ua?.includes('Chrome')) {
          // Simulator: Browser UA wird mit WAF-Challenge blockiert
          return Promise.resolve({
            status: 200,
            text: async () =>
              '<html><script>window.awsWafCookieDomainList=["booking.com"];</script></html>',
          } as unknown as Response);
        }

        // Preview Bot UA erhält volles HTML
        return Promise.resolve({
          status: 200,
          text: async () => `
            <html>
              <head><meta property="og:title" content="Ferienpark Müritz" /></head>
              <body><a data-atlas-latlng="53.357957,12.728514">Karte</a></body>
            </html>
          `,
        } as unknown as Response);
      }) as unknown as typeof fetch;

      const preview = await fetchAccommodationPreview(
        'https://www.booking.com/hotel/de/ferienpark.html'
      );

      expect(preview).not.toBeNull();
      expect(preview?.name).toBe('Ferienpark Müritz');
      expect(preview?.lat).toBe(53.357957);
      expect(preview?.lng).toBe(12.728514);
    });
  });
});
