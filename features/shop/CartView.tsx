"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMoney, lineTotal, sumMinor } from "@/lib/money";
import { Link } from "@/lib/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { PackArt } from "@/components/shop/PackArt";
import { cart } from "./cart-store";
import { useCartLines } from "./useCartLines";

export function CartView() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { lines, loading } = useCartLines();

  // Clamp local quantities to server stock; drop items that no longer exist.
  useEffect(() => {
    if (!lines) return;
    const current = cart.get();
    const known = new Set(lines.map((l) => l.variantId));
    let changed = current.some((i) => !known.has(i.variantId));
    const next = current
      .filter((i) => known.has(i.variantId))
      .map((i) => {
        const l = lines.find((x) => x.variantId === i.variantId)!;
        if (l.available && i.qty > l.stock) {
          changed = true;
          return { ...i, qty: l.stock };
        }
        return i;
      });
    if (changed) cart.replace(next);
  }, [lines]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">{t("empty")}</p>
        <Link href="/shop" className={buttonClass("primary", "md", "mt-6")}>
          {t("continue")}
        </Link>
      </div>
    );
  }

  const currency = lines[0]!.currency;
  const subtotal = sumMinor(lines.map((l) => lineTotal(l.unitMinor, l.qty)));
  const anyUnavailable = lines.some((l) => !l.available);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <ul className="space-y-3" aria-live="polite">
        {lines.map((l) => (
          <li key={l.variantId} className="card flex items-center gap-5 p-4">
            <div className="h-24 w-20 shrink-0 rounded-xl bg-surface-2">
              <PackArt shape={l.shape} labelColor={l.labelColor} accentColor={l.accentColor} brand={l.brand} className="h-full w-full text-ink" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/shop/${l.slug}`} className="line-clamp-1 font-medium hover:underline">
                {locale === "en" ? l.nameEn : l.nameAr}
              </Link>
              <p className="text-sm text-muted">{locale === "en" ? l.variantLabelEn : l.variantLabelAr}</p>
              {!l.available ? <p className="mt-1 text-sm text-danger">{t("unavailable")}</p> : null}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center rounded-full border border-hairline-strong">
                  <button type="button" aria-label="−" className="flex h-9 w-9 items-center justify-center text-muted hover:text-ink" onClick={() => cart.setQty(l.variantId, l.requestedQty - 1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="tabular w-6 text-center text-sm">{l.qty}</span>
                  <button
                    type="button"
                    aria-label="+"
                    className="flex h-9 w-9 items-center justify-center text-muted hover:text-ink disabled:opacity-40"
                    disabled={l.qty >= Math.min(l.stock, 20)}
                    onClick={() => cart.setQty(l.variantId, l.qty + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" onClick={() => cart.remove(l.variantId)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t("remove")}
                </button>
              </div>
            </div>
            <p className="tabular shrink-0 font-medium">{formatMoney(lineTotal(l.unitMinor, l.qty), l.currency, locale)}</p>
          </li>
        ))}
      </ul>
      <aside className="card h-fit p-6 lg:sticky lg:top-28">
        <div className="flex items-center justify-between">
          <span className="text-muted">{t("subtotal")}</span>
          <span className="display tabular text-2xl">{formatMoney(subtotal, currency, locale)}</span>
        </div>
        <Link
          href="/checkout"
          aria-disabled={anyUnavailable || subtotal === 0}
          className={buttonClass("primary", "lg", `mt-6 w-full ${anyUnavailable || subtotal === 0 ? "pointer-events-none opacity-45" : ""}`)}
        >
          {t("checkout")}
        </Link>
        <Link href="/shop" className="mt-4 block text-center text-sm text-muted hover:text-ink">
          {t("continue")}
        </Link>
      </aside>
    </div>
  );
}
