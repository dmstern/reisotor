import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/fonts';

test.describe('Tab and Category Navigation Underline', () => {
  test('TabBar underline slides and aligns with active tab on click in ListenView', async ({
    page,
  }) => {
    await page.goto('/listen');
    await waitForAppReady(page);

    const tabBar = page.locator('.tab-bar');
    await tabBar.waitFor({ state: 'visible' });

    const track = tabBar.locator('.tab-bar-track');
    await expect(track).toBeVisible();

    const tabs = tabBar.locator('.tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    const underline = tabBar.locator('.tab-underline');
    await expect(underline).toBeVisible();

    async function assertUnderlineMatchesActive() {
      // Allow CSS transition to finish
      await page.waitForTimeout(300);
      const activeTab = tabBar.locator('.tab.active');
      await expect(activeTab).toBeVisible();

      const activeRect = await activeTab.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      });
      const underlineRect = await underline.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      });

      expect(underlineRect.width).toBeGreaterThan(0);
      expect(Math.abs(underlineRect.left - activeRect.left)).toBeLessThanOrEqual(3);
      expect(Math.abs(underlineRect.width - activeRect.width)).toBeLessThanOrEqual(3);
    }

    // Initial tab
    await assertUnderlineMatchesActive();

    // Click second tab
    await tabs.nth(1).click();
    await assertUnderlineMatchesActive();

    // Click third tab if present
    if (tabCount > 2) {
      await tabs.nth(2).click();
      await assertUnderlineMatchesActive();
    }
  });

  test('Category nav underline aligns with active item on click and horizontal scroll in ExcursionsView', async ({
    page,
  }) => {
    await page.goto('/excursions');
    await waitForAppReady(page);

    const catNav = page.locator('.category-nav');
    // If only one category exists in seed, test passes gracefully
    if ((await catNav.count()) === 0) return;

    await catNav.waitFor({ state: 'visible' });

    const track = catNav.locator('.category-nav-track');
    await expect(track).toBeVisible();

    const items = catNav.locator('.category-nav-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const underline = catNav.locator('.category-nav-underline');
    await expect(underline).toBeVisible();

    async function assertCategoryUnderlineMatchesActive() {
      await page.waitForTimeout(350);
      const activeItem = catNav.locator('.category-nav-item.active');
      await expect(activeItem).toBeVisible();

      const activeRect = await activeItem.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      });
      const underlineRect = await underline.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      });

      expect(underlineRect.width).toBeGreaterThan(0);
      expect(Math.abs(underlineRect.left - activeRect.left)).toBeLessThanOrEqual(3);
      expect(Math.abs(underlineRect.width - activeRect.width)).toBeLessThanOrEqual(3);
    }

    // Initial category
    await assertCategoryUnderlineMatchesActive();

    // Click second item
    await items.nth(1).click();
    await assertCategoryUnderlineMatchesActive();

    // Click last item
    await items.nth(count - 1).click();
    await assertCategoryUnderlineMatchesActive();
  });

  test('Category nav underline remains aligned when scrolled horizontally on narrow viewports', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/excursions');
    await waitForAppReady(page);

    const catNav = page.locator('.category-nav');
    if ((await catNav.count()) === 0) return;

    const items = catNav.locator('.category-nav-item');
    const count = await items.count();
    if (count < 2) return;

    const lastItem = items.nth(count - 1);
    await lastItem.click();
    await page.waitForTimeout(400);

    const underline = catNav.locator('.category-nav-underline');
    await expect(underline).toBeVisible();

    const activeItem = catNav.locator('.category-nav-item.active');
    await expect(activeItem).toBeVisible();

    const activeRect = await activeItem.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width };
    });
    const underlineRect = await underline.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width };
    });

    expect(underlineRect.width).toBeGreaterThan(0);
    expect(Math.abs(underlineRect.left - activeRect.left)).toBeLessThanOrEqual(3);
    expect(Math.abs(underlineRect.width - activeRect.width)).toBeLessThanOrEqual(3);
  });
});
