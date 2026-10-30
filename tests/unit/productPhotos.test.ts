import {expect,it} from 'vitest';
import {readFile,readdir,stat} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import snapshot from '../../src/data/catalogue.snapshot.json';
import manifest from '../../assets/products/photo-manifest.json';
import draft from '../../product-drafts/olive-grande.json';
import {PUBLIC_PRODUCT_SQL,projectCatalogue} from '../../worker/catalogue';

it('changes only product image metadata and versions, preserving historical prices and admin edits',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const name of (await readdir('migrations')).filter(n=>/^000[1-5]_/.test(n)).sort())db.exec(await readFile('migrations/'+name,'utf8'));
  db.exec("UPDATE products SET price_cents=899,description='Bestaande producttekst',orders_paused=1 WHERE id='olive'; INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,subtotal_cents,legal_version,acknowledgement_at) VALUES('photo-history','TEST-PHOTO','fictional-capability','Fictief','fixture@example.invalid','pickup',699,'historic','test'); INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days) VALUES('photo-history','olive','olive-standard','Olive',1,699,699,14);");
  const products=db.prepare('SELECT * FROM products ORDER BY id').all();
  const tables=['orders','order_items','order_status_history','payment_status','audit_log','financial_events','event_sales','application_settings'];
  const before=tables.map(table=>db.prepare(`SELECT * FROM ${table}`).all());
  db.exec(await readFile('migrations/0006_product_photography.sql','utf8'));
  expect(db.prepare('SELECT * FROM products ORDER BY id').all()).toEqual(products.map(row=>({...row,images_json:expect.any(String),version:Number(row.version)+1})));
  expect(tables.map(table=>db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
 }finally{db.close();}
});

it('keeps generated static photography consistent with fresh D1 metadata and all image files present',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const name of (await readdir('migrations')).filter(n=>/^\d.*\.sql$/.test(n)).sort())db.exec(await readFile('migrations/'+name,'utf8'));
  expect(projectCatalogue(db.prepare(PUBLIC_PRODUCT_SQL).all() as never,'false')).toEqual(snapshot);
 }finally{db.close();}
 for(const product of snapshot.products){
  expect(product.images.length).toBeGreaterThan(1);
  for(const photo of product.images){
   expect(photo.isPlaceholder).toBe(false);expect(photo.alt).toContain(product.name);
   for(const file of [photo.src,photo.src.replace('.webp','-480.webp')])expect((await stat('public'+file)).size).toBeGreaterThan(0);
  }
 }
 expect(Object.values(manifest.products).flat().map(p=>p.original).filter((v,i,a)=>a.indexOf(v)===i)).toHaveLength(14);
});

it('prepares Olive Grande without publishing, inserting a fake price or enabling orders',()=>{
 expect(draft).toMatchObject({id:'olive-grande',priceCents:null,published:false,ordersPaused:true,status:'draft'});
 expect(snapshot.products.some(p=>p.id==='olive-grande')).toBe(false);
 expect(snapshot.products.map(p=>p.variants[0].priceCents)).toEqual([699,699,1299,2599]);
});
