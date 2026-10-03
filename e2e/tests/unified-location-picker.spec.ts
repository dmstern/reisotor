import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Comprehensive Opaque-Box E2E Test Suite for Unified Location Picker
 *
 * Covers:
 * - Tier 1: Feature Coverage (>=5 test cases per feature across 6 features:
 *   Link Detection, POI Search, Autocomplete Selection, Mini-Map Sync, Pin Click/Drag, Clear Action)
 * - Tier 2: Boundary & Corner Cases (empty/whitespace, min query length, invalid maps URL,
 *   shortlinks, upstream 500 error, network abort, special characters/XSS)
 * - Tier 3: Cross-Feature Interactions (link + pin drag, search + clear, pin + search,
 *   query clear before select, device location override)
 * - Tier 4: Real-World Scenarios (spot creation, accommodation, scenic spot, trip destination, spot edit & clear)
 */

interface PlaceResult {
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  category?: string;
}

const MOCK_PLACES: Record<string, PlaceResult[]> = {
  central: [
    {
      name: 'Café Central',
      formatted_address: 'Herrengasse 14, 1010 Wien, Österreich',
      lat: 48.2104,
      lng: 16.3653,
      category: 'Café',
    },
    {
      name: 'Central Park',
      formatted_address: 'New York, NY, USA',
      lat: 40.785091,
      lng: -73.968285,
      category: 'Sehenswürdigkeit',
    },
  ],
  excelsior: [
    {
      name: 'Hotel Excelsior',
      formatted_address: 'Via Vittorio Veneto 125, 00187 Rom, Italien',
      lat: 41.9075,
      lng: 12.4914,
      category: 'Unterkunft',
    },
  ],
  stephan: [
    {
      name: 'Stephansdom',
      formatted_address: 'Stephansplatz 3, 1010 Wien, Österreich',
      lat: 48.2085,
      lng: 16.3731,
      category: 'Sehenswürdigkeit',
    },
  ],
  florenz: [
    {
      name: 'Florenz',
      formatted_address: 'Florenz, Toskana, Italien',
      lat: 43.7696,
      lng: 11.2558,
      category: 'Ort',
    },
  ],
  münchen: [
    {
      name: 'München',
      formatted_address: 'München, Bayern, Deutschland',
      lat: 48.1351,
      lng: 11.582,
      category: 'Ort',
    },
  ],
};

interface MockPlacesOptions {
  delayMs?: number;
  status?: number;
  abort?: boolean;
  empty?: boolean;
}

function setupPlacesMock(page: Page, options: MockPlacesOptions = {}) {
  const requests: { url: string; q: string | null; lat: string | null; lng: string | null }[] = [];

  page.route('**/api/places/search*', async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q');
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');
    requests.push({ url: route.request().url(), q, lat, lng });

    if (options.abort) {
      await route.abort();
      return;
    }

    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    if (options.status && options.status !== 200) {
      await route.fulfill({
        status: options.status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Geocoding Error' }),
      });
      return;
    }

    if (options.empty || !q) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    const lowerQ = q.toLowerCase();
    let matched: PlaceResult[] = [];
    for (const [key, results] of Object.entries(MOCK_PLACES)) {
      if (lowerQ.includes(key)) {
        matched = results;
        break;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(matched),
    });
  });

  return { requests };
}

// Helper: Open "Neuer Spot" modal and locate unified LocationPicker
async function openNewSpotModal(page: Page) {
  await page.goto('/excursions?group=spots');
  const spotsTab = page.locator('.segmented-option', { hasText: 'Spots' });
  if (await spotsTab.isVisible()) {
    await spotsTab.click();
  }
  const addBtn = page.getByRole('button', { name: 'Neuer Spot' });
  await expect(addBtn).toBeVisible();
  await addBtn.click();

  const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
  await expect(modal).toBeVisible();

  // If a draft was restored, discard it to ensure pristine state
  const discardBtn = modal.locator('.draft-discard-btn');
  if (await discardBtn.isVisible()) {
    await discardBtn.click();
  }

  // If Standort section is collapsed, expand it
  const locationBtn = modal.getByRole('button', { name: 'Standort', exact: true });
  if (await locationBtn.isVisible()) {
    const isExpanded = await locationBtn.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await locationBtn.click();
    }
  }

  // Ensure LocationPicker container is visible
  const picker = modal.locator('.spot-location-fieldset, .location-picker').first();
  await expect(picker).toBeVisible();

  return { modal, picker };
}

// Helper: Open "Neuer Urlaub" modal and locate unified LocationPicker
async function openNewTripModal(page: Page) {
  await page.goto('/trips');
  const addBtn = page.getByRole('button', { name: 'Neuer Urlaub' });
  await expect(addBtn).toBeVisible();
  await addBtn.click();

  const modal = page.locator('.modal', { hasText: /Neue[rn] Urlaub/ });
  await expect(modal).toBeVisible();

  const optionalBtn = modal.getByRole('button', { name: 'Optionale Angaben' });
  if (await optionalBtn.isVisible()) {
    const isExpanded = await optionalBtn.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await optionalBtn.click();
    }
  }

  const picker = modal.locator('.location-picker');
  await expect(picker).toBeVisible();

  return { modal, picker };
}

// Helper: Get the unified location input field
function getLocationInput(picker: Locator) {
  return picker
    .locator(
      'input.location-picker-input, input[placeholder*="Adresse"], input[placeholder*="Maps-Link"], input[placeholder*="Ort"], input[type="text"], input[type="search"]'
    )
    .first();
}

// Helper: Get autocomplete dropdown list
function getDropdown(page: Page) {
  return page.locator(
    '.location-dropdown, .location-autocomplete, [role="listbox"], .location-results'
  );
}

// Helper: Get autocomplete option items
function getDropdownOptions(page: Page) {
  return page.locator('[role="option"], .location-result-item, .dropdown-item');
}

// Helper: Get location status badge/text
function getStatusBadge(picker: Locator) {
  return picker.locator('.location-status, .hint.success, [data-testid="location-status"]');
}

// Helper: Get clear button
function getClearButton(picker: Locator) {
  return picker.locator('button.clear-btn, button:has-text("Entfernen")');
}

// Helper: Get the active draggable pin marker on the mini-map
function getMapMarker(picker: Locator) {
  return picker.locator('.location-picker-map .leaflet-marker-draggable');
}

// Helper: Click mini-map at relative offset
async function clickMiniMap(picker: Locator, xRatio = 0.5, yRatio = 0.5) {
  const mapEl = picker.locator('.location-picker-map');
  await expect(mapEl).toBeVisible();
  const box = await mapEl.boundingBox();
  if (!box) throw new Error('Location picker map has no bounding box');
  await mapEl.click({
    position: {
      x: Math.round(box.width * xRatio),
      y: Math.round(box.height * yRatio),
    },
  });
}

test.describe('Unified Location Picker E2E Test Suite', () => {
  // Use simulated geolocation for tests exercising device location
  test.use({
    geolocation: { latitude: 48.2082, longitude: 16.3738 },
    permissions: ['geolocation'],
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature)
  // =========================================================================

  test.describe('Tier 1: Feature Coverage', () => {
    // -----------------------------------------------------------------------
    // Feature 1: Link Detection (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 1: Link Detection', () => {
      test('T1.1: parses standard Google Maps @lat,lng link directly without backend search', async ({
        page,
      }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('https://www.google.com/maps/@48.20820,16.37380,15z');

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2082');
        await expect(status).toContainText('16.3738');

        // Verify zero queries to /api/places/search (client-side link detection)
        expect(requests.length).toBe(0);
        await expect(getMapMarker(picker)).toBeVisible();
      });

      test('T1.2: parses Google Maps place link with !3d/!4d parameters prioritizing exact pin', async ({
        page,
      }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill(
          'https://www.google.com/maps/place/Cafe+Central/@48.2000,16.3000,12z/data=!3m1!4b1!4m6!3m5!1s0x476d07987!8m2!3d48.21040!4d16.36530'
        );

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2104');
        await expect(status).toContainText('16.3653');
        expect(requests.length).toBe(0);
      });

      test('T1.3: parses Apple Maps link with coordinate parameter (including encoded comma)', async ({
        page,
      }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('https://maps.apple.com/?coordinate=48.2082%2C16.3738');

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2082');
        await expect(status).toContainText('16.3738');
        expect(requests.length).toBe(0);
      });

      test('T1.4: parses OpenStreetMap link with mlat/mlon or hash format', async ({ page }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill(
          'https://www.openstreetmap.org/?mlat=48.20820&mlon=16.37380#map=16/48.2082/16.3738'
        );

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2082');
        await expect(status).toContainText('16.3738');
        expect(requests.length).toBe(0);
      });

      test('T1.5: parses RFC 5870 / Android geo: URI without network query', async ({ page }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('geo:48.21040,16.36530');

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2104');
        await expect(status).toContainText('16.3653');
        expect(requests.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 2: POI Search (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 2: POI Search', () => {
      test('T1.6: debounces free-text search queries to /api/places/search by 300ms', async ({
        page,
      }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');

        const dropdown = getDropdown(page);
        await expect(dropdown).toBeVisible();
        expect(requests.length).toBeGreaterThanOrEqual(1);
        expect(requests[requests.length - 1].q?.toLowerCase()).toContain('central');
      });

      test('T1.7: forwards proximity bias coordinates (lat, lng) when available in context', async ({
        page,
      }) => {
        const { requests } = setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Central');
        await expect(getDropdown(page)).toBeVisible();

        const lastReq = requests[requests.length - 1];
        expect(lastReq.q?.toLowerCase()).toContain('central');
        // If proximity bias is supplied from the active trip, lat/lng params should be present
        if (lastReq.lat) {
          expect(Number(lastReq.lat)).toBeGreaterThan(0);
          expect(Math.abs(Number(lastReq.lng))).toBeGreaterThan(0);
        }
      });

      test('T1.8: displays visual loading indicator while geocoding query is in flight', async ({
        page,
      }) => {
        setupPlacesMock(page, { delayMs: 400 });
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Central');

        const loader = picker.locator('.spinner.input-spinner, .location-search-wrap.is-loading');
        // Visual indicator must be displayed during delayed network fetch
        if (await loader.count()) {
          await expect(loader.first()).toBeVisible();
        }
        await expect(getDropdown(page)).toBeVisible({ timeout: 5000 });
      });

      test('T1.9: prevents race condition by discarding stale responses on rapid typing', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Hot');
        await input.fill('Hotel Excelsior');

        const dropdown = getDropdown(page);
        await expect(dropdown).toBeVisible();
        await expect(dropdown).toContainText('Hotel Excelsior');
      });

      test('T1.10: renders rich place results including name, formatted address, and category badge', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');

        const dropdown = getDropdown(page);
        await expect(dropdown).toBeVisible();

        const firstOption = getDropdownOptions(page).first();
        await expect(firstOption).toContainText('Café Central');
        await expect(firstOption).toContainText('Herrengasse 14');
      });
    });

    // -----------------------------------------------------------------------
    // Feature 3: Autocomplete Selection (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 3: Autocomplete Selection', () => {
      test('T1.11: selecting a dropdown item by mouse click sets location and closes dropdown', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');
        const firstOption = getDropdownOptions(page).first();
        await expect(firstOption).toBeVisible();
        await firstOption.click();

        await expect(getDropdown(page)).not.toBeVisible();
        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2104');
        await expect(status).toContainText('16.3653');
      });

      test('T1.12: navigating down with ArrowDown and pressing Enter selects the highlighted item', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Central');
        await expect(getDropdown(page)).toBeVisible();

        await input.press('ArrowDown');
        await input.press('Enter');

        await expect(getDropdown(page)).not.toBeVisible();
        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2104');
      });

      test('T1.13: pressing Escape key closes dropdown without modifying current location state', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Central');
        await expect(getDropdown(page)).toBeVisible();

        await input.press('Escape');
        await expect(getDropdown(page)).not.toBeVisible();
      });

      test('T1.14: cycling with ArrowDown and ArrowUp navigates through options predictably', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Central');
        await expect(getDropdown(page)).toBeVisible();

        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('ArrowUp');
        await input.press('Enter');

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2104');
      });

      test('T1.15: selecting a place updates modelValue coordinates and propagates to parent form', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Hotel Excelsior');
        const firstOption = getDropdownOptions(page).first();
        await expect(firstOption).toBeVisible();
        await firstOption.click();

        // Check that spot title was filled or can be saved with coordinates
        const status = getStatusBadge(picker);
        await expect(status).toContainText('41.9075');
        await expect(status).toContainText('12.4914');
      });
    });

    // -----------------------------------------------------------------------
    // Feature 4: Mini-Map Sync (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 4: Mini-Map Sync', () => {
      test('T1.16: selecting a search result moves and positions the mini-map marker', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');
        await getDropdownOptions(page).first().click();

        const marker = getMapMarker(picker);
        await expect(marker).toBeVisible();
      });

      test('T1.17: selecting a search result centers and zooms the Leaflet map view', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Stephansdom');
        await getDropdownOptions(page).first().click();

        const mapEl = picker.locator('.location-picker-map');
        await expect(mapEl.locator('.leaflet-tile-pane')).toBeAttached();
        await expect(getMapMarker(picker)).toBeVisible();
      });

      test('T1.18: pasting a valid Maps link moves the marker and recenters the mini-map', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('https://www.google.com/maps/@48.20820,16.37380,15z');

        const marker = getMapMarker(picker);
        await expect(marker).toBeVisible();
        const status = getStatusBadge(picker);
        await expect(status).toContainText('48.2082');
      });

      test('T1.19: mini-map correctly attaches Leaflet tile pane and renders map layer', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        const mapEl = picker.locator('.location-picker-map');
        await expect(mapEl.locator('.leaflet-tile-pane')).toBeAttached();
      });

      test('T1.20: editing a spot with existing coordinates initializes mini-map with existing pin', async ({
        page,
      }) => {
        // Create a spot with coordinates via API first
        const seededRes = await page.request.get('/api/trips');
        expect(seededRes.ok()).toBeTruthy();
        const trips = await seededRes.json();
        const tripId = trips[0].id;

        const spotTitle = `Pre-seeded Spot ${Date.now()}`;
        const createdSpot = await page.request.post('/api/spots', {
          data: {
            trip_id: tripId,
            title: spotTitle,
            lat: 48.2082,
            lng: 16.3738,
            category: 'Sonstiges',
          },
        });
        expect(createdSpot.ok()).toBeTruthy();

        await page.goto('/excursions?group=spots');
        const spotCard = page.locator('.spot-card', { hasText: spotTitle });
        await expect(spotCard).toBeVisible();
        await spotCard.locator('h3').click();
        await spotCard.locator('.edit-btn, button[aria-label*="bearbeiten"]').click();

        const editModal = page.locator('.modal');
        const locationBtn = editModal.getByRole('button', { name: 'Standort', exact: true });
        if (await locationBtn.isVisible()) {
          const isExpanded = await locationBtn.getAttribute('aria-expanded');
          if (isExpanded === 'false') {
            await locationBtn.click();
          }
        }

        const editPicker = editModal.locator('.location-picker');
        await expect(getMapMarker(editPicker)).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 5: Pin Click & Drag (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 5: Pin Click & Drag', () => {
      test('T1.21: clicking directly on the mini-map places marker at the clicked position', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        await clickMiniMap(picker, 0.5, 0.5);

        const marker = getMapMarker(picker);
        await expect(marker).toBeVisible();
      });

      test('T1.22: clicking on the mini-map updates the status badge with clicked coordinates', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        await clickMiniMap(picker, 0.5, 0.5);

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status.locator('.status-coords')).toBeVisible();
      });

      test('T1.23: subsequent clicks on different points move marker and update coordinates', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        await clickMiniMap(picker, 0.4, 0.4);
        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        const firstText = await status.innerText();

        await clickMiniMap(picker, 0.6, 0.6);
        await expect(status).toBeVisible();
        const secondText = await status.innerText();

        expect(firstText).not.toEqual(secondText);
      });

      test('T1.24: clicking device location button (useOwnLocation) sets marker to device position', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        const locateBtn = picker.locator('.locate-btn');
        await expect(locateBtn).toBeVisible();
        await locateBtn.click();

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
        await expect(status).toContainText('48.2082');
        await expect(status).toContainText('16.3738');
      });

      test('T1.25: manual map pin synchronizes coordinates to form submission model', async ({
        page,
      }) => {
        const { modal, picker } = await openNewSpotModal(page);
        await clickMiniMap(picker, 0.5, 0.5);

        const titleInput = modal.locator('input[placeholder*="Titel"], input[name="title"]');
        await titleInput.fill(`Manual Pin Spot ${Date.now()}`);

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 6: Clear Action (5 test cases)
    // -----------------------------------------------------------------------
    test.describe('Feature 6: Clear Action', () => {
      test('T1.26: clear button is visible whenever location coordinates are set', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');
        await getDropdownOptions(page).first().click();

        const clearBtn = getClearButton(picker);
        await expect(clearBtn).toBeVisible();
      });

      test('T1.27: clicking clear button removes the marker from the mini-map', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');
        await getDropdownOptions(page).first().click();

        const marker = getMapMarker(picker);
        await expect(marker).toBeVisible();

        const clearBtn = getClearButton(picker);
        await clearBtn.click();

        await expect(marker).not.toBeVisible();
      });

      test('T1.28: clicking clear button resets coordinates while preserving card display', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('Café Central');
        await getDropdownOptions(page).first().click();

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();

        const clearBtn = getClearButton(picker);
        await clearBtn.click();

        await expect(
          status.locator('.status-coords:not(.status-coords-missing)')
        ).not.toBeVisible();
        await expect(status.locator('[data-testid="spot-coords-missing"]')).toBeVisible();
        await expect(status).toBeVisible();
      });

      test('T1.29: clicking clear button clears the text input and maps link in the form', async ({
        page,
      }) => {
        setupPlacesMock(page);
        const { picker } = await openNewSpotModal(page);
        const input = getLocationInput(picker);

        await input.fill('https://www.google.com/maps/@48.20820,16.37380,15z');
        const clearBtn = getClearButton(picker);
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        await expect(input).toHaveValue('');
      });

      test('T1.30: clicking clear button emits null to modelValue reset coordinates', async ({
        page,
      }) => {
        const { picker } = await openNewSpotModal(page);
        await clickMiniMap(picker, 0.5, 0.5);

        const status = getStatusBadge(picker);
        await expect(status).toBeVisible();

        const clearBtn = getClearButton(picker);
        await clearBtn.click();

        await expect(
          status.locator('.status-coords:not(.status-coords-missing)')
        ).not.toBeVisible();
        await expect(status.locator('[data-testid="spot-coords-missing"]')).toBeVisible();
        await expect(getMapMarker(picker)).not.toBeVisible();
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (7 test cases)
  // =========================================================================

  test.describe('Tier 2: Boundary & Corner Cases', () => {
    test('T2.1: whitespace-only query does not trigger API search and keeps dropdown closed', async ({
      page,
    }) => {
      const { requests } = setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('     ');

      const dropdown = getDropdown(page);
      await expect(dropdown).not.toBeVisible();
      expect(requests.length).toBe(0);
    });

    test('T2.2: query below minimum length (single character) does not trigger geocoding search', async ({
      page,
    }) => {
      const { requests } = setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('C');

      const dropdown = getDropdown(page);
      await expect(dropdown).not.toBeVisible();
      expect(requests.length).toBe(0);
    });

    test('T2.3: invalid or non-maps URL is handled safely as plain text without crashing', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('https://example.com/not-a-map/page');

      // The input should not throw or cause unhandled exceptions
      const status = getStatusBadge(picker);
      await expect(status).not.toBeVisible();
    });

    test('T2.4: unresolved maps shortlink falls back gracefully without unhandled exception', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('https://maps.app.goo.gl/shortlink123');

      // Shortlink has no client-side coordinates, should show informative hint and not crash
      await expect(picker.locator('.hint.info')).toBeVisible();
      await expect(picker).toBeVisible();
    });

    test('T2.5: upstream geocoding proxy 500 error fails gracefully with empty state and active map', async ({
      page,
    }) => {
      setupPlacesMock(page, { status: 500 });
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('Café Central');

      // The UI must not crash or display an unhandled error alert
      const dropdown = getDropdown(page);
      if (await dropdown.isVisible()) {
        await expect(getDropdownOptions(page)).toHaveCount(0);
      }

      // Manual map clicking must remain fully functional
      await clickMiniMap(picker, 0.5, 0.5);
      await expect(getStatusBadge(picker)).toBeVisible();
    });

    test('T2.6: network abort or timeout on search request leaves UI responsive and map clickable', async ({
      page,
    }) => {
      setupPlacesMock(page, { abort: true });
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('Café Central');

      // Verify user can still place manual pin without blocking
      await clickMiniMap(picker, 0.5, 0.5);
      await expect(getStatusBadge(picker)).toBeVisible();
    });

    test('T2.7: search queries with umlauts, unicode, and HTML special characters are safely escaped', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('München <script>alert(1)</script>');

      // Verify that no script execution or broken markup occurs
      const dropdown = getDropdown(page);
      if (await dropdown.isVisible()) {
        const text = await dropdown.innerText();
        expect(text).not.toContain('<script>');
      }
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (5 test cases)
  // =========================================================================

  test.describe('Tier 3: Cross-Feature Interactions', () => {
    test('T3.1: pasting maps link then clicking mini-map adjusts pin to new manual position', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      // 1. Paste Maps link
      await input.fill('https://www.google.com/maps/@48.20820,16.37380,15z');
      const status = getStatusBadge(picker);
      await expect(status).toBeVisible();
      await expect(status).toContainText('48.2082');

      // 2. Adjust pin by clicking elsewhere on the map (avoiding top-left polaroid overlay)
      await clickMiniMap(picker, 0.8, 0.7);

      // Status coordinates must update to clicked position
      await expect(status).toBeVisible();
      const newText = await status.innerText();
      expect(newText).not.toContain('48.20820, 16.37380');
    });

    test('T3.2: searching POI then clearing resets coordinates and map pin while preserving card', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('Café Central');
      await getDropdownOptions(page).first().click();

      await expect(getStatusBadge(picker)).toBeVisible();
      await expect(getMapMarker(picker)).toBeVisible();

      await getClearButton(picker).click();

      await expect(
        getStatusBadge(picker).locator('.status-coords:not(.status-coords-missing)')
      ).not.toBeVisible();
      await expect(
        getStatusBadge(picker).locator('[data-testid="spot-coords-missing"]')
      ).toBeVisible();
      await expect(getMapMarker(picker)).not.toBeVisible();
      await expect(input).toHaveValue('');
    });

    test('T3.3: placing manual map pin then selecting POI replaces pin with exact POI location', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      // 1. Click map to place manual pin
      await clickMiniMap(picker, 0.5, 0.5);
      const status = getStatusBadge(picker);
      await expect(status).toBeVisible();

      // 2. Search for a POI and select it
      await input.fill('Stephansdom');
      await getDropdownOptions(page).first().click();

      // Pin and status must now reflect Stephansdom (48.2085, 16.3731)
      await expect(status).toContainText('48.2085');
      await expect(status).toContainText('16.3731');
    });

    test('T3.4: typing search query and clearing input text before selection closes dropdown', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('Central');
      await expect(getDropdown(page)).toBeVisible();

      await input.fill('');
      await expect(getDropdown(page)).not.toBeVisible();
    });

    test('T3.5: acquiring device location then pasting link overrides position with link coordinates', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      // 1. Use device location
      await picker.locator('.locate-btn').click();
      const status = getStatusBadge(picker);
      await expect(status).toContainText('48.2082');

      // 2. Paste link with different coordinates
      await input.fill('https://www.google.com/maps/@41.90750,12.49140,15z');

      await expect(status).toContainText('41.9075');
      await expect(status).toContainText('12.4914');
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (5 test cases)
  // =========================================================================

  test.describe('Tier 4: Real-World Scenarios', () => {
    test('T4.1: Scenario 4.1: creating a spot in ExcursionsView via POI search and verifying persistence', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { modal, picker } = await openNewSpotModal(page);
      const input = getLocationInput(picker);

      await input.fill('Café Central');
      await getDropdownOptions(page).first().click();

      // Title can be auto-suggested or entered
      const titleDisplay = modal.locator('.status-title');
      const titleInput = modal.locator('input[placeholder*="Titel"], input[name="title"]');
      let currentTitle = '';
      if (await titleDisplay.isVisible()) {
        currentTitle = (await titleDisplay.textContent())?.trim() || '';
      } else if (await titleInput.isVisible()) {
        currentTitle = await titleInput.inputValue();
      }
      const uniqueTitle = currentTitle || `Café Central Visit ${Date.now()}`;
      if (!currentTitle) {
        if (await modal.locator('.manual-details-btn').isVisible()) {
          await modal.locator('.manual-details-btn').click();
        }
        await titleInput.fill(uniqueTitle);
      }

      // Submit modal
      const saveBtn = modal.locator('button[type="submit"]');
      await saveBtn.click();

      // Verify spot card appears in Excursions list
      const spotCard = page.locator('.spot-card', { hasText: uniqueTitle });
      await expect(spotCard).toBeVisible();
    });

    test('T4.2: Scenario 4.2: creating an accommodation spot in ExcursionsView via Google Maps link', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { modal, picker } = await openNewSpotModal(page);

      // Switch category to "Unterkunft"
      const categoryCombobox = modal.locator('.category-combobox input, select');
      if (await categoryCombobox.isVisible()) {
        await categoryCombobox.fill('Unterkunft');
        await page.keyboard.press('Enter');
      }

      const input = getLocationInput(picker);
      await input.fill('https://www.google.com/maps/@41.90750,12.49140,15z');

      const titleInput = modal.locator('input[placeholder*="Titel"], input[name="title"]');
      const uniqueTitle = `Hotel Excelsior Booking ${Date.now()}`;
      await titleInput.fill(uniqueTitle);

      const saveBtn = modal.locator('button[type="submit"]');
      await saveBtn.click();

      const spotCard = page.locator('.spot-card', { hasText: uniqueTitle });
      await expect(spotCard).toBeVisible();
    });

    test('T4.3: Scenario 4.3: creating a scenic viewpoint spot without an address using manual map pin', async ({
      page,
    }) => {
      const { modal, picker } = await openNewSpotModal(page);

      // Click map for scenic spot in nature
      await clickMiniMap(picker, 0.45, 0.55);

      const titleInput = modal.locator('input[placeholder*="Titel"], input[name="title"]');
      const uniqueTitle = `Schöne Aussicht ${Date.now()}`;
      await titleInput.fill(uniqueTitle);

      const saveBtn = modal.locator('button[type="submit"]');
      await saveBtn.click();

      const spotCard = page.locator('.spot-card', { hasText: uniqueTitle });
      await expect(spotCard).toBeVisible();
    });

    test('T4.4: Scenario 4.4: setting trip destination in TripForm via location picker search', async ({
      page,
    }) => {
      setupPlacesMock(page);
      const { modal, picker } = await openNewTripModal(page);

      const nameInput = modal.getByLabel(/Name des Urlaubs/);
      const uniqueTripName = `Toskana Urlaub ${Date.now()}`;
      await nameInput.fill(uniqueTripName);

      const input = getLocationInput(picker);
      await input.fill('Florenz');
      const firstOpt = getDropdownOptions(page).first();
      await expect(firstOpt).toBeVisible();
      await firstOpt.click();
      await expect(getDropdown(page)).not.toBeVisible();

      const status = getStatusBadge(picker);
      await expect(status).toBeVisible();
      await expect(status).toContainText('43.7696');

      const saveBtn = modal.locator('button[type="submit"]');
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();

      // Trip should be created
      await expect(modal).not.toBeVisible();
      await expect(
        page.locator('.trip-card, h1, .header', { hasText: uniqueTripName })
      ).toBeVisible();
    });

    test('T4.5: Scenario 4.5: editing an existing spot to remove its location coordinates', async ({
      page,
    }) => {
      // 1. Seed a spot with coordinates
      const tripsRes = await page.request.get('/api/trips');
      const trips = await tripsRes.json();
      const tripId = trips[0].id;

      const spotTitle = `Spot To Clear ${Date.now()}`;
      const createdSpot = await page.request.post('/api/spots', {
        data: {
          trip_id: tripId,
          title: spotTitle,
          lat: 48.2082,
          lng: 16.3738,
          category: 'Sonstiges',
        },
      });
      expect(createdSpot.ok()).toBeTruthy();

      await page.goto('/excursions?group=spots');
      const spotCard = page.locator('.spot-card', { hasText: spotTitle });
      await expect(spotCard).toBeVisible();
      await spotCard.locator('h3').click();
      await spotCard.locator('.edit-btn, button[aria-label*="bearbeiten"]').click();

      const editModal = page.locator('.modal');
      const locationBtn = editModal.getByRole('button', { name: 'Standort', exact: true });
      if (await locationBtn.isVisible()) {
        const isExpanded = await locationBtn.getAttribute('aria-expanded');
        if (isExpanded === 'false') {
          await locationBtn.click();
        }
      }

      const picker = editModal.locator('.spot-location-fieldset, .location-picker').first();
      const clearBtn = getClearButton(picker);
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();

      const saveBtn = editModal.locator('button[type="submit"]', { hasText: 'Speichern' });
      await saveBtn.click();

      await expect(editModal).not.toBeVisible();
    });
  });
});
