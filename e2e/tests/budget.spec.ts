import { test, expect, type Locator, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PASSWORD_2, E2E_USERNAME, E2E_USERNAME_2 } from '../constants.js';
import { VIEWPORTS, expectWithinViewport } from './helpers/layout';
import { newContextWithReducedMotion } from './helpers/context';

// Regressionsnetz für die überarbeitete Budget-Sicht (siehe CLAUDE.md-Plan "Budget-Sicht:
// Überarbeitung"): einfacher Modus (nur Gesamtsumme) vs. detaillierter Modus (Kategorien), echte
// Privatsphäre privater Budget-Töpfe, korrekte Schulden-/Ausgleichsberechnung bei geteilten
// Ausgaben+Überweisungen, und ein mobiler Layout-Check (die Sicht war vorher die einzige mit
// rohen <table>-Elementen ohne jede @media-Regel).

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Benutzername').fill(username);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.locator('.trip-name').first()).toBeVisible();
}

async function selectOptionByText(select: Locator, text: string) {
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value!);
}

// Die Gesamtübersicht ist ein einzelner BudgetMeter (Ausgegeben/Gesamtbudget als Balken statt
// dreier KPI-Boxen) - ".values" trägt "spent €" bzw. bei gesetztem Ziel "spent € / target €".
async function overviewValues(page: Page): Promise<{ spent: number; target: number }> {
  const text = await page.locator('.overview-card .values').innerText();
  const [spentPart, targetPart] = text.split('/');
  const parse = (s: string) => parseFloat(s.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return { spent: parse(spentPart), target: targetPart != null ? parse(targetPart) : 0 };
}

async function netFor(page: Page, username: string): Promise<number> {
  const row = page.locator('.balance-list li', { hasText: username });
  const text = (await row.locator('span').nth(1).innerText()).trim();
  const amount = parseFloat(text.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return /schuldet/.test(text) ? -amount : amount;
}

test('creates a shared budget pot with categories and the KPIs reflect the new expense correctly', async ({
  page,
}) => {
  await page.goto('/abc-123/budget');
  await expect(page.locator('.budget-page')).toBeVisible();

  const { spent: spentBefore, target: grandTotalBefore } = await overviewValues(page);

  const potName = `E2E Geteilter Topf ${Date.now()}`;
  await page.getByRole('button', { name: 'Budget anlegen' }).click();
  await page.getByPlaceholder('Name (z. B. Souvenirs)').fill(potName);
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

  const potCard = page.locator('.pot-card', { hasText: potName });
  await expect(potCard).toBeVisible();

  // Kategorie mit Zielbetrag 100 € anlegen (detaillierter Modus).
  await potCard.locator('summary').click();
  await potCard.getByPlaceholder('Neue Kategorie').fill('E2E Testkategorie');
  await potCard.getByPlaceholder('Ziel €').fill('100');
  await potCard.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(potCard.locator('.category-row')).toHaveCount(1);

  await expect(async () => {
    expect((await overviewValues(page)).target).toBeCloseTo(grandTotalBefore + 100, 1);
  }).toPass();

  // Ausgabe von 40 € gegen diese Kategorie und diesen Topf eintragen.
  await page.getByRole('button', { name: 'Bezahlung eintragen' }).click();
  await page.getByPlaceholder('Titel').fill('E2E Testausgabe');
  await page
    .locator('.add-form')
    .getByPlaceholder('Kategorie', { exact: true })
    .fill('E2E Testkategorie');
  await page.locator('.add-form').getByPlaceholder('Betrag').fill('40');
  await selectOptionByText(page.locator('.modal:visible .add-form select').nth(0), E2E_USERNAME);
  await selectOptionByText(page.locator('.modal:visible .add-form select').nth(1), potName);
  await page.locator('.modal:visible').getByRole('button', { name: 'Eintragen' }).click();

  await expect(async () => {
    expect((await overviewValues(page)).spent).toBeCloseTo(spentBefore + 40, 1);
  }).toPass();

  const categoryMeter = potCard.locator('.category-row', { hasText: 'E2E Testkategorie' });
  await expect(categoryMeter).toContainText('40.00');
  await expect(categoryMeter).toContainText('100.00');
});

test('a budget pot with only a target_amount (simple mode) shows a single meter without categories', async ({
  page,
}) => {
  await page.goto('/abc-123/budget');
  await expect(page.locator('.budget-page')).toBeVisible();
  const { target: grandTotalBefore } = await overviewValues(page);

  const potName = `E2E Einfacher Topf ${Date.now()}`;
  await page.getByRole('button', { name: 'Budget anlegen' }).click();
  await page.getByPlaceholder('Name (z. B. Souvenirs)').fill(potName);
  await page.getByPlaceholder('Gesamtziel € (optional)').fill('250');
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

  const potCard = page.locator('.pot-card', { hasText: potName });
  await expect(potCard).toBeVisible();
  // Einfacher Modus: keine Kategorie-Zeilen, nur der eine Gesamt-Meter.
  await expect(potCard.locator('.category-row')).toHaveCount(0);
  await expect(potCard).toContainText('250.00');

  await expect(async () => {
    expect((await overviewValues(page)).target).toBeCloseTo(grandTotalBefore + 250, 1);
  }).toPass();
});

test('a private budget pot stays invisible to another member, but shared expenses drive a correct settlement suggestion', async ({
  browser,
}) => {
  const ctxA = await newContextWithReducedMotion(browser, {
    storageState: { cookies: [], origins: [] },
  });
  const ctxB = await newContextWithReducedMotion(browser, {
    storageState: { cookies: [], origins: [] },
  });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await login(pageA, E2E_USERNAME, E2E_PASSWORD);
  await login(pageB, E2E_USERNAME_2, E2E_PASSWORD_2);

  await pageA.goto('/abc-123/budget');
  await pageB.goto('/abc-123/budget');
  await expect(pageA.locator('.budget-page')).toBeVisible();
  await expect(pageB.locator('.budget-page')).toBeVisible();

  // --- Privatsphäre: user1 legt privaten Topf + Kategorie + Ausgabe an, nur für sich selbst. ---
  const privatePotName = `E2E Privater Topf ${Date.now()}`;
  await pageA.getByRole('button', { name: 'Budget anlegen' }).click();
  await pageA.getByPlaceholder('Name (z. B. Souvenirs)').fill(privatePotName);
  await selectOptionByText(
    pageA.locator('.new-budget-form select').first(),
    'Privat (nur eine Person sieht ihn)'
  );
  await selectOptionByText(pageA.locator('.new-budget-form select').nth(1), E2E_USERNAME);
  await pageA.getByRole('button', { name: 'Anlegen', exact: true }).click();
  await expect(pageA.locator('.pot-card', { hasText: privatePotName })).toBeVisible();

  const privateExpenseTitle = `E2E Private Ausgabe ${Date.now()}`;
  await pageA.getByRole('button', { name: 'Bezahlung eintragen' }).click();
  await pageA.getByPlaceholder('Titel').fill(privateExpenseTitle);
  await pageA.locator('.add-form').getByPlaceholder('Betrag').fill('20');
  await selectOptionByText(pageA.locator('.modal:visible .add-form select').nth(0), E2E_USERNAME);
  await selectOptionByText(pageA.locator('.modal:visible .add-form select').nth(1), privatePotName);
  await pageA.locator('.modal:visible').getByRole('button', { name: 'Eintragen' }).click();
  await expect(pageA.locator('.row', { hasText: privateExpenseTitle })).toBeVisible();

  await pageB.reload();
  await expect(pageB.locator('.pot-card', { hasText: privatePotName })).toHaveCount(0);
  await expect(pageB.locator('.row', { hasText: privateExpenseTitle })).toHaveCount(0);
  // Eigene Sicht zeigt weiterhin alles.
  await expect(pageA.locator('.pot-card', { hasText: privatePotName })).toBeVisible();

  // --- Geteilte Ausgabe: user1 zahlt 10 €, ohne Budget-Zuordnung (zählt als geteilt/legacy). ---
  const netABefore = await netFor(pageA, E2E_USERNAME);
  const netBBefore = await netFor(pageB, E2E_USERNAME_2);

  const sharedExpenseTitle = `E2E Geteilte Ausgabe ${Date.now()}`;
  await pageA.getByRole('button', { name: 'Bezahlung eintragen' }).click();
  await pageA.getByPlaceholder('Titel').fill(sharedExpenseTitle);
  await pageA.locator('.add-form').getByPlaceholder('Betrag').fill('10');
  await selectOptionByText(pageA.locator('.modal:visible .add-form select').nth(0), E2E_USERNAME);
  await pageA.locator('.modal:visible').getByRole('button', { name: 'Eintragen' }).click();
  await expect(pageA.locator('.row', { hasText: sharedExpenseTitle })).toBeVisible();

  await pageB.reload();
  // Bei 2 Mitgliedern verschiebt eine allein von user1 bezahlte 10€-Ausgabe beide Netto-Salden um
  // genau 5€ in entgegengesetzte Richtung (fairShare = 10/2).
  await expect(async () => {
    expect(await netFor(pageA, E2E_USERNAME)).toBeCloseTo(netABefore + 5, 1);
    expect(await netFor(pageB, E2E_USERNAME_2)).toBeCloseTo(netBBefore - 5, 1);
  }).toPass();

  // --- Ausgleich per Überweisung: user2 (Schuldner) zahlt user1 (Gläubiger) genau die Differenz. ---
  await pageB.getByRole('button', { name: 'Überweisung eintragen', exact: true }).click();
  await selectOptionByText(pageB.locator('.modal:visible .add-form select').nth(0), E2E_USERNAME_2);
  await selectOptionByText(pageB.locator('.modal:visible .add-form select').nth(1), E2E_USERNAME);
  await pageB.locator('.modal:visible .add-form').getByPlaceholder('Betrag').fill('5');
  await pageB.locator('.modal:visible').getByRole('button', { name: 'Eintragen' }).click();

  await pageA.reload();
  await expect(async () => {
    expect(await netFor(pageA, E2E_USERNAME)).toBeCloseTo(netABefore, 1);
    expect(await netFor(pageB, E2E_USERNAME_2)).toBeCloseTo(netBBefore, 1);
  }).toPass();

  await ctxA.close();
  await ctxB.close();
});

test('clicking a settlement suggestion pre-fills the transfer form', async ({ page }) => {
  await page.goto('/abc-123/budget');
  await expect(page.locator('.budget-page')).toBeVisible();

  // Eine unbezahlt bleibende, ausschließlich von user1 getragene Ausgabe erzeugt garantiert einen
  // Ausgleichsvorschlag (unabhängig vom bereits vorhandenen Seed-/Testzustand).
  await page.getByRole('button', { name: 'Bezahlung eintragen' }).click();
  await page.getByPlaceholder('Titel').fill(`E2E Suggestion-Ausgabe ${Date.now()}`);
  await page.locator('.add-form').getByPlaceholder('Betrag').fill('30');
  await selectOptionByText(page.locator('.modal:visible .add-form select').nth(0), E2E_USERNAME);
  await page.locator('.modal:visible').getByRole('button', { name: 'Eintragen' }).click();

  const suggestionRow = page.locator('.suggestion-row').first();
  await expect(suggestionRow).toBeVisible();
  await suggestionRow.getByRole('button', { name: 'Als Überweisung eintragen' }).click();

  const transferModal = page.locator('.modal:visible', { hasText: 'Überweisung eintragen' });
  await expect(transferModal).toBeVisible();
  const amountValue = await transferModal.getByPlaceholder('Betrag').inputValue();
  expect(parseFloat(amountValue)).toBeGreaterThan(0);
});

test('nothing overflows the mobile viewport on the budget view', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto('/abc-123/budget');
  await expect(page.locator('.budget-page')).toBeVisible();

  // Die Seite ist länger als der Viewport (normales vertikales Scrollen) - jedes Element erst in
  // den sichtbaren Bereich scrollen, bevor geprüft wird, dass es nicht seitlich herausragt (siehe
  // layout-overlap.spec.ts für dasselbe Muster bei hohen Seiten).
  async function checkNoOverflow(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    await expectWithinViewport(page, locator);
  }

  // Die Listen-Karten (Bezahlungen/Überweisungen/Salden) wachsen mit der Datenmenge (in dieser
  // Suite akkumuliert über alle Tests hinweg, gleiche DB) und werden dadurch zwangsläufig höher als
  // der Viewport - das ist normales vertikales Scrollen, kein Layout-Fehler. Hier zählt nur, dass
  // sie nicht seitlich herausragen, nicht dass die komplette Karte auf einen Screen passt.
  async function checkNoHorizontalOverflow(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error('Element nicht sichtbar/nicht im DOM');
    const viewport = page.viewportSize();
    expect(viewport, 'page.viewportSize() ist null').not.toBeNull();
    if (!viewport) return;
    expect(box.x, 'Element ragt links aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, 'Element ragt rechts aus dem Viewport').toBeLessThanOrEqual(
      viewport.width + 0.5
    );
  }

  await checkNoOverflow(page.locator('.overview-card'));

  // Pot-Karten können je nach Datenmenge (Seed-Daten haben z. B. 6 Standardkategorien) höher als
  // der Viewport sein - wie bei den Listen-Karten unten zählt hier nur die horizontale Breite.
  const firstPotCard = page.locator('.pot-card').first();
  if (await firstPotCard.count()) {
    await checkNoHorizontalOverflow(firstPotCard);
  }

  const settlementCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Wer schuldet wem?' }) });
  await checkNoHorizontalOverflow(settlementCard);

  const expensesCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Bezahlungen' }) });
  await checkNoHorizontalOverflow(expensesCard);

  const transfersCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Überweisungen' }) });
  await checkNoHorizontalOverflow(transfersCard);
});
