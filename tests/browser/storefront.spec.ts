import { expect, test } from '@playwright/test';

test('official prices, cart totals, reload, quantity changes and removal', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/product/aperitivo');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Aantal kommetjes' }).fill('2');
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('2 toegevoegd');
  await page.getByRole('link', { name: 'Bekijk winkelmand', exact: true }).click();
  await expect(page.getByTestId('cart-total')).toContainText('51,98');
  await page.reload();
  await expect(page.getByTestId('cart-total')).toContainText('51,98');
  await page.getByRole('button', { name: /Meer: Aantal/ }).click();
  await expect(page.getByTestId('cart-total')).toContainText('77,97');
  await page.getByRole('link', { name: 'Naar bestellen' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Jouw volgende aperomoment');
  await expect(page.getByText('Bestelformulier nog niet beschikbaar.', { exact: false })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
  await page.getByRole('link', { name: 'Bekijk je winkelmand' }).click();
  await page.getByRole('button', { name: /Verwijder Aperitivo/ }).click();
  await expect(page.getByRole('heading', { name: 'Er is nog ruimte voor een kommetje.' })).toBeVisible();
  expect(failures).toEqual([]);
});

test('catalogue filters, sorting and no-results recovery', async ({ page }) => {
  await page.goto('/collectie');
  await page.getByRole('button', { name: 'Kommetjes', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Sorteer collectie' }).selectOption('asc');
  await expect(page.locator('.product-card h3').first()).toHaveText('Olive');
  await page.getByRole('textbox', { name: 'Zoek in de collectie' }).fill('geen-resultaat');
  await expect(page.getByRole('heading', { name: 'Geen kommetjes gevonden' })).toBeVisible();
  await page.getByRole('button', { name: 'Toon alle producten' }).click();
  await expect(page.locator('.product-card')).toHaveCount(4);
});

test('paused product and invalid product cannot be ordered', async ({ page }) => {
  // Published product projection fixture, using the same contract as local D1.
  await page.route('**/api/catalogue',async route=>{const response=await route.fetch();const data=await response.json();data.products.find(p=>p.id==='olive').ordersPaused=true;await route.fulfill({response,json:data});});
  await page.goto('/product/olive');
  await expect(page.getByRole('button', { name: 'Tijdelijk gepauzeerd', exact: true })).toBeDisabled();
  await page.goto('/product/bestaat-niet');
  await expect(page.getByRole('heading', { name: 'Even de weg kwijt?' })).toBeVisible();
});

test('direct QR route, contact and privacy do not invent business data or collect customer details', async ({ page }) => {
  await page.goto('/bestellen?source=schoolmarkt');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('input[type="email"], form')).toHaveCount(0);
  await page.goto('/contact');
  await expect(page.getByText('Ons openbare e-mailadres wordt nog bevestigd.')).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'In deze voorvertoning' })).toBeVisible();
});

test('navigation works by touch or keyboard', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu openen' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobiele navigatie' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menu openen' })).toBeFocused();
    await page.getByRole('button', { name: 'Menu openen' }).click();
    await page.getByRole('navigation', { name: 'Mobiele navigatie' }).getByRole('link', { name: 'De collectie' }).click();
    await expect(page.getByRole('button', { name: 'Menu openen' })).toHaveAttribute('aria-expanded', 'false');
  } else {
    await page.getByRole('navigation', { name: 'Hoofdnavigatie', exact: true }).getByRole('link', { name: 'De collectie' }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'De collectie' })).toBeVisible();
});

test('all storefront routes fit the viewport and images load', async ({ page }, testInfo) => {
  for (const route of ['/', '/collectie', '/product/olive', '/winkelmand', '/bestellen', '/ons-verhaal', '/contact', '/privacy']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('img').evaluateAll(async (images: HTMLImageElement[]) => {
      // Off-screen lazy images need an explicit load request for full-page QA.
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });
    const broken = await page.locator('img').evaluateAll((images: HTMLImageElement[]) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
    expect(broken, `broken images on ${route}`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow on ${route}`).toBe(true);
    if (['/', '/collectie', '/product/olive'].includes(route)) {
      await page.screenshot({ path: testInfo.outputPath(`${route === '/' ? 'home' : route.replaceAll('/', '-')}.png`), fullPage: true });
    }
  }
});

test('small phones and tablets fit catalogue and product controls', async ({ page }) => {
  for (const width of [320, 360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/collectie', '/product/aperitivo']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px ${route}`).toBe(true);
    }
  }
});

test('official products show confirmed prices without invented variants', async ({ page }) => {
  for (const [slug, name, price] of [
    ['olive', 'Olive', '6,99'],
    ['dune-mini', 'Dune Mini', '6,99'],
    ['dune-grand', 'Dune Grand', '12,99'],
    ['aperitivo', 'Aperitivo', '25,99'],
  ]) {
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(page.locator('.detail-price')).toContainText(price);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.locator('.production-note')).toContainText('ongeveer 2 weken');
    await expect(page.getByRole('button', { name: 'In winkelmand', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Bekijk sfeerbeeld 2' }).click();
    await expect(page.getByRole('button', { name: 'Bekijk sfeerbeeld 2' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.product-gallery > .product-photo .photo-label')).toContainText('productfoto volgt');
  }
});

test('official logo, about text and social links are present and correctly proportioned', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['.header-logo', '.footer-logo']) {
    await expect(page.locator(selector)).toHaveAttribute('src', '/assets/logo-casa-apero.jpg');
    const size = await page.locator(selector).boundingBox();
    expect(size).not.toBeNull();
    expect(Math.abs(size!.width - size!.height)).toBeLessThan(1);
  }
  await expect(page.locator('.story-logo')).toHaveCount(0);
  await expect(page.locator('.team-photo img')).toHaveAttribute('alt', 'Het team achter Casa Apero');
  await expect(page.locator('.story-copy')).toContainText('8 enthousiaste studenten');
  await expect(page.locator('.story-copy')).toContainText('We werken op een duurzame manier');
  await expect(page.locator('.preview-banner')).not.toContainText('Voorbeeldproducten');
  const brand = await page.locator('.brand').boundingBox();
  const actions = await page.locator('.header-actions').boundingBox();
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(actions!.x);
  await page.goto('/contact');
  for (const [platform, url] of [
    ['Instagram', 'https://www.instagram.com/casa.apero.officieel/'],
    ['TikTok', 'https://www.tiktok.com/@casa_apero'],
  ]) {
    const link = page.locator('main').getByRole('link', { name: `Casa Apero op ${platform} (opent in een nieuw tabblad)`, exact: true });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('main')).toContainText('Julius en Maurits Sabbestraat, Brugge');
  await expect(page.locator('main')).toContainText('eventuele kosten');
});
