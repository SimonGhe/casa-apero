import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function login(page:Page){await page.goto('/');await page.getByRole('button',{name:'Lokale testbeheerder starten'}).click();await expect(page.getByRole('navigation',{name:'Beheernavigatie'})).toBeVisible();}
async function seed(page:Page){
 const response=await page.request.post('http://127.0.0.1:5173/api/requests',{headers:{Origin:'http://127.0.0.1:5173','Idempotency-Key':crypto.randomUUID()},data:{name:'Fictieve Browsertest',email:'test@example.invalid',phone:'',arrangement:'pickup',requestedDate:'',notes:'SYNTHETISCHE TEST',items:[{productId:'olive',variantId:'olive-standard',quantity:1}],expectedSubtotalCents:699,acknowledged:true,testDataOnly:true,receiptToken:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),turnstileToken:'local-test-token'}});
 expect(response.status()).toBe(201);return await response.json() as {reference:string};
}
test('anonymous requests are denied and a fictional local session can sign in and out',async({page})=>{
 const denied=await page.request.get('/api/admin/orders');expect(denied.status()).toBe(401);
 await login(page);await expect(page.getByText('Aangemeld: beheerder@example.invalid')).toBeVisible();
 const sessionCookies=await page.context().cookies();expect(sessionCookies.find(c=>c.name==='casa_admin_local')?.httpOnly).toBe(true);
 await page.getByRole('button',{name:'Afmelden'}).click();await expect(page.getByRole('button',{name:'Lokale testbeheerder starten'})).toBeVisible();expect((await page.request.get('/api/admin/report')).status()).toBe(401);
});
test('order search, confirmation, production, payment, notes and audit work on desktop and mobile',async({page},testInfo)=>{
 const {reference}=await seed(page);await login(page);
 await page.getByLabel('Zoek op naam of referentie').fill(reference);await page.getByRole('button',{name:`Open ${reference}`}).click();
 await expect(page.getByRole('heading',{name:reference,exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Notitie voor het team',exact:true}).fill('Fictieve productienotitie');
 await page.getByLabel('Afhalen of leveren',{exact:true}).fill('TEST — afhalen in Brugge na afspraak.');
 await page.getByRole('button',{name:'Bestelling bevestigen',exact:true}).click();
 await page.getByLabel('Extra afhaal- of leveringskosten EUR',{exact:true}).fill('0');
 await page.getByLabel('Hoe heb je de afspraken gedeeld?').fill('Fictief testbewijs, niets naar een klant verstuurd.');
 await page.getByLabel('Wanneer heb je ze gedeeld?').fill('2026-01-01T12:00');
 await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
 await expect(page.getByRole('button',{name:'Productie starten',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Betaling ontvangen',exact:true})).toBeEnabled();
 for(const action of ['Productie starten','Klaar voor afhaling','Bestelling afronden']){
  await page.getByRole('button',{name:action,exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Gelukt!');
  await expect(page.getByRole('textbox',{name:'Notitie voor het team',exact:true})).toHaveValue('Fictieve productienotitie');
 }
 await page.getByRole('button',{name:'Betaling ontvangen',exact:true}).click();
 await page.getByLabel('Ontvangen bedrag EUR').fill('6,99');await page.getByLabel('Hoe is er betaald?').fill('Fictief contant');
 await page.getByRole('button',{name:'Betaling bewaren',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Betaling opgeslagen: Betaald');
 await page.getByText('Meer opties',{exact:true}).click();
 await page.getByLabel('Bedrag terugbetaling EUR').fill('1,00');await page.getByRole('button',{name:'Terugbetaling bewaren',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Deels terugbetaald');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('admin-order.png'),fullPage:true});
 await page.getByRole('button',{name:'Wijzigingslog',exact:true}).click();await expect(page.locator('.admin-audit')).toContainText('payment.update');
});
test('product edits and pauses affect local D1 and restore original values after the test',async({page})=>{
 await login(page);const original=(await (await page.request.get('/api/admin/products')).json() as Array<Record<string,unknown>>).find(p=>p.id==='olive')!;
 try{
  await page.getByRole('button',{name:'Producten',exact:true}).click();const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Olive',exact:true})});
  await form.getByRole('textbox',{name:'Beschrijving',exact:true}).fill('Fictieve lokale producttekst');await form.getByLabel('Verkoopprijs EUR',{exact:true}).fill('7,99');await form.getByLabel('Product gepauzeerd').check();await form.getByRole('button',{name:'Product bewaren'}).click();
  await expect(form.getByLabel('Product gepauzeerd')).toBeChecked();
  await expect.poll(async()=>{const p=await (await page.request.get('/api/admin/products')).json() as Array<{id:string;orders_paused:number}>;return p.find(x=>x.id==='olive')?.orders_paused;}).toBe(1);
  await expect.poll(async()=>{const quote=await page.request.post('http://127.0.0.1:5173/api/quote',{headers:{Origin:'http://127.0.0.1:5173'},data:{items:[{productId:'olive',variantId:'olive-standard',quantity:1}]}});return quote.status();}).toBe(409);
  const storefront=await page.context().newPage();try{await storefront.goto('http://127.0.0.1:5173/product/olive');await expect(storefront.locator('main')).toContainText('Fictieve lokale producttekst');await expect(storefront.locator('main')).toContainText('7,99');await expect(storefront.getByRole('button',{name:'Tijdelijk gepauzeerd',exact:true})).toBeDisabled();}finally{await storefront.close();}
  await page.getByRole('button',{name:'Alle aanvragen pauzeren'}).click();await expect(page.getByRole('button',{name:'Aanvragen hervatten'})).toBeVisible();
 }finally{
  const current=(await (await page.request.get('/api/admin/products')).json() as Array<Record<string,unknown>>).find(p=>p.id==='olive')!;
  const restored=await page.request.put('/api/admin/products/olive',{headers:{Origin:'http://127.0.0.1:5180'},data:{version:current.version,name:original.name,description:original.description,priceCents:original.price_cents,costCents:original.cost_cents,productionDays:original.production_days,paused:Boolean(original.orders_paused),published:Boolean(original.published)}});expect(restored.ok()).toBe(true);
  const setting=await (await page.request.get('/api/admin/settings')).json();await page.request.put('/api/admin/settings',{headers:{Origin:'http://127.0.0.1:5180'},data:{version:setting.version,paused:false}});
 }
});
test('market summaries, reports, correction and Excel downloads work',async({page},testInfo)=>{
 await login(page);await page.getByRole('button',{name:'Marktverkopen',exact:true}).click();const name=`Fictieve markt ${crypto.randomUUID().slice(0,8)}`;
 await page.getByLabel('Evenement',{exact:true}).fill(name);await page.getByLabel('Aantal Olive',{exact:true}).fill('2');await page.getByRole('button',{name:'Marktverkoop registreren'}).click();
 const card=page.locator('.admin-event-card').filter({has:page.getByRole('heading',{name,exact:true})});await expect(card).toContainText('13,98');
 await page.getByRole('button',{name:'Rapporten',exact:true}).click();await expect(page.getByRole('heading',{name:'Omzet en geschatte winst'})).toBeVisible();
 await expect(page.locator('.admin-report')).toContainText('Netto betaalde omzet');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Financieel log exporteren (CSV)'}).click();const download=await downloadPromise;const path=testInfo.outputPath('finance.csv');await download.saveAs(path);const content=await readFile(path,'utf8');expect(content).toContain(';');expect(content).toContain('event_sale');
 await page.getByRole('button',{name:'Marktverkopen',exact:true}).click();const fresh=page.locator('.admin-event-card').filter({has:page.getByRole('heading',{name,exact:true})});await fresh.getByLabel('Reden voor correctie').fill('Fictieve testcorrectie');await fresh.getByRole('button',{name:'Samenvatting ongeldig maken'}).click();await expect(fresh).toContainText('Ongeldig gemaakt');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
