import {beforeEach,afterEach,expect,it} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import worker from '../../worker/index';
import admin from '../../worker/admin';
import snapshot from '../../src/data/catalogue.snapshot.json';
import {validateCatalogue} from '../../shared/catalogue';
import {DatabaseSync} from 'node:sqlite';
let mf:Miniflare,db:D1Database;
const origin='http://127.0.0.1:5173';
beforeEach(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'catalogue-test',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-24',d1Databases:['DB']}]}));db=await mf.getD1Database('DB') as unknown as D1Database;
 for(const file of (await readdir('migrations')).filter(name=>/^\d.*\.sql$/.test(name)).sort())await db.exec((await readFile('migrations/'+file,'utf8')).split('\n').filter(line=>!line.trim().startsWith('--')).join(' '));
});
afterEach(async()=>{await mf.dispose();});
const catalogue=()=>worker.fetch(new Request(origin+'/api/catalogue'),{DB:db,APP_ENV:'local'});
const quote=()=>worker.fetch(new Request(origin+'/api/quote',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({items:[{productId:'olive',variantId:'olive-standard',quantity:2}]})}),{DB:db,APP_ENV:'local'});
it('projects the confirmed seeded products and exposes no private columns',async()=>{
 await db.exec("UPDATE products SET cost_cents=321; INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,subtotal_cents,legal_version,acknowledgement_at) VALUES('fictional','secret-reference','secret-code','Private Fictional','private@example.invalid','pickup',699,'test','test');");
 const response=await catalogue(),data=await response.json();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(data.products.map(p=>[p.id,p.variants[0].priceCents])).toEqual([['olive',699],['dune-mini',699],['dune-grand',1299],['aperitivo',2599]]);expect(validateCatalogue(data)).toEqual(data);expect(validateCatalogue(snapshot)).toEqual(snapshot);
 for(const marker of ['cost_cents','Private Fictional','private@example.invalid','secret-reference','receipt_token','internal_notes'])expect(JSON.stringify(data)).not.toContain(marker);
 for(const host of ['https://casa-apero.com','https://casa-apero-staging.example.workers.dev','https://admin.casa-apero.com'])expect((await worker.fetch(new Request(host+'/api/catalogue'),{DB:db,APP_ENV:'local'})).status).toBe(403);
 expect((await worker.fetch(new Request(origin+'/api/catalogue'),{DB:db,APP_ENV:'production'})).status).toBe(403);
});
it('uses admin edits immediately for storefront product information and authoritative quotes',async()=>{
 const adminOrigin='http://127.0.0.1:5180',env={DB:db,APP_ENV:'local-admin',ADMIN_AUTH_MODE:'local-session'};
 const login=await admin.fetch(new Request(adminOrigin+'/api/admin/local-login',{method:'POST',headers:{Origin:adminOrigin}}),env);const cookie=login.headers.get('Set-Cookie')!.split(';')[0];
 const productVersion=await db.prepare("SELECT version FROM products WHERE id='olive'").first<number>('version');
 const update=await admin.fetch(new Request(adminOrigin+'/api/admin/products/olive',{method:'PUT',headers:{Origin:adminOrigin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({version:productVersion,name:'Olive test',description:'Fictieve nieuwe producttekst',priceCents:799,costCents:200,productionDays:21,paused:false,published:true})}),env);expect(update.status).toBe(200);
 const data=await(await catalogue()).json();expect(data.products[0]).toMatchObject({name:'Olive test',description:'Fictieve nieuwe producttekst',estimatedProductionDays:21,variants:[{priceCents:799}]});
 expect(await(await quote()).json()).toMatchObject({subtotalCents:1598});
 await db.exec("UPDATE products SET published=0 WHERE id='olive';");expect((await(await catalogue()).json()).products).toHaveLength(3);expect((await quote()).status).toBe(400);
});
it('fails closed on pauses, missing settings and corrupted product metadata',async()=>{
 await db.exec("UPDATE products SET orders_paused=1 WHERE id='olive';");expect((await(await catalogue()).json()).products[0].ordersPaused).toBe(true);expect((await quote()).status).toBe(409);
 await db.exec("DELETE FROM application_settings WHERE key='orders_paused';");expect((await(await catalogue()).json()).shopSettings.ordersPaused).toBe(true);
 await db.exec("UPDATE products SET images_json='[]' WHERE id='olive';");expect((await catalogue()).status).toBe(503);
});
it('rejects invalid catalogue responses instead of accepting stale or unsafe metadata',()=>{
 for(const patch of [{...snapshot,shopSettings:{}},{...snapshot,products:[{...snapshot.products[0],cost_cents:42}]},{...snapshot,products:[{...snapshot.products[0],variants:[{id:'olive-standard',priceCents:1.5}]}]},{...snapshot,products:[{...snapshot.products[0],images:[{src:'https://untrusted.invalid/pixel',alt:'bad',isPlaceholder:true}]}]}])expect(()=>validateCatalogue(patch)).toThrow();
});
it('upgrades presentation metadata without overwriting administrator edits or historical prices',async()=>{
 const upgrade=new DatabaseSync(':memory:');
 try{
  for(const file of ['0001_schema.sql','0002_catalogue.sql','0003_administration.sql'])upgrade.exec(await readFile('migrations/'+file,'utf8'));
  upgrade.exec("UPDATE products SET price_cents=799,description='Fictieve bestaande tekst' WHERE id='olive'; INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,subtotal_cents,legal_version,acknowledgement_at) VALUES('historic','TEST-HISTORIC','test-capability','Fictief','fixture@example.invalid','pickup',699,'test','test'); INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days) VALUES('historic','olive','olive-standard','Olive',1,699,699,14);");
  upgrade.exec(await readFile('migrations/0004_catalogue_presentation.sql','utf8'));
  expect(upgrade.prepare("SELECT price_cents,description,slug FROM products WHERE id='olive'").get()).toMatchObject({price_cents:799,description:'Fictieve bestaande tekst',slug:'olive'});
  expect(upgrade.prepare("SELECT unit_price_cents FROM order_items WHERE order_id='historic'").get()).toMatchObject({unit_price_cents:699});
 }finally{upgrade.close();}
});
