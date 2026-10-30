import {expect,test} from '@playwright/test';

test('official galleries load, switch images and preserve mobile layout and cart imagery',async({page},testInfo)=>{
 for(const [slug,count] of [['olive',4],['dune-mini',4],['dune-grand',3],['aperitivo',5]] as const){
  await page.goto('/product/'+slug);
  await expect(page.locator('.gallery-thumbnails button')).toHaveCount(count);
  const main=page.locator('.product-gallery > .product-photo img');
  await expect(main).toHaveAttribute('src',`/assets/products/${slug}-01.webp`);
  await expect(main).toHaveAttribute('srcset',/480w.*960w/);
  await expect(page.locator('.product-gallery .photo-label')).toHaveCount(0);
  for(let index=0;index<count;index++){
   await page.getByRole('button',{name:`Bekijk productfoto ${index+1}`,exact:true}).click();
   await expect(main).toHaveAttribute('src',`/assets/products/${slug}-0${index+1}.webp`);
   await main.evaluate((image:HTMLImageElement)=>image.decode());
   expect(await main.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByRole('button',{name:'Bekijk productfoto 1',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('img').evaluateAll(async(images:HTMLImageElement[])=>{await Promise.all(images.map(image=>{image.loading='eager';return image.decode();}));});
  await page.screenshot({path:testInfo.outputPath(slug+'.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'In winkelmand',exact:true}).click();await page.goto('/winkelmand');
 await expect(page.locator('.cart-item-image img')).toHaveAttribute('src','/assets/products/aperitivo-01.webp');
 await page.locator('.cart-item-image img').evaluate((image:HTMLImageElement)=>image.decode());
 await page.goto('/collectie');await expect(page.locator('.product-card')).toHaveCount(4);
 await expect(page.getByText('Olive Grande',{exact:true})).toHaveCount(0);
 await page.locator('img').evaluateAll(async(images:HTMLImageElement[])=>{await Promise.all(images.map(image=>{image.loading='eager';return image.decode();}));});
 await page.screenshot({path:testInfo.outputPath('collection.png'),fullPage:true});
});
