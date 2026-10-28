import { expect, test } from '@playwright/test';
import { legalPages } from '../../src/data/legal';

test('all legal routes load directly, support footer navigation and fit narrow screens', async ({ page }) => {
  for (const { path, title } of legalPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Casa Apero`);
    await expect(page.locator('main')).toContainText('Concept ter goedkeuring door school/Vlajo.');
    await expect(page.locator('main')).toContainText('Bestellen is niet mogelijk');
    await expect(page.locator('footer').getByRole('navigation', { name: 'Juridische informatie' }).getByRole('link', { name: title, exact: true })).toHaveAttribute('href', path);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    }
  }
  await page.locator('footer').getByRole('link', { name: 'Algemene voorwaarden', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Algemene voorwaarden');
  await expect(page.locator('main')).toBeFocused();
});

test('verified contact is published while identity, tax and retention remain explicit placeholders', async ({ page }) => {
  await page.goto('/wettelijke-vermeldingen');
  for (const text of ['TODO — school/Vlajo:', 'Juridische naam', 'vestigingsadres', 'ondernemingsnummer', 'btw-identificatie']) {
    await expect(page.locator('main')).toContainText(text);
  }
  await expect(page.locator('main a[href="mailto:info@casa-apero.com"]')).toBeVisible();
  await page.goto('/privacy');
  for (const text of ['verwerkingsverantwoordelijke', 'rechtsgrond', 'Cloudflare', 'bewaartermijnen', 'Jouw rechten', 'één maand']) await expect(page.locator('main')).toContainText(text);
  await page.goto('/herroepingsrecht');
  for (const text of ['14 kalenderdagen', 'Modelformulier', 'twee jaar', 'duurzame gegevensdrager', 'niet automatisch']) await expect(page.locator('main')).toContainText(text);
});

test('checkout displays selection and essential information without accepting data or orders', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/product/olive');
  await page.getByRole('spinbutton', { name: 'Aantal kommetjes' }).fill('2');
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  await page.goto('/bestellen');
  const info = page.getByRole('region', { name: 'Bestelinformatie' });
  await expect(info).toHaveAttribute('data-checkout-status', 'inactive');
  for (const text of ['Olive · 2 ×', '6,99', '13,98', 'afhaalkosten', '2 weken', 'Brugge', 'contant', '14 dagen', 'geen betalingsverplichting']) await expect(info).toContainText(text);
  await expect(info.getByRole('checkbox')).toBeDisabled();
  await expect(info.getByRole('checkbox')).not.toBeChecked();
  await expect(info.getByRole('button')).toBeDisabled();
  await expect(page.locator('form, input:not([type="checkbox"]), textarea')).toHaveCount(0);
  await expect(info.getByRole('link', { name: 'algemene voorwaarden', exact: true })).toHaveAttribute('href', '/algemene-voorwaarden');
  expect(writes).toEqual([]);
});

test('cart storage starts on selection, expires without refreshing on reload and removes empty data', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.goto('/product/olive');
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('casa-apero.cart.v2'));
  expect(saved).not.toBeNull();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('casa-apero.cart.v2'))).toBe(saved);
  await page.goto('/winkelmand');
  await page.getByRole('button', { name: 'Verwijder Olive' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('casa-apero.cart.v2'))).toBeNull();
  await page.evaluate(() => {
    localStorage.setItem('casa-apero.cart.v1', '[]');
    localStorage.setItem('casa-apero.cart.v2', JSON.stringify({ items: [{ productId: 'olive', variantId: 'olive-standard', quantity: 1 }], expiresAt: Date.now() - 1 }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Er is nog ruimte voor een kommetje.' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
