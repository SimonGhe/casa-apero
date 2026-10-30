import { describe, expect, it } from 'vitest';
import { leadTime, products } from '../../src/data/catalogue';
import { addItem, MAX_QUANTITY, normaliseCart, parseCart, resolveCart, setQuantity } from '../../src/lib/cart';

const first = { productId: 'olive', variantId: 'olive-standard', quantity: 2 };

describe('cart restoration and pricing', () => {
  it('restores choices, discarding injected price fields and deriving totals from the catalogue', () => {
    const restored = parseCart(JSON.stringify([{ ...first, priceCents: 1, totalCents: 2 }]), products);
    expect(restored).toEqual([first]);
    expect(resolveCart(restored, products)[0].totalCents).toBe(1398);
  });

  it('recovers from corrupt or unexpected local storage', () => {
    for (const raw of ['{', 'null', 'false', '{}', '123', '"text"', '[null,42,"text"]']) {
      expect(parseCart(raw, products)).toEqual([]);
    }
  });

  it('drops removed products, old fictional selections, invalid variants and invalid quantities', () => {
    expect(normaliseCart([
      first,
      { ...first, productId: 'removed' },
      { productId: 'example-01', variantId: 'example-01-light', quantity: 2 },
      { ...first, variantId: 'dune-mini-standard' },
      { ...first, quantity: -1 },
      { ...first, quantity: Infinity },
      { ...first, quantity: '3' },
    ], products)).toEqual([first]);
  });

  it('merges duplicate choices and caps counts', () => {
    expect(addItem([first], first.productId, first.variantId, 4, products)[0].quantity).toBe(6);
    expect(normaliseCart([{ ...first, quantity: 90 }, { ...first, quantity: 30 }], products)[0].quantity).toBe(MAX_QUANTITY);
  });

  it('preserves future variant support using a test-only fixture', () => {
    const fixture = [{ ...products[0], variants: [
      ...products[0].variants,
      { id: 'test-only-variant', label: 'Test fixture', priceCents: 899 },
    ] }];
    const lines = resolveCart([
      first,
      { productId: 'olive', variantId: 'test-only-variant', quantity: 1 },
    ], fixture);
    expect(lines.map((line) => line.totalCents)).toEqual([1398, 899]);
  });

  it('blocks additions during a global or product pause without deducting any stock', () => {
    const pausedCatalogue = products.map((product) => ({ ...product, ordersPaused: product.id === 'olive' }));
    expect(addItem([first], first.productId, first.variantId, 1, products, true)).toEqual([first]);
    expect(addItem([first], 'olive', 'olive-standard', 1, pausedCatalogue)).toEqual([first]);
    expect(products.every((product) => !product.ordersPaused)).toBe(true);
  });

  it('removes only the chosen product and constrains manual quantity updates', () => {
    const second = { productId: 'dune-mini', variantId: 'dune-mini-standard', quantity: 1 };
    expect(setQuantity([first, second], first.productId, first.variantId, 0)).toEqual([second]);
    expect(setQuantity([first], first.productId, first.variantId, 4.8)[0].quantity).toBe(4);
    expect(setQuantity([first], first.productId, first.variantId, 999)[0].quantity).toBe(MAX_QUANTITY);
  });

  it('totals mixed orders in integer cents', () => {
    const lines = resolveCart([first, { productId: 'dune-grand', variantId: 'dune-grand-standard', quantity: 1 }], products);
    expect(lines.reduce((sum, line) => sum + line.totalCents, 0)).toBe(2697);
  });
});

describe('official catalogue', () => {
  it('has exactly the confirmed four products and prices, with no invented customer variants', () => {
    expect(products.map((product) => [product.name, product.variants[0].priceCents])).toEqual([
      ['Olive', 699], ['Dune Mini', 699], ['Dune Grand', 1299], ['Aperitivo', 2599],
    ]);
    for (const product of products) {
      expect(product.variants).toHaveLength(1);
      expect(product.variants[0].colour).toBeUndefined();
      expect(product.estimatedProductionDays).toBe(14);
      expect(product.images.length).toBeGreaterThan(1);
      expect(product.images.every((photo) => !photo.isPlaceholder)).toBe(true);
    }
    expect(leadTime(14)).toContain('ongeveer 2 weken');
  });
});
