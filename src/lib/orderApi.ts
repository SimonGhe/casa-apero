import type { LocalConfig, Quote, Receipt, RequestInput, Selection } from '../../shared/orders';

export class OrderApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...init, cache: 'no-store' }); }
  catch { throw new Error('Geen verbinding. Je selectie is bewaard. Probeer opnieuw.'); }
  let result: T & { error?: { code: string; message: string } };
  try { result = await response.json(); }
  catch { throw new Error('Ongeldig antwoord van de server. Probeer opnieuw.'); }
  if (!response.ok) throw new OrderApiError(response.status, result.error?.code ?? 'unknown', result.error?.message ?? 'De aanvraag kon niet worden verwerkt.');
  return result;
}
const post = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const getLocalConfig = () => api<LocalConfig>('/api/config');
export const getQuote = (items: Selection[]) => api<Quote>('/api/quote', post({ items }));
export const sendRequest = (input: RequestInput, key: string, turnstileToken: string) => api<Receipt>('/api/requests', {
  ...post({ ...input, turnstileToken }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
});
export const getReceipt = (token: string) => api<Receipt>('/api/receipt', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
export const RECEIPT_SESSION_KEY = 'casa-apero.local-receipt';
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
