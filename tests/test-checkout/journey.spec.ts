import {test,expect} from '@playwright/test';
import {createTestCheckoutFixture} from '../../scripts/lib/test-checkout-fixture.mjs';
let runtime:Awaited<ReturnType<typeof createTestCheckoutFixture>>;
let pageErrors:string[];
test.beforeEach(async({page})=>{
 pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 runtime=await createTestCheckoutFixture();
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.href==='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'){
   await route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,options)=>{el.textContent='Lokale Siteverify-transportfixture';queueMicrotask(()=>options.callback('fixture-'+crypto.randomUUID()));return 'fixture-widget';},remove:()=>{}};`});return;
  }
  expect([runtime.origin,runtime.adminOrigin]).toContain(url.origin);
  const response=await runtime.fetch(url.pathname+url.search,{host:url.origin,method:request.method(),headers:request.headers(),...(request.postData()?{body:JSON.parse(request.postData()!)}:{})});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
});
test.afterEach(async({page})=>{await page.close();await runtime?.dispose();expect(pageErrors).toEqual([]);});
async function select(page:import('@playwright/test').Page){
 await page.goto('/product/olive');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();await page.goto('/bestellen');await page.getByRole('link',{name:'Aanmelden als tester',exact:true}).click();
 await expect(page.getByRole('region',{name:'Serverberekend overzicht'})).toContainText('6,99');
 await page.getByLabel('Afhaling').selectOption('pickup');await page.getByRole('checkbox',{name:/informatie gelezen/}).check();await page.getByRole('checkbox',{name:/uitsluitend fictieve/}).check();
}
test('fictional main-domain checkout, persistent receipt and existing admin management',async({page},testInfo)=>{
 await select(page);await expect(page.getByLabel('Naam',{exact:true})).toHaveValue('Fictieve Testklant');await expect(page.getByLabel('Naam',{exact:true})).toHaveAttribute('readonly','');await expect(page.locator('.preview-banner')).toContainText('GEEN ECHTE BESTELLING');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('checkout.png'),fullPage:true});
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByTestId('order-reference')).toBeVisible();const reference=await page.getByTestId('order-reference').innerText();await page.reload();await expect(page.getByTestId('order-reference')).toHaveText(reference);await expect(page.locator('main')).toContainText('geen koopovereenkomst');
 const record=await runtime.db.prepare('SELECT id,email,source FROM orders WHERE reference=?').bind(reference).first();expect(record).toMatchObject({email:'testklant@example.invalid',source:'local_test'});
 await page.goto(runtime.adminOrigin);await page.getByRole('button',{name:'Open '+reference,exact:true}).click();
 await page.getByRole('textbox',{name:'Notitie voor het team',exact:true}).fill('FICTIEF — Phase 6 teamtest');await page.getByRole('button',{name:'Afspraken bewaren',exact:true}).click();await expect(page.getByRole('status')).toContainText('Gelukt');
 await page.reload();await page.getByRole('button',{name:'Open '+reference,exact:true}).click();await expect(page.getByRole('heading',{name:reference,exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Notitie voor het team',exact:true})).toHaveValue('FICTIEF — Phase 6 teamtest');
 expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM financial_events').first('n')).toBe(0);
 expect(await runtime.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='test_request.create'").first('n')).toBe(1);
});
test('lost success response and reload recover the original receipt without a duplicate',async({page})=>{
 await select(page);let lost=false;
 await page.route('**/test-bestellen/api/requests',async route=>{const req=route.request();const response=await runtime.fetch('/test-bestellen/api/requests',{method:'POST',headers:req.headers(),body:JSON.parse(req.postData()!)});expect(response.status).toBe(201);lost=true;await route.abort('failed');});
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Geen verbinding');expect(lost).toBe(true);
 await page.reload();await expect(page.getByTestId('order-reference')).toBeVisible();expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM test_checkout_orders').first('n')).toBe(1);
});
test('server denies unauthorized submissions and old APIs; session expiry preserves the unresolved retry',async({page})=>{
 for(const path of ['/test-bestellen','/test-bestellen/api/config','/test-bestellen/api/requests'])expect([401,403]).toContain((await runtime.fetch(path,{authenticated:false})).status);
 expect((await runtime.fetch('/test-bestellen/api/requests',{unauthorized:true,method:'POST',body:{}})).status).toBe(403);
 expect((await runtime.fetch('/api/requests',{method:'POST',body:{}})).status).toBe(403);
 await select(page);
 await page.route('**/test-bestellen/api/requests',async route=>{await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'tester_login_required',message:'Meld je opnieuw aan als tester.'}})});});
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('opnieuw aan');expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM test_checkout_orders').first('n')).toBe(0);expect(await page.evaluate(()=>sessionStorage.getItem('casa-apero.tester-attempt'))).toBeTruthy();
});
test('changed backend prices require renewed acknowledgement and a paused product cannot submit',async({page})=>{
 await select(page);await runtime.db.prepare("UPDATE products SET price_cents=799 WHERE id='olive'").run();
 await page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('prijs is gewijzigd');await expect(page.getByRole('region',{name:'Serverberekend overzicht'})).toContainText('7,99');await expect(page.getByRole('checkbox',{name:/informatie gelezen/})).not.toBeChecked();
 await runtime.db.prepare("UPDATE products SET orders_paused=1 WHERE id='olive'").run();await page.reload();await expect(page.getByRole('button',{name:'Vrijblijvende testaanvraag versturen',exact:true})).toBeDisabled();expect(await runtime.db.prepare('SELECT COUNT(*) AS n FROM test_checkout_orders').first('n')).toBe(0);
});
