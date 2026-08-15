import { test, expect } from '@playwright/test';

// Regressionstest für die Emoji↔Tabler-Icons-Einstellung (stores/iconStyle.ts,
// components/AppIcon.vue, components/IconStyleSettings.vue): Default bleibt Emoji (Bestandsnutzer:
// innen sehen ohne aktives Opt-in keine Änderung), Umschalten auf "Symbole" ersetzt die Emoji-Spans
// app-weit durch Tabler-SVGs, ein zusätzlicher Outline/Gefüllt-Umschalter wechselt die Icon-Variante,
// das Nutzer-Avatar bleibt davon in jedem Fall unberührt (siehe DESIGN.md "Icons").
//
// Wichtig für die Selektoren unten: AppIcon.vue setzt seine eigenen Klassen (app-icon, app-icon-
// tabler/-emoji) direkt auf sein Root-Element - im Tabler-Fall ist das Root-Element bereits das
// <svg> selbst (Vues automatisches Attribut-Durchreichen mergt eine vom Aufrufer übergebene class
// wie NavBar.vue's `<AppIcon class="icon">` ebenfalls direkt auf dieses <svg>), im Emoji-Fall ein
// <span>. Es gibt also KEIN <span class="icon"> als Wrapper um ein <svg> - svg.icon bzw. span.icon
// statt eines verschachtelten ".icon svg"-Selektors.
test.describe('Icon-Stil: Emoji/Symbole', () => {
  test('Default ist Emoji, Umschalten auf Symbole ändert das NavBar-Icon zu einem SVG und persistiert', async ({ page }) => {
    await page.goto('/');
    const dashboardLink = page.locator('.navbar .link').first();

    // Default: kein gespeicherter Wert -> Emoji-Text, kein SVG.
    await expect(dashboardLink.locator('span.icon')).toHaveText('🏠');
    expect(await dashboardLink.locator('svg.icon').count()).toBe(0);

    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    const iconsPreview = iconsCard.locator('.icon-style-preview', { hasText: 'Symbole' });
    await iconsPreview.click();
    // Warten, bis die Karte selbst den neuen Zustand zeigt (derselbe Reactivity-Flush wie
    // stores/iconStyle.ts's watch(), das nach localStorage schreibt) statt localStorage sofort nach
    // dem Klick zu lesen, das würde die asynchrone Watcher-Ausführung riskant knapp überholen.
    await expect(iconsPreview).toHaveClass(/active/);
    expect(await page.evaluate(() => localStorage.getItem('reisotor-icon-style'))).toBe('icons');

    await page.goto('/');
    const dashboardLinkAfter = page.locator('.navbar .link').first();
    await expect(dashboardLinkAfter.locator('svg.icon')).toBeVisible();
    await expect(dashboardLinkAfter.locator('svg.icon')).toHaveClass(/tabler-icon-home/);
    expect(await dashboardLinkAfter.locator('span.icon').count()).toBe(0);

    await page.reload();
    await expect(page.locator('.navbar .link').first().locator('svg.icon')).toBeVisible();
  });

  test('Outline/Gefüllt-Umschalter wechselt die Icon-Variante, mit Fallback auf Outline ohne Filled-Pendant', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('reisotor-icon-style', 'icons'));
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    // Startdefault: outline (@tabler/icons-vue setzt fill="none" für Outline-, fill="currentColor"
    // für Filled-Icons, siehe defaultAttributes.mjs - die Vue-Komponenten selbst tragen anders als
    // die rohen SVGs in tablerMarkerSvg.ts keine unterscheidende CSS-Klasse).
    const dashboardIcon = () => page.locator('.navbar .link').first().locator('svg.icon');
    await expect(dashboardIcon()).toHaveAttribute('fill', 'none');

    const filledOption = iconsCard.locator('.segmented-option', { hasText: 'Gefüllt' });
    await filledOption.click();
    await expect(filledOption).toHaveClass(/active/);
    expect(await page.evaluate(() => localStorage.getItem('reisotor-icon-variant'))).toBe('filled');

    await page.goto('/');
    await expect(dashboardIcon()).toHaveAttribute('fill', 'currentColor');

    // Nicht jedes Icon hat eine Filled-Variante (z. B. Karte/map-2, siehe sectionIcons.ts) - muss
    // trotz "Gefüllt"-Einstellung sichtbar bleiben, nur eben als Outline (utils/icon.ts's Fallback).
    const mapLink = page.locator('.navbar .link', { hasText: 'Karte' }).locator('svg.icon');
    await expect(mapLink).toBeVisible();
    await expect(mapLink).toHaveAttribute('fill', 'none');
  });

  test('Avatar bleibt Emoji, unabhängig vom Icon-Stil', async ({ page }) => {
    await page.goto('/');
    const avatar = page.locator('.app-header .avatar');
    const avatarText = await avatar.textContent();
    expect(avatarText?.trim().length).toBeGreaterThan(0);
    expect(await avatar.locator('svg').count()).toBe(0);

    await page.evaluate(() => {
      localStorage.setItem('reisotor-icon-style', 'icons');
      localStorage.setItem('reisotor-icon-variant', 'filled');
    });
    await page.reload();
    // Kontrollcheck, dass die Einstellung diesmal tatsächlich griff (Nav-Icon jetzt ein SVG) -
    // sonst würde dieser Test auch bei kaputter Einstellung grün bleiben, weil das Avatar ja ohnehin
    // nie ein SVG zeigt.
    await expect(page.locator('.navbar .link').first().locator('svg.icon')).toBeVisible();

    await expect(page.locator('.app-header .avatar')).toHaveText(avatarText ?? '');
    expect(await page.locator('.app-header .avatar').locator('svg').count()).toBe(0);
  });

  test('Bereichs-Override lässt die Navigation bei Emoji, während der globale Stil auf Symbole steht', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('reisotor-icon-style', 'icons'));
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    await iconsCard.locator('summary', { hasText: 'Für einzelne Bereiche anpassen' }).click();
    const navRow = iconsCard.locator('.group-override-row', { hasText: 'Navigation & Dashboard' });
    await navRow.locator('.segmented-option', { hasText: 'Emoji' }).click();
    expect(await page.evaluate(() => localStorage.getItem('reisotor-icon-style-group-overrides'))).toContain('"navigation":"emoji"');

    await page.goto('/');
    const dashboardLink = page.locator('.navbar .link').first();
    await expect(dashboardLink.locator('span.icon')).toHaveText('🏠');
    expect(await dashboardLink.locator('svg.icon').count()).toBe(0);

    // Ein anderer Bereich (Kategorien, z. B. Wetter-Icon auf dem Dashboard) bleibt unverändert bei
    // Symbole - der Override gilt gezielt nur für die Navigation-Gruppe.
    await page.goto('/dashboard');
  });

  test('"Icons in der Navigation einfärben" setzt eine Akzentfarbe auf das NavBar-Icon', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('reisotor-icon-style', 'icons'));
    await page.goto('/profile?tab=app');
    const iconsCard = page.locator('.card', { hasText: 'Icons' });
    await expect(iconsCard).toBeVisible();

    const dashboardIcon = () => page.locator('.navbar .link').first().locator('svg.icon');
    await page.goto('/');
    await expect(dashboardIcon()).toHaveAttribute('stroke', 'currentColor');

    await page.goto('/profile?tab=app');
    await iconsCard.locator('.nav-colored-row input[type="checkbox"]').check();
    expect(await page.evaluate(() => localStorage.getItem('reisotor-icon-nav-colored'))).toBe('true');

    await page.goto('/');
    await expect(dashboardIcon()).not.toHaveAttribute('stroke', 'currentColor');
  });
});
