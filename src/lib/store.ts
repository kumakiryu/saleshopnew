import { create } from 'zustand';
import type { Product, Announcement, CartItem, Order } from './types';

const LS_KEY_SEEN   = 'saleshop_announcements_seen_at';
const LS_KEY_CART   = 'saleshop_cart';

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY_CART) ?? '[]'); } catch { return []; }
}
function saveCart(items: CartItem[]) {
  localStorage.setItem(LS_KEY_CART, JSON.stringify(items));
}

interface AppStore {
  // Products
  products: Product[];
  setProducts: (products: Product[]) => void;
  upsertProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  // Announcements
  announcements: Announcement[];
  setAnnouncements: (a: Announcement[]) => void;
  upsertAnnouncement: (a: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  // Notification
  lastSeenAt: string;
  markSeen: () => void;
  // Cart
  cartItems: CartItem[];
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  cartCount: () => number;
  // Orders (admin)
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  // Products
  products: [],
  setProducts: (products) => set({ products }),
  upsertProduct: (product) =>
    set((s) => ({
      products: s.products.some((p) => p.id === product.id)
        ? s.products.map((p) => (p.id === product.id ? product : p))
        : [...s.products, product],
    })),
  removeProduct: (id) =>
    set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

  // Announcements
  announcements: [],
  setAnnouncements: (announcements) => set({ announcements }),
  upsertAnnouncement: (announcement) =>
    set((s) => ({
      announcements: s.announcements.some((a) => a.id === announcement.id)
        ? s.announcements.map((a) => (a.id === announcement.id ? announcement : a))
        : [announcement, ...s.announcements],
    })),
  removeAnnouncement: (id) =>
    set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) })),

  // Notification
  lastSeenAt: localStorage.getItem(LS_KEY_SEEN) ?? '',
  markSeen: () => {
    const now = new Date().toISOString();
    localStorage.setItem(LS_KEY_SEEN, now);
    set({ lastSeenAt: now });
  },

  // Cart
  cartItems: loadCart(),
  addToCart: (product, qty = 1) => {
    set((s) => {
      const existing = s.cartItems.find((i) => i.product.id === product.id);
      const next = existing
        ? s.cartItems.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: Math.min(i.quantity + qty, product.stock) }
              : i
          )
        : [...s.cartItems, { product, quantity: Math.min(qty, product.stock) }];
      saveCart(next);
      return { cartItems: next };
    });
  },
  removeFromCart: (productId) => {
    set((s) => {
      const next = s.cartItems.filter((i) => i.product.id !== productId);
      saveCart(next);
      return { cartItems: next };
    });
  },
  updateCartQty: (productId, qty) => {
    set((s) => {
      const next = qty <= 0
        ? s.cartItems.filter((i) => i.product.id !== productId)
        : s.cartItems.map((i) =>
            i.product.id === productId
              ? { ...i, quantity: Math.min(qty, i.product.stock) }
              : i
          );
      saveCart(next);
      return { cartItems: next };
    });
  },
  clearCart: () => { saveCart([]); set({ cartItems: [] }); },
  cartTotal: () => get().cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
  cartCount: () => get().cartItems.reduce((s, i) => s + i.quantity, 0),

  // Orders
  orders: [],
  setOrders: (orders) => set({ orders }),
  upsertOrder: (order) =>
    set((s) => ({
      orders: s.orders.some((o) => o.id === order.id)
        ? s.orders.map((o) => (o.id === order.id ? order : o))
        : [order, ...s.orders],
    })),
  removeOrder: (id) =>
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),
}));
