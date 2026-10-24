import {expect,test} from '@playwright/test';
test('current catalogue prices are used after restoring an existing cart',async({page})=>{
 let price=799;
 await page.route('**/api/catalogue',async route=>{const response=await route.fetch(),data=await response.json();const olive=data.products.find(p=>p.id==='olive');olive.variants[0].priceCents=price;olive.description='Fictieve actuele productbeschrijving';await route.fulfill({response,json:data});});
 await page.goto('/product/olive');await expect(page.locator('main')).toContainText('Fictieve actuele productbeschrijving');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();
 await page.goto('/winkelmand');await expect(page.getByTestId('cart-total')).toContainText('7,99');
 price=899;await page.reload();await expect(page.getByTestId('cart-total')).toContainText('8,99');
});
test('unpublished selections require an explicit cart correction',async({page})=>{
 await page.goto('/product/olive');await page.getByRole('button',{name:'In winkelmand',exact:true}).click();
 await page.route('**/api/catalogue',async route=>{const response=await route.fetch(),data=await response.json();data.products=data.products.filter(p=>p.id!=='olive');await route.fulfill({response,json:data});});
 await page.goto('/winkelmand');await expect(page.getByRole('alert')).toContainText('niet meer beschikbaar');
 await page.getByRole('button',{name:'Niet-beschikbare producten verwijderen'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('casa-apero.cart.v2'))).toBeNull();
});
test('catalogue failures cannot silently fall back to stale selectable prices',async({page})=>{
 await page.route('**/api/catalogue',route=>route.fulfill({status:503,json:{error:{message:'Fictieve fout'}}}));await page.goto('/product/olive');
 await expect(page.getByRole('alert').first()).toContainText('collectie kan niet worden gecontroleerd');await expect(page.getByRole('button',{name:'In winkelmand',exact:true})).toHaveCount(0);
});
