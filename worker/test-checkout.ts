import staging from './staging';
import {verifyAccessIdentity} from './access-jwt';
import {sameOrigin} from './admin/access';
import {requireFictionalDataset,PREVIEW_DATASET} from './admin/preview-guard';
import {body,quote,receipt,existing,createOrder,digest} from './index';
import {ApiError,validateRequest,validateSelection} from './validation';
import {verifyTurnstile} from './turnstile';
import type {TurnstileEnv} from './turnstile';
import {readCatalogue} from './catalogue';
import {FICTIONAL_CUSTOMER,TEST_CHECKOUT_BASE,TEST_CHECKOUT_API,TEST_CHECKOUT_RATE_LIMIT} from '../shared/testCheckout';
export interface TestCheckoutEnv extends TurnstileEnv{
 DB?:D1Database;ASSETS:Fetcher;CHECKOUT_ENABLED?:string;TEST_CHECKOUT_ENABLED?:string;
 TEST_CHECKOUT_ISSUER?:string;TEST_CHECKOUT_AUDIENCE?:string;TEST_CHECKOUT_ALLOWED_EMAILS?:string;
 ADMIN_ACCESS_AUDIENCE?:string;TEST_CHECKOUT_DATASET?:string;
}
const privateHeaders={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin',Vary:'Cookie, Cf-Access-Jwt-Assertion'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
async function limit(db:D1Database,owner:string){
 const now=Date.now(),minute=Math.floor(now/60000),bucket=`test-checkout:${owner}:${minute}`;
 const row=await db.prepare('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,(minute+2)*60000).first<{attempts:number}>();
 if(!row||row.attempts>TEST_CHECKOUT_RATE_LIMIT)throw new ApiError(429,'rate_limited','Te veel testaanvragen. Probeer over een minuut opnieuw.');
 await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
}
export default{
 async fetch(request:Request,env:TestCheckoutEnv):Promise<Response>{
  const url=new URL(request.url),protectedPath=url.pathname===TEST_CHECKOUT_BASE||url.pathname.startsWith(TEST_CHECKOUT_BASE+'/');
  if(!protectedPath)return staging.fetch(request,env);
  try{
   if(url.origin!=='https://casa-apero.com'||env.APP_ENV!=='test-checkout'||env.CHECKOUT_ENABLED!=='false'||env.TEST_CHECKOUT_ENABLED!=='true'||env.TEST_CHECKOUT_DATASET!==PREVIEW_DATASET||!env.DB
    ||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.TEST_CHECKOUT_ISSUER??'')||!/^([a-f0-9]{64})$/i.test(env.TEST_CHECKOUT_AUDIENCE??'')
    ||!/^([a-f0-9]{64})$/i.test(env.ADMIN_ACCESS_AUDIENCE??'')||env.TEST_CHECKOUT_AUDIENCE===env.ADMIN_ACCESS_AUDIENCE
    ||!env.TEST_CHECKOUT_ALLOWED_EMAILS||!env.TEST_CHECKOUT_ALLOWED_EMAILS.split(',').every(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim()))
    ||env.TURNSTILE_MODE!=='siteverify'||!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY
    ||/^(?:1x|2x|3x)/.test(env.TURNSTILE_SECRET_KEY)||/^(?:1x|2x|3x)/.test(env.TURNSTILE_SITE_KEY))throw new ApiError(403,'test_checkout_disabled','De beveiligde testcheckout is nog niet vrijgegeven.');
   const token=request.headers.get('Cf-Access-Jwt-Assertion');
   if(!token||token.length>16384)throw new ApiError(401,'tester_login_required','Meld je aan via de afzonderlijke testerlogin.');
   let actor;try{actor=await verifyAccessIdentity(token,env.TEST_CHECKOUT_ISSUER!,env.TEST_CHECKOUT_AUDIENCE!,env.TEST_CHECKOUT_ALLOWED_EMAILS);}catch{throw new ApiError(403,'tester_denied','Geen geldige testermachtiging.');}
   // Even GETs require the exact origin, verified audience/identity and dataset.
   await requireFictionalDataset(env.DB);
   await env.DB.prepare('SELECT order_id FROM test_checkout_orders LIMIT 1').all();
   const owner=await digest(`${env.TEST_CHECKOUT_ISSUER}\n${actor.id}`),path=url.pathname.slice(TEST_CHECKOUT_API.length);
   if(!['GET','HEAD'].includes(request.method))sameOrigin(request);
   if(url.pathname===TEST_CHECKOUT_API||url.pathname.startsWith(TEST_CHECKOUT_API+'/')){
    await limit(env.DB,owner);
    if(path==='/config'&&request.method==='GET')return json({localRequests:true,authenticatedTest:true,turnstileMode:'siteverify',siteKey:env.TURNSTILE_SITE_KEY});
    if(path==='/catalogue'&&request.method==='GET')return json(await readCatalogue(env.DB));
    if(path==='/quote'&&request.method==='POST'){const raw=await body(request) as {items?:unknown}|null;return json(await quote(env.DB,validateSelection(raw?.items)));}
    if(path==='/requests'&&request.method==='POST'){
     const raw=await body(request) as Record<string,unknown>,input=validateRequest(raw);
     for(const key of ['name','email','phone','notes'] as const)if(input[key]!==FICTIONAL_CUSTOMER[key])throw new ApiError(400,'fictional_only','Gebruik alleen de vooraf ingevulde fictieve contactgegevens en notitie.');
     const key=request.headers.get('Idempotency-Key')??'';if(!/^[a-f0-9-]{36}$/.test(key))throw new ApiError(400,'invalid_key','Verzendcode ontbreekt.');
     const scopedKey=await digest(`test-checkout\n${owner}\n${key}`),hash=await digest(JSON.stringify(input));
     const duplicate=await existing(env.DB,scopedKey,hash);if(duplicate)return new Response(duplicate.body,{status:duplicate.status,headers:privateHeaders});
     const pricing=await quote(env.DB,input.items);if(pricing.subtotalCents!==input.expectedSubtotalCents)throw new ApiError(409,'price_changed','De prijs is gewijzigd. Vernieuw het overzicht.');
     await verifyTurnstile(typeof raw.turnstileToken==='string'?raw.turnstileToken:'',env,url.hostname);
     const response=await createOrder(env.DB,input,scopedKey,hash,owner);return new Response(response.body,{status:response.status,headers:privateHeaders});
    }
    if(path==='/receipt'&&request.method==='POST'){
     const capability=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
     if(!/^[a-f0-9]{64}$/.test(capability))throw new ApiError(404,'not_found','Ontvangstbewijs niet gevonden.');
     const row=await env.DB.prepare('SELECT o.id FROM orders o JOIN test_checkout_orders t ON t.order_id=o.id WHERE o.receipt_token_hash=? AND t.tester_hash=?').bind(await digest(capability),owner).first<{id:string}>();
     if(!row)throw new ApiError(404,'not_found','Ontvangstbewijs niet gevonden.');return json(await receipt(env.DB,row.id));
    }
    throw new ApiError(404,'not_found','Test-API-route niet gevonden.');
   }
   if(!['GET','HEAD'].includes(request.method)||![TEST_CHECKOUT_BASE,TEST_CHECKOUT_BASE+'/',TEST_CHECKOUT_BASE+'/ontvangen'].includes(url.pathname))throw new ApiError(404,'not_found','Testpagina niet gevonden.');
   const response=await env.ASSETS.fetch(request),headers=new Headers({...Object.fromEntries(response.headers),...privateHeaders});
   for(const key of [...headers.keys()])if(key.toLowerCase().startsWith('access-control-'))headers.delete(key);
   return new Response(response.body,{status:response.status,headers});
  }catch(error){const e=error instanceof ApiError?error:new ApiError(503,'test_unavailable','Testcheckout tijdelijk niet beschikbaar. Probeer opnieuw met dezelfde verzendcode.');return json({error:{code:e.code,message:e.message}},e.status);}
 },
};
