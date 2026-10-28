import {body,quote,receipt,existing,createOrder,digest} from './index';
import {ApiError,validateRequest,validateSelection} from './validation';
import {verifyTurnstile} from './turnstile';
import type {TurnstileEnv} from './turnstile';
import {readCatalogue} from './catalogue';
import {sameOrigin} from './admin/access';
import {requireProductionDatabase} from './production-guard';
import {legalVersion} from '../src/data/legal';
export interface ShopEnv extends TurnstileEnv {DB?:D1Database;ASSETS?:Fetcher;PUBLIC_ORDERS_ENABLED?:string;LEGAL_VERSION?:string}
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
async function limit(db:D1Database,request:Request){
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)throw new ApiError(503,'rate_unavailable','Beveiligingscontrole tijdelijk niet beschikbaar.');
 const now=Date.now(),minute=Math.floor(now/60000);
 for(const [name,max] of [[await digest(ip),20],['global',120]] as const){
  const row=await db.prepare('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(`public:${name}:${minute}`,(minute+2)*60000).first<{attempts:number}>();
  if(!row||row.attempts>max)throw new ApiError(429,'rate_limited','Te veel aanvragen. Probeer over een minuut opnieuw.');
 }
 await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
}
export default{async fetch(request:Request,env:ShopEnv):Promise<Response>{
 const url=new URL(request.url);
 try{
  if(url.origin!=='https://casa-apero.com'||env.APP_ENV!=='public-shop')throw new ApiError(403,'wrong_host','Niet beschikbaar op deze host.');
  if(url.pathname==='/test-bestellen'||url.pathname.startsWith('/test-bestellen/')||/^\/(?:__debug|src|node_modules|@vite|@fs|admin)(?:\/|$)/.test(url.pathname)||/\.(?:map|sql)$/.test(url.pathname))throw new ApiError(404,'not_found','Pagina niet gevonden.');
  if(url.pathname==='/api'||url.pathname.startsWith('/api/')){
   if(!env.DB)throw new ApiError(503,'unavailable','Webshop tijdelijk niet beschikbaar.');
   await requireProductionDatabase(env.DB);
   if(url.pathname==='/api/catalogue'&&request.method==='GET')return json(await readCatalogue(env.DB));
   const enabled=env.PUBLIC_ORDERS_ENABLED==='true'&&env.TURNSTILE_MODE==='siteverify'&&Boolean(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY)&&!/^(?:1x|2x|3x)/.test(env.TURNSTILE_SITE_KEY??'')&&!/^(?:1x|2x|3x)/.test(env.TURNSTILE_SECRET_KEY??'');
   if(url.pathname==='/api/config'&&request.method==='GET')return json({localRequests:enabled,publicRequests:enabled,...(enabled?{turnstileMode:'siteverify',siteKey:env.TURNSTILE_SITE_KEY}:{})});
   if(!enabled)throw new ApiError(403,'checkout_disabled','Aanvragen zijn nog niet vrijgegeven.');
   if(request.method==='POST'){sameOrigin(request);await limit(env.DB,request);}
   if(url.pathname==='/api/quote'&&request.method==='POST'){const raw=await body(request) as {items?:unknown}|null;return json(await quote(env.DB,validateSelection(raw?.items)));}
   if(url.pathname==='/api/requests'&&request.method==='POST'){
    const raw=await body(request) as Record<string,unknown>,input=validateRequest(raw,undefined,'public');
    if(input.arrangement!=='pickup')throw new ApiError(400,'pickup_only','We bieden alleen afhaling op afspraak aan.');
    if(input.email.endsWith('@example.invalid'))throw new ApiError(400,'invalid_email','Gebruik een bereikbaar e-mailadres.');
    const key=request.headers.get('Idempotency-Key')??'';if(!/^[a-f0-9-]{36}$/.test(key))throw new ApiError(400,'invalid_key','Verzendcode ontbreekt.');
    // Bind the retry to its opaque receipt capability; no public order lookup.
    const scopedKey=await digest(`public\n${key}\n${input.receiptToken}`),hash=await digest(JSON.stringify(input));
    const duplicate=await existing(env.DB,scopedKey,hash);if(duplicate)return duplicate;
    const pricing=await quote(env.DB,input.items);if(pricing.subtotalCents!==input.expectedSubtotalCents)throw new ApiError(409,'price_changed','De prijs is gewijzigd. Controleer het nieuwe overzicht.');
    await verifyTurnstile(typeof raw.turnstileToken==='string'?raw.turnstileToken:'',env,url.hostname);
    return await createOrder(env.DB,input,scopedKey,hash,undefined,env.LEGAL_VERSION?.trim()||legalVersion);
   }
   if(url.pathname==='/api/receipt'&&request.method==='POST'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
    if(!/^[a-f0-9]{64}$/.test(token))throw new ApiError(404,'not_found','Ontvangstbewijs niet gevonden.');
    const row=await env.DB.prepare("SELECT id FROM orders WHERE receipt_token_hash=? AND source='web'").bind(await digest(token)).first<{id:string}>();
    if(!row)throw new ApiError(404,'not_found','Ontvangstbewijs niet gevonden.');return json(await receipt(env.DB,row.id));
   }
   throw new ApiError(404,'not_found','API-route niet gevonden.');
  }
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers});
  return env.ASSETS?env.ASSETS.fetch(request):new Response(null,{status:404});
 }catch(error){const e=error instanceof ApiError?error:new ApiError(503,'unavailable','De aanvraag kon niet worden verwerkt. Probeer opnieuw met dezelfde verzendcode.');return json({error:{code:e.code,message:e.message}},e.status);}
}};
