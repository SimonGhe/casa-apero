import type { Product, ProductVariant } from '../data/catalogue';

export type CartItem = { productId: string; variantId: string; quantity: number };
export type CartLine = CartItem & { product: Product; variant: ProductVariant; totalCents: number };
export const CART_STORAGE_KEY = 'casa-apero.cart.v1';
export const MAX_QUANTITY = 99;

export function quantity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_QUANTITY, Math.max(0, Math.floor(value))) : 0;
}

export function normaliseCart(value: unknown, catalogue: Product[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  const result: CartItem[] = [];
  for (const item of value.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue;
    const product = catalogue.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const count = quantity(item.quantity);
    if (!product || !variant || !count) continue;
    const existing = result.find((line) => line.productId === product.id && line.variantId === variant.id);
    if (existing) existing.quantity = quantity(existing.quantity + count);
    else result.push({ productId: product.id, variantId: variant.id, quantity: count });
  }
  return result;
}

export function parseCart(raw: string | null, catalogue: Product[]): CartItem[] {
  try { return normaliseCart(raw ? JSON.parse(raw) : [], catalogue); }
  catch { return []; }
}

export function resolveCart(items: CartItem[], catalogue: Product[]): CartLine[] {
  return normaliseCart(items, catalogue).map((item) => {
    const product = catalogue.find((p) => p.id === item.productId)!;
    const variant = product.variants.find((v) => v.id === item.variantId)!;
    return { ...item, product, variant, totalCents: variant.priceCents * item.quantity };
  });
}

export function addItem(items: CartItem[], productId: string, variantId: string, count: number, catalogue: Product[], paused = false): CartItem[] {
  const product = catalogue.find((p) => p.id === productId);
  if (paused || !product || product.ordersPaused || !quantity(count)) return items;
  return normaliseCart([...items, { productId, variantId, quantity: count }], catalogue);
}

export function setQuantity(items: CartItem[], productId: string, variantId: string, count: number): CartItem[] {
  return items.map((item) => item.productId === productId && item.variantId === variantId
    ? { ...item, quantity: quantity(count) } : item).filter((item) => item.quantity > 0);
}
