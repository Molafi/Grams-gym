"use client";

import { useEffect } from "react";
import { cart } from "./cart-store";

export function ClearCart() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}
