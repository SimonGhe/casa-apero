import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';

it('upgrades an existing fictional staging database without changing historical business rows',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const file of ['0001_schema.sql','0002_catalogue.sql','0003_administration.sql','0004_catalogue_presentation.sql'])db.exec(await readFile('migrations/'+file,'utf8'));
  db.exec(await readFile('preview/admin-fixtures.sql','utf8'));
  db.exec(`UPDATE orders SET workflow_status='completed',confirmed_arrangements='Test',version=5;
   INSERT INTO order_status_history(order_id,category,to_status,actor_id) VALUES('40000000-0000-4000-8000-000000000001','production','completed','fictional-admin');
   INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,before_json,after_json) VALUES('fixture-audit','fictional-admin','payment.update','order','40000000-0000-4000-8000-000000000001','{}','{"fictional":true}');
   UPDATE payment_status SET status='paid',amount_paid_cents=1398,method='FICTIEF contant';
   INSERT INTO financial_events(id,mutation_id,entity_type,entity_id,category,amount_cents,accounting_date) VALUES('fixture-money','fixture-audit','order','40000000-0000-4000-8000-000000000001','payment',1398,'2026-10-25');
   INSERT INTO idempotency_keys(key,request_hash,order_id) VALUES('fictional-key','fictional-hash','40000000-0000-4000-8000-000000000001');
   UPDATE products SET price_cents=799,description='Fictieve bestaande productbewerking' WHERE id='olive';`);
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[];
  const snapshot=()=>Object.fromEntries(tables.map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all().map(row=>JSON.stringify(row)).sort()]));
  const before=snapshot();
  db.exec('BEGIN;'+await readFile('migrations/0005_test_checkout_ownership.sql','utf8')+'; COMMIT;');
  expect(snapshot()).toEqual(before);
  expect(db.prepare('SELECT COUNT(*) AS n FROM test_checkout_orders').get()?.n).toBe(0);
  expect(db.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(db.prepare("SELECT unit_price_cents FROM order_items WHERE product_id='olive'").get()?.unit_price_cents).toBe(699);
  expect(db.prepare("SELECT price_cents FROM products WHERE id='olive'").get()?.price_cents).toBe(799);
  expect(db.prepare('SELECT confirmed_arrangements,version FROM orders').get()).toMatchObject({confirmed_arrangements:'Test',version:5});
 }finally{db.close();}
});
