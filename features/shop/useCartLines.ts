"use client";

import { useEffect, useState } from "react";
import { useCart } from "./cart-store";
import { getCartLines } from "./cart-actions";
import type { PricedLine } from "./catalog";

/** Server-priced view of the local cart. Re-fetches whenever the cart changes. */
export function useCartLines() {
  const items = useCart();
  const [lines, setLines] = useState<PricedLine[] | null>(null);
  const key = JSON.stringify(items);

  useEffect(() => {
    let cancelled = false;
    getCartLines(JSON.parse(key))
      .then((l) => {
        if (!cancelled) setLines(l);
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { items, lines, loading: lines === null };
}
