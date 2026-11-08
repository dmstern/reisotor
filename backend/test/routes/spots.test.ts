import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';
import { clearPhotoCache } from '../../src/utils/placePhoto.js';

describe('spots route coordinate preservation', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('spottester', bcrypt.hashSync('correct-horse', 10), '🗺️');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'spottester', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Spot-Testreise', start_date: '2026-06-01', end_date: '2026-06-10' },
    });
    tripId = tripRes.json().id;
  });

  it('creates a spot with coordinates and preserves them on edit without maps_link', async () => {
    // 1. Create a spot with coordinates (e.g. from manual pin)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Hotel Alfama',
        category: 'Unterkunft',
        lat: 38.72,
        lng: -9.12,
        address: 'Rua de São Pedro 12',
        link: 'https://www.booking.com/hotel/pt/alfama.html',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.lat).toBe(38.72);
    expect(created.lng).toBe(-9.12);
    expect(created.link).toBe('https://www.booking.com/hotel/pt/alfama.html');

    // 2. Edit spot: change title/address/link, but DO NOT provide lat/lng/maps_link
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Hotel Alfama Renoviert',
        category: 'Unterkunft',
        address: 'Rua dos Caminhos de Ferro 40',
        link: 'https://www.airbnb.de/rooms/998877',
        // lat, lng, maps_link omitted/undefined!
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // 3. Verify coordinates were not wiped and link was updated
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/spots?trip_id=${tripId}`,
      headers: { cookie },
    });
    const spots = getRes.json();
    const spot = spots.find((s: { id: number }) => s.id === created.id);
    expect(spot.title).toBe('Hotel Alfama Renoviert');
    expect(spot.address).toBe('Rua dos Caminhos de Ferro 40');
    expect(spot.link).toBe('https://www.airbnb.de/rooms/998877');
    expect(spot.lat).toBe(38.72);
    expect(spot.lng).toBe(-9.12);

    // 4. Edit spot: clear link explicitly
    const clearLinkRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Hotel Alfama Ohne Link',
        link: null,
      },
    });
    expect(clearLinkRes.statusCode).toBe(200);
    const clearedSpot = clearLinkRes.json();
    expect(clearedSpot.link).toBeNull();
  });

  it('auto-populates cleaned link when maps_link is a booking link and link is omitted (issue #607)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Booking Spot Test',
        category: 'Unterkunft',
        maps_link:
          'https://www.booking.com/hotel/at/sacher.html?aid=123456&label=gen173nr&checkin=2026-09-01',
      },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.link).toBe('https://www.booking.com/hotel/at/sacher.html?checkin=2026-09-01');
  });

  it('allows explicitly clearing coordinates by passing null', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Spot mit Pin',
        category: 'Aussichtspunkt',
        lat: 38.71,
        lng: -9.13,
      },
    });
    const created = createRes.json();
    expect(created.lat).toBe(38.71);

    // Clear coordinates explicitly
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Spot ohne Pin',
        category: 'Aussichtspunkt',
        lat: null,
        lng: null,
      },
    });
    expect(updateRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/spots?trip_id=${tripId}`,
      headers: { cookie },
    });
    const spots = getRes.json();
    const spot = spots.find((s: { id: number }) => s.id === created.id);
    expect(spot.lat).toBeNull();
    expect(spot.lng).toBeNull();
  });

  describe('GET /api/spots/preview', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      clearPhotoCache();
    });

    it('returns place name and resolves a photo when name and coordinates are provided', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div id="resitem-0">
                  <a data-origurl="https://upload.wikimedia.org/wikipedia/commons/stephansdom.jpg"
                     data-referenceurl="https://example.com/stephansdom">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/stephansdom.jpg" />
                    <p class="tile-title">Stephansdom</p>
                  </a>
                </div>`
              ),
            json: () => Promise.resolve({ query: { pages: [] } }),
          })
        )
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/spots/preview?name=Stephansdom&lat=48.2085&lng=16.3738&city=Wien',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('Stephansdom');
      // Should find a photo or null, but never throw 500
      expect(data).toHaveProperty('imageUrl');
      expect(Array.isArray(data.images)).toBe(true);
    });

    it('returns imageUrl null when place has no photo without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () => Promise.resolve(''),
            json: () => Promise.resolve({ query: { pages: [] } }),
          })
        )
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/spots/preview?name=UnbekannterOrtXYZ12345',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('UnbekannterOrtXYZ12345');
      expect(data.imageUrl).toBeNull();
      expect(Array.isArray(data.images)).toBe(true);
      expect(data.images).toEqual([]);
    });

    it('accepts variant=banner parameter and handles banner requests', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(''),
          json: () => Promise.resolve({ query: { pages: [] } }),
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const res = await app.inject({
        method: 'GET',
        url: '/api/spots/preview?name=Lissabon&variant=banner',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('Lissabon');
      expect(Array.isArray(data.images)).toBe(true);
      expect(
        fetchMock.mock.calls.some(([callUrl]) => String(callUrl).includes('pithumbsize=2000'))
      ).toBe(true);
    });

    it('resolves booking link preview with accommodation fields (issue #607)', async () => {
      const mockBookingHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Hotel",
                "name": "Grand Hotel Wien – Aktualisierte Preise für 2026",
                "image": "https://images.example.com/grand-hotel.jpg",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Kärntner Ring 9",
                  "postalCode": "1010",
                  "addressLocality": "Wien",
                  "addressCountry": "Österreich"
                },
                "geo": {
                  "@type": "GeoCoordinates",
                  "latitude": 48.2014,
                  "longitude": 16.3712
                },
                "offers": {
                  "@type": "Offer",
                  "price": 280,
                  "priceCurrency": "EUR"
                },
                "checkinTime": "15:00",
                "checkoutTime": "11:00",
                "telephone": "+43 1 515800"
              }
            </script>
          </head>
        </html>
      `;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (String(url).includes('booking.com')) {
            return Promise.resolve({
              status: 200,
              url: 'https://www.booking.com/hotel/at/grand-hotel-wien.html?checkin=2026-09-10&checkout=2026-09-15',
              text: () => Promise.resolve(mockBookingHtml),
            });
          }

          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(''),
            json: () => Promise.resolve({ query: { pages: [] } }),
          });
        })
      );

      const testLink =
        'https://www.booking.com/hotel/at/grand-hotel-wien.html?checkin=2026-09-10&checkout=2026-09-15&aid=123&utm_source=test';
      const res = await app.inject({
        method: 'GET',
        url: `/api/spots/preview?maps_link=${encodeURIComponent(testLink)}`,
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('Grand Hotel Wien');
      expect(data.category).toBe('Unterkunft');
      expect(data.imageUrl).toBe('https://images.example.com/grand-hotel.jpg');
      expect(data.address).toBe('Kärntner Ring 9, 1010 Wien, Österreich');
      expect(data.city).toBe('Wien');
      expect(data.amount).toBe(280);
      expect(data.currency).toBe('EUR');
      expect(data.lat).toBe(48.2014);
      expect(data.lng).toBe(16.3712);
      expect(data.checkin).toBe('15:00');
      expect(data.checkout).toBe('11:00');
      expect(data.startDate).toBe('2026-09-10');
      expect(data.endDate).toBe('2026-09-15');
      expect(data.sourceUrl).toBe(
        'https://www.booking.com/hotel/at/grand-hotel-wien.html?checkin=2026-09-10&checkout=2026-09-15'
      );
      expect(data.contact).toBe('+43 1 515800');
    });
  });
});
