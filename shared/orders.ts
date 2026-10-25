export type Selection = { productId: string; variantId: string; quantity: number };
export type RequestInput = {
  name: string; email: string; phone: string; arrangement: 'pickup' | 'delivery';
  requestedDate: string; notes: string; items: Selection[];
  acknowledged: true; testDataOnly: boolean; expectedSubtotalCents: number; receiptToken: string;
};
export type QuoteLine = Selection & { name: string; unitPriceCents: number; totalCents: number; productionDays: number };
export type Quote = { items: QuoteLine[]; subtotalCents: number; deliveryCents: null; totalCents: null };
export type Receipt = Quote & { reference: string; requestStatus: 'received'; contractStatus: 'none'; createdAt: string };
export type LocalConfig = { localRequests: boolean; authenticatedTest?:boolean; publicRequests?:boolean; turnstileMode?: string; siteKey?: string };
