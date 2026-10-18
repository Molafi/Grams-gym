"use client";

import { useEffect, useRef } from "react";
import { cart } from "./cart-store";
import { mergeCart, syncCart } from "./cart-actions";

/**
 * Signed-in users: merge the guest cart into the DB once, then mirror changes
 * to the DB (debounced). Guests: localStorage only.
 */
export function CartSync({ userId }: { userId: string | null }) {
  const merged = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || merged.current === userId) return;
    merged.current = userId;
    let skipNext = false;
    let timer: number | undefined;

    mergeCart(cart.get())
      .then((items) => {
        skipNext = true;
        cart.replace(items);
      })
      .catch(() => undefined);

    const unsubscribe = cart.subscribe(() => {
      if (skipNext) {
        skipNext = false;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        syncCart(cart.get()).catch(() => undefined);
      }, 600);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [userId]);

  return null;
}
