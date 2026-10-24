import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {convertV4MiniflareOptions,Miniflare} from 'miniflare';
import {readFile} from 'node:fs/promises';
import previewWorker from '../../worker/admin-preview';
import type {PreviewEnv} from '../../worker/admin-preview';
import {localLogin as deployedLogin} from '../../worker/admin/auth.deployed';

const origin='https://admin.casa-apero.com',issuer='https://preview-fixture.cloudflareaccess.com',audience='preview-audience';
let mf:Miniflare,env:PreviewEnv,privateKey:CryptoKey,jwks:{keys:Record<string,unknown>[]};
beforeAll(async()=>{const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;jwks={keys:[{...await exportJWK(pair.publicKey),kid:'preview-test',alg:'RS256',use:'sig'}]};});
beforeEach(async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{if(String(input)===`${issuer}/cdn-cgi/access/certs`)return Response.json(jwks);throw new Error('Unexpected external request in local test');}));
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'preview-unit',modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-24',d1Databases:['DB']}]}));
 const db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_schema.sql','migrations/0002_catalogue.sql','migrations/0003_administration.sql','preview/admin-fixtures.sql'])await db.exec((await readFile(new URL(`../../${file}`,import.meta.url),'utf8')).split('\n').filter(line=>!line.trim().startsWith('--')).join(' '));
 env={APP_ENV:'admin-preview',ADMIN_AUTH_MODE:'access',CHECKOUT_ENABLED:'false',ADMIN_PREVIEW_DATASET:'casa-apero-admin-staging-fictional-v1',ADMIN_WRITES_ENABLED:'false',ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:audience,ADMIN_EMAIL_ALLOWLIST:'student@example.invalid',DB:db as unknown as D1Database,ASSETS:{fetch:async()=>new Response('<html>Fictional admin preview</html>',{headers:{'Content-Type':'text/html'}})}} as unknown as PreviewEnv;
});
afterEach(async()=>{vi.unstubAllGlobals();await mf?.dispose();});
async function token(patch:Record<string,unknown>={},key=privateKey){return new SignJWT({type:'app',email:'student@example.invalid',...patch}).setProtectedHeader({alg:'RS256',kid:'preview-test'}).setSubject('fictional-student').setIssuedAt().setIssuer(typeof patch.iss==='string'?patch.iss:issuer).setAudience(typeof patch.aud==='string'?patch.aud:audience).setExpirationTime(typeof patch.exp==='number'?patch.exp:'10m').sign(key);}
async function call(path:string,options:{authenticated?:boolean;body?:unknown;host?:string;claims?:Record<string,unknown>;headers?:Record<string,string>;settings?:Partial<PreviewEnv>}={}){
 const jwt=options.authenticated?await token(options.claims):undefined;
 return previewWorker.fetch(new Request(`${options.host??origin}${path}`,{method:options.body===undefined?'GET':'PUT',headers:{...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}),Origin:origin,'Content-Type':'application/json',...options.headers},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})}),{...env,...options.settings});
}
it('verifies an actual signed fixture through JWKS and authorizes the full API and asset path',async()=>{
 for(const path of ['/','/assets/app.js','/api/admin/session','/api/admin/orders','/api/admin/products','/api/admin/report','/api/admin/audit','/api/admin/export']){
  const response=await call(path,{authenticated:true});expect(response.status,path).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
 }
 const session=await(await call('/api/admin/session',{authenticated:true})).json();expect(session).toMatchObject({local:false,email:'student@example.invalid',preview:true,writesEnabled:false});
 const orders=await(await call('/api/admin/orders',{authenticated:true})).json() as {orders:{email:string}[]};expect(orders.orders).toHaveLength(1);expect(orders.orders[0].email).toBe('preview@example.invalid');
});
it('denies missing tokens and forged identity/cookies on every private API, including exports',async()=>{
 for(const path of ['/','/api/admin/session','/api/admin/orders','/api/admin/products','/api/admin/events','/api/admin/report','/api/admin/settings','/api/admin/export','/api/admin/audit']){
  expect((await call(path,{headers:{'Cf-Access-Authenticated-User-Email':'student@example.invalid',Cookie:'CF_Authorization=fake;casa_admin_local=fake'}})).status,path).toBe(401);
 }
});
it('denies invalid scopes, signatures, expirations, identities and all alternate origins',async()=>{
 for(const claims of [{aud:'another-app'},{iss:'https://wrong.cloudflareaccess.com'},{exp:1},{email:'unauthorized@example.invalid'},{type:'service'},{nbf:Math.floor(Date.now()/1000)+600}])expect((await call('/api/admin/orders',{authenticated:true,claims})).status).toBe(403);
 const wrong=await generateKeyPair('RS256');const signed=await token({},wrong.privateKey);
 expect((await call('/api/admin/orders',{headers:{'Cf-Access-Jwt-Assertion':signed}})).status).toBe(403);
 for(const host of ['https://casa-apero.com','https://admin.casa-apero.com:8443','https://casa-apero-admin-staging.example.workers.dev','https://casa-apero-staging.example.workers.dev','http://127.0.0.1:5185','https://other.example.com'])expect((await call('/api/admin/orders',{authenticated:true,host})).status,host).toBe(403);
});
it('cannot activate development login or public orders even with a valid preview identity',async()=>{
 for(const path of ['/api/admin/local-login','/api/admin/logout','/api/requests','/api/quote','/api/products','/api/receipt','/api/orders','/api/config','/cdn-cgi/local/explorer/api','/__debug'])expect((await call(path,{authenticated:true})).status,path).toBe(403);
 expect((await call('/api/admin/orders',{authenticated:true,settings:{APP_ENV:'local-admin',ADMIN_AUTH_MODE:'local-session'}})).status).toBe(403);
 await expect(deployedLogin()).rejects.toMatchObject({status:403});
});
it('fails closed with missing configuration, wrong dataset, missing database or a non-fictional row',async()=>{
 for(const settings of [{ACCESS_AUDIENCE:''},{ACCESS_ISSUER:''},{ADMIN_EMAIL_ALLOWLIST:''},{CHECKOUT_ENABLED:'true'},{ADMIN_PREVIEW_DATASET:'wrong'},{DB:undefined}])expect((await call('/api/admin/orders',{authenticated:true,settings})).status).toBe(403);
 await env.DB!.exec('DELETE FROM admin_preview_guard;');expect((await call('/api/admin/orders',{authenticated:true})).status).toBe(403);
 await env.DB!.exec("INSERT INTO admin_preview_guard VALUES(1,'casa-apero-admin-staging-fictional-v1'); UPDATE orders SET email='unexpected@real.example';");expect((await call('/api/admin/orders',{authenticated:true})).status).toBe(403);
});
it('defaults to read-only and allows only separately enabled fictional mutations, with CSRF and audit',async()=>{
 const id='40000000-0000-4000-8000-000000000001',body={version:0,status:'new',internalNotes:'Fictional preview edit'};
 expect((await call(`/api/admin/orders/${id}`,{authenticated:true,body})).status).toBe(403);
 const result=await call(`/api/admin/orders/${id}`,{authenticated:true,body,settings:{ADMIN_WRITES_ENABLED:'true'}});expect(result.status).toBe(200);
 expect(await env.DB!.prepare('SELECT actor_id FROM audit_log').first('actor_id')).toBe('fictional-student');
 expect((await call(`/api/admin/orders/${id}`,{authenticated:true,body:{...body,version:1},settings:{ADMIN_WRITES_ENABLED:'true'},headers:{Origin:'https://evil.invalid'}})).status).toBe(403);
});
