import { expect, test } from '@playwright/test';

async function selectAndFill(page: import('@playwright/test').Page) {
  await page.goto('/product/olive');
  await page.getByRole('spinbutton', { name: 'Aantal kommetjes' }).fill('2');
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  await page.goto('/bestellen');
  await page.getByRole('link', { name: 'Test het lokale bestelformulier' }).click();
  await expect(page.getByRole('region', { name: 'Serverberekend overzicht' })).toContainText('13,98');
  await page.getByLabel('Naam', { exact: true }).fill('Fictieve Testklant');
  await page.getByLabel('E-mailadres', { exact: true }).fill('browser@example.invalid');
  await page.getByLabel('Telefoonnummer (optioneel)').fill('+32 470 00 00 00');
  await page.getByLabel('Afhaling of levering').selectOption('delivery');
  await page.getByLabel('Voorkeursdatum (optioneel)').fill('2028-12-01');
  await page.getByLabel('Opmerkingen (optioneel)').fill('Synthetische browserdemonstratie; niet uitvoeren.');
  await page.getByRole('checkbox', { name: /informatie gelezen/ }).check();
  await page.getByRole('checkbox', { name: /uitsluitend fictieve/ }).check();
}

test('local non-binding request, persistent receipt and responsive checkout', async ({ page }, testInfo) => {
  await selectAndFill(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('local-checkout.png'), fullPage: true });
  await page.getByRole('button', { name: 'Vrijblijvende testaanvraag versturen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Testaanvraag ontvangen' })).toBeVisible();
  const reference = await page.getByTestId('order-reference').innerText();
  expect(reference).toMatch(/^TEST-[A-F0-9]{16}$/);
  await expect(page.locator('main')).toContainText('geen koopovereenkomst');
  await expect(page.locator('main')).toContainText('13,98');
  await page.reload();
  await expect(page.getByTestId('order-reference')).toHaveText(reference);
  await expect(page.locator('main')).not.toContainText('browser@example.invalid');
  expect(await page.evaluate(() => localStorage.getItem('casa-apero.cart.v2'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('casa-apero.local-receipt'))).toMatch(/^[a-f0-9]{64}$/);
  await page.screenshot({ path: testInfo.outputPath('local-receipt.png'), fullPage: true });
});

test('invalid information stays editable and a valid retry succeeds', async ({ page }) => {
  await selectAndFill(page);
  await page.getByLabel('Telefoonnummer (optioneel)').fill('invalid');
  await page.getByRole('button', { name: 'Vrijblijvende testaanvraag versturen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('telefoonnummer');
  await expect(page.getByLabel('Telefoonnummer (optioneel)')).toBeEnabled();
  await page.getByLabel('Telefoonnummer (optioneel)').fill('');
  await page.getByRole('button', { name: 'Vrijblijvende testaanvraag versturen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Testaanvraag ontvangen' })).toBeVisible();
});

test('a lost success response retries with the same key and cannot create duplicate requests', async ({ page }) => {
  await selectAndFill(page);
  const keys: string[] = [];
  const references: string[] = [];
  await page.route('**/api/requests', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    const result = await response.json();
    references.push(result.reference);
    if (keys.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Vrijblijvende testaanvraag versturen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Geen verbinding');
  await expect(page.getByLabel('Naam', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Dezelfde aanvraag opnieuw proberen' }).click();
  await expect(page.getByRole('heading', { name: 'Testaanvraag ontvangen' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(references[0]).toBe(references[1]);
});
test('reloading after a lost success response recovers the receipt without submitting again',async({page})=>{
 await selectAndFill(page);let posts=0,reference='';
 await page.route('**/api/requests',async route=>{posts++;const response=await route.fetch();reference=(await response.json()).reference;await route.abort('failed');});
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Geen verbinding');
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(stored).not.toContain('browser@example.invalid');expect(stored).not.toContain('Fictieve Testklant');
 await page.reload();await expect(page.getByTestId('order-reference')).toHaveText(reference);expect(posts).toBe(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('casa-apero.local-attempt'))).toBeNull();
});
test('requires an explicit pickup or delivery preference before submitting',async({page})=>{
 await page.goto('/product/olive');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();await page.goto('/bestellen/lokaal');
 await page.getByLabel('Naam',{exact:true}).fill('Fictieve Voorkeurtest');await page.getByLabel('E-mailadres',{exact:true}).fill('preference@example.invalid');
 await page.getByRole('checkbox',{name:/informatie gelezen/}).check();await page.getByRole('checkbox',{name:/uitsluitend fictieve/}).check();
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByLabel('Afhaling of levering')).toBeFocused();
});
test('a changed price requires checking the updated quote and acknowledging again',async({page})=>{
 await selectAndFill(page);
 await page.route('**/api/requests',route=>route.fulfill({status:409,json:{error:{code:'price_changed',message:'De prijs is gewijzigd. Controleer het overzicht.'}}}));
 await page.route('**/api/quote',async route=>{const response=await route.fetch(),data=await response.json();data.items[0].unitPriceCents=799;data.items[0].totalCents=1598;data.subtotalCents=1598;await route.fulfill({response,json:data});});
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('prijs is gewijzigd');await expect(page.getByRole('region',{name:'Serverberekend overzicht'})).toContainText('15,98');
 await expect(page.getByRole('checkbox',{name:/informatie gelezen/})).not.toBeChecked();
});

test('API failure keeps the selection and public mode has no active form', async ({ page }) => {
  await page.route('**/api/quote', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Test: database tijdelijk niet beschikbaar.' } }) }));
  await page.goto('/product/olive');
  await page.getByRole('button', { name: 'In winkelmand', exact: true }).click();
  await page.goto('/bestellen/lokaal');
  await expect(page.getByRole('alert')).toContainText('database tijdelijk');
  await expect(page.getByRole('button', { name: 'Vrijblijvende testaanvraag versturen', exact: true })).toBeDisabled();
  await page.goto('/winkelmand');
  await expect(page.getByTestId('cart-total')).toContainText('6,99');
  await page.route('**/api/config', (route) => route.fulfill({ json: { localRequests: false } }));
  await page.goto('/bestellen/lokaal');
  await expect(page.getByRole('heading', { name: 'Bestellen is niet beschikbaar' })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
});

test('receipt requires this tab’s opaque code; no customer lookup by reference exists', async ({ page, request }) => {
  await page.goto('/bestellen/ontvangen');
  await expect(page.getByRole('alert')).toContainText('Geen ontvangstcode');
  const response = await request.get('/api/orders/TEST-123');
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');
});
