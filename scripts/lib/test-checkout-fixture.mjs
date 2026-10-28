// Local-only signed JWT/JWKS and Siteverify transport fixture. Never deployed.
// Every virtual request is dispatched to local workerd; external traffic fails.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
export async function createTestCheckoutFixture({publicShop=false}={}){
 const origin='https://casa-apero.com',adminOrigin='https://admin.casa-apero.com',issuer='https://checkout-browser-fixture.cloudflareaccess.com',aud='b'.repeat(64),adminAud='a'.repeat(64);
 const pair=await generateKeyPair('RS256'),jwks={keys:[{...await exportJWK(pair.publicKey),kid:'checkout-browser',alg:'RS256',use:'sig'}]};
 const storefront=publicShop?'dist-shop':'dist-test-checkout',adminAssets=publicShop?'dist-admin-production':'dist-admin-preview';
 const config=JSON.parse(await readFile(storefront+'/worker/wrangler.json','utf8')),adminConfig=JSON.parse(await readFile(adminAssets+'/worker/wrangler.json','utf8'));
 assert.equal(config.name,publicShop?'casa-apero':'casa-apero-staging');assert.equal(config.d1_databases[0].database_id,publicShop?'5d4d738b-4d84-4826-a15d-4652e7e191bd':'f8c58abc-95ab-4fd9-8279-5f0f0f2ada83');if(!publicShop)assert.equal(config.vars.CHECKOUT_ENABLED,'false');assert.equal(adminConfig.name,publicShop?'casa-apero-admin':'casa-apero-admin-staging');
 const usedTokens=new Set(),pending=new Set();
 const outboundService=async request=>{
  if(request.url===issuer+'/cdn-cgi/access/certs')return Response.json(jwks);
  if(request.url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){
   const form=new URLSearchParams(await request.text());assert.equal(form.get('secret'),'fixture-server-only-secret');const token=form.get('response');
   const success=Boolean(token?.startsWith('fixture-')&&!usedTokens.has(token));usedTokens.add(token);
   return Response.json({success,hostname:'casa-apero.com',action:'order-request'});
  }
  throw Error('External network prohibited by local checkout fixture');
 };
 const assets=directory=>({directory:resolve(directory),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},assetConfig:{not_found_handling:'single-page-application'}});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'checkout-browser',routes:['casa-apero.com/*'],modules:true,scriptPath:resolve(storefront+'/worker/index.js'),compatibilityDate:'2026-10-24',
  bindings:{...config.vars,...(publicShop?{PUBLIC_ORDERS_ENABLED:'true',LEGAL_VERSION:'Concept 0.2 · 28 oktober 2026'}:{TEST_CHECKOUT_ENABLED:'true',TEST_CHECKOUT_ISSUER:issuer,TEST_CHECKOUT_AUDIENCE:aud,ADMIN_ACCESS_AUDIENCE:adminAud,TEST_CHECKOUT_ALLOWED_EMAILS:'tester@example.invalid'}),TURNSTILE_SITE_KEY:'0x-fixture-sitekey',TURNSTILE_SECRET_KEY:'fixture-server-only-secret'},
  d1Databases:{DB:'shared-fictional-db'},assets:assets(storefront+'/client'),outboundService,
 },{
  name:'checkout-browser-admin',routes:['admin.casa-apero.com/*'],modules:true,scriptPath:resolve(adminAssets+'/worker/index.js'),compatibilityDate:'2026-10-24',
  bindings:{...adminConfig.vars,ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:adminAud,ADMIN_EMAIL_ALLOWLIST:'tester@example.invalid',ADMIN_WRITES_ENABLED:'true'},
  d1Databases:{DB:'shared-fictional-db'},assets:assets(adminAssets+'/client'),outboundService,
 }]}));
 try{
  const db=await mf.getD1Database('DB','checkout-browser');
  for(const name of (await readdir('migrations')).filter(n=>/^\d.*\.sql$/.test(n)).sort())await db.exec((await readFile('migrations/'+name,'utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
  const seed=publicShop?'production/initialize.sql':'preview/admin-fixtures.sql';
  await db.exec((await readFile(seed,'utf8')).split('\n').filter(l=>!l.trim().startsWith('--')).join(' '));
  if(publicShop)assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM orders').first('n'),0);
  // Fictional local fixture only; deployed global/product pauses are never bypassed.
  await db.exec("UPDATE application_settings SET value='false' WHERE key='orders_paused';");
  async function sign(audience,email='tester@example.invalid'){return new SignJWT({email,type:'app'}).setSubject('fictional-browser-tester').setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('1h').setProtectedHeader({alg:'RS256',kid:'checkout-browser'}).sign(pair.privateKey);}
  const jwt=await sign(aud),adminJwt=await sign(adminAud),deniedJwt=await sign(aud,'intruder@example.invalid');
  return {origin,adminOrigin,db,dispose:async()=>{await Promise.allSettled([...pending]);await mf.dispose();},fetch(path,{method='GET',body,headers={},host=origin,authenticated,unauthorized=false}={}){
   const adminHost=new URL(host).origin===adminOrigin,withAuth=authenticated??(!publicShop||adminHost),merged=new Headers({Origin:host,...(publicShop?{'CF-Connecting-IP':'192.0.2.10'}:{}),...(withAuth?{'Cf-Access-Jwt-Assertion':unauthorized?deniedJwt:adminHost?adminJwt:jwt}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})});
   for(const [key,value] of new Headers(headers))merged.set(key,value);
   const url=new URL(path,host).href,init={method,headers:Object.fromEntries(merged),...(body===undefined?{}:{body:JSON.stringify(body)})};
   const response=mf.dispatchFetch(url,init);
   pending.add(response);response.then(()=>pending.delete(response),()=>pending.delete(response));return response;
  }};
 }catch(error){await mf.dispose();throw error;}
}
