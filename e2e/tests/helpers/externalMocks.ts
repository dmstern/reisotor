import type { BrowserContext, Page } from '@playwright/test';

/** 1x1-transparentes PNG als Fake-Kachel-Antwort statt echter Requests gegen tile.openstreetmap.org
 *  (OSMs Tile Usage Policy untersagt automatisierten Zugriff aus CI-Testsuites). */
export const FAKE_TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

export async function mockOsmTiles(target: Page | BrowserContext): Promise<void> {
  await target.route('https://*.tile.openstreetmap.org/**/*.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_TILE_PNG })
  );
}

export async function mockSpotsPreview(page: Page): Promise<void> {
  await page.route('**/api/spots/preview*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: null,
        imageUrl: null,
        images: [],
        category: null,
        address: null,
        city: null,
        amount: null,
        currency: null,
        lat: null,
        lng: null,
        checkin: null,
        checkout: null,
        startDate: null,
        endDate: null,
        contact: null,
        sourceUrl: null,
      }),
    })
  );
}

export async function mockWeatherAndRegionInfo(page: Page): Promise<void> {
  await page.route('**/api/weather*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        daily: {
          time: [],
          weathercode: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          precipitation_probability_max: [],
        },
        hourly: {
          time: [],
          weathercode: [],
          temperature_2m: [],
          precipitation_probability: [],
        },
      }),
    })
  );

  await page.route('**/api/trips/*/region-info*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countryName: null,
        languages: [],
        currency: null,
        exchangeRate: null,
        advisory: null,
      }),
    })
  );
}
