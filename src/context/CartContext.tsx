import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { products, shopSettings } from '../data/catalogue';
import { addItem, CART_STORAGE_KEY, CART_LIFETIME_MS, TIMED_CART_STORAGE_KEY, restoreTimedCart, resolveCart, setQuantity } from '../lib/cart';
import type { CartItem, CartLine, StoredCart } from '../lib/cart';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  totalCents: number;
  storageWarning: boolean;
  add: (productId: string, variantId: string, quantity: number) => void;
  update: (productId: string, variantId: string, quantity: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): StoredCart {
  try { return restoreTimedCart(localStorage.getItem(TIMED_CART_STORAGE_KEY), products); }
  catch { return { items: [], expiresAt: 0 }; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState(readCart);
  const { items, expiresAt } = stored;
  const setItems = (change: (previous: CartItem[]) => CartItem[]) => setStored((previous) => ({
    items: change(previous.expiresAt > Date.now() ? previous.items : []),
    expiresAt: Date.now() + CART_LIFETIME_MS,
  }));
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      if (items.length) localStorage.setItem(TIMED_CART_STORAGE_KEY, JSON.stringify(stored));
      else localStorage.removeItem(TIMED_CART_STORAGE_KEY);
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  }, [stored, items]);

  useEffect(() => {
    if (!items.length) return;
    const timer = window.setTimeout(() => setStored({ items: [], expiresAt: 0 }), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [items, expiresAt]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TIMED_CART_STORAGE_KEY || event.key === null) setStored(readCart());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const lines = resolveCart(items, products);
  return <CartContext.Provider value={{
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    storageWarning,
    add: (productId, variantId, count) => setItems((previous) => addItem(previous, productId, variantId, count, products, shopSettings.ordersPaused)),
    update: (productId, variantId, count) => setItems((previous) => setQuantity(previous, productId, variantId, count)),
  }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('CartProvider ontbreekt');
  return context;
}
