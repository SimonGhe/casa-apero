import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = 'http://127.0.0.1:5173';
const directory = new URL('../.wrangler/', import.meta.url);
const savedPath = new URL('demo-receipt.json', directory);
async function api(path, options = {}) {
  const response = await fetch(`${origin}/api/${path}`, { ...options, headers: { Origin: origin, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error?.message ?? 'API error'}`);
  return result;
}
const config = await api('config');
if (!config.localRequests) throw new Error('Local requests are disabled. No data was submitted.');
if (process.argv[2] === 'verify') {
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  const receipt = await api('receipt', { method: 'POST', headers: { Authorization: `Bearer ${saved.token}` } });
  if (receipt.reference !== saved.reference || receipt.subtotalCents !== 3997) throw new Error('Persistence verification failed.');
  console.log(`D1 persistence verified: ${receipt.reference}, 3997 cents, contract=${receipt.contractStatus}`);
} else {
  if (config.turnstileMode !== 'local-mock') throw new Error('CLI demo requires local-mock mode. Use the browser for Siteverify testing.');
  const token = randomBytes(32).toString('hex');
  const key = randomUUID();
  const payload = {
    name: 'Fictieve Demoklant', email: 'demo@example.invalid', phone: '', arrangement: 'pickup', requestedDate: '',
    notes: 'SYNTHETISCHE LOKALE DEMO. Geen echte bestelling; niet produceren.',
    items: [{ productId: 'olive', variantId: 'olive-standard', quantity: 2 }, { productId: 'aperitivo', variantId: 'aperitivo-standard', quantity: 1 }],
    expectedSubtotalCents: 3997, acknowledged: true, testDataOnly: true, receiptToken: token, turnstileToken: 'local-test-token',
  };
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) };
  const first = await api('requests', options);
  const duplicate = await api('requests', options);
  if (first.reference !== duplicate.reference || first.subtotalCents !== 3997 || first.contractStatus !== 'none') throw new Error('Demo assertion failed.');
  await mkdir(directory, { recursive: true });
  await writeFile(savedPath, JSON.stringify({ token, reference: first.reference }), { mode: 0o600 });
  console.log(`Created synthetic request: ${first.reference}`);
  console.log('2 × Olive + 1 × Aperitivo = 3997 euro cents; delivery and final total unset.');
  console.log('Duplicate submission returned the same reference. No purchase, payment or email.');
  console.log(`Local receipt capability saved in ignored ${fileURLToPath(savedPath)} (do not share).`);
  console.log('Restart pnpm dev, then run pnpm demo:verify to check persistence.');
}
