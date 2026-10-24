import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {workflowLabels,workflowTransitions,paymentLabels} from '../../shared/admin';
import type {OrderDetail,Workflow} from '../../shared/admin';
import {adminApi,amount,euroInput} from './api';
import {money} from '../data/catalogue';
import {AuditRows} from './AuditRows';

const steps:Workflow[]=['new','confirmed','in_production','ready','completed'];
const actions:Partial<Record<Workflow,string>>={confirmed:'Bestelling bevestigen',in_production:'Productie starten',ready:'Klaar voor afhaling',completed:'Bestelling afronden'};
const hints:Partial<Record<Workflow,string>>={new:'Spreek met de klant af wat jullie maken en wanneer het klaar zal zijn.',confirmed:'Alles afgesproken? Dan kunnen jullie aan de slag.',in_production:'Helemaal afgewerkt? Zet de bestelling klaar voor de klant.',ready:'De bestelling meegegeven? Dan mag je ze afronden.',completed:'Deze bestelling is afgerond.',cancelled:'Deze bestelling is geannuleerd.'};

export function OrderEditor({id,back,changed,readOnly=false}:{id:string;back:()=>void;changed:()=>void;readOnly?:boolean}){
 const [detail,setDetail]=useState<OrderDetail>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirming,setConfirming]=useState(false),[paying,setPaying]=useState(false),[cancelling,setCancelling]=useState(false);
 const [notesDraft,setNotesDraft]=useState(''),[arrangementsDraft,setArrangementsDraft]=useState('');
 const errorRef=useRef<HTMLDivElement>(null),confirmationRef=useRef<HTMLHeadingElement>(null);
 async function load(){try{const value=await adminApi<OrderDetail>(`orders/${id}`);setDetail(value);setNotesDraft(value.order.internal_notes);setArrangementsDraft(value.order.confirmed_arrangements);setError('');}catch(e){setError(e instanceof Error?e.message:'Laden lukt even niet.');}}
 useEffect(()=>{void load();},[id]);
 useEffect(()=>{if(error){errorRef.current?.focus();errorRef.current?.scrollIntoView({block:'center'});}},[error]);
 useEffect(()=>{if(confirming){confirmationRef.current?.focus();confirmationRef.current?.scrollIntoView({block:'center'});}},[confirming]);
 async function save(body:Record<string,unknown>,payment=false){
  if(!detail||busy||readOnly)return;
  setBusy(true);setError('');setMessage('');
  try{
   const saved=await adminApi<OrderDetail>(`orders/${id}${payment?'/payment':''}`,{...(!payment?{internalNotes:notesDraft,confirmedArrangements:arrangementsDraft}:{}),...body,version:detail.order.version});
   if(!payment){setNotesDraft(saved.order.internal_notes);setArrangementsDraft(saved.order.confirmed_arrangements);}
   setDetail(saved);setConfirming(false);setPaying(false);setCancelling(false);
   setMessage(payment?`Gelukt! Betaling opgeslagen: ${paymentLabels[saved.order.payment_status]}.`:`Gelukt! De bestelling staat op ${workflowLabels[saved.order.workflow_status]}.`);changed();
  }catch(e){setError(e instanceof Error?e.message:'Bewaren lukt even niet. Probeer opnieuw.');}finally{setBusy(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>,kind:'notes'|'confirm'|'payment'|'refund'){
  event.preventDefault();if(!detail||busy||readOnly)return;
  const form=new FormData(event.currentTarget);
  try{
   if(kind==='notes')return await save({status:detail.order.workflow_status,internalNotes:form.get('notes'),confirmedArrangements:form.get('arrangements')});
   if(kind==='confirm')return await save({status:'confirmed',confirmedArrangements:form.get('arrangements'),deliveryCents:euroInput(form.get('delivery')),confirmationEvidence:form.get('evidence'),durableProvidedAt:form.get('durableAt')?new Date(String(form.get('durableAt'))).toISOString():''});
   const {order}=detail;
   const paid=kind==='payment'?euroInput(form.get('paid')):order.amount_paid_cents;
   const refunded=kind==='refund'?order.amount_refunded_cents+euroInput(form.get('refund')):order.amount_refunded_cents;
   if(kind==='refund'&&refunded===order.amount_refunded_cents)throw new Error('Vul een terugbetaling groter dan 0 in.');
   await save({amountPaidCents:paid,amountRefundedCents:refunded,method:form.get('method')},true);
  }catch(e){setMessage('');setError(e instanceof Error?e.message:'Controleer de ingevulde gegevens.');}
 }
 if(!detail)return <p role="status">{error||'Bestelling laden…'}</p>;
 const {order,items}=detail,next=workflowTransitions[order.workflow_status].find(state=>state!=='cancelled');
 const locked=busy||readOnly,remaining=order.amount_paid_cents-order.amount_refunded_cents;
 return <section className="admin-order">
  <button onClick={back}>← Alle bestellingen</button>
  <header className="admin-order-heading"><div><p>Bestelling</p><h2>{order.reference}</h2></div><span className="admin-status-pill">{workflowLabels[order.workflow_status]}</span></header>
  {error&&<div ref={errorRef} tabIndex={-1} role="alert" className="notice"><p>Niet opgeslagen. {error}</p><button onClick={load}>Record vernieuwen</button></div>}
  {message&&<p role="status" className="notice admin-save-success">{message}</p>}
  <ol className="admin-progress" aria-label="Voortgang bestelling">{steps.map((step,index)=><li key={step} aria-current={step===order.workflow_status?'step':undefined} className={order.workflow_status!=='cancelled'&&index<=steps.indexOf(order.workflow_status)?'reached':''}><span>{index+1}</span>{workflowLabels[step]}</li>)}</ol>
  <div className="admin-order-summary"><div><h3>{order.customer_name}</h3><p>{order.email}{order.phone&&` · ${order.phone}`}</p><p>{order.arrangement==='pickup'?'Afhalen':'Leveren'} · {order.requested_date||'Datum nog af te spreken'}</p>{order.notes&&<p>{order.notes}</p>}</div><div><h3>Wat maken we?</h3><ul>{items.map(line=><li key={line.product_id}>{line.quantity} × {line.product_name} <strong>{money(line.line_total_cents)}</strong></li>)}</ul><p>Totaal <strong>{money(order.total_cents??order.subtotal_cents)}</strong>{order.total_cents===null?' · extra kosten nog af te spreken':''}</p></div></div>
  <section className="admin-step-card" aria-label="Volgende stap"><h3>Wat nu?</h3><p>{hints[order.workflow_status]}</p>
   {next&&!confirming&&<button className="button button-primary" disabled={locked} onClick={()=>{setMessage('');if(next==='confirmed')setConfirming(true);else void save({status:next});}}>{actions[next]}</button>}
   {confirming&&<form onSubmit={event=>void submit(event,'confirm')}><fieldset disabled={locked}><h3 ref={confirmationRef} tabIndex={-1}>Samen de afspraken vastleggen</h3><p>Controleer deze afspraken met de klant. Bewaar pas nadat je de bevestiging hebt gedeeld. In deze test gebruik je uitsluitend fictieve gegevens.</p>
    <label>Wat spreken jullie af over afhalen of leveren?<textarea name="arrangements" required maxLength={1000} value={arrangementsDraft} onChange={event=>setArrangementsDraft(event.target.value)}/></label>
    <label>Extra afhaal- of leveringskosten EUR<input name="delivery" required inputMode="decimal" defaultValue={amount(order.delivery_cents)}/></label><p>Geen extra kosten? Vul 0 in.</p>
    <fieldset className="admin-confirmation"><legend>Bevestiging voor de klant</legend><p>De klant moet de afspraken kunnen bewaren, bijvoorbeeld in een e-mail of PDF. Dit scherm verstuurt niets.</p>
     <label>Hoe heb je de afspraken gedeeld?<input name="evidence" required maxLength={1000} defaultValue={order.confirmation_evidence}/></label>
     <label>Wanneer heb je ze gedeeld?<input name="durableAt" required type="datetime-local"/></label>
    </fieldset><div className="admin-actions"><button className="button button-primary" type="submit">Bevestiging bewaren</button><button type="button" onClick={()=>setConfirming(false)}>Terug</button></div>
   </fieldset></form>}
  </section>
  <div className="admin-columns">
   <form key={`notes-${order.version}`} className="admin-order-card" onSubmit={event=>void submit(event,'notes')}><fieldset disabled={locked}><legend>Afspraken en notities</legend><label>Afhalen of leveren<textarea name="arrangements" maxLength={1000} value={arrangementsDraft} onChange={event=>setArrangementsDraft(event.target.value)}/></label><label>Notitie voor het team<textarea name="notes" maxLength={2000} value={notesDraft} onChange={event=>setNotesDraft(event.target.value)}/></label><button type="submit">Afspraken bewaren</button></fieldset></form>
   <section className="admin-order-card" aria-label="Betaling"><h3>Betaling</h3><p>{paymentLabels[order.payment_status]} · ontvangen {money(order.amount_paid_cents)}{order.amount_refunded_cents>0&&` · terugbetaald ${money(order.amount_refunded_cents)}`}</p><p>Registreer hier wat je al hebt ontvangen. Dit voert geen betaling uit.</p>
    {order.contract_status!=='confirmed'?<p>Bevestig eerst de bestelling. Daarna kun je de betaling bijhouden.</p>:order.amount_paid_cents===0&&order.workflow_status!=='cancelled'&&!paying&&<button disabled={locked} onClick={()=>setPaying(true)}>Betaling ontvangen</button>}
    {paying&&<form key={`pay-${order.version}`} onSubmit={event=>void submit(event,'payment')}><fieldset disabled={locked}><label>Ontvangen bedrag EUR<input name="paid" required inputMode="decimal" defaultValue={amount(order.total_cents)}/></label><label>Hoe is er betaald?<input name="method" required maxLength={80} placeholder="Bijvoorbeeld contant of overschrijving"/></label><div className="admin-actions"><button type="submit">Betaling bewaren</button><button type="button" onClick={()=>setPaying(false)}>Terug</button></div></fieldset></form>}
   </section>
  </div>
  <details className="admin-more-options"><summary>Meer opties</summary>
   {remaining>0&&<form key={`refund-${order.version}`} onSubmit={event=>void submit(event,'refund')}><fieldset disabled={locked}><legend>Terugbetaling registreren</legend><p>Er kan nog {money(remaining)} worden terugbetaald. Registreer alleen geld dat je al hebt teruggegeven.</p><label>Bedrag terugbetaling EUR<input name="refund" required inputMode="decimal"/></label><label>Hoe is er terugbetaald?<input name="method" required maxLength={80} defaultValue={order.method??''}/></label><button type="submit">Terugbetaling bewaren</button></fieldset></form>}
   {workflowTransitions[order.workflow_status].includes('cancelled')&&<div><h3>Bestelling annuleren</h3>{!cancelling?<button disabled={locked} onClick={()=>setCancelling(true)}>Annuleren…</button>:<div><p>Wil je deze bestelling annuleren? Ontvangen geld wordt hiermee niet automatisch terugbetaald.</p><div className="admin-actions"><button disabled={locked} onClick={()=>void save({status:'cancelled'})}>Ja, bestelling annuleren</button><button disabled={locked} onClick={()=>setCancelling(false)}>Toch behouden</button></div></div>}</div>}
   <details><summary>Bevestiging en kostprijzen bekijken</summary><p>Bevestiging: {order.confirmation_evidence||'Nog niet vastgelegd'}</p><p>Bron: {order.source} · Producttotaal: {money(order.subtotal_cents)}</p><ul>{items.map(line=><li key={line.product_id}>{line.product_name} · geschatte kostprijs {line.unit_cost_cents===null?'onbekend':money(line.unit_cost_cents)}</li>)}</ul></details>
   <details><summary>Wijzigingshistoriek</summary><AuditRows rows={detail.audit}/></details>
  </details>
 </section>;
}
