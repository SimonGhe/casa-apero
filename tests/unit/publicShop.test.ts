import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import shop from '../../worker/public-shop';
import type {ShopEnv} from '../../worker/public-shop';
let mf:Miniflare,env:ShopEnv;
beforeEach(async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  if(String(input)!=='https://challenges.cloudflare.com/turnstile/v0/siteverify')throw Error('External/Access/remote database requests forbidden');
  return Response.json({success:true,hostname:'casa-apero.com',action:'order-request'});
 }));
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'public-local-unit',modules:true,script:'export default{fetch(){return new Response("local")}}',compatibilityDate:'2026-10-24',d1Databases:['DB']}]}));
 const db=await mf.getD1Database('DB');for(const file of (await readdir('migrations')).filter(n=>/^\d.*\.sql$/.test(n)).sort())await db.exec((await readFile('migrations/'+file,'utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
 await db.exec((await readFile('production/initialize.sql','utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
 await db.exec("UPDATE application_settings SET value='false' WHERE key='orders_paused';");
 env={DB:db as unknown as D1Database,APP_ENV:'public-shop',PUBLIC_ORDERS_ENABLED:'true',LAUNCH_APPROVED:'true',LEGAL_VERSION:'approved-local-fixture-v1',TURNSTILE_MODE:'siteverify',TURNSTILE_SITE_KEY:'0x-local-fixture',TURNSTILE_SECRET_KEY:'fixture-only-secret'};
});
afterEach(async()=>{vi.unstubAllGlobals();await mf.dispose();});
const payload=(extra={})=>({name:'Fictieve klant',email:'fictional@example.test',phone:'',notes:'Alleen lokale test',requestedDate:'',arrangement:'pickup',items:[{productId:'olive',variantId:'olive-standard',quantity:2}],acknowledged:true,testDataOnly:false,expectedSubtotalCents:1398,receiptToken:crypto.randomUUID().replaceAll('-','').repeat(2),turnstileToken:'local-transport-fixture',...extra});
function request(path:string,input?:unknown,headers={},settings:Partial<ShopEnv>={}){return shop.fetch(new Request('https://casa-apero.com/api/'+path,{method:input===undefined?'GET':'POST',headers:{Origin:'https://casa-apero.com','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.5','Idempotency-Key':'10000000-0000-4000-8000-000000000001',...headers},...(input===undefined?{}:{body:JSON.stringify(input)})}),{...env,...settings});}
it('starts with four approved prices and zero transactions, requires explicit launch and correct production dataset',async()=>{
 expect((await env.DB!.prepare('SELECT price_cents FROM products ORDER BY price_cents').all()).results.map(r=>r.price_cents)).toEqual([699,699,1299,2599]);
 for(const table of ['orders','order_items','payment_status','audit_log','financial_events','event_sales','test_checkout_orders'])expect(await env.DB!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n')).toBe(0);
 for(const settings of [{LAUNCH_APPROVED:'false'},{PUBLIC_ORDERS_ENABLED:'false'},{LEGAL_VERSION:''},{LEGAL_VERSION:'concept-1'},{TURNSTILE_MODE:'local-mock'},{TURNSTILE_SECRET_KEY:''},{TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}])expect((await request('requests',payload(),{},settings)).status).toBe(403);
 await env.DB!.exec("UPDATE application_settings SET value='staging' WHERE key='dataset';");expect((await request('requests',payload())).status).toBe(403);
 expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(0);
 await env.DB!.exec("UPDATE application_settings SET value='production' WHERE key='dataset'; DELETE FROM rate_limits;");
 for(let attempt=0;attempt<20;attempt++)expect((await request('receipt',{})).status).toBe(404);
 expect((await request('receipt',{})).status).toBe(429);
});
it('enforces pickup, validation, same origin, authoritative prices, pauses and real Siteverify without customer accounts',async()=>{
 for(const extra of [{arrangement:'delivery'},{email:'not-an-email'},{email:'fixture@example.invalid'},{testDataOnly:true},{acknowledged:false},{name:''},{items:[{productId:'unknown',variantId:'unknown',quantity:1}]}])expect((await request('requests',payload(extra))).status).toBe(400);
 expect((await request('requests',payload(),{Origin:'https://evil.invalid'})).status).toBe(403);
 expect((await request('requests',payload({expectedSubtotalCents:1}))).status).toBe(409);
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({success:false}));expect((await request('requests',payload())).status).toBe(403);
 await env.DB!.exec("UPDATE products SET orders_paused=1 WHERE id='olive';");expect((await request('requests',payload())).status).toBe(409);
 await env.DB!.exec("UPDATE products SET orders_paused=0; UPDATE application_settings SET value='true' WHERE key='orders_paused';");expect((await request('requests',payload())).status).toBe(409);
 expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(0);
});
it('persists one audited public request across concurrent retries; preserves price history and rolls back audit failures',async()=>{
 const input=payload();const responses=await Promise.all([request('requests',input),request('requests',input)]);expect(responses.map(r=>r.status).sort()).toEqual([200,201]);
 const first=await responses[0].json();expect(first.reference).toMatch(/^CA-/);expect((await request('requests',input)).status).toBe(200);
 const recovered=await request('receipt',{}, {Authorization:'Bearer '+input.receiptToken});expect(recovered.status).toBe(200);expect(await recovered.json()).toMatchObject({reference:first.reference,subtotalCents:1398});
 expect((await request('receipt',{}, {Authorization:'Bearer '+'0'.repeat(64)})).status).toBe(404);
 const row=await env.DB!.prepare('SELECT source,delivery_cents,contract_status,workflow_status FROM orders').first();expect(row).toEqual({source:'web',delivery_cents:0,contract_status:'none',workflow_status:'new'});
 expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(1);expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n')).toBe(1);
 await env.DB!.exec("UPDATE products SET price_cents=799 WHERE id='olive';");expect(await env.DB!.prepare('SELECT unit_price_cents FROM order_items').first('unit_price_cents')).toBe(699);
 await env.DB!.exec("CREATE TRIGGER fail_public_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'fixture'); END;");
 expect((await request('requests',payload({expectedSubtotalCents:1598}))).status).toBe(503);expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(1);
});
