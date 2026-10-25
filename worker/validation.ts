import type { RequestInput, Selection } from '../shared/orders';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function invalid(message: string): never { throw new ApiError(400, 'invalid_input', message); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Ongeldige invoer.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string') invalid('Een tekstveld ontbreekt.');
  const result = value.trim();
  if (result.length > max || (required && !result) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) invalid('Controleer de lengte en inhoud van je gegevens.');
  return result;
}
export function validateSelection(value: unknown): Selection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) invalid('Kies één tot vier producten.');
  const seen = new Set<string>();
  return value.map((entry) => {
    const item = record(entry);
    const productId = text(item.productId, 64, true);
    const variantId = text(item.variantId, 64, true);
    if (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99 || seen.has(productId)) invalid('Controleer de aantallen; elk product mag één keer voorkomen.');
    seen.add(productId);
    return { productId, variantId, quantity: item.quantity as number };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
}
export function validateRequest(value: unknown, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' }),mode:'test'|'public'='test'): RequestInput {
  const input = record(value);
  const name = text(input.name, 100, true);
  const email = text(input.email, 254, true).toLowerCase();
  const phone = text(input.phone ?? '', 40);
  const requestedDate = text(input.requestedDate ?? '', 10);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Vul een naam en geldig e-mailadres in.');
  if (phone && !/^[+\d() .\-]{6,40}$/.test(phone)) invalid('Controleer het telefoonnummer.');
  if (input.arrangement !== 'pickup' && input.arrangement !== 'delivery') invalid('Kies afhaling of levering.');
  if (requestedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !Number.isFinite(Date.parse(requestedDate)) || new Date(requestedDate).toISOString().slice(0, 10) !== requestedDate || requestedDate < today)) invalid('Kies een geldige datum vanaf vandaag.');
  if (input.acknowledged !== true || input.testDataOnly !== (mode==='test')) invalid(mode==='test'?'Bevestig dat dit een vrijblijvende testaanvraag met fictieve gegevens is.':'Bevestig dat je de informatie over je vrijblijvende afhaalaanvraag hebt gelezen.');
  if (!Number.isSafeInteger(input.expectedSubtotalCents) || (input.expectedSubtotalCents as number) < 0) invalid('Vernieuw het prijsoverzicht.');
  if (typeof input.receiptToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.receiptToken)) invalid('Ongeldige ontvangstcode.');
  return { name, email, phone, requestedDate, notes: text(input.notes ?? '', 1000), arrangement: input.arrangement,
    items: validateSelection(input.items), acknowledged: true, testDataOnly: mode==='test',
    expectedSubtotalCents: input.expectedSubtotalCents as number, receiptToken: input.receiptToken };
}
