import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import worker from '../../worker/index';
import type { Env } from '../../worker/index';
import { verifyTurnstile } from '../../worker/turnstile';
import { validateRequest } from '../../worker/validation';

let mf: Miniflare;
let env: Env;
const origin = 'http://127.0.0.1:5173';
function input() {
  return { name: 'Test Klant', email: 'test@example.invalid', phone: '', arrangement: 'pickup', requestedDate: '', notes: '',
    items: [{ productId: 'olive', variantId: 'olive-standard', quantity: 2 }], expectedSubtotalCents: 1398,
    acknowledged: true, testDataOnly: true, receiptToken: 'a'.repeat(64), turnstileToken: 'local-test-token' };
}
function call(path: string, value?: unknown, key = crypto.randomUUID(), extraHeaders = {}, overrides = {}) {
  return worker.fetch(new Request(`${origin}/api/${path}`, {
    method: value === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key, ...extraHeaders },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  }), { ...env, ...overrides });
}
beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'test', modules: true, script: 'export default { fetch() { return new Response("test"); } }', compatibilityDate: '2026-10-24', d1Databases: ['DB'] }] }));
  const db = await mf.getD1Database('DB');
  for (const migration of ['0001_schema.sql', '0002_catalogue.sql']) {
    const sql = await readFile(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8');
    // D1 exec requires one statement per line.
    await db.exec(sql.replaceAll('\n', ' '));
  }
  env = { DB: db as unknown as D1Database, APP_ENV: 'local', TURNSTILE_MODE: 'local-mock' };
});
beforeEach(async () => {
  await env.DB!.exec("DELETE FROM orders; DELETE FROM rate_limits; UPDATE products SET orders_paused=0, price_cents=CASE id WHEN 'olive' THEN 699 WHEN 'dune-mini' THEN 699 WHEN 'dune-grand' THEN 1299 ELSE 2599 END; UPDATE application_settings SET value='false' WHERE key='orders_paused';");
});
afterAll(async () => { await mf?.dispose(); });

describe('local Worker with actual simulated D1', () => {
  it('creates a non-binding request with authoritative snapshots, history and unpaid status', async () => {
    const response = await call('requests', { ...input(), priceCents: 1, totalCents: 1 });
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result).toMatchObject({ subtotalCents: 1398, deliveryCents: null, totalCents: null, contractStatus: 'none', requestStatus: 'received' });
    expect(JSON.stringify(result)).not.toContain('test@example.invalid');
    const row = await env.DB!.prepare('SELECT o.contract_status, o.source, i.unit_price_cents, p.status, h.to_status FROM orders o JOIN order_items i ON i.order_id=o.id JOIN payment_status p ON p.order_id=o.id JOIN order_status_history h ON h.order_id=o.id').first();
    expect(row).toMatchObject({ contract_status: 'none', source: 'local_test', unit_price_cents: 699, status: 'unpaid', to_status: 'received' });
  });
  it('prices all four official products and rejects unknown IDs, variants and duplicate lines', async () => {
    const result = await call('products');
    const catalogue = await result.json() as { products: { id: string; price_cents: number }[] };
    expect(catalogue.products.map((p) => p.price_cents)).toEqual([699, 699, 1299, 2599]);
    for (const items of [[{ ...input().items[0], productId: 'unknown' }], [{ ...input().items[0], variantId: 'unknown' }], [...input().items, ...input().items]]) {
      expect((await call('requests', { ...input(), items })).status).toBe(400);
    }
  });
  it('rejects invalid customer data, quantities, dates and missing acknowledgements', async () => {
    for (const patch of [{ name: '' }, { email: 'wrong' }, { phone: 'abc' }, { notes: 'x'.repeat(1001) }, { requestedDate: '2028-02-30' }, { requestedDate: '2020-01-01' }, { acknowledged: false }, { testDataOnly: false }, { items: [{ ...input().items[0], quantity: 1.5 }] }, { items: [{ ...input().items[0], quantity: 100 }] }, { receiptToken: 'short' }]) {
      expect((await call('requests', { ...input(), ...patch })).status, JSON.stringify(patch)).toBe(400);
    }
    expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM orders').first('count')).toBe(0);
  });
  it('respects global and product pauses', async () => {
    await env.DB!.exec("UPDATE application_settings SET value='true' WHERE key='orders_paused';");
    expect((await call('requests', input())).status).toBe(409);
    await env.DB!.exec("UPDATE application_settings SET value='false'; UPDATE products SET orders_paused=1 WHERE id='olive';");
    expect((await call('requests', input())).status).toBe(409);
    expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM orders').first('count')).toBe(0);
  });
  it('rechecks a pause introduced after pricing but before the atomic write', async () => {
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await env.DB!.exec("UPDATE products SET orders_paused=1 WHERE id='olive';");
      return Response.json({ success: true, hostname: '127.0.0.1', action: 'order-request' });
    });
    try {
      const response = await call('requests', input(), undefined, {}, { TURNSTILE_MODE: 'siteverify', TURNSTILE_SECRET_KEY: 'test-secret' });
      expect(response.status).toBe(409);
      expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM orders').first('count')).toBe(0);
    } finally { transport.mockRestore(); }
  });
  it('returns the same receipt on retries and concurrent duplicate submissions, conflicts on changed payloads', async () => {
    const key = crypto.randomUUID();
    const results = await Promise.all([call('requests', input(), key), call('requests', input(), key)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await results[0].json()).toEqual(await results[1].json());
    expect((await call('requests', { ...input(), notes: 'changed' }, key)).status).toBe(409);
    expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM orders').first('count')).toBe(1);
  });
  it('rejects a price change during submission and preserves the subsequently accepted snapshot',async()=>{
    const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{await env.DB!.exec("UPDATE products SET price_cents=799 WHERE id='olive';");return Response.json({success:true,hostname:'127.0.0.1',action:'order-request'});});
    const settings={TURNSTILE_MODE:'siteverify',TURNSTILE_SECRET_KEY:'test-secret'},key=crypto.randomUUID();
    try{
      const conflict=await call('requests',input(),key,{},settings);expect(conflict.status).toBe(409);expect(await conflict.json()).toMatchObject({error:{code:'price_changed'}});
      expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM orders').first('n')).toBe(0);
      expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM idempotency_keys').first('n')).toBe(0);
      expect((await call('requests',{...input(),expectedSubtotalCents:1598},key,{},settings)).status).toBe(201);
      await env.DB!.exec("UPDATE products SET price_cents=899 WHERE id='olive';");
      const response=await call('receipt',{},undefined,{Authorization:`Bearer ${input().receiptToken}`});expect(await response.json()).toMatchObject({subtotalCents:1598,items:[{unitPriceCents:799}]});
    }finally{transport.mockRestore();}
  });
  it('requires a receipt capability and never exposes customer or admin endpoints', async () => {
    await call('requests', input());
    expect((await call('receipt', {})).status).toBe(404);
    const response = await call('receipt', {}, crypto.randomUUID(), { Authorization: `Bearer ${'a'.repeat(64)}` });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toContain('Test Klant');
    expect((await call('orders')).status).toBe(404);
    expect((await call('admin')).status).toBe(404);
  });
  it('rejects stale prices and rolls back every dependent write on a database failure', async () => {
    expect((await call('requests', { ...input(), expectedSubtotalCents: 1 })).status).toBe(409);
    await env.DB!.exec("CREATE TRIGGER test_failure BEFORE INSERT ON payment_status BEGIN SELECT RAISE(ABORT, 'test'); END;");
    try {
      expect((await call('requests', input())).status).toBe(503);
      expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM orders').first('count')).toBe(0);
      expect(await env.DB!.prepare('SELECT COUNT(*) AS count FROM order_items').first('count')).toBe(0);
    } finally { await env.DB!.exec('DROP TRIGGER test_failure;'); }
  });
  it('fails closed outside loopback/local configuration and rejects cross-origin submissions', async () => {
    expect((await call('requests', input(), undefined, {}, { APP_ENV: 'disabled' })).status).toBe(403);
    expect((await worker.fetch(new Request('https://casa-apero.com/api/requests', { method: 'POST' }), env)).status).toBe(403);
    expect((await call('requests', input(), undefined, { Origin: 'https://attacker.invalid' })).status).toBe(403);
    expect((await call('config', undefined, undefined, {}, { APP_ENV: 'disabled' })).status).toBe(200);
  });
  it('handles malformed JSON, oversized payloads and missing Turnstile validation', async () => {
    const response = await worker.fetch(new Request(`${origin}/api/requests`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' }), env);
    expect(response.status).toBe(400);
    expect((await call('requests', { ...input(), notes: 'x'.repeat(20000) })).status).toBe(413);
    expect((await call('requests', { ...input(), turnstileToken: '' })).status).toBe(403);
  });
  it('enforces a database-backed request rate limit', async () => {
    const bucket = `${Math.floor(Date.now() / 60000)}:127.0.0.1`;
    await env.DB!.prepare('INSERT INTO rate_limits VALUES (?,120,?)').bind(bucket, Date.now() + 60000).run();
    expect((await call('quote', { items: input().items })).status).toBe(429);
  });
});

it('persists D1 request snapshots across runtime restart', async () => {
  const path = resolve('.wrangler', 'test-persistence', crypto.randomUUID());
  const options = { workers: [{ name: 'persistent', modules: true, script: 'export default { fetch() { return new Response("test"); } }', compatibilityDate: '2026-10-24', d1Databases: { DB: 'persistence-test' } }], resourcePersistencePath: path };
  let runtime = new Miniflare(convertV4MiniflareOptions(options));
  let db = await runtime.getD1Database('DB');
  let savedReference = '';
  try {
    for (const migration of ['0001_schema.sql', '0002_catalogue.sql']) await db.exec((await readFile(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8')).replaceAll('\n', ' '));
    const testEnv = { ...env, DB: db as unknown as D1Database };
    const response = await worker.fetch(new Request(`${origin}/api/requests`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input()) }), testEnv);
    expect(response.status).toBe(201);
    savedReference = (await response.json() as { reference: string }).reference;
  } finally { await runtime.dispose(); }
  runtime = new Miniflare(convertV4MiniflareOptions(options));
  try {
    db = await runtime.getD1Database('DB');
    expect(await db.prepare('SELECT reference FROM orders').first('reference')).toBe(savedReference);
    expect(await db.prepare('SELECT unit_price_cents FROM order_items').first('unit_price_cents')).toBe(699);
  } finally { await runtime.dispose(); }
}, 20000);

it('normalizes email and strips unknown submitted properties', () => {
  expect(validateRequest({ ...input(), email: ' TEST@EXAMPLE.INVALID ', totalCents: 1 })).toMatchObject({ email: 'test@example.invalid' });
  expect(validateRequest(input())).not.toHaveProperty('turnstileToken');
});

it('validates Turnstile server-side, including hostname, action, failures and unavailable service', async () => {
  const settings = { APP_ENV: 'local', TURNSTILE_MODE: 'siteverify', TURNSTILE_SECRET_KEY: 'test-secret' };
  const success = vi.fn(async () => Response.json({ success: true, hostname: 'localhost', action: 'order-request' })) as unknown as typeof fetch;
  await expect(verifyTurnstile('token', settings, 'localhost', success)).resolves.toBeUndefined();
  for (const response of [{ success: false }, { success: true, hostname: 'wrong', action: 'order-request' }, { success: true, hostname: 'localhost', action: 'wrong' }]) {
    await expect(verifyTurnstile('token', settings, 'localhost', vi.fn(async () => Response.json(response)) as unknown as typeof fetch)).rejects.toMatchObject({ status: 403 });
  }
  await expect(verifyTurnstile('token', settings, 'localhost', vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch)).rejects.toMatchObject({ status: 503 });
  await expect(verifyTurnstile('local-test-token', { APP_ENV: 'disabled', TURNSTILE_MODE: 'local-mock' }, 'localhost')).rejects.toMatchObject({ status: 403 });
  const dummySettings = { APP_ENV: 'local', TURNSTILE_MODE: 'siteverify-test', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
  const dummy = vi.fn(async () => Response.json({ success: true, hostname: 'example.com' })) as unknown as typeof fetch;
  await expect(verifyTurnstile('dummy', dummySettings, 'localhost', dummy)).resolves.toBeUndefined();
  await expect(verifyTurnstile('dummy', { ...dummySettings, APP_ENV: 'disabled' }, 'localhost', dummy)).rejects.toMatchObject({ status: 403 });
  await expect(verifyTurnstile('dummy', dummySettings, 'casa-apero.com', dummy)).rejects.toMatchObject({ status: 403 });
  await expect(verifyTurnstile('dummy', { ...dummySettings, TURNSTILE_SECRET_KEY: 'wrong' }, 'localhost', dummy)).rejects.toMatchObject({ status: 403 });
});
