import {expect,test} from '@playwright/test';
import {createAdminPreviewFixture} from '../../scripts/lib/admin-preview-fixture.mjs';
let runtime:Awaited<ReturnType<typeof createAdminPreviewFixture>>;
test.beforeAll(async()=>{runtime=await createAdminPreviewFixture();});
test.afterAll(async()=>{await runtime?.dispose();});
test('signed local fixture loads compiled admin preview without a simulated login or editable records',async({page},testInfo)=>{
 await page.route('**/*',async(route)=>{
  const url=new URL(route.request().url());expect(url.origin).toBe(runtime.origin);
  const response=await runtime.fetch(url.pathname+url.search);
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto('/');
 await expect(page.getByText('Aangemeld: student@example.invalid')).toBeVisible();
 await expect(page.getByText(/Alleen bekijken\. Wijzigingen blijven uitgeschakeld/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Lokale testbeheerder starten'})).toHaveCount(0);
 await page.getByRole('button',{name:'Open TEST-ADMIN-PREVIEW-001'}).click();
 await expect(page.getByRole('heading',{name:'TEST-ADMIN-PREVIEW-001',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Bestelling bevestigen',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Producten',exact:true}).click();
 await expect(page.getByRole('button',{name:'Alle aanvragen pauzeren'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Aanvragen hervatten'})).toBeDisabled();
 await page.getByRole('button',{name:'Rapporten',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Omzet en geschatte winst'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('admin-preview-readonly.png'),fullPage:true});
});
