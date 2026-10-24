import {beforeAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import worker from '../../worker/test-checkout';
import type {TestCheckoutEnv} from '../../worker/test-checkout';
import admin from '../../worker/admin-preview';
import {FICTIONAL_CUSTOMER,TEST_CHECKOUT_API as base,TEST_CHECKOUT_RATE_LIMIT} from '../../shared/testCheckout';
const origin='https://casa-apero.com',issuer='https://checkout-unit.cloudflareaccess.com',aud='b'.repeat(64),adminAud='a'.repeat(64);
let env:TestCheckoutEnv,mf:Miniflare,privateKey:CryptoKey,jwks:unknown,siteverify:ReturnType<typeof vi.fn>;
beforeAll(async()=>{const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;jwks={keys:[{...await exportJWK(pair.publicKey),kid:'checkout-unit',alg:'RS256',use:'sig'}]};});
beforeEach(async()=>{
 siteverify=vi.fn(async()=>Response.json({success:true,hostname:'casa-apero.com',action:'order-request'}));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  if(String(input)===issuer+'/cdn-cgi/access/certs')return Response.json(jwks);
  if(String(input)==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){expect((init?.body as URLSearchParams).get('secret')).toBe('fixture-server-only-secret');return siteverify();}
  throw Error('No external network allowed in local tests');
 }));
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'checkout-unit',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-24',d1Databases:['DB']}]}));
 const db=await mf.getD1Database('DB');
 for(const f of (await readdir('migrations')).filter(f=>/^\d.*\.sql$/.test(f)).sort())await db.exec((await readFile('migrations/'+f,'utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
 await db.exec((await readFile('preview/admin-fixtures.sql','utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
 await db.exec("UPDATE application_settings SET value='false' WHERE key='orders_paused';");
 env={APP_ENV:'test-checkout',CHECKOUT_ENABLED:'false',TEST_CHECKOUT_ENABLED:'true',TEST_CHECKOUT_DATASET:'casa-apero-admin-staging-fictional-v1',TEST_CHECKOUT_ISSUER:issuer,TEST_CHECKOUT_AUDIENCE:aud,TEST_CHECKOUT_ALLOWED_EMAILS:'student@example.invalid,second@example.invalid',ADMIN_ACCESS_AUDIENCE:adminAud,TURNSTILE_MODE:'siteverify',TURNSTILE_SITE_KEY:'0x-fixture-public-sitekey',TURNSTILE_SECRET_KEY:'fixture-server-only-secret',DB:db as unknown as D1Database,ASSETS:{fetch:async()=>new Response('Public fictional storefront')} as Fetcher};
});
afterEach(async()=>{vi.unstubAllGlobals();await mf?.dispose();});
async function jwt(claims:Record<string,unknown>={},key=privateKey){return new SignJWT({email:'student@example.invalid',type:'app',...claims}).setSubject(String(claims.sub??'tester-one')).setIssuedAt(typeof claims.iat==='number'?claims.iat:Math.floor(Date.now()/1000)).setIssuer(String(claims.iss??issuer)).setAudience(String(claims.aud??aud)).setExpirationTime(typeof claims.exp==='number'?claims.exp:'10m').setProtectedHeader({alg:'RS256',kid:'checkout-unit'}).sign(key);}
const input=(extra={})=>({...FICTIONAL_CUSTOMER,arrangement:'pickup',requestedDate:'',items:[{productId:'olive',variantId:'olive-standard',quantity:2}],acknowledged:true,testDataOnly:true,expectedSubtotalCents:1398,receiptToken:crypto.randomUUID().replaceAll('-','').repeat(2),turnstileToken:'fixture-challenge',...extra});
async function call(path:string,options:{input?:unknown;method?:string;key?:string;claims?:Record<string,unknown>;authenticated?:boolean;headers?:Record<string,string>;host?:string;settings?:Partial<TestCheckoutEnv>}={}){
 return worker.fetch(new Request((options.host??origin)+(path.startsWith('/')?path:base+'/'+path),{method:options.method??(options.input===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':options.key??crypto.randomUUID(),...(options.authenticated===false?{}:{'Cf-Access-Jwt-Assertion':await jwt(options.claims)}),...options.headers},...(options.input===undefined?{}:{body:JSON.stringify(options.input)})}),{...env,...options.settings});
}
async function counts(){const result={};for(const table of ['orders','order_items','payment_status','audit_log','test_checkout_orders','idempotency_keys','order_status_history'])Object.assign(result,{[table]:await env.DB!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n')});return result;}
it('keeps storefront public, ordinary APIs blocked and never exposes admin routes',async()=>{
 expect((await call('/',{authenticated:false})).status).toBe(200);
 for(const path of ['/api/requests','/api/orders','/api/quote','/api/receipt','/api/catalogue','/api/admin/orders','/api/demo'])expect((await call(path,{input:{}})).status,path).toBe(403);
 for(const path of ['/test-bestellen/api/admin','/test-bestellen/api/local-login','/test-bestellen/__debug'])expect((await call(path)).status).toBe(404);
});
it('denies missing JWTs and forged identity/cookies before touching D1',async()=>{
 const before=await counts();for(const path of ['/test-bestellen',base+'/config',base+'/quote',base+'/requests',base+'/receipt']){
  const r=await call(path,{authenticated:false,headers:{Cookie:'CF_Authorization=forged','Cf-Access-Authenticated-User-Email':'student@example.invalid'}});expect(r.status).toBe(401);expect(r.headers.get('Cache-Control')).toContain('no-store');
 }
 expect(await counts()).toEqual(before);expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM rate_limits').first('n')).toBe(0);
});
it.each([{aud:adminAud},{aud:'c'.repeat(64)},{iss:'https://other.cloudflareaccess.com'},{exp:1},{iat:Math.floor(Date.now()/1000)+600},{nbf:Math.floor(Date.now()/1000)+600},{email:'intruder@example.invalid'},{email:'student@example.invalid.evil.invalid'},{type:'service'}])('denies invalid JWT claims %j',async claims=>{
 const before=await counts();expect((await call('requests',{input:input(),claims})).status).toBe(403);expect(await counts()).toEqual(before);
});
it('denies an incorrectly signed token and every alternate hostname/port',async()=>{
 const wrong=await generateKeyPair('RS256');expect((await call('config',{headers:{'Cf-Access-Jwt-Assertion':await jwt({},wrong.privateKey)}})).status).toBe(403);
 for(const host of ['https://admin.casa-apero.com','https://casa-apero-staging.example.workers.dev','https://version-casa-apero-staging.example.workers.dev','http://127.0.0.1:5173','https://casa-apero.com:8443'])expect((await call('config',{host})).status).toBe(403);
});
it('fails closed for missing settings, admin audience reuse, dummy Turnstile and wrong datasets',async()=>{
 for(const settings of [{TEST_CHECKOUT_ENABLED:undefined},{TEST_CHECKOUT_ENABLED:'false'},{APP_ENV:'production'},{CHECKOUT_ENABLED:'true'},{DB:undefined},{TEST_CHECKOUT_DATASET:''},{TEST_CHECKOUT_ISSUER:''},{TEST_CHECKOUT_AUDIENCE:''},{TEST_CHECKOUT_AUDIENCE:adminAud},{ADMIN_ACCESS_AUDIENCE:''},{TEST_CHECKOUT_ALLOWED_EMAILS:''},{TEST_CHECKOUT_ALLOWED_EMAILS:'*'},{TURNSTILE_SECRET_KEY:''},{TURNSTILE_MODE:'local-mock'},{TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'},{TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}])expect((await call('config',{settings})).status,JSON.stringify(settings)).toBe(403);
 await env.DB!.exec('DELETE FROM admin_preview_guard;');expect((await call('config')).status).toBe(403);
});
it('requires a fictional database and the ownership migration; never assumes an empty production DB is safe',async()=>{
 await env.DB!.exec("UPDATE orders SET email='not-fictional@example.test';");expect((await call('config')).status).toBe(403);
 await env.DB!.exec("UPDATE orders SET email='preview@example.invalid'; DROP TABLE test_checkout_orders;");expect((await call('config')).status).toBe(503);
});
it('checks CSRF/content limits and private response policy without storing customer data',async()=>{
 const before=await counts();for(const headers of [{Origin:'https://evil.invalid'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])expect((await call('requests',{input:input(),headers})).status).toBe(403);
 expect((await call('requests',{input:input(),headers:{'Content-Type':'text/plain'}})).status).toBe(415);
 expect((await call('requests',{input:input({notes:'x'.repeat(17000)})})).status).toBe(413);
 const r=await call('config');expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toContain('no-store');expect(r.headers.get('Vary')).toContain('Cookie');expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();expect(JSON.stringify(await r.json())).not.toContain('student@example.invalid');expect(await counts()).toEqual(before);
});
it('accepts only preset fictional identity, blank phone and fixed note; rejects unacknowledged/incomplete requests',async()=>{
 const before=await counts();for(const extra of [{name:'Actual Person'},{email:'actual@example.com'},{phone:'+32 470 00 00 00'},{notes:'Arbitrary personal details'},{acknowledged:false},{testDataOnly:false},{arrangement:''},{requestedDate:'2020-01-01'},{items:[{productId:'unknown',variantId:'unknown',quantity:1}]}])expect((await call('requests',{input:input(extra)})).status).toBe(400);
 expect(await counts()).toEqual(before);expect(siteverify).not.toHaveBeenCalled();
});
it('uses authoritative D1 prices and availability and preserves historical snapshots',async()=>{
 const saved=await call('requests',{input:input()});expect(saved.status).toBe(201);
 await env.DB!.exec("UPDATE products SET price_cents=799 WHERE id='olive';");expect((await call('requests',{input:input()})).status).toBe(409);
 expect(await(await call('quote',{input:{items:input().items}})).json()).toMatchObject({subtotalCents:1598});
 expect(await env.DB!.prepare("SELECT unit_price_cents FROM order_items WHERE order_id IN (SELECT order_id FROM test_checkout_orders)").first('unit_price_cents')).toBe(699);
 await env.DB!.exec("UPDATE products SET orders_paused=1 WHERE id='olive';");expect((await call('requests',{input:input({expectedSubtotalCents:1598})})).status).toBe(409);
 await env.DB!.exec("UPDATE products SET orders_paused=0,published=0 WHERE id='olive';");expect((await call('requests',{input:input()})).status).toBe(400);
 await env.DB!.exec("UPDATE products SET published=1; UPDATE application_settings SET value='true' WHERE key='orders_paused';");expect((await call('requests',{input:input()})).status).toBe(409);
});
it('validates real Siteverify responses (success, hostname and action) and fails safely on network errors',async()=>{
 const before=await counts();for(const result of [{success:false},{success:true,hostname:'wrong.invalid',action:'order-request'},{success:true,hostname:'casa-apero.com',action:'wrong'}]){siteverify.mockResolvedValueOnce(Response.json(result));expect((await call('requests',{input:input()})).status).toBe(403);}
 siteverify.mockRejectedValueOnce(Error('fixture outage'));expect((await call('requests',{input:input()})).status).toBe(503);expect(await counts()).toEqual(before);
});
it('makes retries/concurrent submissions idempotent and receipts private to their verified tester',async()=>{
 const data=input(),key=crypto.randomUUID(),before=await counts();
 const results=await Promise.all([call('requests',{input:data,key}),call('requests',{input:data,key})]);expect(results.map(r=>r.status).sort()).toEqual([200,201]);
 const first=await results[0].json();expect(first.reference).toMatch(/^TEST-/);
 expect((await call('requests',{input:data,key})).status).toBe(200);
 expect((await call('requests',{input:{...data,arrangement:'delivery'},key})).status).toBe(409);
 const headers={Authorization:'Bearer '+data.receiptToken};expect((await call('receipt',{method:'POST',headers})).status).toBe(200);
 expect((await call('receipt',{method:'POST',headers,claims:{sub:'second-tester',email:'second@example.invalid'}})).status).toBe(404);
 expect((await call('receipt',{method:'POST',headers:{Authorization:'Bearer '+'0'.repeat(64)}})).status).toBe(404);
 expect((await counts())).toMatchObject({orders:(before as {orders:number}).orders+1,test_checkout_orders:1,audit_log:1,idempotency_keys:1});
 const audit=await env.DB!.prepare("SELECT * FROM audit_log WHERE action='test_request.create'").first();expect(JSON.stringify(audit)).not.toContain('student@example.invalid');expect(JSON.stringify(audit)).not.toContain(data.receiptToken);
});
it('isolates identical idempotency keys used by two authorized testers',async()=>{
 const key=crypto.randomUUID();expect((await call('requests',{input:input(),key})).status).toBe(201);expect((await call('requests',{input:input(),key,claims:{sub:'second-tester',email:'second@example.invalid'}})).status).toBe(201);
 expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM test_checkout_orders').first('n')).toBe(2);
});
it('rolls the entire creation back when ownership or audit recording fails',async()=>{
 const before=await counts();await env.DB!.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'fixture'); END;");
 expect((await call('requests',{input:input()})).status).toBe(503);expect(await counts()).toEqual(before);
});
it('limits verified testers independently without logging identities or tokens',async()=>{
 for(let i=0;i<TEST_CHECKOUT_RATE_LIMIT;i++)expect((await call('config')).status).toBe(200);
 expect((await call('requests',{input:input()})).status).toBe(429);expect((await call('config',{claims:{sub:'second-tester',email:'second@example.invalid'}})).status).toBe(200);
 const buckets=await env.DB!.prepare('SELECT bucket FROM rate_limits').all();expect(JSON.stringify(buckets)).not.toContain('student@example.invalid');expect(JSON.stringify(buckets)).not.toContain('tester-one');
});
it('creates fictional orders manageable by the existing Access admin without changing old orders or history',async()=>{
 const db=env.DB!,historic=await db.prepare('SELECT * FROM orders ORDER BY id').all(),history=await db.prepare('SELECT * FROM order_status_history ORDER BY id').all();
 const created=await(await call('requests',{input:input()})).json();
 expect((await db.prepare('SELECT * FROM orders WHERE reference!=? ORDER BY id').bind(created.reference).all()).results).toEqual(historic.results);
 const row=await db.prepare('SELECT id FROM orders WHERE reference=?').bind(created.reference).first<{id:string}>();
 const adminEnv={DB:db,APP_ENV:'admin-preview',ADMIN_AUTH_MODE:'access',ADMIN_WRITES_ENABLED:'true',CHECKOUT_ENABLED:'false',ADMIN_PREVIEW_DATASET:env.TEST_CHECKOUT_DATASET,ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:adminAud,ADMIN_EMAIL_ALLOWLIST:'student@example.invalid'};
 async function edit(extra?:unknown){return admin.fetch(new Request('https://admin.casa-apero.com/api/admin/orders/'+row!.id,{method:extra?'PUT':'GET',headers:{Origin:'https://admin.casa-apero.com','Cf-Access-Jwt-Assertion':await jwt({aud:adminAud}),'Content-Type':'application/json'},...(extra?{body:JSON.stringify(extra)}:{})}),adminEnv);}
 expect((await edit()).status).toBe(200);expect((await edit({version:0,status:'confirmed',confirmedArrangements:'FICTIEF — afhalen in Brugge op afspraak',deliveryCents:0,confirmationEvidence:'FICTIEF testbewijs, niets verstuurd',durableProvidedAt:new Date().toISOString()})).status).toBe(200);
 expect((await(await edit()).json()).order).toMatchObject({workflow_status:'confirmed',email:FICTIONAL_CUSTOMER.email,source:'local_test',subtotal_cents:1398});
 const now=await db.prepare('SELECT * FROM order_status_history ORDER BY id').all();for(const old of history.results)expect(now.results).toContainEqual(old);
 expect(await db.prepare('SELECT COUNT(*) AS n FROM financial_events').first('n')).toBe(0);
});
