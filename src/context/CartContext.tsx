import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { products, shopSettings } from '../data/catalogue';
import { addItem, CART_STORAGE_KEY, parseCart, resolveCart, setQuantity } from '../lib/cart';
import type { CartItem, CartLine } from '../lib/cart';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  totalCents: number;
  storageWarning: boolean;
  add: (productId: string, variantId: string, quantity: number) => void;
  update: (productId: string, variantId: string, quantity: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try { return parseCart(localStorage.getItem(CART_STORAGE_KEY), products); }
  catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState(readCart);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  }, [items]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) setItems(readCart());
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
