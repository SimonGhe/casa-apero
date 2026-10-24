import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { money } from '../data/catalogue';
import { workflowLabels, paymentLabels } from '../../shared/admin';
import type { AdminOrder, AdminProduct, AuditRow, EventSale, OrderDetail, Report } from '../../shared/admin';
import { adminApi, amount, euroInput } from './api';

type Identity={email:string;local:boolean;preview?:boolean;writesEnabled?:boolean};
const onlinePreview=import.meta.env.MODE==='admin-preview';
const localSimulation=import.meta.env.DEV&&import.meta.env.MODE==='admin';
type Tab='orders'|'products'|'events'|'report'|'audit';
type Overview=Report&{newOrders:number;activeProduction:number};
const now=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Brussels'});
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Er ging iets mis. Probeer opnieuw.';

export function Dashboard(){
 const [identity,setIdentity]=useState<Identity|null>(),[tab,setTab]=useState<Tab>('orders');
 const [error,setError]=useState(''),[overview,setOverview]=useState<Overview>();
 const [selected,setSelected]=useState<string>(),[revision,setRevision]=useState(0);
 async function loadIdentity(){try{setIdentity(await adminApi<Identity>('session'));}catch{setIdentity(null);}}
 useEffect(()=>{void loadIdentity();},[]);
 useEffect(()=>{if(identity)adminApi<Overview>('report').then(setOverview).catch((failure)=>setError(errorMessage(failure)));},[identity,revision]);
 const refresh=()=>setRevision((value)=>value+1);
 return <div className="admin-shell">
   <header className="admin-header"><BrandLogo className="header-logo" /><div><strong>Casa Apero</strong><p>Studentenbeheer</p></div>{identity&&<button className="button button-secondary" onClick={async()=>{if(!localSimulation){window.location.assign('/cdn-cgi/access/logout');return;}await adminApi('logout',{},'POST');setIdentity(null);setSelected(undefined);}}>Afmelden</button>}</header>
   <main className="content-width admin-main">
    <h1>Studentenbeheer</h1><p className="notice">{onlinePreview?'AFGESCHERMDE TESTVERSIE — uitsluitend fictieve gegevens. Geen echte klantbestellingen.':'Lokale testadministratie — gebruik uitsluitend fictieve gegevens.'} Bevestigingen en betalingen zijn registraties voor de test; er worden geen e-mails of online betalingen uitgevoerd.</p>
    {error&&<p role="alert" className="notice">{error}</p>}
    {identity===undefined?<p role="status">Sessie controleren…</p>:!identity?<section><h2>Aanmelden</h2>{!localSimulation?<p>Een geldige Cloudflare Access-sessie en beheerdersmachtiging zijn vereist. <a className="text-link" href="/">Opnieuw aanmelden via Cloudflare Access</a></p>:<><p>Start op deze lokale omgeving een sessie als fictieve beheerder. Online beheer vereist later Cloudflare Access en een goedgekeurde beheerderslijst.</p><button className="button button-primary" onClick={async()=>{try{await adminApi('local-login',{},'POST');setError('');await loadIdentity();}catch(failure){setError(errorMessage(failure));}}}>Lokale testbeheerder starten</button></>}</section>:<>
     <p className="admin-identity">Aangemeld: {identity.email}</p>
     {onlinePreview&&!identity.writesEnabled&&<p className="notice">Alleen bekijken. Wijzigingen blijven uitgeschakeld tot de echte Access-login en de aparte testdatabase zijn goedgekeurd.</p>}
     <section className="admin-kpis" aria-label="Overzicht">
       <Kpi title="Nieuwe aanvragen" value={overview?.newOrders??'…'} /><Kpi title="Actieve productie" value={overview?.activeProduction??'…'} /><Kpi title="Betaalde omzet dit jaar" value={overview?money(overview.revenueCents):'…'} />
     </section>
     <nav className="admin-tabs" aria-label="Beheernavigatie">{([['orders','Bestellingen'],['products','Producten'],['events','Marktverkopen'],['report','Rapporten'],['audit','Wijzigingslog']] as const).map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setSelected(undefined);}}>{label}</button>)}</nav>
     {tab==='orders'&&(selected?<OrderEditor id={selected} back={()=>setSelected(undefined)} changed={refresh} readOnly={onlinePreview&&!identity.writesEnabled}/>:<OrderList revision={revision} select={setSelected}/>)}
     {tab==='products'&&<fieldset disabled={onlinePreview&&!identity.writesEnabled}><Products changed={refresh}/></fieldset>}
     {tab==='events'&&<fieldset disabled={onlinePreview&&!identity.writesEnabled}><Events changed={refresh}/></fieldset>}
     {tab==='report'&&<Reports/>}
     {tab==='audit'&&<Audit/>}
    </>}
   </main>
 </div>;
}
function Kpi({title,value}:{title:string;value:ReactNode}){return <article><h2>{title}</h2><strong>{value}</strong></article>;}
function OrderList({revision,select}:{revision:number;select:(id:string)=>void}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(0),[data,setData]=useState<{orders:AdminOrder[];total:number}>(),[error,setError]=useState('');
 useEffect(()=>{let active=true;adminApi<{orders:AdminOrder[];total:number}>(`orders?q=${encodeURIComponent(query)}&page=${page}`).then((value)=>{if(active)setData(value);}).catch((failure)=>{if(active)setError(errorMessage(failure));});return()=>{active=false;};},[query,page,revision]);
 return <section><h2>Bestellingen en aanvragen</h2><label>Zoek op naam of referentie<input value={query} onChange={(event)=>{setPage(0);setQuery(event.target.value);}} /></label>{error&&<p role="alert">{error}</p>}
  <div className="admin-table-scroll"><table><thead><tr><th>Referentie</th><th>Klant</th><th>Status</th><th>Betaling</th><th>Afgesproken totaal</th><th>Details</th></tr></thead><tbody>{data?.orders.map((order)=><tr key={order.id}><td>{order.reference}</td><td>{order.customer_name}</td><td>{workflowLabels[order.workflow_status]}</td><td>{paymentLabels[order.payment_status]}</td><td>{order.total_cents===null?'Nog niet afgesproken':money(order.total_cents)}</td><td><button onClick={()=>select(order.id)} aria-label={`Open ${order.reference}`}>Openen</button></td></tr>)}</tbody></table></div>
  {data&&!data.orders.length&&<p>Geen resultaten.</p>}<div className="admin-actions"><button disabled={!page} onClick={()=>setPage(page-1)}>Vorige</button><span>Pagina {page+1} · {data?.total??0} records</span><button disabled={!data||(page+1)*50>=data.total} onClick={()=>setPage(page+1)}>Volgende</button></div>
 </section>;
}
function OrderEditor({id,back,changed,readOnly=false}:{id:string;back:()=>void;changed:()=>void;readOnly?:boolean}){
 const [detail,setDetail]=useState<OrderDetail>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setDetail(await adminApi<OrderDetail>(`orders/${id}`));}catch(failure){setError(errorMessage(failure));}}
 useEffect(()=>{void load();},[id]);
 async function save(event:FormEvent<HTMLFormElement>,payment=false){
  event.preventDefault();if(!detail||busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');
  try{
   const payload=payment?{version:detail.order.version,amountPaidCents:euroInput(form.get('paid')),amountRefundedCents:euroInput(form.get('refunded')),method:String(form.get('method'))}:
    {version:detail.order.version,status:form.get('status'),internalNotes:form.get('notes'),confirmedArrangements:form.get('arrangements'),confirmationEvidence:form.get('evidence'),deliveryCents:!form.has('delivery')?detail.order.delivery_cents:form.get('delivery')===''?null:euroInput(form.get('delivery')),durableProvidedAt:form.get('durableAt')?new Date(String(form.get('durableAt'))).toISOString():''};
   setDetail(await adminApi<OrderDetail>(`orders/${id}${payment?'/payment':''}`,payload));changed();
  }catch(failure){setError(errorMessage(failure));}finally{setBusy(false);}
 }
 if(!detail)return <p role="status">{error||'Aanvraag laden…'}</p>;
 const {order,items}=detail;
 return <section><button onClick={back}>Terug naar overzicht</button><h2>{order.reference}</h2>{error&&<p role="alert" className="notice">{error} <button onClick={load}>Record vernieuwen</button></p>}
  <p>{order.customer_name} · {order.email}{order.phone&&` · ${order.phone}`}</p><p>Voorkeur: {order.arrangement==='pickup'?'Afhaling':'Levering'} · {order.requested_date||'geen voorkeursdatum'}</p><p>Klantopmerking: {order.notes||'Geen'}</p><p>Contract: {order.contract_status==='confirmed'?'Bevestigd (lokale registratie)':'Geen bevestigde overeenkomst'} · Bron: {order.source}</p>
  <ul>{items.map((line)=><li key={line.product_id}>{line.quantity} × {line.product_name}: {money(line.line_total_cents)} · Kostprijs {line.unit_cost_cents===null?'onbekend':money(line.unit_cost_cents)}</li>)}</ul><p>Producttotaal: {money(order.subtotal_cents)}. Afgesproken totaal: {order.total_cents===null?'nog niet afgesproken':money(order.total_cents)}</p>
  <div className="admin-columns"><form key={`order-${order.version}`} onSubmit={(event)=>save(event)}><fieldset disabled={busy||readOnly}><legend>Productie en afspraken</legend>
   <label>Status<select name="status" defaultValue={order.workflow_status}>{Object.entries(workflowLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Interne notities<textarea name="notes" maxLength={2000} defaultValue={order.internal_notes}/></label>
   <label>Bevestigde afhaal- of leverafspraken<textarea name="arrangements" maxLength={1000} defaultValue={order.confirmed_arrangements}/></label>
   {order.workflow_status==='new'&&<><p>Voor de stap Bevestigd: leg alle kosten en afspraken vast en registreer het bewijs van de duurzame bevestiging. Deze test verstuurt die bevestiging niet.</p><label>Leveringskosten EUR<input name="delivery" inputMode="decimal" defaultValue={amount(order.delivery_cents)}/></label><label>Bewijs van duurzame bevestiging<input name="evidence" maxLength={1000} defaultValue={order.confirmation_evidence}/></label><label>Verstrekt op<input name="durableAt" type="datetime-local"/></label></>}
   {order.workflow_status!=='new'&&<input name="evidence" type="hidden" value={order.confirmation_evidence}/>}
   <button className="button button-primary" type="submit">Status en afspraken bewaren</button>
  </fieldset></form>
  <form key={`payment-${order.version}`} onSubmit={(event)=>save(event,true)}><fieldset disabled={busy||readOnly||order.contract_status!=='confirmed'}><legend>Betaling afzonderlijk registreren</legend><p>Status: {paymentLabels[order.payment_status]}. Dit voert geen betaling uit.</p><label>Ontvangen bedrag EUR<input name="paid" inputMode="decimal" required defaultValue={amount(order.amount_paid_cents)}/></label><label>Totaal terugbetaald EUR<input name="refunded" inputMode="decimal" required defaultValue={amount(order.amount_refunded_cents)}/></label><label>Betaalmethode<input name="method" maxLength={80} defaultValue={order.method??''}/></label><button className="button button-primary" type="submit">Betaling registreren</button></fieldset></form></div>
  <h3>Wijzigingshistoriek</h3><AuditRows rows={detail.audit}/>
 </section>;
}
function Products({changed}:{changed:()=>void}){
 const [products,setProducts]=useState<AdminProduct[]>([]),[setting,setSetting]=useState<{paused:boolean;version:number}>(),[error,setError]=useState('');
 const load=async()=>{try{setProducts(await adminApi<AdminProduct[]>('products'));setSetting(await adminApi('settings'));}catch(failure){setError(errorMessage(failure));}};
 useEffect(()=>{void load();},[]);
 async function save(event:FormEvent<HTMLFormElement>,product:AdminProduct){event.preventDefault();const form=new FormData(event.currentTarget);try{await adminApi(`products/${product.id}`,{version:product.version,name:form.get('name'),description:form.get('description'),priceCents:euroInput(form.get('price')),costCents:form.get('cost')===''?null:euroInput(form.get('cost')),productionDays:Number(form.get('days')),paused:form.get('paused')==='on',published:form.get('published')==='on'});setError('');await load();changed();}catch(failure){setError(errorMessage(failure));}}
 return <section><h2>Producten en bestelpauzes</h2>{error&&<p role="alert" className="notice">{error} <button onClick={load}>Vernieuwen</button></p>}<p>Wijzigingen gelden voor de lokale D1-catalogus en nieuwe prijsberekeningen. Bestaande orderprijzen blijven vastgelegd. De openbare productteksten en foto’s komen nog uit de vaste storefrontcatalogus.</p>
  {setting&&<button onClick={async()=>{try{await adminApi('settings',{version:setting.version,paused:!setting.paused});await load();}catch(failure){setError(errorMessage(failure));}}}>{setting.paused?'Aanvragen hervatten':'Alle aanvragen pauzeren'}</button>}
  <div className="admin-product-grid">{products.map((product)=><form key={`${product.id}-${product.version}`} onSubmit={(event)=>save(event,product)}><h3>{product.name}</h3><label>Productnaam<input name="name" required maxLength={100} defaultValue={product.name}/></label><label>Beschrijving<textarea name="description" maxLength={2000} defaultValue={product.description}/></label><label>Verkoopprijs EUR<input name="price" required inputMode="decimal" defaultValue={amount(product.price_cents)}/></label><label>Geschatte kostprijs EUR (leeg = onbekend)<input name="cost" inputMode="decimal" defaultValue={amount(product.cost_cents)}/></label><label>Productietijd in dagen<input name="days" required type="number" min={1} max={365} defaultValue={product.production_days}/></label><label className="admin-check"><input type="checkbox" name="paused" defaultChecked={Boolean(product.orders_paused)}/>Product gepauzeerd</label><label className="admin-check"><input type="checkbox" name="published" defaultChecked={Boolean(product.published)}/>Beschikbaar voor nieuwe aanvragen</label><button className="button button-primary" type="submit">Product bewaren</button></form>)}</div>
 </section>;
}
function Events({changed}:{changed:()=>void}){
 const [products,setProducts]=useState<AdminProduct[]>([]),[events,setEvents]=useState<EventSale[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[formKey,setFormKey]=useState(0),[key,setKey]=useState(()=>crypto.randomUUID());
 async function load(){try{setProducts(await adminApi('products'));setEvents(await adminApi('events'));}catch(failure){setError(errorMessage(failure));}}
 useEffect(()=>{void load();},[]);
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);setBusy(true);try{await adminApi('events',{id:key,name:form.get('name'),date:form.get('date'),notes:form.get('notes'),items:products.filter((p)=>Number(form.get(`qty-${p.id}`))>0).map((p)=>({productId:p.id,quantity:Number(form.get(`qty-${p.id}`)),unitPriceCents:euroInput(form.get(`price-${p.id}`))}))},'POST');setKey(crypto.randomUUID());setFormKey((value)=>value+1);setError('');await load();changed();}catch(failure){setError(errorMessage(failure));}finally{setBusy(false);}}
 return <section><h2>Fysieke marktverkopen</h2><p>Registreer één samenvatting per evenement. Geen klantgegevens nodig. Prijzen en gekende kosten worden vastgelegd; dit voert geen betaling uit.</p>{error&&<p role="alert" className="notice">{error}</p>}
  <form key={formKey} onSubmit={save}><fieldset disabled={busy}><legend>Nieuwe verkoopsamenvatting</legend><label>Evenement<input name="name" required maxLength={120}/></label><label>Verkoopdatum<input name="date" type="date" required defaultValue={now()} max={now()}/></label><label>Interne toelichting<textarea name="notes" maxLength={1000}/></label>
  {products.map((product)=><div className="admin-event-line" key={product.id}><strong>{product.name}</strong><label>Aantal {product.name}<input name={`qty-${product.id}`} type="number" min={0} max={9999} defaultValue="0"/></label><label>Werkelijke stukprijs {product.name} EUR<input name={`price-${product.id}`} inputMode="decimal" defaultValue={amount(product.price_cents)}/></label></div>)}<button className="button button-primary" type="submit">Marktverkoop registreren</button></fieldset></form>
  <h3>Geregistreerde samenvattingen</h3>{events.map((sale)=><article className="admin-event-card" key={sale.id}><h4>{sale.event_name}</h4><p>{sale.event_date} · {money(sale.total_cents)} · {sale.status==='active'?'Actief':'Ongeldig gemaakt'}</p>{sale.status==='active'&&<form onSubmit={async(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);try{await adminApi(`events/${sale.id}/void`,{version:sale.version,reason:form.get('reason')});await load();changed();}catch(failure){setError(errorMessage(failure));}}}><label>Reden voor correctie<input name="reason" required maxLength={1000}/></label><button type="submit">Samenvatting ongeldig maken</button></form>}</article>)}
 </section>;
}
function Reports(){
 const [from,setFrom]=useState(`${now().slice(0,4)}-01-01`),[to,setTo]=useState(now()),[data,setData]=useState<Report>(),[error,setError]=useState('');
 useEffect(()=>{let active=true;setData(undefined);adminApi<Report>(`report?from=${from}&to=${to}`).then((value)=>{if(active){setData(value);setError('');}}).catch((failure)=>{if(active)setError(errorMessage(failure));});return()=>{active=false;};},[from,to]);
 const query=`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
 return <section><h2>Omzet en geschatte winst</h2><div className="admin-actions"><label>Van<input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/></label><label>Tot en met<input type="date" value={to} onChange={(event)=>setTo(event.target.value)}/></label></div>{error&&<p role="alert">{error}</p>}
  <p>Betaalde omzet min geregistreerde terugbetalingen, plus fysieke marktverkopen. Onbevestigde en onbetaalde aanvragen tellen niet mee. Bestelbetalingen volgen de registratiedatum; marktverkopen de evenementdatum. De winstschatting gebruikt alleen geregistreerde productkosten; vervoer, belastingen en overige kosten zijn niet verwerkt. Dit is geen nettowinst of boekhoudkundige jaarrekening.</p>
  {data&&<><dl className="admin-report"><dt>Netto betaalde omzet</dt><dd>{money(data.revenueCents)}</dd><dt>Waarvan bestellingen</dt><dd>{money(data.orderRevenueCents)}</dd><dt>Waarvan marktverkopen</dt><dd>{money(data.eventRevenueCents)}</dd><dt>Gekende geschatte kosten</dt><dd>{money(data.knownCostCents)}</dd><dt>Geschatte winst</dt><dd>{data.estimatedProfitCents===null?'Onbekend door ontbrekende kostprijzen':money(data.estimatedProfitCents)}</dd></dl>{data.unknownCostGroups>0&&<p className="notice">Bij {data.unknownCostGroups} verkoopregistraties ontbreken kostprijzen. Alleen het deel met gekende kosten geeft een geschatte winst van {money(data.knownProfitCents)}. Ontbrekende kosten worden niet als nul gerekend.</p>}</>}
  <div className="admin-actions"><a className="button button-secondary" href={`/api/admin/export?kind=orders&${query}`}>Bestellingen exporteren (CSV)</a><a className="button button-secondary" href={`/api/admin/export?kind=finance&${query}`}>Financieel log exporteren (CSV)</a></div><p>CSV voor Excel: puntkomma’s, decimale komma en UTF-8. Bestel-export bevat persoonsgegevens; deel dit bestand alleen met bevoegde beheerders.</p>
 </section>;
}
function Audit(){const [rows,setRows]=useState<AuditRow[]>([]),[error,setError]=useState('');useEffect(()=>{adminApi<AuditRow[]>('audit').then(setRows).catch((failure)=>setError(errorMessage(failure)));},[]);return <section><h2>Wijzigingslog</h2><p>De laatste 100 order-, product- en financiële wijzigingen, met de geverifieerde beheerder.</p>{error&&<p role="alert">{error}</p>}<AuditRows rows={rows}/></section>;}
function AuditRows({rows}:{rows:AuditRow[]}){return <ul className="admin-audit">{rows.map((row)=><li key={row.id}><strong>{row.action}</strong> · {new Date(row.created_at).toLocaleString('nl-BE',{timeZone:'Europe/Brussels'})}<p>{row.actor_id} · {row.entity_type}</p><details><summary>Wijziging bekijken</summary><p>Voor</p><pre>{row.before_json}</pre><p>Na</p><pre>{row.after_json}</pre></details></li>)}</ul>;}
