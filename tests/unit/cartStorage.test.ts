import { expect, it } from 'vitest';
import { products } from '../../src/data/catalogue';
import { CART_LIFETIME_MS, restoreTimedCart } from '../../src/lib/cart';

it('rejects expired, corrupt and implausibly long cart storage and strips extra fields', () => {
  const now = 1000;
  const items = [{ productId: 'olive', variantId: 'olive-standard', quantity: 2 }];
  for (const raw of [null, '{', 'null', '[]', JSON.stringify({ items, expiresAt: now }), JSON.stringify({ items, expiresAt: now + CART_LIFETIME_MS + 1 })]) {
    expect(restoreTimedCart(raw, products, now).items).toEqual([]);
  }
  expect(restoreTimedCart(JSON.stringify({ items: [{ ...items[0], email: 'discard', priceCents: 1 }], expiresAt: now + 100 }), products, now)).toEqual({ items, expiresAt: now + 100 });
});
