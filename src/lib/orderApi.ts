import type { LocalConfig, Quote, Receipt, RequestInput, Selection } from '../../shared/orders';
import {TEST_CHECKOUT_API} from '../../shared/testCheckout';

export class OrderApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
  try { response = await fetch(path, { ...init, credentials:'same-origin',cache: 'no-store',signal:controller.signal }); }
  catch { throw new Error('Geen verbinding. Je selectie is bewaard. Probeer opnieuw.'); }
  let result: T & { error?: { code: string; message: string } };
  try { result = await response.json(); }
  catch { throw new Error('Ongeldig antwoord van de server. Probeer opnieuw.'); }
  if (!response.ok) throw new OrderApiError(response.status, result.error?.code ?? 'unknown', result.error?.message ?? 'De aanvraag kon niet worden verwerkt.');
  return result;
  }finally{clearTimeout(timer);}
}
const post = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export function authenticatedTestApi(){
 return {
  config:()=>api<LocalConfig>(TEST_CHECKOUT_API+'/config'),
  quote:(items:Selection[])=>api<Quote>(TEST_CHECKOUT_API+'/quote',post({items})),
  send:(input:RequestInput,key:string,turnstileToken:string)=>api<Receipt>(TEST_CHECKOUT_API+'/requests',{...post({...input,turnstileToken}),headers:{'Content-Type':'application/json','Idempotency-Key':key}}),
  receipt:(token:string)=>api<Receipt>(TEST_CHECKOUT_API+'/receipt',{method:'POST',headers:{Authorization:`Bearer ${token}`}}),
 };
}
export const getLocalConfig = () => api<LocalConfig>('/api/config');
export const getQuote = (items: Selection[]) => api<Quote>('/api/quote', post({ items }));
export const sendRequest = (input: RequestInput, key: string, turnstileToken: string) => api<Receipt>('/api/requests', {
  ...post({ ...input, turnstileToken }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
});
const pendingReceipts=new Map<string,Promise<Receipt>>();
export function getReceipt(token:string):Promise<Receipt>{
  const pending=pendingReceipts.get(token);if(pending)return pending;
  const response=api<Receipt>('/api/receipt',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
  pendingReceipts.set(token,response);response.then(()=>pendingReceipts.delete(token),()=>pendingReceipts.delete(token));return response;
}
export const RECEIPT_SESSION_KEY = 'casa-apero.local-receipt';
export const ATTEMPT_SESSION_KEY = 'casa-apero.local-attempt';
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
