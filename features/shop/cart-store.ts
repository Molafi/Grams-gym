"use client";

import { useSyncExternalStore } from "react";

export type CartLineInput = { variantId: string; qty: number };

const KEY = "grams-cart-v1";
const MAX_QTY = 20;
const EMPTY: CartLineInput[] = [];

let items: CartLineInput[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function sanitize(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLineInput[] = [];
  for (const r of raw) {
    if (r && typeof r === "object" && typeof (r as CartLineInput).variantId === "string") {
      const qty = Math.floor(Number((r as CartLineInput).qty));
      if (qty > 0) out.push({ variantId: (r as CartLineInput).variantId, qty: Math.min(qty, MAX_QTY) });
    }
  }
  return out.slice(0, 50);
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    items = sanitize(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
  } catch {
    items = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      items = sanitize(JSON.parse(e.newValue ?? "[]"));
    } catch {
      items = EMPTY;
    }
    listeners.forEach((l) => l());
  });
}

function commit(next: CartLineInput[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  subscribe(listener: () => void) {
    load();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get(): CartLineInput[] {
    load();
    return items;
  },
  replace(next: CartLineInput[]) {
    commit(sanitize(next));
  },
  add(variantId: string, qty: number, maxStock: number) {
    const cap = Math.min(MAX_QTY, Math.max(0, maxStock));
    const existing = items.find((i) => i.variantId === variantId);
    const nextQty = Math.min(cap, (existing?.qty ?? 0) + qty);
    if (nextQty <= 0) return;
    commit(existing ? items.map((i) => (i.variantId === variantId ? { ...i, qty: nextQty } : i)) : [...items, { variantId, qty: nextQty }]);
  },
  setQty(variantId: string, qty: number) {
    if (qty <= 0) return cart.remove(variantId);
    commit(items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(qty, MAX_QTY) } : i)));
  },
  remove(variantId: string) {
    commit(items.filter((i) => i.variantId !== variantId));
  },
  clear() {
    commit(EMPTY);
  },
};

export function useCart(): CartLineInput[] {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((n, i) => n + i.qty, 0);
}
