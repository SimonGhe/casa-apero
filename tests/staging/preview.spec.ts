import { expect, test } from '@playwright/test';

test('staging serves branded products, navigation, cart and legal pages without checkout', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.locator('.preview-banner')).toHaveText('TESTVERSIE — Geen echte bestelaanvragen. Gebruik alleen fictieve gegevens.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.header-logo')).toHaveAttribute('src', '/assets/logo-casa-apero.jpg');
  for (const [slug, name, price] of [['olive', 'Olive', '6,99'], ['dune-mini', 'Dune Mini', '6,99'], ['dune-grand', 'Dune Grand', '12,99'], ['aperitivo', 'Aperitivo', '25,99']]) {
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(page.locator('.detail-price')).toContainText(price);
    await page.locator('img').evaluateAll(async (images: HTMLImageElement[]) => { await Promise.all(images.map((image) => { image.loading = 'eager'; return image.decode(); })); });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  await page.goto('/winkelmand');
  await expect(page.getByTestId('cart-total')).toContainText('25,99');
  await page.reload();
  await expect(page.getByTestId('cart-total')).toContainText('25,99');
  await page.getByRole('link', { name: 'Naar bestellen', exact: true }).click();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bestellen nog niet beschikbaar', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Test het lokale bestelformulier' })).toHaveCount(0);
  for (const title of ['Algemene voorwaarden', 'Privacyverklaring', 'Wettelijke vermeldingen', 'Herroepingsrecht, retouren en klachten', 'Cookiebeleid']) {
    await page.locator('footer').getByRole('navigation', { name: 'Juridische informatie' }).getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('staging-home.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('staging blocks APIs and development routes and discourages indexing', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
  for (const path of ['/api', '/api/config', '/api/catalogue', '/api/products', '/api/quote', '/api/requests', '/api/orders', '/api/receipt', '/api/admin', '/api/demo']) {
    const get = await request.get(path);
    expect(get.status()).toBe(403);
    expect(get.headers()['x-robots-tag']).toContain('noindex');
    // Deliberately no order payload or customer fields, even when verifying live.
    const post = await request.post(path, { data: {} });
    expect(post.status()).toBe(403);
    expect(await post.json()).toMatchObject({ error: { code: 'staging_disabled' } });
  }
  for (const path of ['/__debug', '/cdn-cgi/local/explorer/api', '/bestellen/lokaal', '/bestellen/ontvangen', '/admin', '/src/main.tsx', '/assets/test.js.map']) expect((await request.get(path)).status(), path).toBe(404);
});
