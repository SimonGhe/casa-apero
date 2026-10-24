import {randomBytes,randomUUID} from 'node:crypto';
const admin='http://127.0.0.1:5180',shop='http://127.0.0.1:5173';
const login=await fetch(`${admin}/api/admin/local-login`,{method:'POST',headers:{Origin:admin}});
if(login.status!==204)throw new Error('Start pnpm dev:admin; alleen lokale sessies worden gebruikt.');
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,body,method=body===undefined?'GET':'PUT'){
 const response=await fetch(`${admin}/api/admin/${path}`,{method,headers:{Cookie:cookie,Origin:admin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();if(!response.ok)throw new Error(value.error?.message??'API error');return value;
}
const configuration=await fetch(`${shop}/api/config`).then(r=>r.json());
if(!configuration.localRequests)throw new Error('Start ook pnpm dev op 127.0.0.1:5173. Geen data verstuurd.');
for(const [name,status,paid] of [['Fictief Nieuw','new',false],['Fictief Productie','in_production',false],['Fictief Afgerond','completed',true]]){
 const response=await fetch(`${shop}/api/requests`,{method:'POST',headers:{Origin:shop,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({name,email:'demo@example.invalid',phone:'',arrangement:'pickup',requestedDate:'',notes:'FICTIEVE ADMINDEMO — niet uitvoeren.',items:[{productId:'olive',variantId:'olive-standard',quantity:1}],expectedSubtotalCents:699,acknowledged:true,testDataOnly:true,receiptToken:randomBytes(32).toString('hex'),turnstileToken:'local-test-token'})});
 const receipt=await response.json();if(!response.ok)throw new Error(receipt.error?.message??'Aanvraag mislukt');
 const list=await api(`orders?q=${encodeURIComponent(receipt.reference)}`);let detail=await api(`orders/${list.orders[0].id}`);
 if(status!=='new'){
  for(const next of ['confirmed','in_production',...(status==='completed'?['ready','completed']:[])]){
   detail=await api(`orders/${detail.order.id}`,{version:detail.order.version,status:next,internalNotes:'Fictieve demonstratie',confirmedArrangements:'TEST: afhalen in Brugge op afspraak, geen echte afspraak.',confirmationEvidence:'Fictief bewijs voor lokale demo, geen klantbevestiging verstuurd.',durableProvidedAt:new Date().toISOString(),deliveryCents:0});
  }
 }
 if(paid)detail=await api(`orders/${detail.order.id}/payment`,{version:detail.order.version,amountPaidCents:699,amountRefundedCents:0,method:'Fictief contant'});
 console.log(`${detail.order.reference}: ${detail.order.workflow_status}, ${detail.order.payment_status}`);
}
console.log('Fictieve demogegevens aangemaakt. Open http://127.0.0.1:5180. Geen kosten of prijzen verzonnen.');
