import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {convertV4MiniflareOptions,Miniflare} from 'miniflare';
import {readFile} from 'node:fs/promises';
import adminWorker from '../../worker/admin';
import type {AdminEnv} from '../../worker/admin/api';
import type {AdminOrder,OrderDetail} from '../../shared/admin';
let mf:Miniflare,env:AdminEnv,cookie:string;
const origin='http://127.0.0.1:5180';
const orderId=()=>crypto.randomUUID();
async function api(path:string,body?:unknown,method=body===undefined?'GET':'PUT',originHeader=origin){
 return adminWorker.fetch(new Request(`${origin}/api/admin/${path}`,{method,headers:{Cookie:cookie,Origin:originHeader,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
}
async function json<T=Record<string,unknown>>(path:string,body?:unknown,method?:string):Promise<T>{
 const response=await api(path,body,method);const value=await response.json();expect(response.status,JSON.stringify(value)).toBeLessThan(300);return value as T;
}
async function seed(){
 const id=orderId();
 await env.DB!.batch([
  env.DB!.prepare(`INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,subtotal_cents,legal_version,acknowledgement_at)
   VALUES (?,?,?,'=Fictieve Klant','test@example.invalid','pickup',1398,'test',?)`).bind(id,`TEST-${id}`,id,new Date().toISOString()),
  env.DB!.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days) VALUES (?,'olive','olive-standard','Olive',2,699,1398,14)").bind(id),
  env.DB!.prepare('INSERT INTO payment_status(order_id) VALUES (?)').bind(id),
 ]);return id;
}
async function confirm(id:string){return json<OrderDetail>(`orders/${id}`,{version:0,status:'confirmed',internalNotes:'Fictief',confirmedArrangements:'TEST afhalen op afspraak',confirmationEvidence:'Fictief bewijs',durableProvidedAt:new Date().toISOString(),deliveryCents:0});}
beforeEach(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'admin-test',modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-24',d1Databases:['DB']}]}));
 const db=await mf.getD1Database('DB');
 for(const file of ['0001_schema.sql','0002_catalogue.sql','0003_administration.sql'])await db.exec((await readFile(new URL(`../../migrations/${file}`,import.meta.url),'utf8')).replaceAll('\n',' '));
 env={APP_ENV:'local-admin',ADMIN_AUTH_MODE:'local-session',DB:db as unknown as D1Database};
 const login=await adminWorker.fetch(new Request(`${origin}/api/admin/local-login`,{method:'POST',headers:{Origin:origin}}),env);expect(login.status).toBe(204);cookie=login.headers.get('Set-Cookie')!.split(';')[0];
});
afterEach(async()=>{await mf?.dispose();});

describe('admin API on local D1',()=>{
 it('lists, searches and reads customer records only through the authorized admin route',async()=>{
  const id=await seed();const list=await json<{orders:AdminOrder[];total:number}>('orders?q=Fictieve');expect(list.total).toBe(1);expect(list.orders[0].id).toBe(id);
  expect((await json<{total:number}>('orders?q=%')).total).toBe(0);
  const detail=await json<OrderDetail>(`orders/${id}`);expect(detail.order.email).toBe('test@example.invalid');expect(detail.order).not.toHaveProperty('receipt_token_hash');
  expect((await api(`orders/${id}`,{version:0,status:'confirmed',confirmedArrangements:'only this'})).status).toBe(400);
 });
 it('enforces state transitions, records arrangements/notes and detects concurrent edits',async()=>{
  const id=await seed();expect((await api(`orders/${id}`,{version:0,status:'completed'})).status).toBe(400);
  let detail=await confirm(id);expect(detail.order).toMatchObject({workflow_status:'confirmed',total_cents:1398,contract_status:'confirmed',internal_notes:'Fictief'});
  expect((await api(`orders/${id}`,{version:0,status:'in_production'})).status).toBe(409);
  for(const state of ['in_production','ready','completed'])detail=await json<OrderDetail>(`orders/${id}`,{version:detail.order.version,status:state});
  expect(detail.order.workflow_status).toBe('completed');expect(detail.audit.length).toBe(4);
  expect((await api(`orders/${id}`,{version:detail.order.version,status:'new'})).status).toBe(400);
 });
 it('explains incomplete confirmations and never commits their status or notes',async()=>{
  const id=await seed(),base={version:0,status:'confirmed',internalNotes:'Must not commit',confirmedArrangements:'Fictief afhalen',deliveryCents:0,confirmationEvidence:'Fictief bewijs',durableProvidedAt:new Date().toISOString()};
  for(const [patch,message] of [[{confirmedArrangements:'0'},'afhaal- of leverafspraken'],[{deliveryCents:null},'leveringskosten'],[{confirmationEvidence:''},'bewijs'],[{durableProvidedAt:''},'Verstrekt op'],[{durableProvidedAt:'2099-01-01T00:00:00Z'},'toekomst']] as const){
   const response=await api(`orders/${id}`,{...base,...patch});expect(response.status).toBe(400);expect(JSON.stringify(await response.json())).toContain(message);
  }
  expect((await json<OrderDetail>(`orders/${id}`)).order).toMatchObject({workflow_status:'new',version:0,internal_notes:''});
  expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n')).toBe(0);
 });
 it('only one simultaneous order edit commits its audit record',async()=>{
  const id=await seed();const responses=await Promise.all([api(`orders/${id}`,{version:0,status:'new',internalNotes:'one'}),api(`orders/${id}`,{version:0,status:'new',internalNotes:'two'})]);
  expect(responses.map((r)=>r.status).sort()).toEqual([200,409]);expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n')).toBe(1);
 });
 it('keeps unconfirmed/unpaid requests out of revenue and records payment/refunds without duplicates',async()=>{
  const id=await seed();expect((await api(`orders/${id}/payment`,{version:0,amountPaidCents:1398,amountRefundedCents:0,method:'contant'})).status).toBe(400);
  await env.DB!.exec("UPDATE products SET cost_cents=300 WHERE id='olive';");
  let detail=await confirm(id);
  expect(await json('report')).toMatchObject({revenueCents:0,estimatedProfitCents:0});
  const payment={version:detail.order.version,amountPaidCents:1398,amountRefundedCents:0,method:'Fictief contant'};
  detail=await json<OrderDetail>(`orders/${id}/payment`,payment);expect(detail.order.payment_status).toBe('paid');
  expect((await api(`orders/${id}/payment`,payment)).status).toBe(409);
  expect((await api(`orders/${id}/payment`,{...payment,version:detail.order.version})).status).toBe(400);
  expect(await json('report')).toMatchObject({revenueCents:1398,estimatedProfitCents:798});
  detail=await json<OrderDetail>(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:699,method:'Fictief contant'});
  expect(detail.order.payment_status).toBe('partially_refunded');expect(await json('report')).toMatchObject({revenueCents:699,knownCostCents:300,estimatedProfitCents:399});
  expect((await api(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:0,amountRefundedCents:0,method:''})).status).toBe(400);
  await json(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:1398,method:'Fictief contant'});
  expect(await json('report')).toMatchObject({revenueCents:0,estimatedProfitCents:0});
 });
 it('shows cancelled cash awaiting refund and excludes cancelled unpaid requests from revenue',async()=>{
  const unpaid=await seed();await json(`orders/${unpaid}`,{version:0,status:'cancelled'});
  expect(await json('report')).toMatchObject({revenueCents:0,cancelledOutstandingRefundCents:0});
  const id=await seed();let detail=await confirm(id);
  detail=await json<OrderDetail>(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:0,method:'Fictief'});
  detail=await json<OrderDetail>(`orders/${id}`,{version:detail.order.version,status:'cancelled'});
  expect(await json('report')).toMatchObject({revenueCents:1398,cancelledOutstandingRefundCents:1398});
  await json(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:1398,method:'Fictieve terugbetaling'});
  expect(await json('report')).toMatchObject({revenueCents:0,cancelledOutstandingRefundCents:0});
 });
 it('preserves unknown costs and immutable order prices when products are edited',async()=>{
  const id=await seed();await confirm(id);
  const products=await json<Array<{id:string;version:number}>>('products');const olive=products.find((p)=>p.id==='olive')!;
  await json('products/olive',{version:olive.version,name:'Olive',description:'Testbeschrijving',priceCents:799,costCents:300,productionDays:14,paused:true,published:true});
  const detail=await json<OrderDetail>(`orders/${id}`);expect(detail.items[0]).toMatchObject({unit_price_cents:699,unit_cost_cents:null});
  await json(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:0,method:'contant'});
  expect(await json('report')).toMatchObject({estimatedProfitCents:null,unknownCostGroups:1});
  const setting=await json<{version:number}>('settings');await json('settings',{version:setting.version,paused:true});expect(await env.DB!.prepare("SELECT value FROM application_settings WHERE key='orders_paused'").first('value')).toBe('true');
 });
 it('creates idempotent physical-sale summaries, reports snapshots and reverses corrections with an audit',async()=>{
  await env.DB!.exec('UPDATE products SET cost_cents=200;');
  const input={id:crypto.randomUUID(),name:'Fictieve markt',date:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Brussels'}),notes:'Test',items:[{productId:'olive',quantity:3,unitPriceCents:699}]};
  expect((await api('events',input,'POST')).status).toBe(201);expect((await api('events',input,'POST')).status).toBe(200);
  expect((await api('events',{...input,name:'ander'},'POST')).status).toBe(409);
  expect(await json('report')).toMatchObject({eventRevenueCents:2097,knownCostCents:600,estimatedProfitCents:1497});
  await json(`events/${input.id}/void`,{version:0,reason:'Dubbel ingevoerd testrecord'});expect(await json('report')).toMatchObject({revenueCents:0,estimatedProfitCents:0});
  expect((await json<unknown[]>('audit')).length).toBe(2);
 });
 it('blocks CSRF, invalid financial data and export abuse, and escapes exported names',async()=>{
  const id=await seed();expect((await api(`orders/${id}`,{version:0,status:'new'},'PUT','https://evil.invalid')).status).toBe(403);
  expect((await api('products/olive',{version:0,name:'Olive',description:'',priceCents:1.5,costCents:null,productionDays:14,paused:false,published:true})).status).toBe(400);
  expect((await api('report?from=2026-12-01&to=2026-01-01')).status).toBe(400);
  const response=await api('export?kind=orders');expect(response.headers.get('Content-Type')).toContain('text/csv');expect(await response.text()).toContain("'=Fictieve Klant");
 });
 it('rolls back status, financial changes and audit when any transaction statement fails',async()=>{
  const id=await seed();await confirm(id);
  await env.DB!.exec("CREATE TRIGGER test_financial_failure BEFORE INSERT ON financial_events BEGIN SELECT RAISE(ABORT,'test'); END;");
  expect((await api(`orders/${id}/payment`,{version:1,amountPaidCents:1398,amountRefundedCents:0,method:'contant'})).status).toBe(503);
  expect(await env.DB!.prepare('SELECT amount_paid_cents FROM payment_status WHERE order_id=?').bind(id).first('amount_paid_cents')).toBe(0);
  expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n')).toBe(1);
  await expect(env.DB!.exec("UPDATE audit_log SET action='tampered';")).rejects.toThrow();
 });
});

describe('legacy arrangement compatibility on local D1',()=>{
 async function legacy(state:'completed'|'cancelled'|'confirmed',arrangements='test'){
  const id=await seed();let detail=await confirm(id);
  detail=await json<OrderDetail>(`orders/${id}/payment`,{version:detail.order.version,amountPaidCents:1398,amountRefundedCents:0,method:'Fictief contant'});
  for(const status of state==='completed'?['in_production','ready','completed']:state==='cancelled'?['cancelled']:[])detail=await json<OrderDetail>(`orders/${id}`,{version:detail.order.version,status});
  // Fixture only: simulate text accepted by an older release, never repair it.
  await env.DB!.prepare('UPDATE orders SET confirmed_arrangements=? WHERE id=?').bind(arrangements,id).run();
  return (await json<OrderDetail>(`orders/${id}`)).order;
 }
 async function protectedRecords(){
  const db=env.DB!;
  return {
   items:(await db.prepare('SELECT * FROM order_items ORDER BY id').all()).results,
   payments:(await db.prepare('SELECT * FROM payment_status ORDER BY order_id').all()).results,
   history:(await db.prepare('SELECT * FROM order_status_history ORDER BY id').all()).results,
   finances:(await db.prepare('SELECT * FROM financial_events ORDER BY id').all()).results,
   audit:(await db.prepare('SELECT * FROM audit_log ORDER BY id').all()).results,
  };
 }
 it.each([
  ['completed','test'],['completed','  test  '],['completed',''],
  ['cancelled','test'],['cancelled','  test  '],['cancelled','0'],
 ] as const)('preserves %s legacy text %j through reads and notes-only edits',async(state,text)=>{
  const order=await legacy(state,text),other=await seed();
  const row=()=>env.DB!.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first<Record<string,unknown>>();
  const before=await row(),otherBefore=await env.DB!.prepare('SELECT * FROM orders WHERE id=?').bind(other).first(),records=await protectedRecords();
  expect((await json<OrderDetail>(`orders/${order.id}`)).order.confirmed_arrangements).toBe(text);
  expect(await row()).toEqual(before);expect(await protectedRecords()).toEqual(records);
  // Exercise omission and the exact echoed value sent by the student dashboard.
  for(const [index,extra] of [{},{confirmedArrangements:text}].entries()){
   const result=await json<OrderDetail>(`orders/${order.id}`,{version:order.version+index,status:state,internalNotes:`Fictieve teamnotitie ${index+1}`,...extra});
   expect(result.order).toMatchObject({workflow_status:state,confirmed_arrangements:text,internal_notes:`Fictieve teamnotitie ${index+1}`,version:order.version+index+1});
  }
  const after=await row();
  for(const key of Object.keys(before!))if(!['internal_notes','version','last_mutation_id'].includes(key))expect(after![key],key).toEqual(before![key]);
  expect(await env.DB!.prepare('SELECT * FROM orders WHERE id=?').bind(other).first()).toEqual(otherBefore);
  const saved=await protectedRecords();expect(saved.items).toEqual(records.items);expect(saved.payments).toEqual(records.payments);expect(saved.history).toEqual(records.history);expect(saved.finances).toEqual(records.finances);
  expect(saved.audit).toHaveLength(records.audit.length+2);
  for(const entry of records.audit)expect(saved.audit).toContainEqual(entry);
  const oldIds=new Set(records.audit.map(row=>row.id));
  for(const entry of saved.audit.filter(row=>!oldIds.has(row.id))){expect(entry.action).toBe('order.update');expect(JSON.parse(String(entry.after_json)).arrangements).toBe(text);}
 });
 it.each(['new','completed','cancelled'] as const)('validates every explicit arrangement edit on a %s order',async state=>{
  const order=state==='new'?(await json<OrderDetail>(`orders/${await seed()}`)).order:await legacy(state);
  if(state==='new')await env.DB!.prepare("UPDATE orders SET confirmed_arrangements='test' WHERE id=?").bind(order.id).run();
  const before=await json<OrderDetail>(`orders/${order.id}`),records=await protectedRecords();
  for(const value of ['other','', '          ',null,42,'x'.repeat(1001),'Afhalen\u0000 op afspraak']){
   const response=await api(`orders/${order.id}`,{version:order.version,status:state,internalNotes:'Dit mag niet worden opgeslagen',confirmedArrangements:value});
   expect(response.status,JSON.stringify(value)).toBe(400);
  }
  expect(await json<OrderDetail>(`orders/${order.id}`)).toEqual(before);expect(await protectedRecords()).toEqual(records);
  const result=await json<OrderDetail>(`orders/${order.id}`,{version:order.version,status:state,confirmedArrangements:'Fictief afhalen in Brugge op afspraak'});
  expect(result.order.confirmed_arrangements).toBe('Fictief afhalen in Brugge op afspraak');
  expect(result.order.internal_notes).toBe(before.order.internal_notes);expect(result.order.version).toBe(order.version+1);
  const after=await protectedRecords();expect(after.items).toEqual(records.items);expect(after.payments).toEqual(records.payments);expect(after.history).toEqual(records.history);expect(after.finances).toEqual(records.finances);
  expect(after.audit).toHaveLength(records.audit.length+1);
 });
 it('does not grandfather incomplete arrangements when a new request is confirmed',async()=>{
  const id=await seed();
  const base={version:0,status:'confirmed',deliveryCents:0,confirmationEvidence:'Fictief bewijs',durableProvidedAt:new Date().toISOString()};
  for(const text of ['test','          ','Fictief afhalen\u0000 op afspraak','x'.repeat(1001)]){
   await env.DB!.prepare('UPDATE orders SET confirmed_arrangements=? WHERE id=?').bind(text,id).run();
   for(const extra of [{},{confirmedArrangements:text}])expect((await api(`orders/${id}`,{...base,...extra})).status).toBe(400);
   expect((await json<OrderDetail>(`orders/${id}`)).order).toMatchObject({workflow_status:'new',version:0,confirmed_arrangements:text});
  }
  expect((await confirm(id)).order.workflow_status).toBe('confirmed');
 });
 it('keeps permitted production steps available without rewriting an unchanged legacy arrangement',async()=>{
  const order=await legacy('confirmed');
  const result=await json<OrderDetail>(`orders/${order.id}`,{version:order.version,status:'in_production',confirmedArrangements:'test'});
  expect(result.order).toMatchObject({workflow_status:'in_production',confirmed_arrangements:'test',total_cents:1398,amount_paid_cents:1398});
 });
 it('keeps authentication, CSRF and optimistic concurrency checks on legacy edits',async()=>{
  const order=await legacy('completed'),input={version:order.version,status:'completed',internalNotes:'Fictieve nieuwe notitie',confirmedArrangements:'test'},before=await protectedRecords();
  const denied=await adminWorker.fetch(new Request(`${origin}/api/admin/orders/${order.id}`,{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json','Cf-Access-Authenticated-User-Email':'test@example.invalid'},body:JSON.stringify(input)}),env);
  expect([401,403]).toContain(denied.status);
  expect((await api(`orders/${order.id}`,input,'PUT','https://evil.invalid')).status).toBe(403);
  expect(await protectedRecords()).toEqual(before);
  const responses=await Promise.all([api(`orders/${order.id}`,input),api(`orders/${order.id}`,{...input,internalNotes:'Andere fictieve notitie'})]);
  expect(responses.map(response=>response.status).sort()).toEqual([200,409]);
  expect((await api(`orders/${order.id}`,input)).status).toBe(409);
  const detail=await json<OrderDetail>(`orders/${order.id}`);expect(detail.order.version).toBe(order.version+1);expect(detail.order.confirmed_arrangements).toBe('test');
  const after=await protectedRecords();expect(after.audit).toHaveLength(before.audit.length+1);expect(after.finances).toEqual(before.finances);
 });
 it('rolls back a legacy notes edit if its audit insert fails',async()=>{
  const order=await legacy('completed'),before=await env.DB!.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first(),records=await protectedRecords();
  await env.DB!.exec("CREATE TRIGGER legacy_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'fictional audit failure'); END;");
  expect((await api(`orders/${order.id}`,{version:order.version,status:'completed',internalNotes:'Niet bewaren',confirmedArrangements:'test'})).status).toBe(503);
  expect(await env.DB!.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first()).toEqual(before);expect(await protectedRecords()).toEqual(records);
 });
});
