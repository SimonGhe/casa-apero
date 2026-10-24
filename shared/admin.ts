export const workflowLabels = { new: 'Nieuw', confirmed: 'Bevestigd', in_production: 'In productie', ready: 'Klaar voor afhaling', completed: 'Afgerond', cancelled: 'Geannuleerd' } as const;
export type Workflow = keyof typeof workflowLabels;
export const workflowTransitions:Record<Workflow,readonly Workflow[]> = { new:['confirmed','cancelled'],confirmed:['in_production','cancelled'],in_production:['ready','cancelled'],ready:['completed','cancelled'],completed:[],cancelled:[] };
export const paymentLabels = { unpaid: 'Onbetaald', paid: 'Betaald', partially_refunded: 'Deels terugbetaald', refunded: 'Terugbetaald' } as const;
export type PaymentState = keyof typeof paymentLabels;
export type AdminOrder = {
 id: string; reference: string; customer_name: string; email: string; phone: string | null; arrangement: string;
 requested_date: string | null; notes: string | null; internal_notes: string; confirmed_arrangements: string; confirmation_evidence: string;
 workflow_status: Workflow; contract_status: string; source: string; subtotal_cents: number; delivery_cents: number | null;
 total_cents: number | null; version: number; created_at: string; payment_status: PaymentState;
 amount_paid_cents: number; amount_refunded_cents: number; method: string | null;
};
export type AdminItem = { product_id: string; product_name: string; quantity: number; unit_price_cents: number; line_total_cents: number; unit_cost_cents: number | null };
export type AuditRow = { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; before_json: string; after_json: string; created_at: string };
export type OrderDetail = { order: AdminOrder; items: AdminItem[]; audit: AuditRow[] };
export type AdminProduct = { id: string; name: string; description: string; price_cents: number; cost_cents: number | null; production_days: number; orders_paused: number; published: number; version: number };
export type FinancialEvent = { entity_type: string; entity_id: string; amount_cents: number; cost_cents: number | null; accounting_date: string; category: string };
export type Report = { revenueCents: number; orderRevenueCents: number; eventRevenueCents: number; knownCostCents: number; knownProfitCents: number; estimatedProfitCents: number | null; unknownCostGroups: number; cancelledOutstandingRefundCents?:number };
export type EventSale = { id: string; event_name: string; event_date: string; notes: string; status: string; total_cents: number; cost_cents: number | null; version: number };
