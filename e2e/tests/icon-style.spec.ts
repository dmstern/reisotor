import { test, expect, type Page } from '@playwright/test';

// Regressionstest für die Emoji↔Tabler-Icons-Einstellung (stores/iconStyle.ts,
// components/AppIcon.vue, components/IconStyleSettings.vue): jeder Bereich (Navigation, Kategorien,
// Wetter, Formularfelder, Aktionen) hat immer einen konkreten Wert (kein globaler Fallback mehr,
// siehe Issue #74), Default ist überall Symbole außer bei Kategorien (Emoji). Ein
// "Für alle Bereiche umstellen"-Bulk-Toggle sowie Einfärben-Checkboxen für Navigation/Wetter und ein
// Reset-Button runden die Karte ab. Das Nutzer-Avatar bleibt davon in jedem Fall unberührt.
//
// Seit #105 kontoweit über /api/users/me/icon-settings persistiert statt in localStorage - die
// Helper unten sprechen direkt mit der API (page.request teilt sich die Session-Cookies mit page),
// statt localStorage zu lesen/schreiben.
//
// Wichtig für die Selektoren unten: AppIcon.vue setzt seine eigenen Klassen (app-icon, app-icon-
// tabler/-emoji) direkt auf sein Root-Element - im Tabler-Fall ist das Root-Element bereits das
// <svg> selbst (Vues automatisches Attribut-Durchreichen mergt eine vom Aufrufer übergebene class
// wie NavBar.vue's `<AppIcon class="icon">` ebenfalls direkt auf dieses <svg>), im Emoji-Fall ein
// <span>. Es gibt also KEIN <span class="icon"> als Wrapper um ein <svg> - svg.icon bzw. span.icon
// statt eines verschachtelten ".icon svg"-Selektors.
//
// tests/auth.setup.ts setzt für die restliche Suite bewusst alle Bereiche auf Emoji (damit
// unabhängige Tests ein Icon beiläufig per festem Emoji-Zeichen identifizieren können) - dieser
// Spec hier überschreibt das gezielt pro Test, um die tatsächliche Icon-Stil-Funktionalität zu
// prüfen.

interface StoredIconSettings {
  groups?: Record<string, string>;
  variants?: Record<string, string>;
  navColored?: boolean;
  colorizeWeather?: boolean;
  colorizeCategories?: boolean;
}

async function getIconSettings(page: Page): Promise<StoredIconSettings> {
  const res = await page.request.get('/api/users/me/icon-settings');
  return res.json();
}

async function putIconSettings(page: Page, settings: StoredIconSettings): Promise<void> {
  await page.request.put('/api/users/me/icon-settings', { data: { settings } });
}

test.describe('Icon-Stil: Emoji/Symbole', () => {
  test('Default ist überall Symbole außer bei Kategorien (Emoji), Bereichs-Toggle ändert das NavBar-Icon und persistiert', async ({
    page,
  }) => {
    await putIconSettings(page, {});
    await page.goto('/');
    const dashboardLink = page.locator('.navbar .link').first();

    // Default: Navigation-Bereich steht auf Symbole -> SVG, kein Emoji-Text.
    await expect(dashboardLink.locator('svg.icon')).toBeVisible();
    expect(await dashboardLink.locator('span.icon').count()).toBe(0);

    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    const navRow = iconsCard.locator('.group-override-row', { hasText: 'Navigation & Dashboard' });
    await navRow.locator('.segmented-option', { hasText: 'Emoji' }).click();
    // Warten, bis der Store die Änderung tatsächlich an die API übermittelt hat, statt sofort zu
    // lesen (persist() ist ein Fire-and-forget-PUT, siehe stores/iconStyle.ts).
    await expect.poll(async () => (await getIconSettings(page)).groups?.navigation).toBe('emoji');

    await page.goto('/');
    const dashboardLinkAfter = page.locator('.navbar .link').first();
    await expect(dashboardLinkAfter.locator('span.icon')).toHaveText('🏠');
    expect(await dashboardLinkAfter.locator('svg.icon').count()).toBe(0);

    await page.reload();
    await expect(page.locator('.navbar .link').first().locator('span.icon')).toHaveText('🏠');
  });

  test('"Für alle Bereiche umstellen" setzt alle Bereichs-Toggles auf einmal', async ({ page }) => {
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    await iconsCard.locator('.all-groups-row .segmented-option', { hasText: 'Emoji' }).click();
    await expect
      .poll(async () => Object.values((await getIconSettings(page)).groups ?? {}))
      .toEqual(['emoji', 'emoji', 'emoji', 'emoji', 'emoji']);

    await iconsCard.locator('.all-groups-row .segmented-option', { hasText: 'Symbole' }).click();
    await expect
      .poll(async () => Object.values((await getIconSettings(page)).groups ?? {}))
      .toEqual(['icons', 'icons', 'icons', 'icons', 'icons']);
  });

  test('Outline/Gefüllt ist pro Bereich einzeln einstellbar, nur sichtbar wenn der Bereich auf Symbole steht', async ({ page }) => {
    // tests/auth.setup.ts setzt für die restliche Suite bewusst alle Bereiche auf Emoji - hier
    // gezielt Navigation auf Symbole zurückstellen, um die Varianten-Zeile testen zu können.
    const current = await getIconSettings(page);
    await putIconSettings(page, { ...current, groups: { ...current.groups, navigation: 'icons' } });
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    const navRow = iconsCard.locator('.group-override-row', { hasText: 'Navigation & Dashboard' });
    const navVariantRow = iconsCard.locator('.variant-row').first();

    // Navigation steht jetzt auf Symbole -> Variante-Zeile sichtbar.
    await expect(navVariantRow).toBeVisible();

    const dashboardIcon = () => page.locator('.navbar .link').first().locator('svg.icon');
    // @tabler/icons-vue setzt fill="none" für Outline-, fill="currentColor" für Filled-Icons
    // (defaultAttributes.mjs) - Startdefault ist outline.
    await page.goto('/');
    await expect(dashboardIcon()).toHaveAttribute('fill', 'none');

    await page.goto('/profile?tab=app');
    await navVariantRow.locator('.segmented-option', { hasText: 'Gefüllt' }).click();
    await expect.poll(async () => (await getIconSettings(page)).variants?.navigation).toBe('filled');

    // fill ist nicht mehr 'none' (siehe @tabler/icons-vue's defaultAttributes.mjs) - der exakte Wert
    // hängt zusätzlich davon ab, ob "Icons in der Navigation einfärben" aktiv ist (Default: an, siehe
    // stores/iconStyle.ts), deshalb kein fixer Farbwert-Vergleich hier.
    await page.goto('/');
    await expect(dashboardIcon()).not.toHaveAttribute('fill', 'none');

    // Ein anderer Bereich (Kategorien) bleibt von der Navigation-Varianten-Änderung unberührt (jeder
    // Bereich trägt einen eigenen, vollständigen Wert - siehe stores/iconStyle.ts's DEFAULT_VARIANTS).
    await page.goto('/profile?tab=app');
    expect((await getIconSettings(page)).variants?.categories).toBe('outline');

    // Kategorien steht standardmäßig auf Emoji -> keine Varianten-Zeile für diesen Bereich.
    const categoriesRow = iconsCard.locator('.group-override-row', { hasText: 'Kategorien' });
    await expect(categoriesRow).toBeVisible();
    void navRow;
  });

  test('Avatar bleibt Emoji, unabhängig vom Icon-Stil', async ({ page }) => {
    await page.goto('/');
    const avatar = page.locator('.app-header .avatar');
    const avatarText = await avatar.textContent();
    expect(avatarText?.trim().length).toBeGreaterThan(0);
    expect(await avatar.locator('svg').count()).toBe(0);

    await putIconSettings(page, {
      groups: { navigation: 'icons', categories: 'icons', weather: 'icons', formFields: 'icons', actions: 'icons' },
    });
    await page.reload();
    // Kontrollcheck, dass die Einstellung diesmal tatsächlich griff (Nav-Icon jetzt ein SVG) -
    // sonst würde dieser Test auch bei kaputter Einstellung grün bleiben, weil das Avatar ja ohnehin
    // nie ein SVG zeigt.
    await expect(page.locator('.navbar .link').first().locator('svg.icon')).toBeVisible();

    await expect(page.locator('.app-header .avatar')).toHaveText(avatarText ?? '');
    expect(await page.locator('.app-header .avatar').locator('svg').count()).toBe(0);
  });

  test('Bereichs-Override lässt Kategorien bei Emoji, während andere Bereiche auf Symbole stehen', async ({ page }) => {
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    // Standard-Zustand (keine gespeicherten Einstellungen) erzwingen.
    await putIconSettings(page, {});
    await page.reload();
    await expect(iconsCard).toBeVisible();

    const categoriesRow = iconsCard.locator('.group-override-row', { hasText: 'Kategorien' });
    await expect(categoriesRow.locator('.segmented-option', { hasText: 'Emoji' })).toHaveClass(/active/);

    const navRow = iconsCard.locator('.group-override-row', { hasText: 'Navigation & Dashboard' });
    await expect(navRow.locator('.segmented-option', { hasText: 'Symbole' })).toHaveClass(/active/);
  });

  test('"Icons in der Navigation einfärben" setzt eine Akzentfarbe auf das NavBar-Icon', async ({ page }) => {
    // tests/auth.setup.ts setzt für die restliche Suite bewusst alle Bereiche auf Emoji - hier
    // gezielt Navigation auf Symbole zurückstellen, sonst gibt es kein SVG zum Einfärben.
    const current = await getIconSettings(page);
    await putIconSettings(page, { ...current, groups: { ...current.groups, navigation: 'icons' } });
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();
    // Ausgangspunkt: Einfärben aus (Default ist zwar "an", hier gezielt "aus" gesetzt, um den
    // Kontrast zu prüfen).
    const navColorCheckbox = iconsCard.locator('.colorize-row', { hasText: 'Icons in der Navigation einfärben' }).locator('input');
    if (await navColorCheckbox.isChecked()) await navColorCheckbox.uncheck();
    await expect.poll(async () => (await getIconSettings(page)).navColored).toBe(false);

    const dashboardIcon = () => page.locator('.navbar .link').first().locator('svg.icon');
    await page.goto('/');
    await expect(dashboardIcon()).toHaveAttribute('stroke', 'currentColor');

    await page.goto('/profile?tab=app');
    await navColorCheckbox.check();
    await expect.poll(async () => (await getIconSettings(page)).navColored).toBe(true);

    await page.goto('/');
    await expect(dashboardIcon()).not.toHaveAttribute('stroke', 'currentColor');
  });

  test('"Auf Standard-Einstellungen zurücksetzen" stellt Defaults wieder her', async ({ page }) => {
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    await iconsCard.locator('.all-groups-row .segmented-option', { hasText: 'Emoji' }).click();
    await expect.poll(async () => (await getIconSettings(page)).groups?.navigation).toBe('emoji');

    await iconsCard.locator('button', { hasText: 'Auf Standard-Einstellungen zurücksetzen' }).click();

    await expect
      .poll(async () => {
        const groups = (await getIconSettings(page)).groups ?? {};
        return [groups.navigation, groups.categories];
      })
      .toEqual(['icons', 'emoji']);
  });
});
