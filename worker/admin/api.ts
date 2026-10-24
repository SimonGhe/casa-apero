import type { AdminItem, AdminOrder, AdminProduct, AuditRow, EventSale, FinancialEvent, OrderDetail } from '../../shared/admin';
import { ApiError } from '../validation';
import { authorizeAdmin, localAdmin, localLogin, logoutAdmin, sameOrigin } from './auth';
import type { AdminAuthEnv, AdminIdentity } from './auth';
import { adminText, cents, csv, date, fail, report, today, transition } from './domain';

export interface AdminEnv extends AdminAuthEnv { DB?: D1Database; ASSETS?: Fetcher; ADMIN_WRITES_ENABLED?: string }
export const privateHeaders = { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"frame-ancestors 'none'; base-uri 'self'; object-src 'none'" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });
const orderSelect = `SELECT o.id,o.reference,o.customer_name,o.email,o.phone,o.arrangement,o.requested_date,o.notes,
 o.internal_notes,o.confirmed_arrangements,o.confirmation_evidence,o.workflow_status,o.contract_status,o.source,
 o.subtotal_cents,o.delivery_cents,o.total_cents,o.version,o.created_at,
 p.status AS payment_status,p.amount_paid_cents,p.amount_refunded_cents,p.method
 FROM orders o JOIN payment_status p ON p.order_id=o.id`;
const productSelect = 'SELECT id,name,description,price_cents,cost_cents,production_days,orders_paused,published,version FROM products';

async function readBody(request: Request): Promise<Record<string, unknown>> {
 if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new ApiError(415,'json_required','JSON vereist.');
 const reader = request.body?.getReader();
 if (!reader) fail('Lege invoer.');
 const decoder = new TextDecoder(); let text = '', size = 0;
 while (true) { const chunk = await reader!.read(); if (chunk.done) break; size += chunk.value.byteLength;
   if (size > 16384) { await reader!.cancel(); throw new ApiError(413,'too_large','Invoer te groot.'); }
   text += decoder.decode(chunk.value, { stream: true });
 }
 text += decoder.decode();
 try { const value = JSON.parse(text); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Ongeldige invoer.'); return value; }
 catch { return fail('Ongeldige JSON.'); }
}
async function getOrder(db: D1Database, id: string): Promise<AdminOrder> {
 const row = await db.prepare(`${orderSelect} WHERE o.id=?`).bind(id).first<AdminOrder>();
 if (!row) throw new ApiError(404,'not_found','Aanvraag niet gevonden.'); return row;
}
async function items(db: D1Database, id: string) {
 return (await db.prepare('SELECT product_id,product_name,quantity,unit_price_cents,line_total_cents,unit_cost_cents FROM order_items WHERE order_id=? ORDER BY id').bind(id).all<AdminItem>()).results;
}
async function detail(db: D1Database, id: string): Promise<OrderDetail> {
 return { order: await getOrder(db,id), items: await items(db,id), audit: (await db.prepare("SELECT * FROM audit_log WHERE entity_type='order' AND entity_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(id).all<AuditRow>()).results };
}
function expectedVersion(value: unknown, current: number) {
 if (!Number.isSafeInteger(value) || value !== current) throw new ApiError(409,'stale_version','Een andere beheerder wijzigde dit record. Vernieuw en controleer de gegevens.');
}
function guardedAudit(db: D1Database, mutation: string, actor: AdminIdentity, action: string, entity: string, id: string, before: unknown, after: unknown, table: 'orders'|'products'|'application_settings'|'event_sales', key = 'id') {
 return db.prepare(`INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,before_json,after_json)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE ${key}=? AND last_mutation_id=?)`)
 .bind(mutation,actor.id,action,entity,id,JSON.stringify(before),JSON.stringify(after),id,mutation);
}
function changed(results: D1Result[]) {
 if (results[0].meta.changes !== 1) throw new ApiError(409,'stale_version','Dit record is intussen gewijzigd. Vernieuw het overzicht.');
}
function guardedFinance(db: D1Database, mutation: string, entity: 'order'|'event', id: string, category: string, amount: number, cost: number|null, accountingDate: string) {
 return db.prepare(`INSERT INTO financial_events(id,mutation_id,entity_type,entity_id,category,amount_cents,cost_cents,accounting_date)
 SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_log WHERE id=?)`)
 .bind(crypto.randomUUID(),mutation,entity,id,category,amount,cost,accountingDate,mutation);
}

async function updateOrder(db: D1Database, id: string, input: Record<string,unknown>, actor: AdminIdentity) {
 const before = await getOrder(db,id); expectedVersion(input.version,before.version);
 const state = transition(before.workflow_status,input.status);
 const notes = adminText(input.internalNotes ?? before.internal_notes);
 const arrangements = adminText(input.confirmedArrangements ?? before.confirmed_arrangements,1000);
 const evidence = adminText(input.confirmationEvidence ?? before.confirmation_evidence,1000);
 const confirming = before.workflow_status === 'new' && state === 'confirmed';
 if(state!=='new'&&state!=='cancelled'&&!arrangements) fail('Bevestigde afspraken mogen niet ontbreken.');
 let delivery = before.delivery_cents;
 let durableAt: string|null = null;
 if (confirming) {
   if(input.deliveryCents===null||input.deliveryCents===undefined)fail('Vul de leveringskosten in, ook wanneer die 0 zijn.');
   delivery = cents(input.deliveryCents,100000);
   if(!evidence)fail('Vul het bewijs van de duurzame bevestiging in.');
   const dateString = adminText(input.durableProvidedAt??'',40);
   if (!Number.isFinite(Date.parse(dateString)) || Date.parse(dateString) > Date.now()+60000) fail('Vul bij Verstrekt op een geldige datum en tijd in die niet in de toekomst liggen.');
   durableAt = new Date(dateString).toISOString();
 }
 const total = confirming ? before.subtotal_cents + delivery! : before.total_cents;
 const mutation = crypto.randomUUID();
 const requestStatus = state === 'cancelled' ? 'cancelled' : state === 'new' ? 'received' : state === 'completed' ? 'closed' : 'accepted';
 const production = ({ new:'not_started',confirmed:'not_started',in_production:'in_production',ready:'ready',completed:'completed',cancelled:'not_started' } as const)[state];
 const results = await db.batch([
   db.prepare(`UPDATE orders SET workflow_status=?,internal_notes=?,confirmed_arrangements=?,confirmation_evidence=?,
    delivery_cents=?,total_cents=?,contract_status=CASE WHEN ? THEN 'confirmed' ELSE contract_status END,
    confirmed_at=CASE WHEN ? THEN ? ELSE confirmed_at END,durable_confirmation_at=CASE WHEN ? THEN ? ELSE durable_confirmation_at END,
    request_status=?,production_status=?,version=version+1,last_mutation_id=? WHERE id=? AND version=?`)
    .bind(state,notes,arrangements,evidence,delivery,total,confirming?1:0,confirming?1:0,new Date().toISOString(),confirming?1:0,durableAt,requestStatus,production,mutation,id,before.version),
   ...(confirming ? [db.prepare(`UPDATE order_items SET unit_cost_cents=COALESCE(unit_cost_cents,(SELECT cost_cents FROM products WHERE id=product_id))
     WHERE order_id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND last_mutation_id=?)`).bind(id,id,mutation)] : []),
   db.prepare(`INSERT INTO order_status_history(order_id,category,from_status,to_status,actor_id)
    SELECT ?,'production',?,?,? WHERE ?!=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND last_mutation_id=?)`)
    .bind(id,before.workflow_status,state,actor.id,before.workflow_status,state,id,mutation),
   guardedAudit(db,mutation,actor,'order.update','order',id,{ status:before.workflow_status,notes:before.internal_notes,arrangements:before.confirmed_arrangements },{ status:state,notes,arrangements,evidence,delivery,total,durableAt },'orders'),
 ]);
 changed(results); return json(await detail(db,id));
}

async function updatePayment(db: D1Database, id: string, input: Record<string,unknown>, actor: AdminIdentity) {
 const before = await getOrder(db,id); expectedVersion(input.version,before.version);
 const paid = cents(input.amountPaidCents), refunded = cents(input.amountRefundedCents);
 if(before.workflow_status==='cancelled'&&paid>before.amount_paid_cents) fail('Een geannuleerde bestelling kan geen nieuwe betaling krijgen.');
 const method = adminText(input.method,80,paid>0);
 if (before.contract_status !== 'confirmed' || before.total_cents === null) fail('Een vrijblijvende aanvraag kan nog geen betaling krijgen.');
 if (paid < before.amount_paid_cents || refunded < before.amount_refunded_cents || refunded > paid || (paid !== 0 && paid !== before.total_cents)) fail('Betaling moet het afgesproken totaal zijn. Corrigeer ontvangen betalingen met een terugbetaling.');
 if (paid === before.amount_paid_cents && refunded === before.amount_refunded_cents) fail('Geen financiële wijziging opgegeven.');
 const status = paid === 0 ? 'unpaid' : refunded === paid ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid';
 const lines = await items(db,id);
 const cost = lines.some((line)=>line.unit_cost_cents===null) ? null : lines.reduce((sum,line)=>sum+line.unit_cost_cents!*line.quantity,0);
 const refundCost = cost===null || paid===0 ? null : Math.round(cost*refunded/paid)-Math.round(cost*before.amount_refunded_cents/paid);
 const mutation = crypto.randomUUID();
 const statements = [
   db.prepare('UPDATE orders SET version=version+1,last_mutation_id=? WHERE id=? AND version=?').bind(mutation,id,before.version),
   db.prepare(`UPDATE payment_status SET status=?,amount_paid_cents=?,amount_refunded_cents=?,method=?,paid_at=COALESCE(paid_at,?)
    WHERE order_id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND last_mutation_id=?)`).bind(status,paid,refunded,method,new Date().toISOString(),id,id,mutation),
   guardedAudit(db,mutation,actor,'payment.update','order',id,{ paid:before.amount_paid_cents,refunded:before.amount_refunded_cents,status:before.payment_status },{ paid,refunded,status,method },'orders'),
   db.prepare(`INSERT INTO order_status_history(order_id,category,from_status,to_status,actor_id) SELECT ?,'payment',?,?,?
    WHERE EXISTS(SELECT 1 FROM audit_log WHERE id=?)`).bind(id,before.payment_status,status,actor.id,mutation),
 ];
 if (paid>before.amount_paid_cents) statements.push(guardedFinance(db,mutation,'order',id,'payment',paid-before.amount_paid_cents,cost,today()));
 if (refunded>before.amount_refunded_cents) statements.push(guardedFinance(db,mutation,'order',id,'refund',-(refunded-before.amount_refunded_cents),refundCost===null?null:-refundCost,today()));
 changed(await db.batch(statements)); return json(await detail(db,id));
}

async function updateProduct(db: D1Database, id: string, input: Record<string,unknown>, actor: AdminIdentity) {
 const before = await db.prepare(`${productSelect} WHERE id=?`).bind(id).first<AdminProduct>();
 if (!before) throw new ApiError(404,'not_found','Product niet gevonden.'); expectedVersion(input.version,before.version);
 const name = adminText(input.name,100,true), description = adminText(input.description,2000);
 const price = cents(input.priceCents,100000), cost = input.costCents===null?null:cents(input.costCents,100000);
 const days = cents(input.productionDays,365);
 if (days<1 || typeof input.paused!=='boolean' || typeof input.published!=='boolean') fail('Controleer productinstellingen.');
 const mutation = crypto.randomUUID();
 changed(await db.batch([
   db.prepare('UPDATE products SET name=?,description=?,price_cents=?,cost_cents=?,production_days=?,orders_paused=?,published=?,version=version+1,last_mutation_id=? WHERE id=? AND version=?')
    .bind(name,description,price,cost,days,input.paused?1:0,input.published?1:0,mutation,id,before.version),
   guardedAudit(db,mutation,actor,'product.update','product',id,before,{name,description,price,cost,days,paused:input.paused,published:input.published},'products'),
 ])); return json(await db.prepare(`${productSelect} WHERE id=?`).bind(id).first());
}

async function createEvent(db: D1Database, input: Record<string,unknown>, actor: AdminIdentity) {
 const id = adminText(input.id,36,true); if (!/^[a-f0-9-]{36}$/.test(id)) fail('Ongeldige verzendcode.');
 const name=adminText(input.name,120,true), eventDate=date(input.date), notes=adminText(input.notes??'',1000);
 if (eventDate>today()) fail('Een verkoopdatum ligt niet in de toekomst.');
 if (!Array.isArray(input.items) || input.items.length<1 || input.items.length>4) fail('Kies één tot vier verkoopregels.');
 const products=(await db.prepare(productSelect).all<AdminProduct>()).results;
 const seen=new Set<string>();
 const lines=(input.items as unknown[]).map((value: unknown)=>{
   if (!value || typeof value!=='object') fail('Ongeldige verkoopregel.');
   const row=value as Record<string,unknown>; const product=products.find((p)=>p.id===row.productId);
   if (!product || seen.has(product.id)) fail('Onbekend of dubbel product.');
   seen.add(product!.id); const quantity=cents(row.quantity,9999); if (!quantity) fail('Aantal moet positief zijn.');
   return { product:product!,quantity,price:cents(row.unitPriceCents,100000) };
 });
 const canonical=JSON.stringify({name,eventDate,notes,items:lines.map((line)=>({productId:line.product.id,quantity:line.quantity,price:line.price})).sort((a,b)=>a.productId.localeCompare(b.productId))});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical))),(x)=>x.toString(16).padStart(2,'0')).join('');
 const existing=await db.prepare('SELECT request_hash FROM event_sales WHERE id=?').bind(id).first<{request_hash:string}>();
 if (existing) { if (existing.request_hash!==hash) throw new ApiError(409,'idempotency_conflict','Deze verzendcode hoort bij een andere verkoop.'); return json({id}); }
 const total=lines.reduce((sum,line)=>sum+line.quantity*line.price,0);
 const cost=lines.some((line)=>line.product.cost_cents===null)?null:lines.reduce((sum,line)=>sum+line.quantity*line.product.cost_cents!,0);
 const mutation=crypto.randomUUID();
 try { await db.batch([
   db.prepare('INSERT INTO event_sales(id,request_hash,event_name,event_date,notes,total_cents,cost_cents,last_mutation_id) VALUES (?,?,?,?,?,?,?,?)').bind(id,hash,name,eventDate,notes,total,cost,mutation),
   ...lines.map((line)=>db.prepare('INSERT INTO event_sale_items(sale_id,product_id,product_name,quantity,unit_price_cents,unit_cost_cents) VALUES (?,?,?,?,?,?)').bind(id,line.product.id,line.product.name,line.quantity,line.price,line.product.cost_cents)),
   guardedAudit(db,mutation,actor,'event.create','event',id,null,{name,eventDate,notes,total,cost,items:JSON.parse(canonical).items},'event_sales'),
   guardedFinance(db,mutation,'event',id,'event_sale',total,cost,eventDate),
 ]); } catch (error) {
   const winner=await db.prepare('SELECT request_hash FROM event_sales WHERE id=?').bind(id).first<{request_hash:string}>();
   if (winner?.request_hash===hash) return json({id});
   if (winner) throw new ApiError(409,'idempotency_conflict','Deze verzendcode is al gebruikt.'); throw error;
 }
 return json({id},201);
}

function period(url: URL) {
 const from=date(url.searchParams.get('from')??`${today().slice(0,4)}-01-01`), to=date(url.searchParams.get('to')??today());
 if (from>to || (Date.parse(to)-Date.parse(from))/86400000>366) fail('Kies een periode van maximaal 366 dagen.');
 return {from,to};
}
async function financial(db: D1Database,url: URL) { const {from,to}=period(url); return (await db.prepare('SELECT entity_type,entity_id,category,amount_cents,cost_cents,accounting_date FROM financial_events WHERE accounting_date BETWEEN ? AND ? ORDER BY accounting_date,id LIMIT 10001').bind(from,to).all<FinancialEvent>()).results; }

export async function adminApi(request: Request, env: AdminEnv): Promise<Response> {
 try {
   const url=new URL(request.url), path=url.pathname;
   if (path==='/api/admin/local-login' && request.method==='POST') return await localLogin(request,env);
   const actor=await authorizeAdmin(request,env);
   if (!env.DB) throw new ApiError(503,'db_unconfigured','Lokale beheerdatabase ontbreekt.'); const db=env.DB;
   const writing=!['GET','HEAD'].includes(request.method);
   if (writing) { sameOrigin(request); if (!localAdmin(request,env) && env.ADMIN_WRITES_ENABLED!=='true') throw new ApiError(403,'writes_disabled','Beheerwijzigingen zijn nog niet ingeschakeld.'); }
   if (path==='/api/admin/session' && request.method==='GET') return json({...actor,preview:env.APP_ENV==='admin-preview',writesEnabled:localAdmin(request,env)||env.ADMIN_WRITES_ENABLED==='true'});
   if (path==='/api/admin/logout' && request.method==='POST') return logoutAdmin();
   if (path==='/api/admin/orders' && request.method==='GET') {
     const search=(url.searchParams.get('q')??'').slice(0,100).replace(/[\\%_]/g,'\\$&');
     const page=Number(url.searchParams.get('page')??0); if (!Number.isInteger(page)||page<0||page>1000) fail('Ongeldige pagina.');
     const pattern=`%${search}%`;
     return json({ orders:(await db.prepare(`${orderSelect} WHERE o.reference LIKE ? ESCAPE '\\' OR o.customer_name LIKE ? ESCAPE '\\' ORDER BY o.created_at DESC,o.id LIMIT 50 OFFSET ?`).bind(pattern,pattern,page*50).all<AdminOrder>()).results,
       total:await db.prepare("SELECT COUNT(*) FROM orders WHERE reference LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\'").bind(pattern,pattern).first('COUNT(*)') });
   }
   const orderPath=path.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})(?:\/(payment))?$/);
   if (orderPath) {
     if (request.method==='GET'&&!orderPath[2]) return json(await detail(db,orderPath[1]));
     if (request.method==='PUT') return orderPath[2]?await updatePayment(db,orderPath[1],await readBody(request),actor):await updateOrder(db,orderPath[1],await readBody(request),actor);
   }
   if (path==='/api/admin/products'&&request.method==='GET') return json((await db.prepare(productSelect).all()).results);
   const productPath=path.match(/^\/api\/admin\/products\/([a-z-]+)$/);
   if (productPath&&request.method==='PUT') return await updateProduct(db,productPath[1],await readBody(request),actor);
   if (path==='/api/admin/settings') {
     const setting=await db.prepare("SELECT value,version FROM application_settings WHERE key='orders_paused'").first<{value:string;version:number}>();
     if (!setting) throw new ApiError(503,'missing_settings','Instellingen ontbreken.');
     if (request.method==='GET') return json({paused:setting.value!=='false',version:setting.version});
     if (request.method==='PUT') {
       const input=await readBody(request); expectedVersion(input.version,setting.version); if(typeof input.paused!=='boolean') fail('Ongeldige pauze.'); const mutation=crypto.randomUUID();
       changed(await db.batch([db.prepare("UPDATE application_settings SET value=?,version=version+1,last_mutation_id=? WHERE key='orders_paused' AND version=?").bind(input.paused?'true':'false',mutation,setting.version),guardedAudit(db,mutation,actor,'settings.pause','settings','orders_paused',setting,{paused:input.paused},'application_settings','key')]));
       return json({paused:input.paused,version:setting.version+1});
     }
   }
   if (path==='/api/admin/events') {
     if (request.method==='GET') return json((await db.prepare('SELECT id,event_name,event_date,notes,status,total_cents,cost_cents,version FROM event_sales ORDER BY event_date DESC LIMIT 100').all()).results);
     if (request.method==='POST') return await createEvent(db,await readBody(request),actor);
   }
   const eventPath=path.match(/^\/api\/admin\/events\/([a-f0-9-]{36})\/void$/);
   if(eventPath&&request.method==='PUT') {
     const before=await db.prepare('SELECT * FROM event_sales WHERE id=?').bind(eventPath[1]).first<EventSale>();
     if(!before) throw new ApiError(404,'not_found','Verkoop niet gevonden.');
     const input=await readBody(request); expectedVersion(input.version,before.version); if(before.status!=='active') fail('Deze samenvatting is al ongeldig gemaakt.');
     const reason=adminText(input.reason,1000,true), mutation=crypto.randomUUID();
     changed(await db.batch([db.prepare("UPDATE event_sales SET status='voided',version=version+1,last_mutation_id=? WHERE id=? AND version=?").bind(mutation,before.id,before.version),
       guardedAudit(db,mutation,actor,'event.void','event',before.id,before,{status:'voided',reason},'event_sales'),
       guardedFinance(db,mutation,'event',before.id,'event_void',-before.total_cents,before.cost_cents===null?null:-before.cost_cents,before.event_date)])); return json({id:before.id});
   }
   if(path==='/api/admin/report'&&request.method==='GET') {
     const events=await financial(db,url); if(events.length>10000) fail('Verklein de rapportperiode.');
     return json({...report(events),cancelledOutstandingRefundCents:await db.prepare("SELECT COALESCE(SUM(p.amount_paid_cents-p.amount_refunded_cents),0) AS n FROM orders o JOIN payment_status p ON p.order_id=o.id WHERE o.workflow_status='cancelled'").first('n'),newOrders:await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE workflow_status='new'").first('n'),activeProduction:await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE workflow_status IN ('confirmed','in_production','ready')").first('n')});
   }
   if(path==='/api/admin/audit'&&request.method==='GET') return json((await db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC,id DESC LIMIT 100').all()).results);
   if(path==='/api/admin/export'&&request.method==='GET') {
     const {from,to}=period(url); let rows: unknown[][];
     if(url.searchParams.get('kind')==='finance') {
       const events=await financial(db,url); if(events.length>10000) fail('Verklein de exportperiode.');
       rows=[['Datum','Type','Referentie-ID','Categorie','Omzet EUR','Geschatte kosten EUR'],...events.map((e)=>[e.accounting_date,e.entity_type,e.entity_id,e.category,e.amount_cents/100,e.cost_cents===null?'ONBEKEND':e.cost_cents/100])];
     } else {
       const orders=(await db.prepare(`${orderSelect} WHERE substr(o.created_at,1,10) BETWEEN ? AND ? ORDER BY o.created_at LIMIT 10001`).bind(from,to).all<AdminOrder>()).results;
       if(orders.length>10000) fail('Verklein de exportperiode.');
       rows=[['Referentie','Naam','E-mail','Werkstatus','Betaalstatus','Producttotaal EUR','Afgesproken totaal EUR'],...orders.map((o)=>[o.reference,o.customer_name,o.email,o.workflow_status,o.payment_status,o.subtotal_cents/100,o.total_cents===null?'NOG NIET AFGESPROKEN':o.total_cents/100])];
     }
     return new Response(csv(rows),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="casa-apero-export.csv"'}});
   }
   throw new ApiError(404,'not_found','Beheerroute niet gevonden.');
 } catch(error) {
   return error instanceof ApiError ? json({error:{code:error.code,message:error.message}},error.status) : json({error:{code:'admin_unavailable',message:'Beheer tijdelijk niet beschikbaar. Vernieuw het record vóór je opnieuw probeert.'}},503);
 }
}
