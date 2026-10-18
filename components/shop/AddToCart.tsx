"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cart, useCart } from "@/features/shop/cart-store";
import { toast } from "@/components/ui/Toaster";
import { buttonClass } from "@/components/ui/Button";

export type VariantOption = {
  id: string;
  label: string;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  stock: number;
  sku: string;
};

/** Flies a small ember orb from the button to the cart icon (WAAPI, respects reduced motion). */
function flyToCart(from: HTMLElement) {
  const target = document.getElementById("cart-icon");
  if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const orb = document.createElement("div");
  orb.setAttribute("aria-hidden", "true");
  Object.assign(orb.style, {
    position: "fixed",
    left: `${a.left + a.width / 2 - 10}px`,
    top: `${a.top + a.height / 2 - 10}px`,
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    background: "radial-gradient(circle at 35% 35%, #ffd2a3, #ff7d09 60%, #b85400)",
    boxShadow: "0 0 24px rgba(255,125,9,.6)",
    zIndex: "95",
    pointerEvents: "none",
  });
  document.body.appendChild(orb);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = orb.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy - 120}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
    ],
    { duration: 900, easing: "cubic-bezier(.22,1,.36,1)" },
  );
  anim.onfinish = () => {
    orb.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
  };
}

export function AddToCart({ variants }: { variants: VariantOption[] }) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const items = useCart();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const btn = useRef<HTMLButtonElement>(null);

  const v = variants.find((x) => x.id === variantId);
  if (!v) return null;
  const inCart = items.find((i) => i.variantId === v.id)?.qty ?? 0;
  const maxAdd = Math.max(0, Math.min(20, v.stock) - inCart);
  const soldOut = v.stock <= 0;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <p className="display tabular text-4xl" aria-live="polite">
          {formatMoney(v.priceMinor, v.currency, locale)}
        </p>
        {v.compareAtMinor && v.compareAtMinor > v.priceMinor ? (
          <p className="tabular text-muted line-through">{formatMoney(v.compareAtMinor, v.currency, locale)}</p>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <fieldset className="mt-8">
          <legend className="mb-3 text-sm text-muted">
            {t("flavor")} / {t("size")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((opt) => (
              <label
                key={opt.id}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors duration-500 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember ${
                  opt.id === variantId ? "border-ember bg-ember/10 text-ink" : "border-hairline-strong text-muted hover:text-ink"
                } ${opt.stock <= 0 ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={opt.id}
                  checked={opt.id === variantId}
                  onChange={() => {
                    setVariantId(opt.id);
                    setQty(1);
                  }}
                  className="sr-only"
                />
                {opt.label}
                {opt.stock <= 0 ? ` · ${t("outOfStock")}` : ""}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-hairline-strong" role="group" aria-label={t("quantity")}>
          <button type="button" className="flex h-12 w-12 items-center justify-center text-muted hover:text-ink disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="−">
            <Minus className="h-4 w-4" />
          </button>
          <span className="tabular w-8 text-center" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="flex h-12 w-12 items-center justify-center text-muted hover:text-ink disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxAdd || 1, q + 1))} disabled={qty >= maxAdd} aria-label="+">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          ref={btn}
          type="button"
          disabled={soldOut || maxAdd <= 0}
          onClick={() => {
            cart.add(v.id, Math.min(qty, maxAdd), v.stock);
            if (btn.current) flyToCart(btn.current);
            toast(t("added"));
            setQty(1);
          }}
          className={buttonClass("primary", "lg", "flex-1 sm:flex-none")}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {soldOut ? t("outOfStock") : t("addToCart")}
        </button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {soldOut ? null : v.stock <= 5 ? <span className="text-warning">{t("lowStock", { count: v.stock })}</span> : t("inStock")}
        <span className="ms-3 text-xs" dir="ltr">
          {t("sku")}: {v.sku}
        </span>
      </p>
    </div>
  );
}
