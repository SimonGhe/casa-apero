import {expect,test} from '@playwright/test';
import {createAdminPreviewFixture} from '../../scripts/lib/admin-preview-fixture.mjs';
let runtime:Awaited<ReturnType<typeof createAdminPreviewFixture>>;
test.beforeEach(async()=>{runtime=await createAdminPreviewFixture({writesEnabled:true});});
test.afterEach(async({page})=>{await page.close();await runtime?.dispose();});
test('confirmation identifies missing fields and exposes rejected saves without pretending the status persisted',async({page})=>{
 let writes=0;
 await page.route('**/*',async(route)=>{
  const request=route.request(),url=new URL(request.url());expect(url.origin).toBe(runtime.origin);
  if(request.method()==='PUT')writes++;
  const response=await runtime.fetch(url.pathname+url.search,{method:request.method(),body:request.postData()?JSON.parse(request.postData()!):undefined,headers:request.headers()});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('/');await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('combobox',{name:'Status',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Bestelling bevestigen',exact:true}).click();
 await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
 await expect(page.getByLabel('Wat spreken jullie af over afhalen of leveren?')).toBeFocused();expect(writes).toBe(0);
 await page.getByLabel('Wat spreken jullie af over afhalen of leveren?').fill('Fictief afhalen');
 await page.getByLabel('Extra afhaal- of leveringskosten EUR',{exact:true}).fill('0');
 await page.getByLabel('Hoe heb je de afspraken gedeeld?').fill('Fictief testbewijs');
 await page.getByLabel('Wanneer heb je ze gedeeld?').fill('2099-01-01T12:00');
 await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
 await expect(page.getByRole('alert')).toContainText('Niet opgeslagen.');
 await expect(page.getByRole('alert')).toContainText('niet in de toekomst');
 await expect(page.getByRole('alert')).toBeFocused();
 const detail=await(await runtime.fetch('/api/admin/orders/40000000-0000-4000-8000-000000000001')).json();
 expect(detail.order.workflow_status).toBe('new');expect(detail.audit).toHaveLength(0);
 await page.getByLabel('Wanneer heb je ze gedeeld?').fill('2026-10-24T12:00');
 await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
 await expect(page.getByRole('status')).toHaveText('Gelukt! De bestelling staat op Bevestigd.');
 await page.reload();await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('button',{name:'Productie starten',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Klaar voor afhaling',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Productie starten',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('In productie');
 await page.reload();await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('button',{name:'Klaar voor afhaling',exact:true})).toBeVisible();
});
test('compiled Access preview persists authorized edits and refuses unauthorized writes',async({page},testInfo)=>{
 await page.route('**/*',async(route)=>{
  const request=route.request(),url=new URL(request.url());expect(url.origin).toBe(runtime.origin);
  const response=await runtime.fetch(url.pathname+url.search,{method:request.method(),body:request.postData()?JSON.parse(request.postData()!):undefined,headers:request.headers()});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('/');await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await page.getByRole('textbox',{name:'Notitie voor het team',exact:true}).fill('Fictieve stagingtest');
 await page.getByLabel('Afhalen of leveren',{exact:true}).fill('TEST afhalen op afspraak');
 await page.getByRole('button',{name:'Bestelling bevestigen',exact:true}).click();
 await page.getByLabel('Extra afhaal- of leveringskosten EUR',{exact:true}).fill('0');
 await page.getByLabel('Hoe heb je de afspraken gedeeld?').fill('Fictief testbewijs; geen echte klant');
 await page.getByLabel('Wanneer heb je ze gedeeld?').fill('2026-10-24T12:00');
 await page.getByRole('button',{name:'Bevestiging bewaren'}).click();
 await expect(page.getByRole('button',{name:'Betaling ontvangen',exact:true})).toBeEnabled();
 await page.reload();await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('button',{name:'Productie starten',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Notitie voor het team',exact:true})).toHaveValue('Fictieve stagingtest');
 await expect(page.getByRole('textbox',{name:'Afhalen of leveren',exact:true})).toHaveValue('TEST afhalen op afspraak');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('student-order.png'),fullPage:true});
 const path='/api/admin/orders/40000000-0000-4000-8000-000000000001';
 expect((await runtime.fetch(path,{authenticated:false,method:'PUT',body:{version:1,status:'cancelled'}})).status).toBe(401);
 expect((await runtime.fetch(path,{method:'PUT',body:{version:1,status:'cancelled'},headers:{Origin:'https://evil.invalid'}})).status).toBe(403);
 const detail=await(await runtime.fetch(path)).json();expect(detail.order.workflow_status).toBe('confirmed');expect(detail.audit).toHaveLength(1);
});
test('cancellation stays under more options and requires an explicit confirmation',async({page})=>{
 await page.route('**/*',async(route)=>{
  const request=route.request(),url=new URL(request.url());expect(url.origin).toBe(runtime.origin);
  const response=await runtime.fetch(url.pathname+url.search,{method:request.method(),body:request.postData()?JSON.parse(request.postData()!):undefined,headers:request.headers()});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('/');await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('button',{name:'Annuleren…',exact:true})).not.toBeVisible();
 await page.getByText('Meer opties',{exact:true}).click();await page.getByRole('button',{name:'Annuleren…',exact:true}).click();
 const path='/api/admin/orders/40000000-0000-4000-8000-000000000001';
 expect((await(await runtime.fetch(path)).json()).order.workflow_status).toBe('new');
 await page.getByRole('button',{name:'Toch behouden',exact:true}).click();
 await page.getByRole('button',{name:'Annuleren…',exact:true}).click();await page.getByRole('button',{name:'Ja, bestelling annuleren',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Geannuleerd');
 const detail=await(await runtime.fetch(path)).json();expect(detail.order.workflow_status).toBe('cancelled');expect(detail.audit).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.locator('.admin-status-pill')).toHaveText('Geannuleerd');
 await expect(page.getByRole('button',{name:'Bestelling bevestigen',exact:true})).toHaveCount(0);
});
test('a lost market-sale response and browser reload reuse the original submission ID',async({page})=>{
 let loseResponse=true;const ids:string[]=[];
 await page.route('**/*',async(route)=>{
  const request=route.request(),url=new URL(request.url());expect(url.origin).toBe(runtime.origin);
  const body=request.postData()?JSON.parse(request.postData()!):undefined;
  const response=await runtime.fetch(url.pathname+url.search,{method:request.method(),body,headers:request.headers()});
  if(url.pathname==='/api/admin/events'&&request.method()==='POST'){
   ids.push(body.id);if(loseResponse){loseResponse=false;await route.abort('failed');return;}
  }
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 async function fill(){await page.getByRole('button',{name:'Marktverkopen',exact:true}).click();await page.getByLabel('Evenement',{exact:true}).fill('Fictieve markt herpoging');await page.getByLabel('Aantal Olive',{exact:true}).fill('2');}
 await page.goto('/');await fill();await page.getByRole('button',{name:'Marktverkoop registreren'}).click();
 await expect(page.getByRole('alert')).toBeVisible();await page.reload();await fill();
 await expect(page.getByText(/Er is een eerdere verzendpoging/)).toBeVisible();
 await page.getByRole('button',{name:'Marktverkoop registreren'}).click();
 await expect(page.getByText(/Er is een eerdere verzendpoging/)).toHaveCount(0);
 expect(ids).toHaveLength(2);expect(ids[1]).toBe(ids[0]);
 const events=await(await runtime.fetch('/api/admin/events')).json();expect(events).toHaveLength(1);
 const report=await(await runtime.fetch('/api/admin/report')).json();expect(report.eventRevenueCents).toBe(1398);
 const audit=await(await runtime.fetch('/api/admin/audit')).json();expect(audit).toHaveLength(1);
});
