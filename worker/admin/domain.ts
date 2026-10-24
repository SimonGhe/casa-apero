import type { FinancialEvent, Report, Workflow } from '../../shared/admin';
import { workflowTransitions } from '../../shared/admin';
import { ApiError } from '../validation';
export const fail = (message: string): never => { throw new ApiError(400, 'invalid_admin_input', message); };
export function adminText(value: unknown, max = 2000, required = false): string {
 if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (required && !value.trim())) fail('Controleer de tekstvelden.');
 return (value as string).trim();
}
export function cents(value: unknown, max = 100000000): number {
 if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) fail('Geef een geldig bedrag in eurocenten op.');
 return value as number;
}
export function date(value: unknown): string {
 const input = adminText(value, 10, true);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0,10) !== input) fail('Ongeldige datum.');
 return input;
}
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' });
export function transition(from: Workflow, to: unknown): Workflow {
 if (to !== from && !workflowTransitions[from]?.includes(to as Workflow)) fail('Deze statusovergang is niet toegestaan.');
 return to as Workflow;
}
export function report(events: FinancialEvent[]): Report {
 let revenueCents = 0, orderRevenueCents = 0, eventRevenueCents = 0, knownCostCents = 0, knownRevenue = 0;
 const unknown = new Map<string, {amount:number;zeroWeight:number}>();
 for (const event of events) {
   revenueCents += event.amount_cents;
   if (event.entity_type === 'order') orderRevenueCents += event.amount_cents; else eventRevenueCents += event.amount_cents;
   if (event.cost_cents === null) { const key = `${event.entity_type}/${event.entity_id}`; const previous=unknown.get(key)??{amount:0,zeroWeight:0}; unknown.set(key,{amount:previous.amount+event.amount_cents,zeroWeight:previous.zeroWeight+(event.amount_cents===0?(event.category==='event_void'?-1:1):0)}); }
   else { knownCostCents += event.cost_cents; knownRevenue += event.amount_cents; }
 }
 const unknownCostGroups = [...unknown.values()].filter((value) => value.amount !== 0 || value.zeroWeight !== 0).length;
 return { revenueCents, orderRevenueCents, eventRevenueCents, knownCostCents, knownProfitCents: knownRevenue-knownCostCents,
   estimatedProfitCents: unknownCostGroups ? null : revenueCents-knownCostCents, unknownCostGroups };
}
export function csv(rows: unknown[][]): string {
 const cell = (value: unknown) => {
   const trustedNumber=typeof value==='number'&&Number.isFinite(value);
   let text = value == null ? '' : trustedNumber?String(value).replace('.',','):String(value);
   // Excel interprets formula prefixes even through CSV quotes. Include leading
   // whitespace/control variants and always quote/escape every cell.
   if (!trustedNumber&&(/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
   return `"${text.replaceAll('"','""')}"`;
 };
 return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
