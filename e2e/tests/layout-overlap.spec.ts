import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, boxOf, expectNotCoveredBy, expectWithinBox, expectWithinViewport } from './helpers/layout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'),
);
const dinner = seeded.scheduleItems.find((i: { title: string }) => i.title === 'Abendessen im Time Out Market');
const excursion = seeded.ideas.find((i: { title: string }) => i.title === 'Sightseeing-Tag Belém');

// Regressionsnetz gegen Elemente, die über ihre vorgesehene Box hinausragen oder von Laschen/
// Schubladen/Dialogen verdeckt werden (siehe CLAUDE.md, "Wann einen neuen/aktualisierten Test
// schreiben?" — hier: Positionierungs-/Layout-Bugs, ein bewusst als wert erachteter Fall). Ergänzt
// den bereits bestehenden, engeren "MapsAppPicker dropdown is not clipped by the modal"-Test in
// calendar.spec.ts (Dropdown vs. Modal-Overflow) um weitere, bereits real aufgetretene
// Überdeckungs-/Überlauf-Muster (Drawer-Overflow, mobile Bottom-Sheet vs. NavBar, schwebende Buttons
// vs. Status-Chips) über die wichtigsten Viewports hinweg.

test.describe('Kalender-Drawer: Kalender-Export-Dropdown wird nicht vom Drawer-Panel abgeschnitten', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('dropdown bleibt innerhalb des Viewports sichtbar, auch nahe am unteren Rand der Schublade', async ({ page }) => {
    // Regressionstest für einen realen Bug: das Dropdown hing per position:absolute an seinem
    // Trigger-Button innerhalb der scrollbaren Kalender-Schublade — bei einem Termin nahe am
    // unteren Rand der (auf Desktop höhenbegrenzten) Schublade ragte es dadurch unsichtbar über den
    // Viewport-Rand hinaus. Fix in ScheduleView.vue: per Teleport + position:fixed positioniert,
    // mit nachträglicher Klemmung an den unteren Viewport-Rand — dasselbe etablierte Muster wie
    // MapsAppPicker.vue's Dropdown-vs-Modal-Fix (siehe calendar.spec.ts).
    await page.goto('/');
    await page.locator(`.day[data-date="${dinner.date}"]`).click();
    const item = page.locator('.day-detail .items .item', { hasText: dinner.title });
    await item.locator('button[aria-label="Zum eigenen Kalender hinzufügen"]').click();

    const menu = page.locator('.picker-menu');
    await expect(menu).toBeVisible();
    await expectWithinViewport(page, menu);
  });
});

test.describe('Mobile: Kollabiertes Bottom-Sheet verdeckt keine Karten-Steuerelemente', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Karten-Button "Alle eingetragenen Orte anzeigen" bleibt über dem kollabierten Sheet sichtbar', async ({ page }) => {
    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Spots-Liste weiter runterschieben' }).click();

    const fitBtn = page.getByRole('button', { name: 'Alle eingetragenen Orte anzeigen' });
    const sheet = page.locator('.spots-col');
    await expect(sheet).toHaveClass(/collapsed/);
    await expectNotCoveredBy(page, fitBtn, sheet);
  });
});

test.describe('Mobile: nach unten positionierte NavBar überdeckt nicht die Sheet-Bedienelemente', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Hoch-/Runterschieben-Buttons des Spots-Sheets bleiben über der NavBar bedienbar', async ({ page }) => {
    // Regressionstest für einen realen Bug: .page's Höhenformel in ExcursionsView.vue zog bisher
    // nur --navbar-offset ab, nie --navbar-bottom-offset — bei navPosition.mobile === 'bottom' blieb
    // .spots-col (position:absolute; bottom:0) dadurch bis zum tatsächlichen Viewport-Rand
    // gestreckt und geriet hinter die fixierte NavBar (z-index 10 vs. spots-col z-index 5). Siehe
    // Fix in ExcursionsView.vue's .page-Regel.
    await page.addInitScript(() => localStorage.setItem('reisotor-nav-position-mobile', 'bottom'));
    await page.goto('/excursions');

    const navbar = page.locator('nav.navbar.mobile-bottom');
    await expect(navbar).toBeVisible();

    const upBtn = page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' });
    const downBtn = page.getByRole('button', { name: 'Spots-Liste weiter runterschieben' });
    await expectNotCoveredBy(page, upBtn, navbar);
    await expectNotCoveredBy(page, downBtn, navbar);
  });
});

test.describe('TripSwitcher-Dropdown liegt über Header/NavBar, nicht darunter', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(name, () => {
      test.use({ viewport });

      test('dropdown bleibt im Viewport und ist nicht von der NavBar verdeckt', async ({ page }) => {
        await page.goto('/');
        await page.locator('.switcher-btn').click();
        const dropdown = page.locator('.trip-switcher .dropdown');
        await expect(dropdown).toBeVisible();
        await expectWithinViewport(page, dropdown);
        await expectNotCoveredBy(page, dropdown, page.locator('nav.navbar'));
      });
    });
  }
});

test.describe('Dashboard: Aktions-Button bleibt innerhalb seiner Card', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(name, () => {
      test.use({ viewport });

      test('"Bearbeiten"-Button der Urlaub-Hero-Card ragt nicht heraus', async ({ page }) => {
        await page.goto('/');
        const heroCard = page.locator('.hero.card');
        const editBtn = heroCard.locator('.banner-edit-btn');
        await expect(editBtn).toBeVisible();
        await expectWithinBox(editBtn, heroCard);
      });
    });
  }
});

test.describe('Mobile: ExcursionCard-Löschen-Button überdeckt nicht den Status-Chip', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Status-Chip einer geplanten Tour bleibt neben dem Löschen-Button erreichbar', async ({ page }) => {
    // Regressionstest für einen vom Nutzer gemeldeten Bug: im mobilen Spaltenlayout
    // (@media max-width:480px) landeten .card-delete (oben rechts relativ zur ganzen Card) und
    // .status (oben rechts relativ zu .image, das dort die volle Kartenbreite einnimmt) in
    // derselben Ecke. Siehe Fix in ExcursionCard.vue. Touren-Karten leben seit der Verschmelzung
    // des früheren "erweiterten Touren-Modus" in der Spots-Sicht (/excursions, Touren-Gruppierung)
    // statt in einer eigenständigen Touren-Route.
    await page.goto('/excursions');
    // Spots-Sheet ganz aufziehen ("▲" bis deaktiviert, max. 2 Schritte von jedem Ausgangszustand
    // aus): maximiert den für die Liste verfügbaren sichtbaren Bereich, bevor gescrollt wird -
    // andere Tests können im geteilten Seed-Trip im Lauf der gesamten Suite weitere Spots/Stationen
    // zu "Sightseeing-Tag Belém" hinzufügen, wodurch die Karte höher wird als bei einem isolierten
    // Lauf dieser einen Spec.
    const expandBtn = page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' });
    for (let i = 0; i < 2 && (await expandBtn.isEnabled()); i++) await expandBtn.click();
    // Gruppieren/Sortieren/Filtern stecken auf Mobil standardmäßig hinter "⚙️ Anzeige & Filter"
    // (siehe ExcursionsView.vue) - erst aufklappen, um "🎒 Touren" überhaupt zu erreichen.
    await page.locator('.filter-toggle-row').click();
    await page.getByRole('button', { name: 'Touren' }).click();
    const card = page.locator('.excursion-card', { hasText: excursion.title });
    await expect(card).toBeVisible();
    const statusChip = card.locator('.status');
    const deleteBtn = card.locator('.card-delete');
    // Scrollt gezielt die beiden zu prüfenden Elemente (nicht nur die - ggf. höher als der
    // Viewport hohe - Karte als Ganzes) in den sichtbaren Bereich: elementFromPoint() (siehe
    // expectNotCoveredBy) trifft für Punkte außerhalb des aktuellen Viewports sonst grundsätzlich
    // "null", unabhängig vom eigentlich zu testenden Überdeckungs-Verhalten - reines
    // card.scrollIntoViewIfNeeded() garantiert das für Kind-Elemente in der oberen Ecke einer hohen
    // Karte nicht zuverlässig genug (leicht abweichende Schrift-/Layout-Maße je nach Umgebung
    // können die Ecke knapp über oder unter den sichtbaren Bereich schieben).
    await statusChip.scrollIntoViewIfNeeded();
    await deleteBtn.scrollIntoViewIfNeeded();
    await expect(statusChip).toBeVisible();
    await expect(deleteBtn).toBeVisible();
    await expectNotCoveredBy(page, statusChip, deleteBtn);
  });
});

test.describe('Mobile: Header-Statuszeile (Offline-/PWA-Update-Hinweis) überlagert nicht den TripSwitcher', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Update-Pill bekommt eine eigene Zeile statt vom TripSwitcher überdeckt zu werden, NavBar bleibt beim Scrollen sichtbar', async ({ page }) => {
    // Regressionstest für einen vom Nutzer gemeldeten Bug: PwaUpdatePrompt.vue saß zunächst als
    // weiterer Icon in derselben Zeile wie der TripSwitcher — dessen Button wächst mit dem
    // Urlaubsnamen und schrumpft nicht zuverlässig (.switcher-btn hat kein min-width:0 auf
    // .trip-name), wodurch er auf schmalen Viewports über seine eigene Box hinaus den danebenliegen-
    // den Pill überlagerte. Fix: eigene .status-row über der Icon-Zeile in AppHeader.vue. Simuliert
    // needRefresh=true per DOM-Injektion statt eines echten Service-Worker-Update-Zyklus (in Dev
    // sowieso deaktiviert, siehe devOptions.enabled in vite.config.ts) — reicht für den reinen
    // Layout-Check.
    await page.goto('/');
    await page.waitForSelector('.trip-name');
    await page.evaluate(() => {
      const row = document.querySelector('.status-row');
      if (!row) throw new Error('.status-row nicht gefunden');
      const pill = document.createElement('span');
      pill.className = 'pwa-pill update';
      pill.textContent = '🔄 Update verfügbar';
      row.appendChild(pill);
    });

    const pill = page.locator('.pwa-pill.update');
    const switcher = page.locator('.switcher-btn');
    await expect(pill).toBeVisible();
    await expectNotCoveredBy(page, switcher, pill);
    await expectNotCoveredBy(page, pill, switcher);

    // Der jetzt höhere Header (56px Icon-Zeile + Statuszeile) darf die sticky positionierte NavBar
    // beim Scrollen nicht verdecken — Regressionstest für den fest verdrahteten "top:56px" in
    // NavBar.vue, der die neue, variable Header-Höhe zunächst nicht kannte (siehe --app-header-height
    // in AppHeader.vue/NavBar.vue).
    await page.evaluate(() => window.scrollTo(0, 300));
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toBeVisible();
    await expectNotCoveredBy(page, navbar, page.locator('.app-header'));
  });
});

test.describe('Mobile: unten positionierte NavBar schwebt mit Rand statt randlos an der Kante zu kleben', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('NavBar hat auf allen Seiten Abstand zum Viewport-Rand, Seiteninhalt bleibt darüber sichtbar', async ({ page }) => {
    // Regressionstest für einen vom Nutzer gemeldeten Bug: eine randlos an die Bildschirmkante
    // geklebte NavBar war zu niedrig, wodurch horizontales Wischen über die Icon-Leiste leicht
    // versehentlich die Zurück-/Vorwärts-Wischgeste des mobilen Browsers auslöste (die an der
    // äußersten Kante abgefangen wird). Fix: schwebende Pille mit Rand-Abstand (NavBar.vue).
    await page.addInitScript(() => localStorage.setItem('reisotor-nav-position-mobile', 'bottom'));
    await page.goto('/todo');

    const navbar = page.locator('nav.navbar.mobile-bottom');
    await expect(navbar).toBeVisible();
    const box = await boxOf(navbar);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    // "Schwebend" heißt: spürbarer Abstand auf allen vier Seiten, nicht nur oben (das ergäbe sich
    // schon allein aus der Positionierung am unteren Rand).
    expect(box.left, 'NavBar klebt links an der Bildschirmkante').toBeGreaterThan(4);
    expect(viewport.width - box.right, 'NavBar klebt rechts an der Bildschirmkante').toBeGreaterThan(4);
    expect(viewport.height - box.bottom, 'NavBar klebt unten an der Bildschirmkante').toBeGreaterThan(4);

    // Der reservierte Content-Abstand (--navbar-bottom-offset) muss die schwebende Pille komplett
    // decken (Höhe + unterer Rand-Abstand), sonst könnte Seiteninhalt am Ende dahinter verschwinden.
    const pageEl = page.locator('.page').first();
    const pageBox = await boxOf(pageEl);
    expect(pageBox.bottom, 'Seiteninhalt reicht nicht bis zur schwebenden NavBar hoch').toBeGreaterThanOrEqual(box.top - 1);
  });
});

test.describe('Mobile: Gruppieren/Sortieren/Filtern auf der Spots-Karte sind standardmäßig eingeklappt', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  // Regressionsnetz für die neue Einklapp-Funktion (Nutzer-Feedback: das Werkzeug-Trio verbrauchte
  // auf Mobil spürbar Platz) - ExcursionsView.vue's filterBarExpanded/.filter-toggle-row. Bewusst
  // ein @media(max-width:799px)-Schwellenwert (nicht der schmalere @container spots-col
  // max-width:480px, der auch für das Karten-Grid gilt) - sonst würde dieselbe Einklapp-Logik
  // fälschlich auch auf Desktop greifen, sobald .spots-col dort schmal gezogen wird (echte
  // Bildschirmhöhe ist dort trotzdem meist reichlich vorhanden, das eigentliche Platzproblem
  // besteht nur auf kleinen Geräten).
  test('Werkzeug-Trio ist eingeklappt, lässt sich aufklappen und zeigt dabei den animierten Segmented-Toggle', async ({ page }) => {
    await page.goto('/excursions');
    const toggle = page.locator('.filter-toggle-row');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Touren' })).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const groupToggle = page.getByRole('button', { name: 'Touren' });
    await expect(groupToggle).toBeVisible();
    await expect(groupToggle).toHaveAttribute('aria-pressed', 'false');
    await groupToggle.click();
    await expect(groupToggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(groupToggle).toBeHidden();
  });
});

test.describe('Desktop: Gruppieren/Sortieren/Filtern bleiben immer offen, kein Einklapp-Umschalter sichtbar', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('kein "⚙️ Anzeige & Filter"-Umschalter, Werkzeug-Trio direkt sichtbar', async ({ page }) => {
    await page.goto('/excursions');
    await expect(page.locator('.filter-toggle-row')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Touren' })).toBeVisible();
  });
});

// Referenz: das Dropdown-vs-Modal-Overflow-Muster (MapsAppPicker im Termin-Detail-Dialog) ist
// bereits in calendar.spec.ts abgedeckt ("MapsAppPicker dropdown is not clipped by the modal") —
// hier bewusst nicht dupliziert.
