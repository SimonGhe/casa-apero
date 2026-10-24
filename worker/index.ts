import type { Quote, QuoteLine, Receipt, RequestInput, Selection } from '../shared/orders';
import { ApiError, validateRequest, validateSelection } from './validation';
import { isLoopback, verifyTurnstile } from './turnstile';
import type { TurnstileEnv } from './turnstile';
import {readCatalogue} from './catalogue';

export interface Env extends TurnstileEnv { DB?: D1Database; ASSETS?: Fetcher }
const LEGAL_VERSION = 'concept-0.1-2026-10-24';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function body(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError(415, 'json_required', 'Verstuur JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_json', 'Lege aanvraag.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new ApiError(413, 'too_large', 'Aanvraag te groot.'); }
    chunks.push(value);
  }
  try { return JSON.parse(new TextDecoder().decode(await new Blob(chunks).arrayBuffer())); }
  catch { throw new ApiError(400, 'invalid_json', 'Ongeldige JSON.'); }
}
async function rateLimit(db: D1Database, request: Request) {
  const minute = Math.floor(Date.now() / 60000);
  // Loopback only: never trust a client-supplied IP header as identity.
  const bucket = `${minute}:${new URL(request.url).hostname}`;
  const result = await db.prepare(`INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(bucket, (minute + 2) * 60000).first<{ attempts: number }>();
  if (!result || result.attempts > 120) throw new ApiError(429, 'rate_limited', 'Te veel aanvragen. Probeer over een minuut opnieuw.');
  await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
}
type ProductRow = { id: string; variant_id: string; name: string; price_cents: number; production_days: number; orders_paused: number; published: number };
async function quote(db: D1Database, items: Selection[]): Promise<Quote> {
  const paused = await db.prepare("SELECT value FROM application_settings WHERE key='orders_paused'").first<{ value: string }>();
  if (paused?.value !== 'false') throw new ApiError(409, 'orders_paused', 'Aanvragen zijn tijdelijk gepauzeerd.');
  const rows = await db.prepare('SELECT id, variant_id, name, price_cents, production_days, orders_paused, published FROM products').all<ProductRow>();
  const lines: QuoteLine[] = items.map((item) => {
    const product = rows.results.find((entry) => entry.id === item.productId && entry.variant_id === item.variantId && entry.published);
    if (!product) throw new ApiError(400, 'unknown_product', 'Een product is niet beschikbaar. Pas je winkelmand aan.');
    if (product.orders_paused) throw new ApiError(409, 'product_paused', 'Een product is tijdelijk gepauzeerd.');
    return { ...item, name: product.name, unitPriceCents: product.price_cents, totalCents: product.price_cents * item.quantity, productionDays: product.production_days };
  });
  return { items: lines, subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0), deliveryCents: null, totalCents: null };
}
async function receipt(db: D1Database, id: string): Promise<Receipt> {
  const order = await db.prepare('SELECT reference, subtotal_cents, created_at FROM orders WHERE id=?').bind(id).first<{ reference: string; subtotal_cents: number; created_at: string }>();
  if (!order) throw new ApiError(404, 'not_found', 'Ontvangstbewijs niet gevonden.');
  const lines = await db.prepare(`SELECT product_id AS productId, variant_id AS variantId, product_name AS name,
    quantity, unit_price_cents AS unitPriceCents, line_total_cents AS totalCents, production_days AS productionDays
    FROM order_items WHERE order_id=? ORDER BY product_id`).bind(id).all<QuoteLine>();
  return { reference: order.reference, items: lines.results, subtotalCents: order.subtotal_cents,
    deliveryCents: null, totalCents: null, requestStatus: 'received', contractStatus: 'none', createdAt: order.created_at };
}
async function existing(db: D1Database, key: string, hash: string): Promise<Response | null> {
  const row = await db.prepare('SELECT request_hash, order_id FROM idempotency_keys WHERE key=?').bind(key).first<{ request_hash: string; order_id: string }>();
  if (!row) return null;
  if (row.request_hash !== hash) throw new ApiError(409, 'idempotency_conflict', 'Deze verzendcode hoort bij andere gegevens. Start een nieuwe aanvraag.');
  return json(await receipt(db, row.order_id));
}
async function createOrder(db: D1Database, input: RequestInput, key: string, hash: string) {
  const id = crypto.randomUUID();
  const reference = `TEST-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const selection = JSON.stringify(input.items);
  // Insert and all snapshots are one D1 transaction. The guarded INSERT rechecks
  // availability and authoritative pricing inside that same transaction.
  const statement = db.prepare(`INSERT INTO orders
    (id,reference,receipt_token_hash,customer_name,email,phone,arrangement,requested_date,notes,subtotal_cents,legal_version,acknowledgement_at)
    SELECT ?,?,?,?,?,?,?,?,?,SUM(p.price_cents * json_extract(j.value,'$.quantity')),?,?
    FROM json_each(?) j JOIN products p ON p.id=json_extract(j.value,'$.productId') AND p.variant_id=json_extract(j.value,'$.variantId')
    WHERE p.published=1 AND p.orders_paused=0 AND (SELECT value FROM application_settings WHERE key='orders_paused')='false'
    HAVING COUNT(*)=? AND SUM(p.price_cents * json_extract(j.value,'$.quantity'))=?`)
    .bind(id, reference, await digest(input.receiptToken), input.name, input.email, input.phone || null,
      input.arrangement, input.requestedDate || null, input.notes || null, LEGAL_VERSION, new Date().toISOString(), selection, input.items.length, input.expectedSubtotalCents);
  try {
    await db.batch([
      statement,
      db.prepare(`INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days,unit_cost_cents)
        SELECT ?,p.id,p.variant_id,p.name,json_extract(j.value,'$.quantity'),p.price_cents,p.price_cents*json_extract(j.value,'$.quantity'),p.production_days,p.cost_cents
        FROM json_each(?) j JOIN products p ON p.id=json_extract(j.value,'$.productId')`).bind(id, selection),
      db.prepare("INSERT INTO order_status_history(order_id,category,to_status,actor_id) VALUES (?,'request','received','local-test-customer')").bind(id),
      db.prepare('INSERT INTO payment_status(order_id) VALUES (?)').bind(id),
      db.prepare('INSERT INTO idempotency_keys(key,request_hash,order_id) VALUES (?,?,?)').bind(key, hash, id),
    ]);
  } catch (error) {
    const duplicate = await existing(db, key, hash);
    if (duplicate) return duplicate;
    // Resolve a price/pause race as a conflict, not a success. Other database
    // failures propagate to the generic 503 handler without leaking SQL or PII.
    const current = await quote(db, input.items);
    if (current.subtotalCents !== input.expectedSubtotalCents) throw new ApiError(409, 'price_changed', 'De prijs is gewijzigd. Vernieuw het overzicht.');
    throw error;
  }
  return json(await receipt(db, id), 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response(null, { status: 404 });
    try {
      const local = env.APP_ENV === 'local' && isLoopback(url.hostname) && Boolean(env.DB);
      if (url.pathname === '/api/config' && request.method === 'GET') return json({ localRequests: local, ...(local ? { turnstileMode: env.TURNSTILE_MODE, siteKey: env.TURNSTILE_SITE_KEY } : {}) });
      if (!local || !env.DB) throw new ApiError(403, 'checkout_disabled', 'Aanvragen zijn alleen lokaal met fictieve gegevens beschikbaar.');
      const db = env.DB;
      if(url.pathname==='/api/catalogue'&&request.method==='GET')return json(await readCatalogue(db));
      if (request.method === 'POST') {
        if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'origin_rejected', 'Ongeldige herkomst.');
        await rateLimit(db, request);
      }
      if (url.pathname === '/api/products' && request.method === 'GET') {
        const products = await db.prepare('SELECT id, variant_id, name, price_cents, production_days, orders_paused FROM products WHERE published=1').all();
        return json({ products: products.results });
      }
      if (url.pathname === '/api/quote' && request.method === 'POST') {
        const input = await body(request) as { items?: unknown } | null;
        return json(await quote(db, validateSelection(input?.items)));
      }
      if (url.pathname === '/api/requests' && request.method === 'POST') {
        const raw = await body(request) as Record<string, unknown>;
        const input = validateRequest(raw);
        const key = request.headers.get('Idempotency-Key') ?? '';
        if (!/^[a-f0-9-]{36}$/.test(key)) throw new ApiError(400, 'invalid_key', 'Verzendcode ontbreekt.');
        const hash = await digest(JSON.stringify(input));
        const duplicate = await existing(db, key, hash);
        if (duplicate) return duplicate;
        const pricing = await quote(db, input.items);
        if (pricing.subtotalCents !== input.expectedSubtotalCents) throw new ApiError(409, 'price_changed', 'De prijs is gewijzigd. Vernieuw het overzicht.');
        await verifyTurnstile(typeof raw.turnstileToken === 'string' ? raw.turnstileToken : '', env, url.hostname);
        return await createOrder(db, input, key, hash);
      }
      if (url.pathname === '/api/receipt' && request.method === 'POST') {
        const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
        if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(404, 'not_found', 'Ontvangstbewijs niet gevonden.');
        const row = await db.prepare('SELECT id FROM orders WHERE receipt_token_hash=?').bind(await digest(token)).first<{ id: string }>();
        if (!row) throw new ApiError(404, 'not_found', 'Ontvangstbewijs niet gevonden.');
        return json(await receipt(db, row.id));
      }
      throw new ApiError(404, 'not_found', 'API-route niet gevonden.');
    } catch (error) {
      if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
      return json({ error: { code: 'service_unavailable', message: 'De aanvraag kon niet worden verwerkt. Bewaar je selectie en probeer opnieuw met dezelfde verzendcode.' } }, 503);
    }
  },
};
