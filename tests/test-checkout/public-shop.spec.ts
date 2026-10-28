import {test,expect} from '@playwright/test';
import {createTestCheckoutFixture} from '../../scripts/lib/test-checkout-fixture.mjs';
async function localRoutes(page:import('@playwright/test').Page,runtime:Awaited<ReturnType<typeof createTestCheckoutFixture>>){
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.href==='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')return route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,options)=>{queueMicrotask(()=>options.callback('fixture-'+crypto.randomUUID()));return 'fixture';},remove:()=>{}};`});
   expect([runtime.origin,runtime.adminOrigin]).toContain(url.origin);
   const response=await runtime.fetch(url.pathname+url.search,{host:url.origin,method:request.method(),headers:request.headers(),...(request.postData()?{body:JSON.parse(request.postData()!)}:{})});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
}

test('public pickup request through confirmation, payment, production, collection and reporting',async({page},testInfo)=>{
 const runtime=await createTestCheckoutFixture({publicShop:true});
 try{
  await localRoutes(page,runtime);
  expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(0);
  await page.goto('/product/olive');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();await page.goto('/winkelmand');await page.getByRole('link',{name:'Naar bestellen',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Jouw afhaalaanvraag'})).toBeVisible();await expect(page.getByRole('region',{name:'Serverberekend overzicht'})).toContainText('6,99');
  await expect(page.locator('.preview-banner')).not.toContainText('TESTVERSIE');
  await expect(page.locator('a[href^="/test-bestellen"]')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('pas na persoonlijke bevestiging aanvaard');
  await expect(page.getByRole('combobox',{name:'Afhaling of levering'})).toHaveCount(0);
  await page.getByLabel('Naam',{exact:true}).fill('Fictieve MVP klant');await page.getByLabel('E-mailadres',{exact:true}).fill('mvp@example.test');await page.getByRole('checkbox',{name:/informatie gelezen/}).check();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('public-checkout.png'),fullPage:true});
  await page.getByRole('button',{name:'Bestelaanvraag versturen',exact:true}).click();await expect(page.getByRole('heading',{name:'Aanvraag ontvangen',exact:true})).toBeVisible();
  const reference=await page.getByTestId('order-reference').innerText();expect(reference).toMatch(/^CA-/);await page.reload();await expect(page.getByTestId('order-reference')).toHaveText(reference);
  await expect(page.locator('main')).toContainText('geen automatische e-mail');expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(1);
  await expect(page.getByRole('button',{name:'Ontvangstbewijs afdrukken of als PDF bewaren'})).toBeVisible();
  const order=await runtime.db.prepare('SELECT id,source,delivery_cents,contract_status FROM orders WHERE reference=?').bind(reference).first();expect(order).toMatchObject({source:'web',delivery_cents:0,contract_status:'none'});
  expect((await runtime.fetch('/api/admin/session',{host:runtime.adminOrigin,authenticated:false})).status).toBe(401);
  await page.goto(runtime.adminOrigin);await page.getByRole('button',{name:'Open '+reference,exact:true}).click();await page.getByRole('button',{name:'Bestelling bevestigen',exact:true}).click();
  await page.getByRole('textbox',{name:'Wat spreken jullie af over afhalen?',exact:true}).fill('FICTIEF — afhalen op school op afspraak');await expect(page.getByLabel('Afhaalkosten EUR',{exact:true})).toHaveValue('0.00');await page.getByLabel('Hoe heb je de afspraken gedeeld?').fill('FICTIEF — bewaarde mail en klantakkoord, geen mail verstuurd');await page.getByLabel('Wanneer heb je ze gedeeld?').fill('2026-10-24T12:00');await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
  await expect(page.getByRole('status')).toContainText('Bevestigd');await page.getByRole('button',{name:'Betaling ontvangen',exact:true}).click();await page.getByLabel('Ontvangen bedrag EUR').fill('6,99');await page.getByLabel('Hoe is er betaald?',{exact:true}).fill('FICTIEF contant');await page.getByRole('button',{name:'Betaling bewaren',exact:true}).click();await expect(page.getByRole('status')).toContainText('Betaling opgeslagen');
  for(const [action,status] of [['Productie starten','In productie'],['Klaar voor afhaling','Klaar voor afhaling'],['Bestelling afronden','Afgerond']]){await page.getByRole('button',{name:action,exact:true}).click();await expect(page.getByRole('status')).toContainText(status);}
  await page.reload();await page.getByRole('button',{name:'Open '+reference,exact:true}).click();await expect(page.locator('.admin-status-pill')).toHaveText('Afgerond');
  await page.getByRole('button',{name:'Rapporten',exact:true}).click();await expect(page.getByRole('heading',{name:'Omzet en geschatte winst'})).toBeVisible();await expect(page.locator('main')).toContainText('6,99');
  expect(await runtime.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE source='local_test' OR reference LIKE 'TEST-%'").first('n')).toBe(0);
  expect(await runtime.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='request.create'").first('n')).toBe(1);
  await page.goto(runtime.origin+'/algemene-voorwaarden');
  await expect(page.locator('main')).toContainText('Concept ter goedkeuring');
  await expect(page.locator('main')).not.toContainText('Bestellen is niet mogelijk');
 }finally{await page.close();await runtime.dispose();}
});


test('public wording follows active, globally paused and configuration-disabled states',async({page},testInfo)=>{
 const runtime=await createTestCheckoutFixture({publicShop:true});
 try{
  await localRoutes(page,runtime);
  await page.goto('/');await expect(page.locator('.preview-banner')).toContainText('Bestelaanvragen mogelijk');
  await expect(page.locator('footer')).toContainText('Alleen afhaling op afspraak');
  await expect(page.locator('footer a[href="mailto:info@casa-apero.com"]')).toBeVisible();
  await page.goto('/contact');await expect(page.locator('main a[href="mailto:info@casa-apero.com"]')).toBeVisible();await expect(page.locator('main')).not.toContainText('nog bevestigd');
  await page.goto('/product/olive');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();
  await page.goto('/bestellen');await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('leveringskosten');
  await runtime.db.prepare("UPDATE application_settings SET value='true' WHERE key='orders_paused'").run();
  await page.reload();await expect(page.locator('.preview-banner')).toContainText('Tijdelijk gepauzeerd');
  await expect(page.getByRole('heading',{name:'Bestelaanvragen tijdelijk gepauzeerd'})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);await expect(page.locator('.preview-banner')).not.toContainText('TESTVERSIE');
  await page.screenshot({path:testInfo.outputPath('paused-checkout.png'),fullPage:true});
  await runtime.db.prepare("UPDATE application_settings SET value='false' WHERE key='orders_paused'").run();
  await page.route('**/api/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({localRequests:false,publicRequests:false})}));
  await page.reload();await expect(page.locator('.preview-banner')).toContainText('Tijdelijk gepauzeerd');await expect(page.locator('form')).toHaveCount(0);
  await page.unroute('**/api/config');await page.reload();await expect(page.locator('.preview-banner')).toContainText('Bestelaanvragen mogelijk');await expect(page.locator('form')).toBeVisible();
  await page.route('**/api/config',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload();await expect(page.locator('.preview-banner')).toContainText('tijdelijk niet beschikbaar');await expect(page.locator('.preview-banner')).not.toContainText('Bestelaanvragen mogelijk');
  expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(0);
 }finally{await page.close();await runtime.dispose();}
});
